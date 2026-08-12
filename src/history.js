function createHistoryStore({ maxTurns = 6, ttlMinutes = 30, now = () => Date.now() } = {}) {
  const store = new Map();
  const ttlMs = ttlMinutes * 60 * 1000;

  function pruneExpired(key) {
    const record = store.get(key);
    if (!record) return;
    if (now() - record.updatedAt > ttlMs) {
      store.delete(key);
    }
  }

  function get(userKey) {
    pruneExpired(userKey);
    const record = store.get(userKey);
    return record ? [...record.messages] : [];
  }

  function append(userKey, role, content) {
    pruneExpired(userKey);
    const record = store.get(userKey) || { messages: [], updatedAt: now() };
    record.messages.push({ role, content });
    record.messages = record.messages.slice(-maxTurns);
    record.updatedAt = now();
    store.set(userKey, record);
  }

  function clear(userKey) {
    store.delete(userKey);
  }

  return { get, append, clear };
}

module.exports = { createHistoryStore };
