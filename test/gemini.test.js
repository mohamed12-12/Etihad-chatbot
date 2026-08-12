const assert = require("node:assert/strict");
const test = require("node:test");
const { extractGeminiText, toGeminiContents } = require("../src/gemini");

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
