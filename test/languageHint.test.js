const assert = require("node:assert/strict");
const test = require("node:test");
const { detectLanguageHint } = require("../src/languageHint");

test("detects Arabic, English, and mixed messages", () => {
  assert.equal(detectLanguageHint("مرحبا"), "Jordanian colloquial Arabic");
  assert.equal(detectLanguageHint("Hello there"), "English");
  assert.equal(detectLanguageHint("مرحبا price?"), "mixed Arabic and English");
});
