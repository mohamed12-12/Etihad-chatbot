const path = require("node:path");

function readConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    nodeEnv: env.NODE_ENV || "development",
    pageAccessToken: env.PAGE_ACCESS_TOKEN || "",
    verifyToken: env.VERIFY_TOKEN || "",
    appSecret: env.APP_SECRET || "",
    metaAppId: env.META_APP_ID || "",
    metaAppSecret: env.META_APP_SECRET || env.APP_SECRET || "",
    oauthRedirectUri: env.OAUTH_REDIRECT_URI || "",
    metaGraphVersion: env.META_GRAPH_VERSION || "v23.0",
    igPageAccessToken: env.IG_PAGE_ACCESS_TOKEN || env.PAGE_ACCESS_TOKEN || "",
    geminiApiKey: env.GEMINI_API_KEY || "",
    geminiModel: env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    knowledgeBasePath: path.resolve(env.KNOWLEDGE_BASE_PATH || "./knowledge_base/company_info.json"),
    pagesConfigPath: path.resolve(env.PAGES_CONFIG_PATH || "./data/pages.json"),
    knowledgeBasesDir: path.resolve(env.KNOWLEDGE_BASES_DIR || "./data/knowledge_bases"),
    adminPassword: env.ADMIN_PASSWORD || "",
    routerWebhookToken: env.ROUTER_WEBHOOK_TOKEN || "",
    routerDefaultClientId: env.ROUTER_DEFAULT_CLIENT_ID || "etihad",
    responseDelayMinMs: Number(env.RESPONSE_DELAY_MIN_MS || 1200),
    responseDelayMaxMs: Number(env.RESPONSE_DELAY_MAX_MS || 3200),
    historyTtlMinutes: Number(env.HISTORY_TTL_MINUTES || 30),
    historyMaxTurns: Number(env.HISTORY_MAX_TURNS || 6),
  };
}

function requireEnv(config, names) {
  const missing = names.filter((name) => !config[name]);
  if (missing.length) {
    throw new Error(`Missing required environment values: ${missing.join(", ")}`);
  }
}

module.exports = { readConfig, requireEnv };
