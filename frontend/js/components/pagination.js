// Componente de paginacion reutilizable.
(function () {
  function pagination({
    totalItems,
    limit,
    currentSkip,
    onPage,
    maxButtons = 7,
    compact = false
  }) {
    const totalPages = Math.ceil(totalItems / limit);
    const wrap = document.createElement("div");
    if (totalPages <= 1) return wrap;

    const currentPage = currentSkip / limit;
    const mkBtn = (label, page, { disabled = false, active = false, title = "" } = {}) => {
      const btn = document.createElement("button");
      btn.className = `btn btn-sm ${active ? "btn-primary" : "btn-outline-secondary"}`;
      btn.innerHTML = label;
      btn.disabled = disabled;
      if (title) btn.title = title;
      if (!disabled && !active) btn.addEventListener("click", () => onPage(page * limit));
      return btn;
    };

    wrap.appendChild(mkBtn('<i class="fas fa-chevron-left"></i>', currentPage - 1, {
      disabled: currentPage === 0,
      title: "Pagina anterior"
    }));

    if (compact) {
      const info = document.createElement("span");
      info.className = "text-secondary small";
      info.textContent = `Pagina ${currentPage + 1} de ${totalPages}`;
      wrap.appendChild(info);
    } else {
      let start = Math.max(0, currentPage - Math.floor(maxButtons / 2));
      let end = Math.min(totalPages, start + maxButtons);
      start = Math.max(0, end - maxButtons);
      for (let i = start; i < end; i++) {
        wrap.appendChild(mkBtn(String(i + 1), i, { active: i === currentPage }));
      }
    }

    wrap.appendChild(mkBtn('<i class="fas fa-chevron-right"></i>', currentPage + 1, {
      disabled: currentPage >= totalPages - 1,
      title: "Pagina siguiente"
    }));

    if (!compact) {
      const info = document.createElement("span");
      info.className = "text-secondary small ms-2";
      info.textContent = `Pagina ${currentPage + 1} de ${totalPages}`;
      wrap.appendChild(info);
    }

    return wrap;
  }

  window.App.ui.pagination = pagination;
})();
