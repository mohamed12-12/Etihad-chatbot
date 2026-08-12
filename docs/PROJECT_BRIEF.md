# Project Brief — Jordan Company FAQ Chatbot

## What this is

A small, focused chatbot that answers frequently asked questions about a company based
in Jordan: what services it offers, how much they cost, where it's located, and how to
contact it. It runs on **Instagram DM** and **Facebook Messenger**.

## Who it's for

Customers messaging the company's Instagram or Facebook Page with common questions
that currently get answered manually and repeatedly by staff.

## Languages

- Jordanian colloquial Arabic (primary)
- Modern Standard Arabic (for more formal questions)
- English

The bot detects the customer's language from their message and replies in kind — no
menu, no toggle.

## Core requirement: accuracy over cleverness

This bot must never make up information. It only knows what's in the company
knowledge base file. Anything outside that scope gets an honest "let me connect you
with our team" response with the real contact number. This matters more than the bot
sounding impressive — wrong prices or wrong addresses cost real trust and real money.

## Tone

Friendly and human. Should feel like messaging a helpful team member, not filling out
a form or talking to an obvious script.

## Channels

- Instagram Direct Messages (via Meta Graph API, Instagram Business account linked to
  a Facebook Page)
- Facebook Messenger (same Page)

Both are handled through one webhook, since Meta routes both through the same
Graph API infrastructure once the accounts are linked.

## Out of scope for v1

- Bookings, payments, or any transactional action
- Admin dashboard or analytics
- Multi-company / multi-tenant support
- Long-term conversation memory beyond the current chat session

## What the company needs to provide before launch

Fill in each connected client's knowledge base from `/pages`:
- Company name and short description (Arabic + English)
- All services with accurate pricing and details
- All branch locations with addresses and maps links
- Phone numbers, WhatsApp, email, working hours
- Common FAQ pairs the team already gets asked

The more complete each client's file is, the fewer questions get bounced to a human.
