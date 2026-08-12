const fs = require("node:fs");
const path = require("node:path");
const { detectLanguageHint } = require("./languageHint");

function blankValue(value) {
  if (Array.isArray(value)) {
    return value.length ? [blankValue(value[0])] : [];
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, blankValue(nested)]));
  }

  return "";
}

function setupFallbackReply(languageHint) {
  if (languageHint === "English") {
    return "We're still setting up this page. Please contact the team directly for now.";
  }

  return "لسه بنجهّز معلومات هاي الصفحة. تواصل مع الفريق مباشرة حالياً وراح يساعدوك.";
}

function createKnowledgeBaseStore({ baseTemplatePath, directoryPath }) {
  function ensureDirectory() {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  function fileFor(pageId) {
    return path.join(directoryPath, `${pageId}.json`);
  }

  function createBlankFromTemplate(pageId) {
    ensureDirectory();
    const target = fileFor(pageId);
    if (fs.existsSync(target)) return target;

    const template = JSON.parse(fs.readFileSync(baseTemplatePath, "utf8"));
    fs.writeFileSync(target, JSON.stringify(blankValue(template), null, 2));
    return target;
  }

  function exists(pageId) {
    return Boolean(pageId) && fs.existsSync(fileFor(pageId));
  }

  function read(pageId) {
    if (!exists(pageId)) return null;
    return JSON.parse(fs.readFileSync(fileFor(pageId), "utf8"));
  }

  function readText(pageId) {
    if (!exists(pageId)) return null;
    return fs.readFileSync(fileFor(pageId), "utf8");
  }

  function writeText(pageId, text) {
    ensureDirectory();
    const parsed = JSON.parse(text);
    fs.writeFileSync(fileFor(pageId), JSON.stringify(parsed, null, 2));
  }

  function loadSystemPromptForPage({ pageId, promptTemplate }) {
    const knowledgeBase = read(pageId);
    if (!knowledgeBase) {
      throw new Error(`Knowledge base missing for page ${pageId || "(unknown)"}`);
    }

    const companyName = knowledgeBase.company?.name_ar || knowledgeBase.company?.name_en || "the company";
    return promptTemplate
      .replaceAll("{{KNOWLEDGE_BASE}}", JSON.stringify(knowledgeBase, null, 2))
      .replaceAll("{{COMPANY_NAME}}", companyName);
  }

  return {
    createBlankFromTemplate,
    exists,
    fileFor,
    loadSystemPromptForPage,
    read,
    readText,
    setupFallbackReply,
    writeText,
  };
}

module.exports = { blankValue, createKnowledgeBaseStore, setupFallbackReply };
