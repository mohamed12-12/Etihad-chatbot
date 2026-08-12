# CLAUDE.md — Build Instructions for Claude Code

You are building a small, production-ready FAQ chatbot for a company based in Jordan.
It answers repeated questions about the company: services offered, prices, details,
locations, and contact numbers. It replies on **Facebook Messenger** and **Instagram DM**
via the Meta Graph API (the user already has all required Meta permissions/tokens).

Read this whole file before writing code. Keep the implementation small and boring —
this is explicitly a *small task*, not a platform. Do not over-engineer.

---

## 1. Goal

- A webhook server that receives messages from Messenger + Instagram (both go through
  the same Meta Graph API / same webhook endpoint when the IG account is linked to the
  Facebook Page).
- On each incoming message, the server calls the Gemini API with:
  - a fixed system prompt (see `prompts/system_prompt.md`)
  - the company knowledge base (see `knowledge_base/company_info.json`)
  - the user's message + short recent history (last ~6 messages, in memory or a simple
    DB row — no need for anything heavy)
- The reply is sent back to the same channel (Messenger or Instagram) via the Graph API.
- The bot must reply in **Arabic (Jordanian dialect)** by default, or **English** if the
  user writes in English. Never mix broken/formal MSA that feels robotic — see the
  system prompt for tone rules.

## 2. Hard requirements (do not skip these)

1. **No hallucination.** The bot must only state facts that exist in
   `knowledge_base/company_info.json`. If the answer isn't in the knowledge base, it
   must say so naturally and offer the human contact number, never invent a price,
   service, location, or policy. This rule lives in the system prompt — keep it intact
   when you edit anything.
2. **Trilingual by user choice**, not a language switcher UI: Arabic (Jordanian
   colloquial) primary, MSA fallback for formal questions, English if the user types in
   English. Detect language from the incoming message itself, not from any stored
   setting.
3. **Sounds human, not scripted.** Short, warm, natural replies. No numbered corporate
   answers unless the user is asking to compare options. No "I am an AI language
   model" disclaimers. It's fine for it to say it's the company's virtual assistant if
   asked directly.
4. **One webhook, two channels.** Messenger and Instagram both call the same
   `/webhook` endpoint (Meta merges these when the IG business account is linked to the
   Page). Detect the channel from the payload (`entry[].messaging` vs
   `entry[].changes` with `field: "messages"` for IG) and reply through the matching
   Graph API call.
5. **Secrets only in `.env`.** Never hardcode tokens. Use `.env.example` as the
   contract for what must be set.
6. **Webhook verification** (Meta's `GET /webhook` handshake with `hub.verify_token`)
   must be implemented correctly or Meta will refuse to activate the integration.
7. **Signature validation** on incoming `POST /webhook` using `APP_SECRET`
   (`X-Hub-Signature-256` header) — reject unsigned/invalid requests.

## 3. Tech stack

- Node.js + Express (simplest for Meta webhooks, huge amount of reference code exists,
  fast to stand up).
- Gemini API over its REST `generateContent` endpoint.
- Plain JSON file for the knowledge base (`knowledge_base/company_info.json`). No
  database needed for v1 — this is explicitly small in scope. If the user later wants
  logging/analytics, that's a v2 add-on, not part of this build.
- In-memory `Map` for per-user short conversation history (keyed by PSID/IGSID), capped
  at last ~6 turns, cleared after a period of inactivity (e.g. 30 min). Fine to lose on
  server restart — this is a FAQ bot, not a CRM.
- dotenv for config.

## 4. Project structure to create

```
/
├── .env.example
├── .env                  (gitignored, user fills this in)
├── .gitignore
├── package.json
├── server.js             (Express app entrypoint)
├── src/
│   ├── webhook.js         (GET verify + POST receive, signature check)
│   ├── meta.js            (send message to Messenger/IG via Graph API)
│   ├── gemini.js          (calls Gemini API with system prompt + KB + history)
│   ├── history.js         (in-memory per-user short history store)
│   └── languageHint.js    (lightweight helper: detect Arabic vs English script to
│                            pick reply language hint passed to Gemini — Gemini does
│                            the real language judgment, this is just a fast pre-check)
├── knowledge_base/
│   └── company_info.json  (see template — user fills real data in here)
├── prompts/
│   └── system_prompt.md   (loaded at startup, sent as the system prompt every call)
└── docs/
    ├── PROJECT_BRIEF.md
    ├── ARCHITECTURE.md
    └── META_SETUP.md       (write this: step-by-step for connecting the webhook in
                              Meta Developer Console, since the user says they already
                              have permissions but still needs to wire up the webhook
                              URL + subscribe fields: messages, messaging_postbacks)
```

## 5. Gemini API call shape

- Model: value of `GEMINI_MODEL` env var (default `gemini-3.6-flash` if unset).
- `systemInstruction`: contents of `prompts/system_prompt.md` with `{{KNOWLEDGE_BASE}}`
  replaced by the JSON-stringified knowledge base.
- `messages`: last ~6 turns of history + the new user message.
- Keep `max_tokens` modest (400–600) — these are chat replies, not essays.
- On any API error, fall back to a friendly generic message in the user's detected
  language ("we're having a small technical hiccup, please try again in a bit / بنعتذر
  في مشكلة تقنية بسيطة، جرب بعد شوي") rather than crashing or leaking an error to the
  user.

## 6. What NOT to build

- No admin dashboard, no auth system, no database migrations, no multi-tenant support.
- No RAG/vector search — the knowledge base is small enough to pass in full every call.
- No language-switch button — language is inferred per message.
- No payment/booking flow — this bot answers questions, it doesn't take actions.

## 7. Acceptance checklist before calling this done

- [ ] `GET /webhook` verification handshake works with Meta's test call.
- [ ] `POST /webhook` validates `X-Hub-Signature-256` and rejects bad signatures.
- [ ] A message in Jordanian Arabic gets a natural Jordanian Arabic reply.
- [ ] A message in English gets an English reply.
- [ ] Asking about a service/price/location that IS in the knowledge base returns the
      correct answer with no invented details.
- [ ] Asking something NOT in the knowledge base gets an honest "I don't have that,
      here's our number" style answer — never a guess.
- [ ] Same code path handles both a Messenger PSID message and an Instagram IGSID
      message.
- [ ] `.env.example` lists every variable actually used in the code — no orphans, no
      missing ones.
- [ ] `docs/META_SETUP.md` has clear steps for the user to paste in their webhook URL
      and subscribe the Page/IG app to the right webhook fields.

Build it in that order: webhook skeleton + verification → Meta send/receive plumbing →
Gemini integration + system prompt wiring → knowledge base loading → history → polish
docs. Test each stage before moving to the next.
