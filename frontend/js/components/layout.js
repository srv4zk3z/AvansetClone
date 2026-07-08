// Componente de layout: comportamiento compartido del sidebar.
(function () {
  const { $ } = window.App.dom;

  function initLayout() {
    const toggle = $("#toggleSidebar");
    const sidebar = $("#sidebar");
    const main = $("#mainContent");
    if (!toggle || !sidebar || !main) return;

    toggle.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      main.classList.toggle("shifted");
    });
  }

  window.App.ui = window.App.ui || {};
  window.App.ui.initLayout = initLayout;
})();
