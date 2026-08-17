const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { createHistoryStore } = require("../src/history");
const { checkRelayToken, createRouterRelay, extractRelayMessages } = require("../src/routerRelay");

test("relay accepts common dashboard payload shapes", () => {
  assert.deepEqual(extractRelayMessages({ text: "hello", senderId: "u1", ownerId: "client1" }, "fallback"), [
    { channel: "instagram", pageId: "client1", senderId: "u1", text: "hello" },
  ]);
});

test("relay token can come from query, header, or bearer", () => {
  assert.equal(checkRelayToken({ get: () => "", query: { token: "secret" } }, "secret"), true);
  assert.equal(checkRelayToken({ get: (name) => (name === "x-router-token" ? "secret" : ""), query: {} }, "secret"), true);
  assert.equal(checkRelayToken({ get: () => "Bearer secret", query: {} }, "secret"), true);
  assert.equal(checkRelayToken({ get: () => "", query: {} }, "secret"), false);
});

test("POST /router-webhook/:clientId returns reply JSON without Meta send", async () => {
  const app = express();
  app.use(
    "/router-webhook",
    express.json(),
    createRouterRelay({
      config: { routerWebhookToken: "secret" },
      historyStore: createHistoryStore(),
      botClient: {
        generateReply: async ({ pageId, userMessage }) => `reply:${pageId}:${userMessage}`,
      },
    }),
  );

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/router-webhook/etihad?token=secret`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "مرحبا", senderId: "user-1" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.reply, "reply:etihad:مرحبا");
    assert.equal(body.responses[0].text, "reply:etihad:مرحبا");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("router webhook replies to voice payloads without calling AI", async () => {
  let calledAi = false;
  const app = express();
  app.use(
    "/router-webhook",
    express.json(),
    createRouterRelay({
      config: { routerWebhookToken: "" },
      historyStore: createHistoryStore(),
      botClient: {
        generateReply: async () => {
          calledAi = true;
          return "should not happen";
        },
      },
    }),
  );

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/router-webhook/etihad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderId: "user-1",
        message: { attachments: [{ type: "audio" }] },
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(calledAi, false);
    assert.match(body.reply, /تكتبلي سؤالك نص/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
