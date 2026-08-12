const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveAccessToken } = require("../src/meta");

test("resolves saved page token by Meta entry page ID", () => {
  const pageStore = {
    get: (pageId) =>
      pageId === "PAGE_1"
        ? {
            pageAccessToken: "page-token",
            igPageAccessToken: "ig-token",
          }
        : null,
  };

  assert.equal(
    resolveAccessToken({
      channel: "messenger",
      pageId: "PAGE_1",
      config: {},
      pageStore,
    }),
    "page-token",
  );
  assert.equal(
    resolveAccessToken({
      channel: "instagram",
      pageId: "PAGE_1",
      config: {},
      pageStore,
    }),
    "ig-token",
  );
});

test("falls back to env token if page is not saved", () => {
  assert.equal(
    resolveAccessToken({
      channel: "messenger",
      pageId: "UNKNOWN",
      config: { pageAccessToken: "fallback" },
      pageStore: { get: () => null },
    }),
    "fallback",
  );
});
