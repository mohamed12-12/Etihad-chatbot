const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const express = require("express");
const { createConnectRouter, saveConnectedPage } = require("../src/connect");
const { createKnowledgeBaseStore } = require("../src/knowledgeBaseStore");
const { createPageStore } = require("../src/pageStore");

function tempStores() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "connect-"));
  return {
    knowledgeBaseStore: createKnowledgeBaseStore({
      baseTemplatePath: path.resolve("./knowledge_base/company_info.json"),
      directoryPath: path.join(dir, "knowledge_bases"),
    }),
    pageStore: createPageStore(path.join(dir, "pages.json")),
  };
}

test("OAuth save writes page schema and creates per-page knowledge base", () => {
  const { pageStore, knowledgeBaseStore } = tempStores();

  saveConnectedPage({
    page: { id: "PAGE_123", name: "Client Page", access_token: "page-token" },
    pageStore,
    knowledgeBaseStore,
  });

  assert.equal(pageStore.get("PAGE_123").name, "Client Page");
  assert.equal(pageStore.get("PAGE_123").pageAccessToken, "page-token");
  assert.equal(knowledgeBaseStore.exists("PAGE_123"), true);
});

test("/connect is public while /pages-style admin protection is separate", async () => {
  const { pageStore, knowledgeBaseStore } = tempStores();
  const app = express();
  app.use(
    "/connect",
    createConnectRouter({
      config: {
        metaAppId: "app",
        metaAppSecret: "secret",
        oauthRedirectUri: "https://example.com/connect/callback",
        metaGraphVersion: "v23.0",
      },
      pageStore,
      knowledgeBaseStore,
      fetchImpl: async () => {
        throw new Error("not used");
      },
    }),
  );

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/connect`);
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.match(text, /Connect your page/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("OAuth callback exchanges code, extracts page, and writes pages.json schema", async () => {
  const { pageStore, knowledgeBaseStore } = tempStores();
  const calls = [];
  const app = express();
  app.use(
    "/connect",
    createConnectRouter({
      config: {
        metaAppId: "app",
        metaAppSecret: "secret",
        oauthRedirectUri: "https://example.com/connect/callback",
        metaGraphVersion: "v23.0",
      },
      pageStore,
      knowledgeBaseStore,
      fetchImpl: async (url, options = {}) => {
        calls.push({ url: String(url), method: options.method || "GET" });
        if (String(url).includes("fb_exchange_token")) {
          return { ok: true, json: async () => ({ access_token: "long-user-token" }) };
        }
        if (String(url).includes("oauth/access_token")) {
          return { ok: true, json: async () => ({ access_token: "user-token" }) };
        }
        if (String(url).includes("/me/accounts")) {
          return {
            ok: true,
            json: async () => ({
              data: [{ id: "PAGE_CB", name: "Callback Page", access_token: "page-token" }],
            }),
          };
        }
        if (String(url).includes("/PAGE_CB/subscribed_apps")) {
          return { ok: true, json: async () => ({ success: true }) };
        }
        return { ok: false, status: 404, json: async () => ({ error: { message: "not found" } }) };
      },
    }),
  );

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const start = await fetch(`http://127.0.0.1:${port}/connect/start`, { redirect: "manual" });
    const redirect = start.headers.get("location");
    const state = new URL(redirect).searchParams.get("state");

    const callback = await fetch(`http://127.0.0.1:${port}/connect/callback?code=abc&state=${state}`);
    const html = await callback.text();

    assert.equal(callback.status, 200);
    assert.match(html, /Connected successfully/);
    assert.equal(pageStore.get("PAGE_CB").name, "Callback Page");
    assert.equal(pageStore.get("PAGE_CB").pageAccessToken, "page-token");
    assert.equal(knowledgeBaseStore.exists("PAGE_CB"), true);
    assert.equal(calls.some((call) => call.url.includes("oauth/access_token")), true);
    assert.equal(calls.some((call) => call.url.includes("fb_exchange_token")), true);
    assert.equal(calls.some((call) => call.url.includes("/me/accounts")), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
