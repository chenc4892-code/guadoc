const test = require("node:test");
const assert = require("node:assert/strict");
const { buildToc, plainTextFromHtml, renderContentHtml, slugFromValue } = require("../src/lib/content");

test("slugFromValue normalizes rich text headings", () => {
  assert.equal(slugFromValue(" Hello API World! "), "hello-api-world");
  assert.equal(slugFromValue("###", "fallback"), "fallback");
  assert.equal(slugFromValue("接口 文档"), "接口-文档");
});

test("withHeadingAnchors injects stable ids and TOC entries", () => {
  const html = renderContentHtml("<h1>Quick Start</h1><h2>Install</h2>");
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

test("renderContentHtml renders pasted markdown source", () => {
  const html = renderContentHtml(`# Markdown Guide

## Setup

- Install
- Configure

\`\`\`js
const answer = 42;
\`\`\``);

  assert.match(html, /<h1 id="markdown-guide">Markdown Guide<\/h1>/);
  assert.match(html, /<h2 id="setup">Setup<\/h2>/);
  assert.match(html, /<li>Install<\/li>/);
  assert.match(html, /class="language-js hljs"|class="hljs language-js"/);
});

test("renderContentHtml renders TinyMCE paragraph-wrapped markdown", () => {
  const html = renderContentHtml(
    "<p><span># API Guide</span></p><p>## Prompt Caching</p><p>1. cache_control</p><p>2. metadata</p>",
  );

  assert.match(html, /<h1 id="api-guide">API Guide<\/h1>/);
  assert.match(html, /<h2 id="prompt-caching">Prompt Caching<\/h2>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<li>\s*(?:<p>)?cache_control/);
});

test("plainTextFromHtml strips tags for indexing", () => {
  assert.equal(plainTextFromHtml("<p>Hello <strong>world</strong></p>"), "Hello world");
});

test("renderContentHtml strips pasted dark backgrounds and normalizes non-code pre blocks", () => {
  const html = renderContentHtml('<pre style="background-color:#222;color:#fff">Normal prose line</pre>');

  assert.doesNotMatch(html, /background-color/i);
  assert.match(html, /<p>Normal prose line<\/p>/);
});

test("renderContentHtml highlights real code blocks", () => {
  const html = renderContentHtml("<pre><code class=\"language-js\">const answer = 42;</code></pre>");

  assert.match(html, /class="language-js hljs"|class="hljs language-js"/);
  assert.match(html, /span class="hljs/);
});
