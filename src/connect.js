const crypto = require("node:crypto");

const GRAPH_BASE = "https://graph.facebook.com";
const OAUTH_SESSIONS = new Map();
const BASE_SCOPES = ["pages_messaging", "pages_show_list", "pages_manage_metadata"];
const IG_SCOPES = ["instagram_basic", "instagram_manage_messages"];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildOAuthUrl({ config, includeInstagram = false, state }) {
  const scopes = includeInstagram ? [...BASE_SCOPES, ...IG_SCOPES] : BASE_SCOPES;
  const params = new URLSearchParams({
    client_id: config.metaAppId,
    redirect_uri: config.oauthRedirectUri,
    state,
    scope: scopes.join(","),
  });

  return `https://www.facebook.com/${config.metaGraphVersion}/dialog/oauth?${params.toString()}`;
}

async function graphJson({ config, path, params = {}, accessToken, method = "GET", fetchImpl = fetch }) {
  const url = new URL(`${GRAPH_BASE}/${config.metaGraphVersion}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }
  if (accessToken) url.searchParams.set("access_token", accessToken);

  const response = await fetchImpl(url, { method });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message || `Graph API request failed (${response.status})`);
  }
  return body;
}

async function exchangeCodeForUserToken({ config, code, fetchImpl = fetch }) {
  return graphJson({
    config,
    path: "oauth/access_token",
    fetchImpl,
    params: {
      client_id: config.metaAppId,
      client_secret: config.metaAppSecret,
      redirect_uri: config.oauthRedirectUri,
      code,
    },
  });
}

async function exchangeForLongLivedUserToken({ config, userAccessToken, fetchImpl = fetch }) {
  return graphJson({
    config,
    path: "oauth/access_token",
    fetchImpl,
    params: {
      grant_type: "fb_exchange_token",
      client_id: config.metaAppId,
      client_secret: config.metaAppSecret,
      fb_exchange_token: userAccessToken,
    },
  });
}

async function fetchManagedPages({ config, userAccessToken, fetchImpl = fetch }) {
  const response = await graphJson({
    config,
    path: "me/accounts",
    accessToken: userAccessToken,
    fetchImpl,
    params: {
      fields: "id,name,access_token,instagram_business_account{id,username}",
    },
  });

  return response.data || [];
}

async function subscribePage({ config, page, fetchImpl = fetch }) {
  if (!page.access_token) return;
  try {
    await graphJson({
      config,
      path: `${page.id}/subscribed_apps`,
      accessToken: page.access_token,
      fetchImpl,
      method: "POST",
      params: {
        subscribed_fields: "messages,messaging_postbacks",
      },
    });
  } catch (error) {
    console.warn(`Could not subscribe page ${page.id}: ${error.message}`);
  }
}

function saveConnectedPage({ page, pageStore, knowledgeBaseStore }) {
  const saved = pageStore.upsert({
    pageId: page.id,
    name: page.name,
    pageAccessToken: page.access_token,
  });
  knowledgeBaseStore.createBlankFromTemplate(page.id);
  return saved;
}

function renderConnectPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Connect Page</title>
    <style>
      body { margin:0; min-height:100vh; display:grid; place-items:center; background:#eef3f1; font-family:Arial,Tahoma,sans-serif; color:#17211d; }
      main { width:min(560px, calc(100% - 32px)); background:#fff; border:1px solid #d9e2dd; border-radius:8px; padding:24px; }
      h1 { margin:0 0 8px; }
      p { color:#66746e; line-height:1.5; }
      a { display:inline-block; margin:8px 8px 0 0; padding:12px 14px; border-radius:8px; background:#0f766e; color:#fff; text-decoration:none; font-weight:700; }
      a.secondary { background:#fff; color:#17211d; border:1px solid #d9e2dd; }
    </style>
  </head>
  <body>
    <main>
      <h1>Connect your page</h1>
      <p>Connect your Facebook Page to the central Etihad chatbot webhook. We will store the Page token securely on the server and will not show it in the browser.</p>
      <a href="/connect/start">Connect Facebook Page</a>
      <a class="secondary" href="/connect/start?instagram=1">Connect Instagram too</a>
    </main>
  </body>
</html>`;
}

function renderSuccess(pageNames) {
  const names = pageNames.map(escapeHtml).join(", ");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Connected</title></head><body style="font-family:Arial,Tahoma,sans-serif;padding:32px"><h1>Connected successfully</h1><p>${names} ${pageNames.length === 1 ? "is" : "are"} now connected.</p></body></html>`;
}

function renderSelection(sessionId, pages) {
  const options = pages
    .map((page) => `<label style="display:block;margin:8px 0"><input type="checkbox" name="pageIds" value="${escapeHtml(page.id)}" /> ${escapeHtml(page.name)} (${escapeHtml(page.id)})</label>`)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Select Pages</title></head>
  <body style="font-family:Arial,Tahoma,sans-serif;padding:32px">
    <h1>Select pages to connect</h1>
    <form method="post" action="/connect/select">
      <input type="hidden" name="sessionId" value="${sessionId}" />
      ${options}
      <button type="submit">Connect selected pages</button>
    </form>
  </body>
</html>`;
}

function createConnectRouter({ config, pageStore, knowledgeBaseStore, fetchImpl = fetch }) {
  const express = require("express");
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.type("html").send(renderConnectPage());
  });

  router.get("/start", (req, res) => {
    if (!config.metaAppId || !config.metaAppSecret || !config.oauthRedirectUri) {
      return res.status(503).send("Meta OAuth is not configured yet.");
    }

    const state = crypto.randomBytes(16).toString("hex");
    OAUTH_SESSIONS.set(state, { createdAt: Date.now() });
    res.redirect(buildOAuthUrl({ config, includeInstagram: req.query.instagram === "1", state }));
  });

  router.get("/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state || !OAUTH_SESSIONS.has(state)) {
        return res.status(400).send("Invalid OAuth callback.");
      }
      OAUTH_SESSIONS.delete(state);

      const token = await exchangeCodeForUserToken({ config, code, fetchImpl });
      const longLivedToken = await exchangeForLongLivedUserToken({
        config,
        userAccessToken: token.access_token,
        fetchImpl,
      });
      const pages = await fetchManagedPages({
        config,
        userAccessToken: longLivedToken.access_token || token.access_token,
        fetchImpl,
      });

      if (!pages.length) {
        return res.status(400).send("No managed pages were returned by Meta.");
      }

      if (pages.length === 1) {
        await subscribePage({ config, page: pages[0], fetchImpl });
        const saved = saveConnectedPage({ page: pages[0], pageStore, knowledgeBaseStore });
        return res.type("html").send(renderSuccess([saved.name || saved.pageId]));
      }

      const sessionId = crypto.randomBytes(16).toString("hex");
      OAUTH_SESSIONS.set(sessionId, { pages, createdAt: Date.now() });
      return res.type("html").send(renderSelection(sessionId, pages));
    } catch (error) {
      console.error(`OAuth callback failed: ${error.message}`);
      return res.status(500).send("Could not connect this page. Please try again.");
    }
  });

  router.post("/select", express.urlencoded({ extended: false }), async (req, res) => {
    try {
      const session = OAUTH_SESSIONS.get(req.body.sessionId);
      if (!session) return res.status(400).send("Selection session expired.");
      OAUTH_SESSIONS.delete(req.body.sessionId);

      const selected = Array.isArray(req.body.pageIds) ? req.body.pageIds : [req.body.pageIds].filter(Boolean);
      const pages = session.pages.filter((page) => selected.includes(page.id));
      if (!pages.length) return res.status(400).send("No pages selected.");

      for (const page of pages) {
        await subscribePage({ config, page, fetchImpl });
        saveConnectedPage({ page, pageStore, knowledgeBaseStore });
      }

      return res.type("html").send(renderSuccess(pages.map((page) => page.name || page.id)));
    } catch (error) {
      console.error(`OAuth selection failed: ${error.message}`);
      return res.status(500).send("Could not save selected pages.");
    }
  });

  return router;
}

module.exports = {
  buildOAuthUrl,
  createConnectRouter,
  exchangeCodeForUserToken,
  exchangeForLongLivedUserToken,
  fetchManagedPages,
  saveConnectedPage,
};
