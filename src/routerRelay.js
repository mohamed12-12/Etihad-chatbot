const { extractIncomingMessages } = require("./webhook");
const { isAudioLike, voiceReply } = require("./nonTextReply");
const { waitBeforeReply } = require("./responseDelay");

function safeErrorReply(channel) {
  if (channel === "messenger" || channel === "instagram") {
    return "بنعتذر، صار خلل بسيط. جرّب تبعتلنا كمان شوي.";
  }

  return "Sorry, something went wrong. Please try again in a bit.";
}

function normalizeRelayReply(reply, channel) {
  const text = String(reply || "").trim();

  if (!text || /^<!doctype html/i.test(text) || /<html[\s>]/i.test(text) || /Internal Server Error/i.test(text)) {
    return safeErrorReply(channel);
  }

  return text.slice(0, 950);
}

function extractResponseWebhook(body = {}) {
  return (
    body.response_webhook ||
    body.responseWebhook ||
    body.response_url ||
    body.responseUrl ||
    body.reply_webhook ||
    body.replyWebhook ||
    body.bridge?.response_webhook ||
    body.bridge?.responseWebhook ||
    ""
  );
}

async function postResponseWebhook({ responseWebhook, response, fetchImpl }) {
  if (!responseWebhook) return;

  const payload = {
    text: response.reply,
    reply: response.reply,
    message: { text: response.reply },
    channel: response.channel,
    pageId: response.pageId,
    senderId: response.senderId,
  };

  const callbackResponse = await fetchImpl(responseWebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!callbackResponse.ok) {
    const body = await callbackResponse.text().catch(() => "");
    throw new Error(`Router response webhook failed (${callbackResponse.status}): ${body}`);
  }
}

function checkRelayToken(req, token) {
  if (!token) return true;

  const headerToken = req.get("x-router-token") || "";
  const bearer = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const queryToken = req.query.token || "";

  return headerToken === token || bearer === token || queryToken === token;
}

function extractRelayMessages(body, fallbackClientId) {
  const metaMessages = extractIncomingMessages(body);
  if (metaMessages.length) {
    return metaMessages.map((message) => ({
      ...message,
      pageId: message.pageId || fallbackClientId,
    }));
  }

  const rawText =
    body.message?.text ||
    body.text ||
    body.body ||
    body.content ||
    body.payload?.text ||
    body.payload?.message;
  const text = typeof rawText === "string" ? rawText : "";
  const senderId =
    body.sender?.id ||
    body.senderId ||
    body.userId ||
    body.from?.id ||
    body.ownerId ||
    body.accountId ||
    "router-user";
  const pageId = body.pageId || body.ownerId || body.accountId || fallbackClientId;
  const channel = body.channel || "instagram";

  if (!text && isAudioLike(body)) {
    return [{ channel, pageId: String(pageId), senderId: String(senderId), text: "", directReply: voiceReply() }];
  }
  if (!text) return [];
  return [{ channel, pageId: String(pageId), senderId: String(senderId), text: String(text) }];
}

function createRouterRelay({ config, historyStore, botClient, fetchImpl = fetch }) {
  const express = require("express");
  const router = express.Router();

  async function handleRelay(req, res) {
    try {
      if (!checkRelayToken(req, config.routerWebhookToken)) {
        return res.sendStatus(401);
      }

      const fallbackClientId = req.params.clientId || config.routerDefaultClientId || "default";
      const messages = extractRelayMessages(req.body || {}, fallbackClientId);
      const responseWebhook = extractResponseWebhook(req.body || {});

      if (!messages.length) {
        return res.status(400).json({ error: "No message text found in payload." });
      }

      const responses = [];
      for (const incoming of messages) {
        const userKey = `router:${incoming.channel}:${incoming.pageId}:${incoming.senderId}`;
        const history = historyStore.get(userKey);
        await waitBeforeReply(config);
        const generatedReply =
          incoming.directReply ||
          (await botClient.generateReply({
            pageId: incoming.pageId,
            userMessage: incoming.text,
            history,
          }));
        const reply = normalizeRelayReply(generatedReply, incoming.channel);

        historyStore.append(userKey, "user", incoming.text || "[voice note]");
        historyStore.append(userKey, "assistant", reply);
        const response = {
          channel: incoming.channel,
          pageId: incoming.pageId,
          senderId: incoming.senderId,
          reply,
          text: reply,
        };
        responses.push(response);

        try {
          await postResponseWebhook({ responseWebhook, response, fetchImpl });
        } catch (error) {
          console.error("Router response webhook error:", error);
        }
      }

      return res.status(200).json({
        reply: responses[0].reply,
        text: responses[0].reply,
        responses,
      });
    } catch (error) {
      console.error("Router relay error:", error);
      const reply = safeErrorReply(req.body?.channel || "instagram");
      return res.status(200).json({
        reply,
        text: reply,
        responses: [{ channel: req.body?.channel || "instagram", reply, text: reply }],
      });
    }
  }

  router.post("/", handleRelay);
  router.post("/:clientId", handleRelay);

  return router;
}

module.exports = {
  checkRelayToken,
  createRouterRelay,
  extractRelayMessages,
  extractResponseWebhook,
  normalizeRelayReply,
  postResponseWebhook,
  safeErrorReply,
};
