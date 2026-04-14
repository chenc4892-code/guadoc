const path = require("path");
const express = require("express");
const multer = require("multer");
const { createSession, destroySession, hashPassword, rotateAdminSessions, verifyPassword } = require("../lib/auth");
const config = require("../lib/config");
const { relativeUploadPath, slugFromValue } = require("../lib/content");
const { collectDescendantIds, decorateNodes } = require("../lib/tree");
const { requireAdmin } = require("../middleware/admin");

const adminRouter = ({ dbApi }) => {
  const router = express.Router();

  const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, config.uploadsDir);
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname || "").toLowerCase() || ".bin";
      const baseName = slugFromValue(path.basename(file.originalname || "image", extension), "image");
      callback(null, `${Date.now()}-${baseName}${extension}`);
    },
  });

  const upload = multer({
    storage,
    fileFilter: (_req, file, callback) => {
      if (!file.mimetype.startsWith("image/")) {
        callback(new Error("Only image uploads are allowed."));
        return;
      }

      callback(null, true);
    },
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });

  const setSessionCookie = (res, token, expiresAt) => {
    res.cookie(config.cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: Boolean(config.appOrigin.startsWith("https://")),
      expires: new Date(expiresAt),
    });
  };

  const clearSessionCookie = (res) => {
    res.clearCookie(config.cookieName, {
      httpOnly: true,
      sameSite: "lax",
    });
  };

  const dashboardContext = () => ({
    settings: dbApi.getSettings(),
    tree: decorateNodes(dbApi.getAllNodes()).roots,
  });

  router.get("/login", (req, res) => {
    if (req.admin) {
      res.redirect("/admin");
      return;
    }

    res.render("admin/login", {
      error: "",
      settings: dbApi.getSettings(),
    });
  });

  router.post("/login", (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const admin = dbApi.findAdminByUsername(username);

    if (!admin || !verifyPassword(password, admin.password_hash)) {
      res.status(401).render("admin/login", {
        error: "Invalid username or password.",
        settings: dbApi.getSettings(),
      });
      return;
    }

    const session = createSession(dbApi.db, admin.id);
    setSessionCookie(res, session.token, session.expiresAt);
    res.redirect("/admin");
  });

  router.post("/logout", requireAdmin, (req, res) => {
    destroySession(dbApi.db, req.cookies[config.cookieName]);
    clearSessionCookie(res);
    res.redirect("/admin/login");
  });

  router.get("/", requireAdmin, (req, res) => {
    res.render("admin/dashboard", dashboardContext());
  });

  router.get("/nodes/new", requireAdmin, (req, res) => {
    const kind = req.query.kind === "group" ? "group" : "page";
    const parentId = req.query.parentId ? Number(req.query.parentId) : null;

    res.render("admin/editor", {
      action: "/admin/nodes",
      allNodes: decorateNodes(dbApi.getAllNodes()).roots,
      error: "",
      node: {
        id: null,
        kind,
        title: "",
        slug: "",
        excerpt: "",
        content_html: "",
        meta_title: "",
        meta_description: "",
        is_published: 1,
        parent_id: parentId,
      },
      blockedParentIds: [],
      settings: dbApi.getSettings(),
    });
  });

  router.get("/nodes/:id/edit", requireAdmin, (req, res) => {
    const node = dbApi.getNodeById(Number(req.params.id));

    if (!node) {
      res.redirect("/admin");
      return;
    }

    const decorated = decorateNodes(dbApi.getAllNodes());
    const currentNode = decorated.byId.get(node.id);

    res.render("admin/editor", {
      action: `/admin/nodes/${node.id}`,
      allNodes: decorated.roots,
      blockedParentIds: [node.id, ...collectDescendantIds(currentNode)],
      error: "",
      node,
      settings: dbApi.getSettings(),
    });
  });

  const parseNodeForm = (req) => ({
    parent_id: req.body.parent_id ? Number(req.body.parent_id) : null,
    title: String(req.body.title || "").trim(),
    slug: String(req.body.slug || "").trim(),
    excerpt: String(req.body.excerpt || "").trim(),
    content_html: String(req.body.content_html || ""),
    meta_title: String(req.body.meta_title || "").trim(),
    meta_description: String(req.body.meta_description || "").trim(),
    is_published: req.body.is_published === "1",
  });

  const validateParent = (payload, options = {}) => {
    if (!payload.parent_id) {
      return "";
    }

    const parent = dbApi.getNodeById(payload.parent_id);

    if (!parent) {
      return "Selected parent group does not exist.";
    }

    if (parent.kind !== "group") {
      return "Items can only be placed inside groups.";
    }

    if (options.blockedParentIds?.includes(parent.id)) {
      return "This parent would create an invalid nesting cycle.";
    }

    return "";
  };

  router.post("/nodes", requireAdmin, (req, res) => {
    const kind = req.body.kind === "group" ? "group" : "page";
    const payload = parseNodeForm(req);
    const parentError = validateParent(payload);

    if (!payload.title || parentError) {
      res.status(422).render("admin/editor", {
        action: "/admin/nodes",
        allNodes: decorateNodes(dbApi.getAllNodes()).roots,
        blockedParentIds: [],
        error: parentError || "Title is required.",
        node: {
          ...payload,
          id: null,
          kind,
        },
        settings: dbApi.getSettings(),
      });
      return;
    }

    try {
      dbApi.createNode({
        ...payload,
        kind,
      });
      res.redirect("/admin");
    } catch (error) {
      res.status(422).render("admin/editor", {
        action: "/admin/nodes",
        allNodes: decorateNodes(dbApi.getAllNodes()).roots,
        blockedParentIds: [],
        error: "A sibling item already uses this slug. Choose a different slug.",
        node: {
          ...payload,
          id: null,
          kind,
        },
        settings: dbApi.getSettings(),
      });
    }
  });

  router.post("/nodes/:id", requireAdmin, (req, res) => {
    const node = dbApi.getNodeById(Number(req.params.id));

    if (!node) {
      res.redirect("/admin");
      return;
    }

    const payload = parseNodeForm(req);
    const decorated = decorateNodes(dbApi.getAllNodes());
    const currentNode = decorated.byId.get(node.id);
    const blockedParentIds = [node.id, ...collectDescendantIds(currentNode)];
    const parentError = validateParent(payload, { blockedParentIds });

    if (!payload.title || parentError) {
      res.status(422).render("admin/editor", {
        action: `/admin/nodes/${node.id}`,
        allNodes: decorated.roots,
        blockedParentIds,
        error: parentError || "Title is required.",
        node: {
          ...node,
          ...payload,
        },
        settings: dbApi.getSettings(),
      });
      return;
    }

    try {
      dbApi.updateNode(node.id, payload);
      res.redirect("/admin");
    } catch (error) {
      res.status(422).render("admin/editor", {
        action: `/admin/nodes/${node.id}`,
        allNodes: decorated.roots,
        blockedParentIds,
        error: "A sibling item already uses this slug. Choose a different slug.",
        node: {
          ...node,
          ...payload,
        },
        settings: dbApi.getSettings(),
      });
    }
  });

  router.post("/nodes/:id/delete", requireAdmin, (req, res) => {
    dbApi.deleteNode(Number(req.params.id));
    res.redirect("/admin");
  });

  router.post("/nodes/reorder", requireAdmin, (req, res) => {
    const tree = Array.isArray(req.body.tree) ? req.body.tree : [];
    dbApi.reorderNodes(tree);
    res.json({ ok: true });
  });

  router.post("/uploads/image", requireAdmin, upload.single("file"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No image received." });
      return;
    }

    res.json({
      location: relativeUploadPath(req.file.filename),
    });
  });

  router.get("/settings", requireAdmin, (req, res) => {
    res.render("admin/settings", {
      adminError: "",
      adminSuccess: "",
      settings: dbApi.getSettings(),
      siteSuccess: "",
    });
  });

  router.post("/settings/site", requireAdmin, (req, res) => {
    dbApi.saveSettings({
      site_title: String(req.body.site_title || "").trim(),
      site_tagline: String(req.body.site_tagline || "").trim(),
      site_description: String(req.body.site_description || "").trim(),
      custom_css: String(req.body.custom_css || ""),
    });

    res.render("admin/settings", {
      adminError: "",
      adminSuccess: "",
      settings: dbApi.getSettings(),
      siteSuccess: "Site settings saved.",
    });
  });

  router.post("/settings/account", requireAdmin, (req, res) => {
    const admin = dbApi.getSingleAdmin();
    const currentPassword = String(req.body.current_password || "");
    const username = String(req.body.username || "").trim();
    const newPassword = String(req.body.new_password || "");

    if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
      res.status(422).render("admin/settings", {
        adminError: "Current password is incorrect.",
        adminSuccess: "",
        settings: dbApi.getSettings(),
        siteSuccess: "",
      });
      return;
    }

    if (!username || !newPassword) {
      res.status(422).render("admin/settings", {
        adminError: "Username and new password are required.",
        adminSuccess: "",
        settings: dbApi.getSettings(),
        siteSuccess: "",
      });
      return;
    }

    try {
      dbApi.updateAdminCredentials(admin.id, username, hashPassword(newPassword));
      rotateAdminSessions(dbApi.db, admin.id);
      clearSessionCookie(res);

      res.render("admin/login", {
        error: "Credentials updated. Sign in again with the new password.",
        settings: dbApi.getSettings(),
      });
    } catch (error) {
      res.status(422).render("admin/settings", {
        adminError: "That username is already in use.",
        adminSuccess: "",
        settings: dbApi.getSettings(),
        siteSuccess: "",
      });
    }
  });

  return router;
};

module.exports = adminRouter;
