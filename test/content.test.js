const test = require("node:test");
const assert = require("node:assert/strict");
const { buildToc, plainTextFromHtml, slugFromValue, withHeadingAnchors } = require("../src/lib/content");

test("slugFromValue normalizes rich text headings", () => {
  assert.equal(slugFromValue(" Hello API World! "), "hello-api-world");
  assert.equal(slugFromValue("###", "fallback"), "fallback");
  assert.equal(slugFromValue("接口 文档"), "接口-文档");
});

test("withHeadingAnchors injects stable ids and TOC entries", () => {
  const html = withHeadingAnchors("<h1>Quick Start</h1><h2>Install</h2>");
  const toc = buildToc(html);

  assert.match(html, /id="quick-start"/);
  assert.match(html, /id="install"/);
  assert.deepEqual(
    toc.map((item) => ({ id: item.id, level: item.level, text: item.text })),
    [
      { id: "quick-start", level: 1, text: "Quick Start" },
      { id: "install", level: 2, text: "Install" },
    ],
  );
});

test("plainTextFromHtml strips tags for indexing", () => {
  assert.equal(plainTextFromHtml("<p>Hello <strong>world</strong></p>"), "Hello world");
});
