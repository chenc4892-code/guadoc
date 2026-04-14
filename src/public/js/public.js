document.querySelectorAll("pre code").forEach((block) => {
  if (window.hljs) {
    window.hljs.highlightElement(block);
  }
});

const sidebar = document.getElementById("site-sidebar");
const toggle = document.querySelector("[data-nav-toggle]");

if (sidebar && toggle) {
  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
  });
}
