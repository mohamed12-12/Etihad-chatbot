const assert = require("node:assert/strict");
const test = require("node:test");
const { createHistoryStore } = require("../src/history");

test("history is capped to max turns", () => {
  const history = createHistoryStore({ maxTurns: 3, ttlMinutes: 30 });

  history.append("user-1", "user", "one");
  history.append("user-1", "assistant", "two");
  history.append("user-1", "user", "three");
  history.append("user-1", "assistant", "four");

  assert.deepEqual(history.get("user-1"), [
    { role: "assistant", content: "two" },
    { role: "user", content: "three" },
    { role: "assistant", content: "four" },
  ]);
});

test("history expires after inactivity ttl", () => {
  let now = 0;
  const history = createHistoryStore({ maxTurns: 6, ttlMinutes: 1, now: () => now });

  history.append("user-1", "user", "hello");
  now = 61_000;

  assert.deepEqual(history.get("user-1"), []);
});
