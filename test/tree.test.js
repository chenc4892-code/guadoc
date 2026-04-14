const test = require("node:test");
const assert = require("node:assert/strict");
const { collectDescendantIds, decorateNodes, filterVisibleTree, previousNextForPage } = require("../src/lib/tree");

const sampleNodes = [
  { id: 1, parent_id: null, kind: "group", title: "Group", slug: "group", is_published: 1, sort_order: 0 },
  { id: 2, parent_id: 1, kind: "page", title: "Page A", slug: "page-a", is_published: 1, sort_order: 0 },
  { id: 3, parent_id: 1, kind: "group", title: "Nested", slug: "nested", is_published: 1, sort_order: 1 },
  { id: 4, parent_id: 3, kind: "page", title: "Page B", slug: "page-b", is_published: 1, sort_order: 0 },
];

test("decorateNodes computes full paths and descendants", () => {
  const decorated = decorateNodes(sampleNodes);
  const nestedGroup = decorated.byId.get(3);
  const pageB = decorated.byId.get(4);

  assert.equal(pageB.full_path, "group/nested/page-b");
  assert.deepEqual(collectDescendantIds(nestedGroup), [4]);
});

test("filterVisibleTree hides draft groups and keeps published pagination order", () => {
  const decorated = decorateNodes(
    sampleNodes.map((node) =>
      node.id === 3
        ? {
            ...node,
            is_published: 0,
          }
        : node,
    ),
  );
  const visibleTree = filterVisibleTree(decorated.roots);
  const visiblePages = [];

  const collectPages = (nodes) => {
    nodes.forEach((node) => {
      if (node.kind === "page") {
        visiblePages.push(node);
      }

      collectPages(node.children);
    });
  };

  collectPages(visibleTree);

  assert.deepEqual(visiblePages.map((page) => page.id), [2]);
  assert.deepEqual(previousNextForPage(visiblePages, 2), { previous: null, next: null });
});
