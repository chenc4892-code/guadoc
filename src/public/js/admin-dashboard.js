import Sortable from "/vendor/sortablejs/modular/sortable.core.esm.js";

const treeRoot = document.getElementById("tree-root");

const serializeList = (list) =>
  Array.from(list.children).map((item) => {
    const childList = item.querySelector(":scope > .tree-children > .tree-list");

    return {
      id: Number(item.dataset.nodeId),
      children: childList ? serializeList(childList) : [],
    };
  });

const rootList = treeRoot?.querySelector(":scope > .tree-list");

const saveTree = async () => {
  if (!rootList) {
    return;
  }

  await fetch("/admin/nodes/reorder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tree: serializeList(rootList),
    }),
  });
};

document.querySelectorAll(".tree-list").forEach((list) => {
  new Sortable(list, {
    group: "guadoc-tree",
    animation: 160,
    handle: ".tree-card__handle",
    ghostClass: "sortable-ghost",
    onEnd: () => {
      saveTree().catch(() => {
        window.location.reload();
      });
    },
  });
});

document.querySelectorAll("[data-confirm]").forEach((button) => {
  button.addEventListener("click", (event) => {
    if (!window.confirm(button.dataset.confirm)) {
      event.preventDefault();
    }
  });
});
