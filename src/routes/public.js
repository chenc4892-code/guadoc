const express = require("express");
const { buildToc, renderContentHtml } = require("../lib/content");
const { decorateNodes, filterVisibleTree, findPageByPath, previousNextForPage } = require("../lib/tree");

const buildSearchQuery = (query = "") => {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter(Boolean);

  if (tokens.length === 0) {
    return "";
  }

  return tokens.map((token) => `${token}*`).join(" AND ");
};

const publicRouter = ({ dbApi }) => {
  const router = express.Router();

  const loadSiteContext = () => {
    const settings = dbApi.getSettings();
    const decorated = decorateNodes(dbApi.getAllNodes());
    const tree = filterVisibleTree(decorated.roots);
    const publishedPages = [];

    const collectVisiblePages = (nodes) => {
      nodes.forEach((node) => {
        if (node.kind === "page") {
          publishedPages.push(node);
        }

        collectVisiblePages(node.children);
      });
    };

    collectVisiblePages(tree);

    return {
      settings,
      tree,
      pages: publishedPages,
    };
  };

  router.get("/", (req, res) => {
    const site = loadSiteContext();
    const firstPage = site.pages[0];

    if (!firstPage) {
      res.render("empty", { pageTitle: "No Content Yet", site });
      return;
    }

    res.redirect(firstPage.url);
  });

  router.get("/search", (req, res) => {
    const site = loadSiteContext();
    const q = String(req.query.q || "").trim();
    let results = [];

    if (q) {
      const ftsQuery = buildSearchQuery(q);

      if (ftsQuery) {
        results = dbApi.db
          .prepare(
            `
              SELECT
                nodes.id,
                nodes.title,
                snippet(search_index, 1, '<mark>', '</mark>', ' ... ', 24) AS snippet
              FROM search_index
              JOIN nodes ON nodes.id = search_index.rowid
              WHERE search_index MATCH ?
                AND nodes.is_published = 1
              ORDER BY bm25(search_index)
              LIMIT 20
            `,
          )
          .all(ftsQuery)
          .map((row) => {
            const page = site.pages.find((item) => item.id === row.id);
            return page
              ? {
              ...row,
              url: page?.url || "#",
                }
              : null;
          });

        results = results.filter(Boolean);
      }
    }

    res.render("search", {
      pageTitle: q ? `Search: ${q}` : "Search",
      query: q,
      results,
      site,
    });
  });

  router.get("/api/pages", (req, res) => {
    const site = loadSiteContext();

    res.json({
      items: site.pages.map((page) => ({
        id: page.id,
        title: page.title,
        excerpt: page.excerpt,
        path: page.full_path,
        url: page.url,
        updated_at: page.updated_at,
      })),
    });
  });

  router.get("/api/page", (req, res) => {
    const site = loadSiteContext();
    const requestedPath = String(req.query.path || "").replace(/^\/+|\/+$/g, "");
    const page = findPageByPath(site.pages, requestedPath);

    if (!page) {
      res.status(404).json({ error: "Page not found." });
      return;
    }

    res.json({
      id: page.id,
      title: page.title,
      excerpt: page.excerpt,
      content_html: page.content_html,
      path: page.full_path,
      url: page.url,
      updated_at: page.updated_at,
    });
  });

  router.get("/api/search", (req, res) => {
    const q = String(req.query.q || "").trim();
    const site = loadSiteContext();
    const ftsQuery = buildSearchQuery(q);

    if (!ftsQuery) {
      res.json({ items: [] });
      return;
    }

    const items = dbApi.db
      .prepare(
        `
          SELECT nodes.id, nodes.title, snippet(search_index, 1, '', '', ' ... ', 20) AS snippet
          FROM search_index
          JOIN nodes ON nodes.id = search_index.rowid
          WHERE search_index MATCH ?
            AND nodes.is_published = 1
          ORDER BY bm25(search_index)
          LIMIT 20
        `,
      )
      .all(ftsQuery)
      .map((row) => {
        const page = site.pages.find((item) => item.id === row.id);
        return page
          ? {
              ...row,
              path: page.full_path,
              url: page.url,
            }
          : null;
      })
      .filter(Boolean);

    res.json({ items });
  });

  router.get(/^\/docs(?:\/(.*))?$/, (req, res, next) => {
    const site = loadSiteContext();
    const requestedPath = (req.params[0] || "").replace(/^\/+|\/+$/g, "");
    const page = requestedPath ? findPageByPath(site.pages, requestedPath) : site.pages[0];

    if (!page) {
      next();
      return;
    }

    const renderedContentHtml = renderContentHtml(page.content_html);
    const toc = buildToc(renderedContentHtml);
    const pagination = previousNextForPage(site.pages, page.id);

    res.render("page", {
      page: {
        ...page,
        content_html: renderedContentHtml,
      },
      pageTitle: page.meta_title || page.title,
      pagination,
      site,
      toc,
    });
  });

  return router;
};

module.exports = publicRouter;
