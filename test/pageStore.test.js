const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createPageStore } = require("../src/pageStore");

test("page store saves tokens and returns public masked state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pages-"));
  const store = createPageStore(path.join(dir, "pages.json"));

  store.upsert({
    pageId: "123",
    name: "Offok",
    pageAccessToken: "token-1",
  });

  assert.equal(store.get("123").pageAccessToken, "token-1");
  assert.deepEqual(store.listPublic().map(({ pageId, name, hasPageAccessToken }) => ({ pageId, name, hasPageAccessToken })), [
    { pageId: "123", name: "Offok", hasPageAccessToken: true },
  ]);
});
