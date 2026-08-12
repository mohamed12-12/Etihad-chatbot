# Architecture

```
Instagram DM ──┐
               ├──► Meta Graph API ──► POST /webhook ──► Express server
Messenger ─────┘                                              │
                                                                ▼
                                                    Load knowledge_base/company_info.json
                                                    Load prompts/system_prompt.md
                                                    Add last ~6 turns of history for this user
                                                                │
                                                                ▼
                                                        Gemini API
                                                                │
                                                                ▼
                                                          Reply text
                                                                │
                                                                ▼
                                                Meta Graph API "send message" call
                                                                │
                                                                ▼
                                                    Back to Instagram / Messenger
```

## Flow, step by step

1. Meta sends a `POST /webhook` request whenever a customer messages the Page or its
   linked Instagram account.
2. The server verifies the request signature using `APP_SECRET`.
3. The server figures out which channel it came from (Messenger `messaging` array vs
   Instagram `changes` array) and extracts: sender ID, message text.
4. The server pulls that sender's recent short history from the in-memory store.
5. The server builds the Gemini API request:
   - `system` = `prompts/system_prompt.md` with the knowledge base injected
   - `messages` = history + new message
6. Gemini returns a reply. The server sends it back via the matching Graph API
   endpoint (Messenger Send API or Instagram Send API — same shape, different
   recipient field).
7. The server updates the in-memory history for that sender.

## Why no database for v1

The scope is a FAQ bot, not a CRM. In-memory history is enough to keep a conversation
coherent for a session; losing it on a server restart is an acceptable tradeoff for how
small this project is. If the company later wants conversation logs, analytics, or
persistent memory across sessions, that's a clearly separable v2 addition — add a
Postgres or SQLite table for messages at that point, don't build it preemptively.

## Where the "no hallucination" guarantee actually lives

It's enforced in two places, not one:
1. **The system prompt** explicitly instructs the model to only state facts present in
   the injected knowledge base JSON, and gives it a safe fallback behavior.
2. **The knowledge base itself** is the only source injected into context — the model
   is never given open-ended access to the internet or any other data source, so there
   is nothing else for it to answer from besides its instructions and the KB.

Keeping the knowledge base accurate and complete is the main lever the company has to
keep answers accurate — this is a content maintenance task, not just a code one.
