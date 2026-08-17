const crypto = require("node:crypto");
const { waitBeforeReply } = require("./responseDelay");

function verifyMetaSignature({ rawBody, signatureHeader, appSecret }) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  if (!appSecret) return false;

  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signatureHeader);

  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function extractMessengerMessages(body) {
  const messages = [];

  for (const entry of body.entry || []) {
    const pageId = String(entry.id || "");
    for (const event of entry.messaging || []) {
      const text = event.message?.text || event.postback?.payload;
      const senderId = event.sender?.id;

      if (!senderId || !text || event.message?.is_echo) continue;
      messages.push({ channel: "messenger", pageId, senderId, text });
    }
  }

  return messages;
}

function extractInstagramMessages(body) {
  const messages = [];

  for (const entry of body.entry || []) {
    const pageId = String(entry.id || "");
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;

      const value = change.value || {};
      const candidateMessages = value.messages || value.messaging || [];

      for (const message of candidateMessages) {
        const senderId = message.from?.id || message.sender?.id || value.sender?.id;
        const text = message.text?.body || message.message?.text || message.text;
        if (!senderId || !text) continue;
        messages.push({ channel: "instagram", pageId, senderId, text });
      }
    }
  }

  return messages;
}

function extractIncomingMessages(body) {
  return [...extractMessengerMessages(body), ...extractInstagramMessages(body)];
}

function createWebhookRouter({ config, historyStore, botClient, sendMetaMessage, pageStore }) {
  const express = require("express");
  const router = express.Router();

  router.get("/", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === config.verifyToken) {
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  });

  router.post("/", async (req, res) => {
    const rawBody = req.body;
    const signatureHeader = req.get("x-hub-signature-256");

    if (!verifyMetaSignature({ rawBody, signatureHeader, appSecret: config.appSecret })) {
      return res.sendStatus(401);
    }

    let body;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.sendStatus(400);
    }

    const incomingMessages = extractIncomingMessages(body);
    res.sendStatus(200);

    for (const incoming of incomingMessages) {
      const userKey = `${incoming.channel}:${incoming.pageId}:${incoming.senderId}`;
      const history = historyStore.get(userKey);
      await waitBeforeReply(config);
      const reply = await botClient.generateReply({ pageId: incoming.pageId, userMessage: incoming.text, history });

      try {
        await sendMetaMessage({
          channel: incoming.channel,
          pageId: incoming.pageId,
          recipientId: incoming.senderId,
          text: reply,
          config,
          pageStore,
        });

        historyStore.append(userKey, "user", incoming.text);
        historyStore.append(userKey, "assistant", reply);
      } catch (error) {
        console.error("Meta send error:", error);
      }
    }
  });

  return router;
}

module.exports = {
  createWebhookRouter,
  extractIncomingMessages,
  verifyMetaSignature,
};
