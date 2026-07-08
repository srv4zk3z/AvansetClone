// Componentes visuales para estados genericos: carga, error, vacio y avisos.
(function () {
  function loading(message) {
    return `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        ${message ? `<p class="text-secondary mt-3 mb-0">${escapeHTML(message)}</p>` : ""}
      </div>
    `;
  }

  function connectionError(message = "No se pudo conectar con el servidor. Verifica que la API este corriendo e intentalo de nuevo.") {
    return `
      <div class="alert alert-danger d-flex align-items-center gap-2">
        <i class="fas fa-plug-circle-xmark"></i>
        <div>${escapeHTML(message)}</div>
      </div>
    `;
  }

  function emptyState({ icon, title, message }) {
    return `
      <div class="card text-center">
        <div class="card-body py-5">
          <i class="fas ${icon} fa-2x text-secondary mb-3"></i>
          <h5>${escapeHTML(title)}</h5>
          <p class="text-secondary mb-0">${message}</p>
        </div>
      </div>
    `;
  }

  function notify(container, message, type = "success") {
    const div = document.createElement("div");
    div.className = `alert alert-${type} alert-dismissible fade show`;
    div.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    container.appendChild(div);
    setTimeout(() => div.remove(), 5000);
  }

  Object.assign(window.App.ui, {
    loading,
    connectionError,
    emptyState,
    notify
  });
})();
