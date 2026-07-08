// Capa de transporte HTTP.
// Mantener aqui las llamadas fetch evita que cada pantalla conozca detalles
// repetidos de headers, query params y parseo JSON.
(function () {
  const API_BASE = "";

  function buildUrl(path, params = {}) {
    const url = new URL(API_BASE + path, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
    return url.pathname + url.search;
  }

  async function request(path, { method = "GET", params, body } = {}) {
    const response = await fetch(buildUrl(path, params), {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    return { ok: response.ok, data, response };
  }

  window.App.api = {
    get: (path, params) => request(path, { params }),
    post: (path, body) => request(path, { method: "POST", body }),
    put: (path, body) => request(path, { method: "PUT", body }),
    del: (path) => request(path, { method: "DELETE" })
  };
})();
