const GRAPH_API_BASE = "https://graph.facebook.com/v23.0/me/messages";

async function sendMetaMessage({ channel, recipientId, text, config, fetchImpl = fetch }) {
  const token = channel === "instagram" ? config.igPageAccessToken : config.pageAccessToken;
  if (!token) {
    throw new Error(`Missing access token for ${channel}`);
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

module.exports = { sendMetaMessage };
