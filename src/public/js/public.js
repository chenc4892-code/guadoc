const sidebar = document.getElementById("site-sidebar");
const toggle = document.querySelector("[data-nav-toggle]");
const backdrop = document.getElementById("sidebar-backdrop");

if (sidebar && toggle) {
  const setSidebarOpen = (isOpen) => {
    sidebar.classList.toggle("is-open", isOpen);
    document.body.classList.toggle("is-nav-open", isOpen);
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
