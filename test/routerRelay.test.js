const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { createHistoryStore } = require("../src/history");
const {
  checkRelayToken,
  createRouterRelay,
  extractRelayMessages,
  extractResponseWebhook,
  normalizeRelayReply,
} = require("../src/routerRelay");

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

test("extracts response webhook from common Nanovate payload fields", () => {
  assert.equal(extractResponseWebhook({ response_webhook: "https://example.com/a" }), "https://example.com/a");
  assert.equal(extractResponseWebhook({ bridge: { responseWebhook: "https://example.com/b" } }), "https://example.com/b");
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

test("router webhook posts reply to Nanovate response webhook when provided", async () => {
  const callbacks = [];
  const app = express();
  app.use(
    "/router-webhook",
    express.json(),
    createRouterRelay({
      config: { routerWebhookToken: "" },
      historyStore: createHistoryStore(),
      botClient: {
        generateReply: async ({ userMessage }) => `reply:${userMessage}`,
      },
      fetchImpl: async (url, options) => {
        callbacks.push({ url, body: JSON.parse(options.body) });
        return { ok: true };
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
        channel: "instagram",
        senderId: "user-1",
        text: "مرحبا",
        response_webhook: "https://demos.nanovate.io/instagram/webhook/response",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    // Reply goes out on the response webhook only, so the router does not send it twice.
    assert.equal(body.reply, undefined);
    assert.equal(body.ok, true);
    assert.equal(callbacks.length, 1);
    assert.equal(callbacks[0].url, "https://demos.nanovate.io/instagram/webhook/response");
    assert.equal(callbacks[0].body.text, "reply:مرحبا");
    assert.equal(callbacks[0].body.reply, "reply:مرحبا");
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

test("router webhook returns a safe JSON reply when bot generation fails", async () => {
  const app = express();
  app.use(
    "/router-webhook",
    express.json(),
    createRouterRelay({
      config: { routerWebhookToken: "" },
      historyStore: createHistoryStore(),
      botClient: {
        generateReply: async () => {
          throw new Error("boom");
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
      body: JSON.stringify({ text: "هلا", senderId: "user-1", channel: "instagram" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.doesNotMatch(body.reply, /<!DOCTYPE html|Internal Server Error/i);
    assert.match(body.reply, /خلل بسيط/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("router relay normalizes accidental HTML replies", () => {
  const reply = normalizeRelayReply("<!DOCTYPE html><html><body><pre>Internal Server Error</pre></body></html>", "instagram");
  assert.match(reply, /خلل بسيط/);
});
