const sidebar = document.getElementById("site-sidebar");
const toggle = document.querySelector("[data-nav-toggle]");
const backdrop = document.getElementById("sidebar-backdrop");

if (sidebar && toggle) {
  const setSidebarOpen = (isOpen) => {
    sidebar.classList.toggle("is-open", isOpen);
    document.body.classList.toggle("is-nav-open", isOpen);
    if (backdrop) {
      backdrop.hidden = !isOpen;
    }
    toggle.setAttribute("aria-expanded", String(isOpen));
  };

  toggle.addEventListener("click", () => {
    setSidebarOpen(!sidebar.classList.contains("is-open"));
  });

  backdrop?.addEventListener("click", () => {
    setSidebarOpen(false);
  });

  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      setSidebarOpen(false);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSidebarOpen(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) {
      setSidebarOpen(false);
    }
  });
}

document.querySelectorAll(".doc-content pre").forEach((block) => {
  const code = block.querySelector("code");

  if (!code || block.querySelector(".code-copy-button")) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "code-copy-button";
  button.textContent = "Copy";
  button.setAttribute("aria-label", "Copy code block");

  button.addEventListener("click", async () => {
    const originalLabel = button.textContent;
    const codeText = code.textContent || "";

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codeText);
      } else {
        const textarea = document.createElement("textarea");

        textarea.value = codeText;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }

      button.textContent = "Copied";
    } catch (_error) {
      button.textContent = "Failed";
    }

    window.setTimeout(() => {
      button.textContent = originalLabel;
    }, 1600);
  });

  block.appendChild(button);
});
