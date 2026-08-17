function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelayMs(config = {}) {
  const min = Math.max(0, Number(config.responseDelayMinMs || 0));
  const max = Math.max(min, Number(config.responseDelayMaxMs || min));
  if (!max) return 0;
  return Math.floor(min + Math.random() * (max - min + 1));
}

async function waitBeforeReply(config) {
  const ms = randomDelayMs(config);
  if (ms) await delay(ms);
}

module.exports = { delay, randomDelayMs, waitBeforeReply };
