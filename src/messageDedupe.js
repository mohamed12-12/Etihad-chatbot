function createMessageDeduper({ ttlMinutes = 10, maxEntries = 500, now = () => Date.now() } = {}) {
  const seen = new Map();
  const ttlMs = ttlMinutes * 60 * 1000;

  function pruneExpired() {
    const cutoff = now() - ttlMs;
    for (const [key, seenAt] of seen) {
      if (seenAt <= cutoff) seen.delete(key);
    }
    while (seen.size > maxEntries) {
      const oldest = seen.keys().next().value;
      seen.delete(oldest);
    }
  }

  function isDuplicate(messageId) {
    if (!messageId) return false;
    pruneExpired();
    if (seen.has(messageId)) return true;
    seen.set(messageId, now());
    return false;
  }

  return { isDuplicate };
}

module.exports = { createMessageDeduper };
