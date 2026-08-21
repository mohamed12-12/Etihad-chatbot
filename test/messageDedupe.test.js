const assert = require("node:assert/strict");
const test = require("node:test");
const { createMessageDeduper } = require("../src/messageDedupe");

test("flags a repeated message id once seen", () => {
  const deduper = createMessageDeduper();

  assert.equal(deduper.isDuplicate("mid.1"), false);
  assert.equal(deduper.isDuplicate("mid.1"), true);
  assert.equal(deduper.isDuplicate("mid.2"), false);
});

test("never treats a missing message id as a duplicate", () => {
  const deduper = createMessageDeduper();

  assert.equal(deduper.isDuplicate(""), false);
  assert.equal(deduper.isDuplicate(""), false);
  assert.equal(deduper.isDuplicate(undefined), false);
});

test("forgets message ids once the ttl passes", () => {
  let clock = 0;
  const deduper = createMessageDeduper({ ttlMinutes: 10, now: () => clock });

  assert.equal(deduper.isDuplicate("mid.1"), false);
  clock += 11 * 60 * 1000;
  assert.equal(deduper.isDuplicate("mid.1"), false);
});

test("keeps the store bounded by dropping the oldest ids", () => {
  const deduper = createMessageDeduper({ maxEntries: 2 });

  deduper.isDuplicate("mid.1");
  deduper.isDuplicate("mid.2");
  deduper.isDuplicate("mid.3");

  assert.equal(deduper.isDuplicate("mid.1"), false);
  assert.equal(deduper.isDuplicate("mid.3"), true);
});
