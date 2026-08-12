const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createGeminiClient, extractGeminiText, loadPromptTemplate, toGeminiContents } = require("../src/gemini");
const { createKnowledgeBaseStore } = require("../src/knowledgeBaseStore");

test("maps chat history to Gemini contents roles", () => {
  assert.deepEqual(
    toGeminiContents([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]),
    [
      { role: "user", parts: [{ text: "hi" }] },
      { role: "model", parts: [{ text: "hello" }] },
    ],
  );
});

test("extracts text from Gemini generateContent responses", () => {
  assert.equal(
    extractGeminiText({
      candidates: [
        {
          content: {
            parts: [{ text: "أهلاً وسهلاً" }],
          },
        },
      ],
    }),
    "أهلاً وسهلاً",
  );
});

test("Gemini client injects the knowledge base for the incoming page ID", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kb-"));
  const pageId = "PAGE_A";
  const kbDir = path.join(dir, "knowledge_bases");
  fs.mkdirSync(kbDir, { recursive: true });
  fs.writeFileSync(
    path.join(kbDir, `${pageId}.json`),
    JSON.stringify({ company: { name_ar: "شركة الصفحة أ", name_en: "Page A" }, faq: [] }),
  );

  let capturedBody;
  const client = createGeminiClient({
    config: { geminiModel: "test-model", geminiApiKey: "key" },
    systemPrompt: "fallback",
    promptTemplate: loadPromptTemplate(),
    knowledgeBaseStore: createKnowledgeBaseStore({
      baseTemplatePath: path.resolve("./knowledge_base/company_info.json"),
      directoryPath: kbDir,
    }),
    fetchImpl: async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
      };
    },
  });

  const reply = await client.generateReply({ pageId, userMessage: "مرحبا", history: [] });

  assert.equal(reply, "ok");
  assert.match(capturedBody.systemInstruction.parts[0].text, /شركة الصفحة أ/);
});

test("Gemini client returns setup fallback when page knowledge base is missing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kb-missing-"));
  const client = createGeminiClient({
    config: { geminiModel: "test-model", geminiApiKey: "key" },
    systemPrompt: "fallback",
    promptTemplate: loadPromptTemplate(),
    knowledgeBaseStore: createKnowledgeBaseStore({
      baseTemplatePath: path.resolve("./knowledge_base/company_info.json"),
      directoryPath: dir,
    }),
    fetchImpl: async () => {
      throw new Error("should not call Gemini");
    },
  });

  const reply = await client.generateReply({ pageId: "MISSING_PAGE", userMessage: "hello", history: [] });

  assert.match(reply, /still setting up/);
});
