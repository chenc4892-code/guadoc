const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const config = require("./config");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const createSessionToken = () => crypto.randomBytes(32).toString("hex");

const createSession = (db, adminId) => {
  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `
      INSERT INTO auth_tokens (admin_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `,
  ).run(adminId, tokenHash, expiresAt, new Date().toISOString());

  return {
    token,
    expiresAt,
  };
};

const clearExpiredSessions = (db) => {
  db.prepare("DELETE FROM auth_tokens WHERE expires_at <= ?").run(new Date().toISOString());
};

const findAdminForToken = (db, token) => {
  if (!token) {
    return null;
  }

  clearExpiredSessions(db);

  return (
    db
      .prepare(
        `
          SELECT admins.id, admins.username
          FROM auth_tokens
          JOIN admins ON admins.id = auth_tokens.admin_id
          WHERE auth_tokens.token_hash = ?
            AND auth_tokens.expires_at > ?
          LIMIT 1
        `,
      )
      .get(hashToken(token), new Date().toISOString()) || null
  );
};

const destroySession = (db, token) => {
  if (!token) {
    return;
  }

  db.prepare("DELETE FROM auth_tokens WHERE token_hash = ?").run(hashToken(token));
};

const rotateAdminSessions = (db, adminId) => {
  db.prepare("DELETE FROM auth_tokens WHERE admin_id = ?").run(adminId);
};

const verifyPassword = (plainTextPassword, passwordHash) => bcrypt.compareSync(plainTextPassword, passwordHash);

const hashPassword = (plainTextPassword) => bcrypt.hashSync(plainTextPassword, 12);

module.exports = {
  createSession,
  destroySession,
  findAdminForToken,
  hashPassword,
  rotateAdminSessions,
  verifyPassword,
};
