// Helpers minimos de DOM para evitar repetir querySelector en cada modulo.
(function () {
  window.App.dom = {
    $: (selector, root = document) => root.querySelector(selector),
    $$: (selector, root = document) => Array.from(root.querySelectorAll(selector))
  };
})();
