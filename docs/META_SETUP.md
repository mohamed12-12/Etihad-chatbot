# Connecting the Bot to Meta (Messenger + Instagram)

You said you already have the required Meta permissions — this is the remaining wiring
once the server is deployed and reachable at a public HTTPS URL.

## 1. Deploy the server first
Meta requires a live, publicly reachable HTTPS URL to configure a webhook — it will not
accept `localhost`. Deploy to any Node-friendly host (Render, Railway, a VPS, etc.)
before doing the steps below.

## 2. In Meta App Dashboard (developers.facebook.com)
1. Open your app → **Messenger** → **Settings**.
2. Under **Webhooks**, click **Add Callback URL**:
   - Callback URL: `https://Etihad.cvis.com.eg/webhook`
   - Verify Token: must exactly match `VERIFY_TOKEN` in your `.env`
3. Subscribe to these webhook fields at minimum: `messages`, `messaging_postbacks`.
4. Under **Access Tokens**, generate a Page Access Token for the Page connected to your
   Instagram Business account → put it in `PAGE_ACCESS_TOKEN`.
5. Under **App Settings → Basic**, copy the **App Secret** → put it in `APP_SECRET`.

## 3. Instagram
1. Confirm your Instagram account is a **Business or Creator account** and linked to
   the same Facebook Page.
2. In the app dashboard, under **Instagram → Settings**, subscribe the same webhook to
   Instagram messaging fields (`messages`).
3. In most setups the same `PAGE_ACCESS_TOKEN` works for both channels once linked; if
   Meta issues a separate token for Instagram, set `IG_PAGE_ACCESS_TOKEN` too.

## 4. Test the handshake
Meta will call `GET /webhook` with `hub.mode`, `hub.verify_token`, and `hub.challenge`
query params when you save the callback URL. The server must respond with the
`hub.challenge` value if `hub.verify_token` matches `VERIFY_TOKEN` — this confirms the
webhook is live before Meta will start sending real messages.

## 5. Go live
Once verification passes and fields are subscribed, send a test DM to the Page on both
Messenger and Instagram to confirm end-to-end replies work.
