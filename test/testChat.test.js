const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");
const { createHistoryStore } = require("../src/history");
const { createTestChatRouter } = require("../src/testChat");

function readBody(response) {
  return new Promise((resolve) => {
    let data = "";
    response.on("data", (chunk) => {
      data += chunk;
    });
    response.on("end", () => resolve(data));
  });
}

test("POST /test-chat returns a bot reply and stores history", async () => {
  const historyStore = createHistoryStore();
  const app = express();
  app.use(
    "/test-chat",
    express.json(),
    createTestChatRouter({
      historyStore,
      botClient: {
        generateReply: async ({ userMessage }) => `reply to ${userMessage}`,
      },
    }),
  );

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/test-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "browser", message: "مرحبا" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { reply: "reply to مرحبا" });
    assert.deepEqual(historyStore.get("test:browser"), [
      { role: "user", content: "مرحبا" },
      { role: "assistant", content: "reply to مرحبا" },
    ]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("DELETE /test-chat/:userId clears local test history", async () => {
  const historyStore = createHistoryStore();
  historyStore.append("test:browser", "user", "hello");

  const app = express();
  app.use(
    "/test-chat",
    express.json(),
    createTestChatRouter({
      historyStore,
      botClient: { generateReply: async () => "ok" },
    }),
  );

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const response = await new Promise((resolve, reject) => {
      const request = http.request(
        `http://127.0.0.1:${port}/test-chat/browser`,
        { method: "DELETE" },
        resolve,
      );
      request.on("error", reject);
      request.end();
    });
    await readBody(response);

    assert.equal(response.statusCode, 204);
    assert.deepEqual(historyStore.get("test:browser"), []);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
