const fs = require("node:fs");
const { detectLanguageHint } = require("./languageHint");
const { setupFallbackReply } = require("./knowledgeBaseStore");

function loadPromptTemplate(promptPath = "./prompts/system_prompt.md") {
  return fs.readFileSync(promptPath, "utf8");
}

function loadSystemPrompt({ promptPath = "./prompts/system_prompt.md", knowledgeBasePath }) {
  const promptTemplate = loadPromptTemplate(promptPath);
  const knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, "utf8"));
  const companyName = knowledgeBase.company?.name_ar || knowledgeBase.company?.name_en || "the company";

  return promptTemplate
    .replaceAll("{{KNOWLEDGE_BASE}}", JSON.stringify(knowledgeBase, null, 2))
    .replaceAll("{{COMPANY_NAME}}", companyName);
}

function fallbackReply(languageHint) {
  if (languageHint === "English") {
    return "Sorry, we're having a small technical hiccup. Please try again in a bit.";
  }

  return "بنعتذر، في مشكلة تقنية بسيطة. جرّب تبعتلنا كمان شوي.";
}

function toGeminiContents(messages) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

function extractGeminiText(responseBody) {
  return (responseBody.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();
}

function createGeminiClient({ config, systemPrompt, promptTemplate, knowledgeBaseStore, fetchImpl = fetch }) {
  async function generateReply({ pageId, userMessage, history }) {
    const languageHint = detectLanguageHint(userMessage);
    let activeSystemPrompt = systemPrompt;

    if (knowledgeBaseStore && pageId) {
      try {
        activeSystemPrompt = knowledgeBaseStore.loadSystemPromptForPage({ pageId, promptTemplate });
      } catch (error) {
        console.error(error.message);
        return setupFallbackReply(languageHint);
      }
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      config.geminiModel,
    )}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;

    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `${activeSystemPrompt}\n\nReply language hint for this message: ${languageHint}.` }],
          },
          contents: toGeminiContents([...history, { role: "user", content: userMessage }]),
          generationConfig: {
            maxOutputTokens: 500,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Gemini API failed (${response.status}): ${body}`);
      }

      const responseBody = await response.json();
      return extractGeminiText(responseBody) || fallbackReply(languageHint);
    } catch (error) {
      console.error("Gemini API error:", error);
      return fallbackReply(languageHint);
    }
  }

  return { generateReply };
}

module.exports = {
  createGeminiClient,
  extractGeminiText,
  fallbackReply,
  loadPromptTemplate,
  loadSystemPrompt,
  toGeminiContents,
};
