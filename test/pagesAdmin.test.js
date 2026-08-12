const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { createPagesAdminRouter, hasAccess } = require("../src/pagesAdmin");

test("admin access checks basic auth password", () => {
  const req = {
    get: () => `Basic ${Buffer.from("admin:secret").toString("base64")}`,
  };

  assert.equal(hasAccess(req, "secret"), true);
  assert.equal(hasAccess(req, "wrong"), false);
});

test("/pages admin routes require ADMIN_PASSWORD", async () => {
  const app = express();
  app.use(
    "/pages",
    createPagesAdminRouter({
      config: { adminPassword: "secret" },
      pageStore: { listPublic: () => [] },
      knowledgeBaseStore: { exists: () => false },
    }),
  );

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/pages`);

    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
