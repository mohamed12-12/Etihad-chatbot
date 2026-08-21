const crypto = require("node:crypto");
const { isAudioLike, voiceReply } = require("./nonTextReply");
const { createMessageDeduper } = require("./messageDedupe");
const { waitBeforeReply } = require("./responseDelay");

function verifyMetaSignature({ rawBody, signatureHeader, appSecret }) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  if (!appSecret) return false;

  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signatureHeader);

  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractMessengerMessages(body) {
  const messages = [];

  for (const entry of asArray(body.entry)) {
    const pageId = String(entry.id || "");
    for (const event of asArray(entry.messaging)) {
      const text = event.message?.text || event.postback?.payload;
      const senderId = event.sender?.id;
      const messageId =
        event.message?.mid ||
        (event.postback ? `postback:${senderId}:${event.timestamp || ""}:${event.postback.payload || ""}` : "");

      if (!senderId || event.message?.is_echo) continue;
      if (!text && isAudioLike(event.message?.attachments)) {
        messages.push({ channel: "messenger", pageId, senderId, messageId, text: "", directReply: voiceReply() });
        continue;
      }
      if (!text) continue;
      messages.push({ channel: "messenger", pageId, senderId, messageId, text });
    }
  }

  return messages;
}

function extractInstagramMessages(body) {
  const messages = [];

  for (const entry of asArray(body.entry)) {
    const pageId = String(entry.id || "");
    for (const change of asArray(entry.changes)) {
      if (change.field !== "messages") continue;

      const value = change.value || {};
      const candidateMessages = asArray(value.messages || value.messaging);

      for (const message of candidateMessages) {
        const senderId = message.from?.id || message.sender?.id || value.sender?.id;
        const text = message.text?.body || message.message?.text || message.text;
        const messageId = message.id || message.mid || message.message?.mid || value.message_id || "";
        if (!senderId) continue;
        if (!text && isAudioLike(message)) {
          messages.push({ channel: "instagram", pageId, senderId, messageId, text: "", directReply: voiceReply() });
          continue;
        }
        if (!text) continue;
        messages.push({ channel: "instagram", pageId, senderId, messageId, text });
      }
    }
  }

  return messages;
}

function extractIncomingMessages(body) {
  return [...extractMessengerMessages(body), ...extractInstagramMessages(body)];
}

function createWebhookRouter({ config, historyStore, botClient, sendMetaMessage, pageStore, deduper = createMessageDeduper() }) {
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
      if (deduper.isDuplicate(incoming.messageId)) {
        console.warn("Skipping duplicate message:", incoming.messageId);
        continue;
      }

      const userKey = `${incoming.channel}:${incoming.pageId}:${incoming.senderId}`;
      const history = historyStore.get(userKey);
      await waitBeforeReply(config);
      const reply = incoming.directReply || (await botClient.generateReply({ pageId: incoming.pageId, userMessage: incoming.text, history }));

      try {
        await sendMetaMessage({
          channel: incoming.channel,
          pageId: incoming.pageId,
          recipientId: incoming.senderId,
          text: reply,
          config,
          pageStore,
        });

        historyStore.append(userKey, "user", incoming.text || "[voice note]");
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
