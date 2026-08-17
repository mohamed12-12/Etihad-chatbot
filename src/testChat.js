const { waitBeforeReply } = require("./responseDelay");

function createTestChatRouter({ historyStore, botClient, config }) {
  const express = require("express");
  const router = express.Router();

  router.post("/", async (req, res) => {
    const message = String(req.body?.message || "").trim();
    const userId = String(req.body?.userId || "local-test-user");

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const userKey = `test:${userId}`;
    const history = historyStore.get(userKey);
    await waitBeforeReply(config);
    const reply = await botClient.generateReply({ userMessage: message, history });

    historyStore.append(userKey, "user", message);
    historyStore.append(userKey, "assistant", reply);

    return res.status(200).json({ reply });
  });

  router.delete("/:userId", (req, res) => {
    historyStore.clear(`test:${req.params.userId}`);
    res.status(204).send();
  });

  return router;
}

module.exports = { createTestChatRouter };
