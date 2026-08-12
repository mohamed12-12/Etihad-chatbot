# Jordan Company FAQ Chatbot — Project Handoff

This folder is a ready-to-build spec, not the finished app. Hand it to **Claude Code**
and it will build the working webhook server from these files.

## How to use this

1. Open this folder in Claude Code.
2. Say: *"Read CLAUDE.md and build this project."*
3. Before going live, fill in real data in
   `knowledge_base/company_info.json` (services, prices, locations, phone numbers,
   FAQs) — this is the only source of truth the bot is allowed to answer from.
4. Copy `.env.example` to `.env` and fill in your Meta tokens + Gemini API key.
5. Follow `docs/META_SETUP.md` to connect the deployed webhook to your Facebook Page
   and linked Instagram account.

## File map

| File | Purpose |
|---|---|
| `CLAUDE.md` | Full build instructions for Claude Code — read this first |
| `.env.example` | Every environment variable the app needs |
| `knowledge_base/company_info.json` | Fill this in with real company data |
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
