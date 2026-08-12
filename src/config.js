const path = require("node:path");

function readConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    nodeEnv: env.NODE_ENV || "development",
    pageAccessToken: env.PAGE_ACCESS_TOKEN || "",
    verifyToken: env.VERIFY_TOKEN || "",
    appSecret: env.APP_SECRET || "",
    igPageAccessToken: env.IG_PAGE_ACCESS_TOKEN || env.PAGE_ACCESS_TOKEN || "",
    geminiApiKey: env.GEMINI_API_KEY || "",
    geminiModel: env.GEMINI_MODEL || "gemini-3.6-flash",
    knowledgeBasePath: path.resolve(env.KNOWLEDGE_BASE_PATH || "./knowledge_base/company_info.json"),
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
