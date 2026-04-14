const fs = require("fs");
const Database = require("better-sqlite3");
const config = require("../lib/config");
const { cleanHtml, excerptFromHtml, plainTextFromHtml, slugFromValue, withHeadingAnchors } = require("../lib/content");
const { hashPassword } = require("../lib/auth");

const ensureDirectory = (directoryPath) => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

ensureDirectory(config.dataDir);
ensureDirectory(config.uploadsDir);

const db = new Database(config.dbPath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

const createSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER,
      kind TEXT NOT NULL CHECK (kind IN ('group', 'page')),
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      excerpt TEXT NOT NULL DEFAULT '',
      content_html TEXT NOT NULL DEFAULT '',
      meta_title TEXT NOT NULL DEFAULT '',
      meta_description TEXT NOT NULL DEFAULT '',
      is_published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE,
      UNIQUE (parent_id, slug)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      title,
      body,
      tokenize = 'porter unicode61'
    );
  `);
};

createSchema();

const setSettingStatement = db.prepare(`
  INSERT INTO settings (key, value)
  VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const getSettingStatement = db.prepare("SELECT value FROM settings WHERE key = ? LIMIT 1");
const getAllSettingsStatement = db.prepare("SELECT key, value FROM settings ORDER BY key");
const getNodeByIdStatement = db.prepare("SELECT * FROM nodes WHERE id = ? LIMIT 1");
const getAllNodesStatement = db.prepare("SELECT * FROM nodes ORDER BY sort_order, id");
const findAdminByUsernameStatement = db.prepare("SELECT * FROM admins WHERE username = ? LIMIT 1");
const getSingleAdminStatement = db.prepare("SELECT * FROM admins LIMIT 1");

const defaultSettings = {
  site_title: "Guadoc",
  site_tagline: "Warm, searchable API documentation for your users.",
  site_description: "A self-hosted documentation center for API guides and ecosystem tutorials.",
  custom_css: "",
};

const ensureDefaultSettings = () => {
  Object.entries(defaultSettings).forEach(([key, value]) => {
    if (!getSettingStatement.get(key)) {
      setSettingStatement.run(key, value);
    }
  });
};

const ensureDefaultAdmin = () => {
  const existingAdmin = getSingleAdminStatement.get();

  if (existingAdmin) {
    return;
  }

  db.prepare(
    `
      INSERT INTO admins (username, password_hash, created_at)
      VALUES (?, ?, ?)
    `,
  ).run(config.adminUsername, hashPassword(config.adminPassword), new Date().toISOString());
};

const nextSortOrder = (parentId = null) => {
  const row = db
    .prepare(
      `
        SELECT COALESCE(MAX(sort_order), -1) AS sort_order
        FROM nodes
        WHERE parent_id IS ?
      `,
    )
    .get(parentId);

  return row.sort_order + 1;
};

const insertNodeStatement = db.prepare(`
  INSERT INTO nodes (
    parent_id,
    kind,
    title,
    slug,
    excerpt,
    content_html,
    meta_title,
    meta_description,
    is_published,
    sort_order,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateNodeStatement = db.prepare(`
  UPDATE nodes
  SET parent_id = ?,
      title = ?,
      slug = ?,
      excerpt = ?,
      content_html = ?,
      meta_title = ?,
      meta_description = ?,
      is_published = ?,
      updated_at = ?
  WHERE id = ?
`);

const deleteSearchEntryStatement = db.prepare("DELETE FROM search_index WHERE rowid = ?");
const insertSearchEntryStatement = db.prepare("INSERT INTO search_index(rowid, title, body) VALUES (?, ?, ?)");

const syncSearchIndex = (node) => {
  deleteSearchEntryStatement.run(node.id);

  if (node.kind !== "page" || !node.is_published) {
    return;
  }

  insertSearchEntryStatement.run(node.id, node.title, plainTextFromHtml(node.content_html));
};

const createNode = (input) => {
  const now = new Date().toISOString();
  const kind = input.kind === "group" ? "group" : "page";
  const title = input.title.trim();
  const slug = slugFromValue(input.slug || title, kind === "group" ? "group" : "page");
  const html = kind === "page" ? withHeadingAnchors(cleanHtml(input.content_html || "")) : "";
  const excerpt = input.excerpt?.trim() || excerptFromHtml(html);

  const result = insertNodeStatement.run(
    input.parent_id || null,
    kind,
    title,
    slug,
    excerpt,
    html,
    input.meta_title?.trim() || "",
    input.meta_description?.trim() || "",
    input.is_published ? 1 : 0,
    nextSortOrder(input.parent_id || null),
    now,
    now,
  );

  const node = getNodeByIdStatement.get(result.lastInsertRowid);
  syncSearchIndex(node);
  return node;
};

const updateNode = (id, input) => {
  const existingNode = getNodeByIdStatement.get(id);

  if (!existingNode) {
    return null;
  }

  const html = existingNode.kind === "page" ? withHeadingAnchors(cleanHtml(input.content_html || "")) : "";

  updateNodeStatement.run(
    input.parent_id || null,
    input.title.trim(),
    slugFromValue(input.slug || input.title, existingNode.kind === "group" ? "group" : "page"),
    input.excerpt?.trim() || excerptFromHtml(html),
    html,
    input.meta_title?.trim() || "",
    input.meta_description?.trim() || "",
    input.is_published ? 1 : 0,
    new Date().toISOString(),
    id,
  );

  const updatedNode = getNodeByIdStatement.get(id);
  syncSearchIndex(updatedNode);
  return updatedNode;
};

const deleteNode = (id) => {
  const node = getNodeByIdStatement.get(id);

  if (!node) {
    return false;
  }

  const descendantIds = db
    .prepare(
      `
        WITH RECURSIVE descendants(id) AS (
          SELECT id FROM nodes WHERE id = ?
          UNION ALL
          SELECT nodes.id
          FROM nodes
          JOIN descendants ON nodes.parent_id = descendants.id
        )
        SELECT id FROM descendants
      `,
    )
    .all(id)
    .map((row) => row.id);

  db.prepare("DELETE FROM nodes WHERE id = ?").run(id);
  descendantIds.forEach((nodeId) => {
    deleteSearchEntryStatement.run(nodeId);
  });
  return true;
};

const applyReorder = (items, parentId, updateOrderStatement, timestamp) => {
  items.forEach((item, index) => {
    updateOrderStatement.run(parentId, index, timestamp, item.id);
    if (Array.isArray(item.children) && item.children.length > 0) {
      applyReorder(item.children, item.id, updateOrderStatement, timestamp);
    }
  });
};

const reorderNodes = db.transaction((items, parentId = null) => {
  const updateOrderStatement = db.prepare(
    "UPDATE nodes SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?",
  );
  const timestamp = new Date().toISOString();

  applyReorder(items, parentId, updateOrderStatement, timestamp);
});

const ensureSeedContent = () => {
  const row = db.prepare("SELECT COUNT(*) AS count FROM nodes").get();

  if (row.count > 0) {
    return;
  }

  const group = createNode({
    kind: "group",
    title: "Getting Started",
    slug: "getting-started",
    parent_id: null,
    is_published: true,
  });

  createNode({
    kind: "page",
    title: "Welcome",
    slug: "welcome",
    parent_id: group.id,
    is_published: true,
    content_html: `
      <h1>Welcome to Guadoc</h1>
      <p>Guadoc is a self-hosted documentation center designed for fast publishing and a warm reading experience.</p>
      <div class="callout callout-note">
        <p><strong>Start here:</strong> Sign in to the admin area, create a page, paste your tutorial, and publish.</p>
      </div>
      <h2>What is included</h2>
      <ul>
        <li>Browser-based editor with image uploads and live preview</li>
        <li>Automatic navigation, table of contents, and previous or next links</li>
        <li>Full-text search and API access for future RAG workflows</li>
      </ul>
      <h2>Deployment model</h2>
      <p>The app reads content directly from SQLite, so publishing is immediate and does not require a rebuild.</p>
      <pre><code class="language-bash">docker compose up -d</code></pre>
    `,
  });

  createNode({
    kind: "page",
    title: "Publishing Workflow",
    slug: "publishing-workflow",
    parent_id: group.id,
    is_published: true,
    content_html: `
      <h1>Publishing Workflow</h1>
      <p>Use the admin dashboard to create groups and pages, then drag items into the order you want.</p>
      <h2>Fast path</h2>
      <ol>
        <li>Create a page.</li>
        <li>Paste rich text from your source document.</li>
        <li>Upload images by dragging them into the editor.</li>
        <li>Publish immediately.</li>
      </ol>
    `,
  });
};

const initializeDatabase = () => {
  ensureDefaultSettings();
  ensureDefaultAdmin();
  ensureSeedContent();
};

const getSettings = () =>
  getAllSettingsStatement.all().reduce((settings, row) => {
    settings[row.key] = row.value;
    return settings;
  }, {});

const saveSettings = (input) => {
  Object.entries(input).forEach(([key, value]) => {
    setSettingStatement.run(key, value ?? "");
  });
};

const updateAdminCredentials = (adminId, username, passwordHash) => {
  db.prepare(
    `
      UPDATE admins
      SET username = ?, password_hash = ?
      WHERE id = ?
    `,
  ).run(username, passwordHash, adminId);
};

module.exports = {
  createNode,
  db,
  deleteNode,
  findAdminByUsername: (username) => findAdminByUsernameStatement.get(username),
  getAllNodes: () => getAllNodesStatement.all(),
  getNodeById: (id) => getNodeByIdStatement.get(id),
  getSettings,
  getSingleAdmin: () => getSingleAdminStatement.get(),
  initializeDatabase,
  reorderNodes,
  saveSettings,
  updateAdminCredentials,
  updateNode,
};
