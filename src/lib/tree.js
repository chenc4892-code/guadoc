const sortNodes = (nodes) =>
  [...nodes].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return left.title.localeCompare(right.title);
  });

const decorateNodes = (nodes) => {
  const byId = new Map();
  const cloned = nodes.map((node) => ({
    ...node,
    children: [],
    depth: 0,
    full_path: "",
    url: null,
  }));

  cloned.forEach((node) => {
    byId.set(node.id, node);
  });

  const roots = [];

  cloned.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id).children.push(node);
      return;
    }

    roots.push(node);
  });

  const walk = (list, parentPath = "", depth = 0) => {
    const ordered = sortNodes(list);

    ordered.forEach((node) => {
      node.depth = depth;
      node.full_path = parentPath ? `${parentPath}/${node.slug}` : node.slug;
      node.url = node.kind === "page" ? `/docs/${node.full_path}` : null;
      walk(node.children, node.full_path, depth + 1);
    });

    return ordered;
  };

  const orderedRoots = walk(roots);
  const pages = [];

  const collectPages = (list) => {
    list.forEach((node) => {
      if (node.kind === "page") {
        pages.push(node);
      }

      collectPages(node.children);
    });
  };

  collectPages(orderedRoots);

  return {
    roots: orderedRoots,
    pages,
    byId,
  };
};

const filterVisibleTree = (nodes) =>
  nodes
    .map((node) => ({
      ...node,
      children: filterVisibleTree(node.children),
    }))
    .filter((node) => {
      if (node.kind === "page") {
        return Boolean(node.is_published);
      }

      return Boolean(node.is_published) && node.children.length > 0;
    });

const findPageByPath = (pages, fullPath = "") =>
  pages.find((page) => page.full_path === fullPath) || null;

const previousNextForPage = (pages, pageId) => {
  const visiblePages = pages.filter((page) => page.is_published);
  const index = visiblePages.findIndex((page) => page.id === pageId);

  return {
    previous: index > 0 ? visiblePages[index - 1] : null,
    next: index >= 0 && index < visiblePages.length - 1 ? visiblePages[index + 1] : null,
  };
};

const collectDescendantIds = (node) => {
  const ids = [];

  const walk = (currentNode) => {
    currentNode.children.forEach((child) => {
      ids.push(child.id);
      walk(child);
    });
  };

  walk(node);
  return ids;
};

module.exports = {
  collectDescendantIds,
  decorateNodes,
  filterVisibleTree,
  findPageByPath,
  previousNextForPage,
};
