const { extractIncomingMessages } = require("./webhook");
const { isAudioLike, voiceReply } = require("./nonTextReply");
const { waitBeforeReply } = require("./responseDelay");

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

function createRouterRelay({ config, historyStore, botClient }) {
  const express = require("express");
  const router = express.Router();

  async function handleRelay(req, res) {
    if (!checkRelayToken(req, config.routerWebhookToken)) {
      return res.sendStatus(401);
    }

    const fallbackClientId = req.params.clientId || config.routerDefaultClientId || "default";
    const messages = extractRelayMessages(req.body || {}, fallbackClientId);

    if (!messages.length) {
      return res.status(400).json({ error: "No message text found in payload." });
    }

    const responses = [];
    for (const incoming of messages) {
      const userKey = `router:${incoming.channel}:${incoming.pageId}:${incoming.senderId}`;
      const history = historyStore.get(userKey);
      await waitBeforeReply(config);
      const reply =
        incoming.directReply ||
        (await botClient.generateReply({
          pageId: incoming.pageId,
          userMessage: incoming.text,
          history,
        }));

      historyStore.append(userKey, "user", incoming.text || "[voice note]");
      historyStore.append(userKey, "assistant", reply);
      responses.push({
        channel: incoming.channel,
        pageId: incoming.pageId,
        senderId: incoming.senderId,
        reply,
        text: reply,
      });
    }

    return res.status(200).json({
      reply: responses[0].reply,
      text: responses[0].reply,
      responses,
    });
  }

  router.post("/", handleRelay);
  router.post("/:clientId", handleRelay);

  return router;
}

module.exports = { checkRelayToken, createRouterRelay, extractRelayMessages };
