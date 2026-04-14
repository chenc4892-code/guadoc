const sidebar = document.getElementById("site-sidebar");
const toggle = document.querySelector("[data-nav-toggle]");

if (sidebar && toggle) {
  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
  });
}
