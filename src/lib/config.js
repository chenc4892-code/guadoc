const path = require("path");

const rootDir = process.cwd();
const dataDir = process.env.DATA_DIR || path.join(rootDir, "data");

module.exports = {
  rootDir,
  dataDir,
  dbPath: process.env.DATABASE_PATH || path.join(dataDir, "guadoc.sqlite"),
  uploadsDir: process.env.UPLOADS_DIR || path.join(dataDir, "uploads"),
  port: Number(process.env.PORT || 3210),
  appOrigin: process.env.APP_ORIGIN || "",
  cookieName: process.env.COOKIE_NAME || "guadoc_session",
  sessionDays: Number(process.env.SESSION_DAYS || 30),
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "change-me-now",
};
