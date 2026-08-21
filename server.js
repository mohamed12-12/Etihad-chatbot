require("dotenv").config();

const express = require("express");
const { createConnectRouter } = require("./src/connect");
const { readConfig, requireEnv } = require("./src/config");
const { createGeminiClient, loadPromptTemplate, loadSystemPrompt } = require("./src/gemini");
const { createHistoryStore } = require("./src/history");
const { createKnowledgeBaseStore } = require("./src/knowledgeBaseStore");
const { createMessageDeduper } = require("./src/messageDedupe");
const { sendMetaMessage } = require("./src/meta");
const { createPagesAdminRouter } = require("./src/pagesAdmin");
const { createPageStore } = require("./src/pageStore");
const { createRouterRelay } = require("./src/routerRelay");
const { createTestChatRouter } = require("./src/testChat");
const { createWebhookRouter } = require("./src/webhook");

const config = readConfig();

requireEnv(config, ["geminiApiKey"]);

const missingMetaValues = ["verifyToken", "appSecret"].filter((key) => !config[key]);
if (missingMetaValues.length) {
  console.warn(
    `Meta webhook is not fully configured yet. Missing: ${missingMetaValues.join(
      ", ",
    )}. The local test UI will still work.`,
  );
}

const app = express();
app.set("env", config.nodeEnv);
const systemPrompt = loadSystemPrompt({ knowledgeBasePath: config.knowledgeBasePath });
const promptTemplate = loadPromptTemplate();
const historyStore = createHistoryStore({
  maxTurns: config.historyMaxTurns,
  ttlMinutes: config.historyTtlMinutes,
});
const knowledgeBaseStore = createKnowledgeBaseStore({
  baseTemplatePath: config.knowledgeBasePath,
  directoryPath: config.knowledgeBasesDir,
});
const geminiClient = createGeminiClient({ config, systemPrompt, promptTemplate, knowledgeBaseStore });
const pageStore = createPageStore(config.pagesConfigPath);
// Shared so the same Meta message never gets answered twice, whether it arrives
// straight from Meta on /webhook or forwarded by the router on /router-webhook.
const deduper = createMessageDeduper();

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use(express.static("public"));
app.use("/test-chat", express.json(), createTestChatRouter({ historyStore, botClient: geminiClient, config }));
app.use("/router-webhook", express.json({ limit: "1mb" }), createRouterRelay({ config, historyStore, botClient: geminiClient, deduper }));
app.use("/pages", createPagesAdminRouter({ config, pageStore, knowledgeBaseStore }));
app.use("/connect", createConnectRouter({ config, pageStore, knowledgeBaseStore }));

app.use(
  "/webhook",
  express.raw({ type: "application/json" }),
  createWebhookRouter({ config, historyStore, botClient: geminiClient, sendMetaMessage, pageStore, deduper }),
);

app.listen(config.port, () => {
  console.log(`Etihad FAQ chatbot listening on port ${config.port}`);
});
