const config = require("../lib/config");
const { findAdminForToken } = require("../lib/auth");

const attachAdmin = (db) => (req, res, next) => {
  const token = req.cookies[config.cookieName];
  const admin = findAdminForToken(db, token);

  req.admin = admin;
  res.locals.currentAdmin = admin;
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.admin) {
    next();
    return;
  }

  res.redirect("/admin/login");
};

module.exports = {
  attachAdmin,
  requireAdmin,
};
