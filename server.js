require("dotenv").config();

const express = require("express");
const { readConfig, requireEnv } = require("./src/config");
const { createGeminiClient, loadSystemPrompt } = require("./src/gemini");
const { createHistoryStore } = require("./src/history");
const { sendMetaMessage } = require("./src/meta");
const { createWebhookRouter } = require("./src/webhook");

const config = readConfig();

requireEnv(config, ["verifyToken", "appSecret", "pageAccessToken", "geminiApiKey"]);

const app = express();
app.set("env", config.nodeEnv);
const systemPrompt = loadSystemPrompt({ knowledgeBasePath: config.knowledgeBasePath });
const historyStore = createHistoryStore({
  maxTurns: config.historyMaxTurns,
  ttlMinutes: config.historyTtlMinutes,
});
const geminiClient = createGeminiClient({ config, systemPrompt });

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use(
  "/webhook",
  express.raw({ type: "application/json" }),
  createWebhookRouter({ config, historyStore, claudeClient: geminiClient, sendMetaMessage }),
);

app.listen(config.port, () => {
  console.log(`Etihad FAQ chatbot listening on port ${config.port}`);
});
