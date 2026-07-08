// Modulo: preguntas mas falladas.
// Responsabilidad: pedir el ranking de errores y mostrar tarjetas de repaso.
(function () {
  const App = window.App;
  const { $ } = App.dom;
  const api = App.api;
  const ui = App.ui;

  async function cargarPreguntas() {
    const input = $("#limit");
    const limit = Math.min(Math.max(parseInt(input.value) || 5, 1), 100);
    input.value = limit;

    const resultado = $("#resultado");
    resultado.innerHTML = ui.loading("Cargando tus preguntas mas falladas...");

    let result;
    try {
      result = await api.get("/exam/weakest", { limit });
    } catch (e) {
      resultado.innerHTML = ui.connectionError();
      return;
    }

    const data = result.data;
    if (!result.ok || !data.exam || data.exam.length === 0) {
      resultado.innerHTML = ui.emptyState({
        icon: "fa-circle-check",
        title: "Sin errores registrados",
        message: escapeHTML(data.detail || "Aun no tienes preguntas falladas. Haz un examen en el Simulador y aqui apareceran las que respondas mal.")
      });
      return;
    }

    resultado.innerHTML = `
      <p class="text-secondary mb-3">
        Mostrando <strong class="text-body">${data.exam.length}</strong> pregunta(s), de la mas fallada a la menos fallada.
      </p>
    `;

    data.exam.forEach((question, index) => {
      resultado.insertAdjacentHTML("beforeend", ui.questionReviewCard(question, {
        number: index + 1,
        showDomain: true
      }));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    ui.initLayout();
    $("#filtroForm").addEventListener("submit", cargarPreguntas);

    // Carga inicial para que la pantalla tenga contenido al abrirse.
    cargarPreguntas();
  });
})();
