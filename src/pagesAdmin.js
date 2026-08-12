const PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Central Webhook Pages</title>
    <style>
      :root { --bg:#eef3f1; --panel:#fff; --ink:#17211d; --muted:#66746e; --line:#d9e2dd; --brand:#0f766e; --danger:#9f1239; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--ink); font-family: Arial, Tahoma, sans-serif; }
      main { width: min(1120px, calc(100% - 32px)); margin: 32px auto; }
      header { margin-bottom: 20px; }
      h1 { margin: 0 0 6px; font-size: 28px; }
      p { margin: 0; color: var(--muted); line-height: 1.5; }
      section { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 18px; margin-bottom: 16px; }
      form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      label { display: grid; gap: 6px; font-weight: 700; font-size: 14px; }
      input, textarea { width: 100%; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font: inherit; }
      input { height: 42px; }
      textarea { min-height: 420px; resize: vertical; font-family: Consolas, "Courier New", monospace; font-size: 13px; line-height: 1.45; }
      input:focus, textarea:focus { outline: 0; border-color: var(--brand); box-shadow: 0 0 0 3px rgb(15 118 110 / 12%); }
      button { height: 42px; border: 0; border-radius: 8px; background: var(--brand); color: #fff; font-weight: 700; cursor: pointer; padding: 0 14px; }
      button.secondary { background: #fff; border: 1px solid var(--line); color: var(--ink); }
      button.danger { color: var(--danger); }
      .full { grid-column: 1 / -1; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; border-bottom: 1px solid var(--line); padding: 10px; vertical-align: middle; }
      th { color: var(--muted); font-size: 13px; }
      code { background: #f3f7f5; border: 1px solid var(--line); border-radius: 6px; padding: 2px 5px; }
      .status { margin-top: 10px; min-height: 22px; color: var(--muted); }
      .empty { color: var(--muted); padding: 8px 0; }
      .hidden { display: none; }
      @media (max-width: 720px) { form { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Central Webhook Pages</h1>
        <p>Use one callback URL for all pages: <code>https://Etihad.cvis.com.eg/webhook</code>. Clients can self-connect at <code>/connect</code>.</p>
      </header>

      <section>
        <p>Connected Pages appear here after the client completes Meta OAuth at <code>/connect</code>. Tokens are stored server-side and never displayed.</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Page ID</th>
              <th>Page token</th>
              <th>IG token</th>
              <th>Knowledge base</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="pages"></tbody>
        </table>
        <div class="empty" id="empty">No pages saved yet.</div>
      </section>

      <section id="editorSection" class="hidden">
        <h2 id="editorTitle">Knowledge base</h2>
        <p>Edit the selected page JSON. The bot will only answer from this file for that Page ID.</p>
        <textarea id="knowledgeBaseEditor" spellcheck="false"></textarea>
        <div style="display:flex;gap:10px;margin-top:12px">
          <button id="saveKbButton" type="button">Save knowledge base</button>
          <button id="closeEditorButton" class="secondary" type="button">Close</button>
        </div>
        <div class="status" id="kbStatus"></div>
      </section>
    </main>

    <script>
      const pagesNode = document.querySelector("#pages");
      const emptyNode = document.querySelector("#empty");
      const editorSection = document.querySelector("#editorSection");
      const editorTitle = document.querySelector("#editorTitle");
      const editor = document.querySelector("#knowledgeBaseEditor");
      const saveKbButton = document.querySelector("#saveKbButton");
      const closeEditorButton = document.querySelector("#closeEditorButton");
      const kbStatus = document.querySelector("#kbStatus");
      let activePageId = "";

      function escapeHtml(value) {
        return String(value || "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      async function loadPages() {
        const response = await fetch("/pages/api");
        const pages = await response.json();
        pagesNode.replaceChildren();
        emptyNode.style.display = pages.length ? "none" : "block";

        for (const page of pages) {
          const row = document.createElement("tr");
          row.innerHTML = \`
            <td>\${escapeHtml(page.name)}</td>
            <td><code>\${escapeHtml(page.pageId)}</code></td>
            <td>\${page.hasPageAccessToken ? "Saved" : "Missing"}</td>
            <td>\${page.hasIgPageAccessToken ? "Saved" : "Uses page token"}</td>
            <td>\${page.hasKnowledgeBase ? "Ready" : "Missing"}</td>
            <td>
              <button class="secondary" data-edit-kb="\${escapeHtml(page.pageId)}">Edit KB</button>
              <button class="secondary danger" data-page-id="\${escapeHtml(page.pageId)}">Delete</button>
            </td>
          \`;
          pagesNode.appendChild(row);
        }
      }

      pagesNode.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-page-id]");
        const editButton = event.target.closest("button[data-edit-kb]");
        if (editButton) {
          activePageId = editButton.dataset.editKb;
          kbStatus.textContent = "Loading...";
          const response = await fetch(\`/pages/api/\${encodeURIComponent(activePageId)}/knowledge-base\`);
          const body = await response.json();
          editor.value = body.json || "";
          editorTitle.textContent = \`Knowledge base: \${activePageId}\`;
          editorSection.classList.remove("hidden");
          kbStatus.textContent = "";
          editor.focus();
          return;
        }
        if (!button) return;
        await fetch(\`/pages/api/\${encodeURIComponent(button.dataset.pageId)}\`, { method: "DELETE" });
        await loadPages();
      });

      saveKbButton.addEventListener("click", async () => {
        if (!activePageId) return;
        kbStatus.textContent = "Saving...";
        const response = await fetch(\`/pages/api/\${encodeURIComponent(activePageId)}/knowledge-base\`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: editor.value }),
        });
        const body = await response.json().catch(() => ({}));
        kbStatus.textContent = response.ok ? "Saved." : body.error || "Could not save JSON.";
        await loadPages();
      });

      closeEditorButton.addEventListener("click", () => {
        activePageId = "";
        editorSection.classList.add("hidden");
      });

      loadPages().catch(() => {
        kbStatus.textContent = "Could not load pages.";
      });
    </script>
  </body>
</html>`;

function hasAccess(req, adminPassword) {
  if (!adminPassword) return false;
  const header = req.get("authorization") || "";
  if (!header.startsWith("Basic ")) return false;

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const password = decoded.slice(decoded.indexOf(":") + 1);
  return password === adminPassword;
}

function requireAdmin(config) {
  return (req, res, next) => {
    if (hasAccess(req, config.adminPassword)) return next();

    if (!config.adminPassword) {
      return res.status(503).send("Set ADMIN_PASSWORD in .env to enable the page manager.");
    }

    res.set("WWW-Authenticate", 'Basic realm="Etihad pages"');
    return res.sendStatus(401);
  };
}

function createPagesAdminRouter({ config, pageStore, knowledgeBaseStore }) {
  const express = require("express");
  const router = express.Router();

  router.use(requireAdmin(config));
  router.get("/", (_req, res) => {
    res.type("html").send(PAGE_HTML);
  });

  router.get("/api", (_req, res) => {
    res.json(
      pageStore.listPublic().map((page) => ({
        ...page,
        hasKnowledgeBase: knowledgeBaseStore.exists(page.pageId),
      })),
    );
  });

  router.post("/api", express.json(), (req, res) => {
    try {
      const page = pageStore.upsert(req.body || {});
      res.status(201).json({ pageId: page.pageId });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.delete("/api/:pageId", (req, res) => {
    pageStore.remove(req.params.pageId);
    res.status(204).send();
  });

  router.get("/api/:pageId/knowledge-base", (req, res) => {
    if (!knowledgeBaseStore.exists(req.params.pageId)) {
      knowledgeBaseStore.createBlankFromTemplate(req.params.pageId);
    }

    res.json({ json: knowledgeBaseStore.readText(req.params.pageId) });
  });

  router.put("/api/:pageId/knowledge-base", express.json({ limit: "1mb" }), (req, res) => {
    try {
      knowledgeBaseStore.writeText(req.params.pageId, String(req.body?.json || ""));
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createPagesAdminRouter, hasAccess };
