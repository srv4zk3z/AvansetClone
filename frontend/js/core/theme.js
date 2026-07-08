const THEME_STORAGE_KEY = "examPrepareTheme";
const DEFAULT_THEME = "dark";

function getStoredTheme() {
  let theme;
  try {
    theme = localStorage.getItem(THEME_STORAGE_KEY);
  } catch (e) {
    theme = DEFAULT_THEME;
  }
  return theme === "light" || theme === "dark" ? theme : DEFAULT_THEME;
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-bs-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {
    // El tema sigue activo en la sesion aunque el navegador bloquee storage.
  }

  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  const isLight = theme === "light";
  toggle.setAttribute("aria-pressed", String(isLight));
  toggle.title = isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro";
  toggle.innerHTML = `
    <i class="fas ${isLight ? "fa-moon" : "fa-sun"}"></i>
    <span>${isLight ? "Oscuro" : "Claro"}</span>
  `;
}

function mountThemeToggle() {
  const sidebar = document.getElementById("sidebar");
  const nav = sidebar?.querySelector(".nav");
  if (!sidebar || !nav || document.getElementById("themeToggle")) return;

  const item = document.createElement("div");
  item.className = "theme-toggle-wrap";
  item.innerHTML = `
    <button class="theme-toggle" id="themeToggle" type="button" aria-pressed="false">
      <i class="fas fa-sun"></i>
      <span>Claro</span>
    </button>
  `;

  sidebar.insertBefore(item, nav);
  document.getElementById("themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-bs-theme") || DEFAULT_THEME;
    applyTheme(current === "dark" ? "light" : "dark");
  });
  applyTheme(getStoredTheme());
}

applyTheme(getStoredTheme());
document.addEventListener("DOMContentLoaded", mountThemeToggle);
