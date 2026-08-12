# Jordan Company FAQ Chatbot — Project Handoff

This folder is a ready-to-build spec, not the finished app. Hand it to **Claude Code**
and it will build the working webhook server from these files.

## How to use this

1. Open this folder in Claude Code.
2. Say: *"Read CLAUDE.md and build this project."*
3. Before going live, fill each connected client's knowledge base from `/pages`.
   `knowledge_base/company_info.json` is now the base template for new clients.
4. Copy `.env.example` to `.env` and fill in your Meta tokens + Gemini API key.
5. Follow `docs/META_SETUP.md` to connect the deployed webhook to your Facebook Page
   and linked Instagram account.

## Local test UI

Run `npm start` and open `http://127.0.0.1:3000/` to chat with the bot locally.
The UI uses the same Gemini prompt, knowledge base, and in-memory history as the Meta
webhook path.

## Central multi-page webhook

Use one Meta callback URL for every Page:

```text
https://Etihad.cvis.com.eg/webhook
```

Set `ADMIN_PASSWORD` in `.env`, then open `https://Etihad.cvis.com.eg/pages` to add
each Page ID and Page Access Token. The webhook reads Meta's `entry.id` and sends the
reply using the matching saved token.

Clients can also self-connect at:

```text
https://Etihad.cvis.com.eg/connect
```

OAuth saves the Page ID/token automatically and creates a per-page knowledge base at
`data/knowledge_bases/{pageId}.json`. Admins edit each client's KB from `/pages`.

## File map

| File | Purpose |
|---|---|
| `CLAUDE.md` | Full build instructions for Claude Code — read this first |
| `.env.example` | Every environment variable the app needs |
| `knowledge_base/company_info.json` | Base template used to create per-client KB files |
| `prompts/system_prompt.md` | The bot's personality + anti-hallucination rules |
| `docs/PROJECT_BRIEF.md` | Plain-language project scope |
| `docs/ARCHITECTURE.md` | How the pieces fit together |
| `docs/META_SETUP.md` | Steps to connect Messenger + Instagram webhooks |

## Design principles baked into this spec

- **No hallucination**: the bot only answers from the knowledge base file, and admits
  when it doesn't know something instead of guessing.
- **Trilingual by detection**: Jordanian Arabic, MSA, and English — matched to
  whatever the customer writes, no language menu.
- **Sounds human**: short, warm replies, no robotic disclaimers.
- **Small and boring on purpose**: no database, no dashboard, no auth system — this is
  a FAQ bot, and the architecture reflects that on purpose so it ships fast and stays
  easy to maintain.
