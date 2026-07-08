// Modulo: buscador del banco de preguntas.
// Responsabilidad: manejar filtros, paginacion y render del listado publico.
(function () {
  const LIMIT = 10;
  const App = window.App;
  const { $ } = App.dom;
  const api = App.api;
  const ui = App.ui;

  let totalPreguntas = 0;
  let searchTerm = "";
  let currentSkip = 0;

  async function buscarPreguntas(skip = 0) {
    currentSkip = skip;
    searchTerm = $("#searchInput").value.trim();

    const resultados = $("#resultados");
    const paginador = $("#paginador");
    resultados.innerHTML = ui.loading("Buscando preguntas...");
    paginador.innerHTML = "";

    let result;
    try {
      result = await api.get("/questions", { limit: LIMIT, skip, search: searchTerm });
    } catch (e) {
      resultados.innerHTML = ui.connectionError();
      return;
    }

    const data = result.data;
    totalPreguntas = data.total;

    if (!data.total) {
      resultados.innerHTML = ui.emptyState({
        icon: "fa-magnifying-glass",
        title: "Sin resultados",
        message: `No se encontraron preguntas que contengan "<strong>${escapeHTML(searchTerm)}</strong>". Prueba con otra palabra clave.`
      });
      return;
    }

    const desde = skip + 1;
    const hasta = Math.min(skip + LIMIT, data.total);
    resultados.innerHTML = `
      <p class="text-secondary mb-3">
        Mostrando <strong class="text-body">${desde}&ndash;${hasta}</strong> de <strong class="text-body">${data.total}</strong> pregunta(s)
        ${searchTerm ? `para "<strong class="text-body">${escapeHTML(searchTerm)}</strong>"` : ""}
      </p>
    `;

    Object.values(data.preguntas || {}).forEach(question => {
      resultados.insertAdjacentHTML("beforeend", ui.questionReviewCard(question, {
        number: question.qid,
        term: searchTerm,
        showDomain: Boolean(question.domain),
        explanationMode: "highlight"
      }));
    });

    renderPaginador();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderPaginador() {
    const paginador = $("#paginador");
    paginador.innerHTML = "";
    paginador.appendChild(ui.pagination({
      totalItems: totalPreguntas,
      limit: LIMIT,
      currentSkip,
      onPage: buscarPreguntas
    }));
  }

  document.addEventListener("DOMContentLoaded", () => {
    ui.initLayout();
    $("#searchForm").addEventListener("submit", () => buscarPreguntas(0));

    // Carga inicial: el usuario ve contenido sin tener que hacer clic.
    buscarPreguntas(0);
  });
})();
