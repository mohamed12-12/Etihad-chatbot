const fs = require("node:fs");
const path = require("node:path");

function createPageStore(filePath) {
  function ensureFile() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({ pages: [] }, null, 2));
    }
  }

  function readAll() {
    ensureFile();
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(data.pages) ? data.pages : [];
  }

  function writeAll(pages) {
    ensureFile();
    fs.writeFileSync(filePath, JSON.stringify({ pages }, null, 2));
  }

  function listPublic() {
    return readAll().map((page) => ({
      pageId: page.pageId,
      name: page.name || "",
      hasPageAccessToken: Boolean(page.pageAccessToken),
      hasIgPageAccessToken: Boolean(page.igPageAccessToken),
      updatedAt: page.updatedAt || "",
    }));
  }

  function get(pageId) {
    return readAll().find((page) => page.pageId === pageId) || null;
  }

  function upsert({ pageId, name = "", pageAccessToken = "", igPageAccessToken = "" }) {
    const normalizedPageId = String(pageId || "").trim();
    if (!normalizedPageId) {
      throw new Error("Page ID is required.");
    }

    const pages = readAll();
    const existing = pages.find((page) => page.pageId === normalizedPageId);
    const now = new Date().toISOString();

    if (existing) {
      existing.name = String(name || existing.name || "").trim();
      if (pageAccessToken) existing.pageAccessToken = String(pageAccessToken).trim();
      if (igPageAccessToken) existing.igPageAccessToken = String(igPageAccessToken).trim();
      existing.updatedAt = now;
    } else {
      pages.push({
        pageId: normalizedPageId,
        name: String(name || "").trim(),
        pageAccessToken: String(pageAccessToken || "").trim(),
        igPageAccessToken: String(igPageAccessToken || "").trim(),
        updatedAt: now,
      });
    }

    writeAll(pages);
    return get(normalizedPageId);
  }

  function remove(pageId) {
    const pages = readAll().filter((page) => page.pageId !== pageId);
    writeAll(pages);
  }

  return { get, listPublic, remove, upsert };
}

module.exports = { createPageStore };
