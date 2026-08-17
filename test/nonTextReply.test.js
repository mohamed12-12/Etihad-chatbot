const assert = require("node:assert/strict");
const test = require("node:test");
const { isAudioLike, voiceReply } = require("../src/nonTextReply");

test("detects voice and audio attachments", () => {
  assert.equal(isAudioLike([{ type: "audio", payload: { url: "https://example.com/a.ogg" } }]), true);
  assert.equal(isAudioLike({ message: { attachments: [{ type: "image" }] } }), false);
});

test("voice reply asks for text without sounding broken", () => {
  assert.match(voiceReply(), /تكتبلي سؤالك نص/);
});
