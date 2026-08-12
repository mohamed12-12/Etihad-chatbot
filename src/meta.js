const GRAPH_API_BASE = "https://graph.facebook.com/v23.0/me/messages";

function resolveAccessToken({ channel, pageId, config, pageStore }) {
  const savedPage = pageId && pageStore ? pageStore.get(pageId) : null;
  if (savedPage) {
    return channel === "instagram"
      ? savedPage.igPageAccessToken || savedPage.pageAccessToken
      : savedPage.pageAccessToken;
  }

  return channel === "instagram" ? config.igPageAccessToken : config.pageAccessToken;
}

async function sendMetaMessage({ channel, pageId, recipientId, text, config, pageStore, fetchImpl = fetch }) {
  const token = resolveAccessToken({ channel, pageId, config, pageStore });
  if (!token) {
    throw new Error(`Missing access token for ${channel}${pageId ? ` page ${pageId}` : ""}`);
  }

  const response = await fetchImpl(`${GRAPH_API_BASE}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { text },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meta send failed (${response.status}): ${body}`);
  }

  return response.json();
}

module.exports = { resolveAccessToken, sendMetaMessage };
