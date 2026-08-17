const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const test = require("node:test");
const express = require("express");
const { createHistoryStore } = require("../src/history");
const { createWebhookRouter, extractIncomingMessages, verifyMetaSignature } = require("../src/webhook");

test("validates Meta sha256 signatures", () => {
  const rawBody = Buffer.from(JSON.stringify({ object: "page" }));
  const appSecret = "test-secret";
  const signatureHeader = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;

  assert.equal(verifyMetaSignature({ rawBody, signatureHeader, appSecret }), true);
  assert.equal(verifyMetaSignature({ rawBody, signatureHeader: "sha256=bad", appSecret }), false);
});

test("extracts Messenger text messages", () => {
  const body = {
    object: "page",
    entry: [
      {
        messaging: [
          {
            sender: { id: "PSID_1" },
            message: { text: "مرحبا" },
          },
        ],
      },
    ],
  };

  assert.deepEqual(extractIncomingMessages(body), [
    { channel: "messenger", pageId: "", senderId: "PSID_1", text: "مرحبا" },
  ]);
});

test("extracts Messenger messages when entry and messaging are single objects", () => {
  const body = {
    object: "page",
    entry: {
      id: "PAGE_1",
      messaging: {
        sender: { id: "PSID_1" },
        message: { text: "مرحبا" },
      },
    },
  };

  assert.deepEqual(extractIncomingMessages(body), [
    { channel: "messenger", pageId: "PAGE_1", senderId: "PSID_1", text: "مرحبا" },
  ]);
});

test("extracts Instagram messages payloads", () => {
  const body = {
    object: "instagram",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              messages: [
                {
                  from: { id: "IGSID_1" },
                  text: { body: "How much?" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  assert.deepEqual(extractIncomingMessages(body), [
    { channel: "instagram", pageId: "", senderId: "IGSID_1", text: "How much?" },
  ]);
});

test("GET /webhook returns Meta challenge for matching verify token", async () => {
  const app = express();
  app.use(
    "/webhook",
    createWebhookRouter({
      config: { verifyToken: "verify-me" },
      historyStore: createHistoryStore(),
      botClient: { generateReply: async () => "ok" },
      sendMetaMessage: async () => ({}),
    }),
  );

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const response = await new Promise((resolve, reject) => {
      http
        .get(
          `http://127.0.0.1:${port}/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc123`,
          resolve,
        )
        .on("error", reject);
    });

    const body = await new Promise((resolve) => {
      let data = "";
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => resolve(data));
    });

    assert.equal(response.statusCode, 200);
    assert.equal(body, "abc123");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /webhook passes Meta entry page ID into the bot client", async () => {
  const appSecret = "secret";
  const rawBody = Buffer.from(
    JSON.stringify({
      object: "page",
      entry: [
        {
          id: "PAGE_ABC",
          messaging: [
            {
              sender: { id: "PSID_1" },
              message: { text: "مرحبا" },
            },
          ],
        },
      ],
    }),
  );
  const signatureHeader = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  let seenPageId = "";

  const app = express();
  app.use(
    "/webhook",
    express.raw({ type: "application/json" }),
    createWebhookRouter({
      config: { appSecret, verifyToken: "verify" },
      historyStore: createHistoryStore(),
      botClient: {
        generateReply: async ({ pageId }) => {
          seenPageId = pageId;
          return "ok";
        },
      },
      sendMetaMessage: async () => ({}),
      pageStore: { get: () => ({ pageAccessToken: "token" }) },
    }),
  );

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signatureHeader,
      },
      body: rawBody,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(response.status, 200);
    assert.equal(seenPageId, "PAGE_ABC");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("extracts Messenger voice notes as direct replies", () => {
  const body = {
    object: "page",
    entry: [
      {
        id: "PAGE_1",
        messaging: [
          {
            sender: { id: "PSID_1" },
            message: {
              attachments: [{ type: "audio", payload: { url: "https://example.com/voice.ogg" } }],
            },
          },
        ],
      },
    ],
  };

  const [message] = extractIncomingMessages(body);
  assert.equal(message.channel, "messenger");
  assert.equal(message.pageId, "PAGE_1");
  assert.equal(message.senderId, "PSID_1");
  assert.match(message.directReply, /تكتبلي سؤالك نص/);
});
