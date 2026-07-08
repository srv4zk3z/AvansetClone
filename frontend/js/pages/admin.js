// Modulo: administracion del banco de preguntas.
// Responsabilidad: listar, crear, editar y eliminar preguntas desde el panel.
(function () {
  const App = window.App;
  const { $, $$ } = App.dom;
  const api = App.api;
  const ui = App.ui;

  const LIMIT = 10;
  const MAX_IMG_BYTES = 1.5 * 1024 * 1024;

  let totalPreguntas = 0;
  let currentSkip = 0;
  let imagenBase64 = "";
  let qidAEliminar = null;
  let modalPregunta;
  let modalEliminar;
  const dominios = new Set();

  async function cargarLista(skip = 0) {
    currentSkip = skip;
    const term = $("#searchInput").value.trim();
    const lista = $("#lista");
    lista.innerHTML = ui.loading();

    let result;
    try {
      result = await api.get("/questions", { limit: LIMIT, skip, search: term });
    } catch (e) {
      lista.innerHTML = ui.connectionError("No se pudo conectar con el servidor.");
      return;
    }

    const data = result.data;
    totalPreguntas = data.total;
    const preguntas = Object.values(data.preguntas || {});

    if (preguntas.length === 0) {
      lista.innerHTML = ui.emptyState({
        icon: "fa-inbox",
        title: `No hay preguntas${term ? " que coincidan con la busqueda" : ""}`,
        message: 'Usa el boton "Nueva pregunta" para crear la primera.'
      });
      renderPaginador();
      return;
    }

    preguntas.forEach(question => {
      if (question.domain) dominios.add(question.domain);
    });
    actualizarDatalist();

    lista.innerHTML = `
      <div class="card">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width:70px;">ID</th>
                <th>Pregunta</th>
                <th style="width:130px;">Tipo</th>
                <th style="width:180px;">Dominio</th>
                <th style="width:110px;" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${preguntas.map(question => `
                <tr>
                  <td class="text-secondary">${question.qid}</td>
                  <td>${escapeHTML(shortText(question.question, 90))}</td>
                  <td><span class="badge ${question.type === "match" ? "text-bg-info" : "badge-domain"}">${question.type === "match" ? "Emparejar" : "Opcion multiple"}</span></td>
                  <td class="text-secondary">${escapeHTML(question.domain || "-")}</td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary js-edit-question" title="Editar" data-qid="${question.qid}">
                      <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger js-delete-question" title="Eliminar" data-qid="${question.qid}" data-question="${escapeHTML(shortText(question.question, 80))}">
                      <i class="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
      <p class="text-secondary small mt-2">Total: ${data.total} pregunta(s)</p>
    `;
    renderPaginador();
  }

  function shortText(text, max) {
    const value = String(text || "");
    return value.length > max ? value.slice(0, max) + "..." : value;
  }

  function renderPaginador() {
    const paginador = $("#paginador");
    paginador.innerHTML = "";
    paginador.appendChild(ui.pagination({
      totalItems: totalPreguntas,
      limit: LIMIT,
      currentSkip,
      onPage: cargarLista,
      compact: true
    }));
  }

  function actualizarDatalist() {
    $("#domainsList").innerHTML =
      [...dominios].sort().map(domain => `<option value="${escapeHTML(domain)}">`).join("");
  }

  function avisar(mensaje, tipo = "success") {
    ui.notify($("#avisos"), mensaje, tipo);
  }

  function cambiarTipo() {
    const esMatch = $("#fType").value === "match";
    $("#seccionMC").style.display = esMatch ? "none" : "block";
    $("#seccionMatch").style.display = esMatch ? "block" : "none";
  }

  function agregarOpcion(texto = "", correcta = false) {
    const row = document.createElement("div");
    row.className = "d-flex gap-2 align-items-center mb-2 fila-opcion";
    row.innerHTML = `
      <div class="form-check mb-0" title="Marcar como correcta">
        <input class="form-check-input opcion-correcta" type="checkbox" ${correcta ? "checked" : ""}>
      </div>
      <input type="text" class="form-control opcion-texto" placeholder="Texto de la opcion">
      <button type="button" class="btn btn-sm btn-outline-danger js-remove-row" title="Quitar opcion">
        <i class="fas fa-xmark"></i>
      </button>
    `;
    row.querySelector(".opcion-texto").value = texto;
    row.querySelector(".js-remove-row").addEventListener("click", () => row.remove());
    $("#opcionesContainer").appendChild(row);
  }

  function agregarPar(item = "", target = "") {
    const row = document.createElement("div");
    row.className = "d-flex gap-2 align-items-center mb-2 fila-par";
    row.innerHTML = `
      <input type="text" class="form-control par-item" placeholder="Elemento">
      <i class="fas fa-arrow-right text-secondary"></i>
      <input type="text" class="form-control par-target" placeholder="Se empareja con...">
      <button type="button" class="btn btn-sm btn-outline-danger js-remove-row" title="Quitar par">
        <i class="fas fa-xmark"></i>
      </button>
    `;
    row.querySelector(".par-item").value = item;
    row.querySelector(".par-target").value = target;
    row.querySelector(".js-remove-row").addEventListener("click", () => row.remove());
    $("#paresContainer").appendChild(row);
  }

  function cargarImagen(input) {
    const file = input.files[0];
    if (!file) return;

    const tiposValidos = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!tiposValidos.includes(file.type)) {
      avisar("Formato no soportado. Usa PNG, JPEG, GIF o WebP.", "danger");
      input.value = "";
      return;
    }
    if (file.size > MAX_IMG_BYTES) {
      avisar(`La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el maximo es 1.5 MB. Reducela e intentalo de nuevo.`, "danger");
      input.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      imagenBase64 = reader.result.split(",")[1];
      $("#imagenPreview").src = reader.result;
      $("#imagenPreviewWrap").style.display = "block";
    };
    reader.readAsDataURL(file);
  }

  function quitarImagen() {
    imagenBase64 = "";
    $("#fImage").value = "";
    $("#imagenPreviewWrap").style.display = "none";
  }

  function limpiarFormulario() {
    $("#editQid").value = "";
    $("#fQuestion").value = "";
    $("#fType").value = "multiple_choice";
    $("#fDomain").value = "";
    $("#fExplanation").value = "";
    $("#opcionesContainer").innerHTML = "";
    $("#paresContainer").innerHTML = "";
    $("#formError").style.display = "none";
    quitarImagen();
    cambiarTipo();
  }

  function abrirNueva() {
    limpiarFormulario();
    $("#modalTitulo").textContent = "Nueva pregunta";
    for (let i = 0; i < 4; i++) agregarOpcion();
    agregarPar();
    agregarPar();
    modalPregunta.show();
  }

  async function abrirEditar(qid) {
    limpiarFormulario();
    $("#modalTitulo").textContent = `Editar pregunta ${qid}`;

    let result;
    try {
      result = await api.get(`/questions/${qid}`);
      if (!result.ok) throw new Error();
    } catch (e) {
      avisar("No se pudo cargar la pregunta para editar.", "danger");
      return;
    }

    const question = result.data;
    $("#editQid").value = question.qid;
    $("#fQuestion").value = question.question || "";
    $("#fType").value = question.type || "multiple_choice";
    $("#fDomain").value = question.domain || "";
    $("#fExplanation").value = question.explanation || "";

    if (question.type === "match") {
      const items = question.match_items || Object.keys(question.answer || {});
      items.forEach(item => agregarPar(item, (question.answer || {})[item] || ""));
      if (items.length === 0) {
        agregarPar();
        agregarPar();
      }
    } else {
      const correctas = question.answer || [];
      (question.options || []).forEach(option => agregarOpcion(option, correctas.includes(option)));
      if (!question.options || question.options.length === 0) {
        for (let i = 0; i < 4; i++) agregarOpcion();
      }
    }

    if (question.image_base64) {
      imagenBase64 = question.image_base64;
      $("#imagenPreview").src = imageSrcFromBase64(question.image_base64);
      $("#imagenPreviewWrap").style.display = "block";
    }

    cambiarTipo();
    modalPregunta.show();
  }

  function leerFormulario() {
    const errores = [];
    const question = $("#fQuestion").value.trim();
    const type = $("#fType").value;
    if (!question) errores.push("El enunciado de la pregunta es obligatorio.");

    const payload = {
      question,
      type,
      domain: $("#fDomain").value.trim() || null,
      explanation: $("#fExplanation").value.trim() || null,
      // Siempre string: "" borra la imagen al editar; null mantendria la vieja.
      image_base64: imagenBase64
    };

    if (type === "multiple_choice") {
      const options = [];
      const answer = [];
      $$("#opcionesContainer .fila-opcion").forEach(row => {
        const text = row.querySelector(".opcion-texto").value.trim();
        if (!text) return;
        options.push(text);
        if (row.querySelector(".opcion-correcta").checked) answer.push(text);
      });
      if (options.length < 2) errores.push("Se necesitan al menos 2 opciones con texto.");
      if (new Set(options).size !== options.length) errores.push("Hay opciones repetidas.");
      if (answer.length === 0) errores.push("Marca al menos una opcion como correcta.");
      payload.options = options;
      payload.answer = answer;
    } else {
      const match_items = [];
      const match_targets = [];
      const answer = {};
      $$("#paresContainer .fila-par").forEach(row => {
        const item = row.querySelector(".par-item").value.trim();
        const target = row.querySelector(".par-target").value.trim();
        if (!item && !target) return;
        if (!item || !target) {
          errores.push("Hay un par incompleto: llena ambos lados o eliminalo.");
          return;
        }
        match_items.push(item);
        match_targets.push(target);
        answer[item] = target;
      });
      if (match_items.length < 2) errores.push("Se necesitan al menos 2 pares completos.");
      if (new Set(match_items).size !== match_items.length) errores.push("Hay elementos repetidos en la columna izquierda.");
      payload.match_items = match_items;
      payload.match_targets = match_targets;
      payload.answer = answer;
    }

    return { payload, errores };
  }

  function mostrarErrorFormulario(mensajes) {
    const error = $("#formError");
    error.innerHTML = mensajes.map(message => `<div>- ${escapeHTML(message)}</div>`).join("");
    error.style.display = "block";
    error.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function guardarPregunta() {
    const { payload, errores } = leerFormulario();
    if (errores.length) {
      mostrarErrorFormulario(errores);
      return;
    }

    const qid = $("#editQid").value;
    const esEdicion = qid !== "";
    const btn = $("#btnGuardar");
    btn.disabled = true;

    try {
      if (esEdicion) payload.qid = parseInt(qid);
      const result = esEdicion
        ? await api.put(`/questions/${qid}`, payload)
        : await api.post("/questions", payload);
      const data = result.data;

      if (!result.ok) {
        const detalle = Array.isArray(data.detail)
          ? data.detail.map(error => error.msg || JSON.stringify(error))
          : [String(data.detail || "Error al guardar")];
        mostrarErrorFormulario(detalle);
        return;
      }

      modalPregunta.hide();
      avisar(`<i class="fas fa-circle-check me-1"></i>${escapeHTML(data.msg || "Guardado correctamente")}`);
      if (payload.domain) {
        dominios.add(payload.domain);
        actualizarDatalist();
      }
      cargarLista(esEdicion ? currentSkip : 0);
    } catch (e) {
      mostrarErrorFormulario(["No se pudo conectar con el servidor."]);
    } finally {
      btn.disabled = false;
    }
  }

  function confirmarEliminar(qid, texto) {
    qidAEliminar = qid;
    $("#eliminarTexto").textContent = `#${qid} - ${texto}`;
    modalEliminar.show();
  }

  async function eliminarPregunta() {
    if (qidAEliminar === null) return;

    try {
      const result = await api.del(`/questions/${qidAEliminar}`);
      const data = result.data;
      if (!result.ok) {
        avisar(escapeHTML(String(data.detail || "No se pudo eliminar")), "danger");
      } else {
        avisar(`<i class="fas fa-circle-check me-1"></i>${escapeHTML(data.msg)}`);
      }
    } catch (e) {
      avisar("No se pudo conectar con el servidor.", "danger");
    }

    modalEliminar.hide();
    qidAEliminar = null;
    cargarLista(currentSkip);
  }

  function bindEvents() {
    $("#filtroForm").addEventListener("submit", () => cargarLista(0));
    $("#btnNueva").addEventListener("click", abrirNueva);
    $("#fType").addEventListener("change", cambiarTipo);
    $("#btnAgregarOpcion").addEventListener("click", () => agregarOpcion());
    $("#btnAgregarPar").addEventListener("click", () => agregarPar());
    $("#fImage").addEventListener("change", event => cargarImagen(event.currentTarget));
    $("#btnQuitarImagen").addEventListener("click", quitarImagen);
    $("#btnGuardar").addEventListener("click", guardarPregunta);
    $("#btnConfirmarEliminar").addEventListener("click", eliminarPregunta);

    $("#lista").addEventListener("click", event => {
      const editBtn = event.target.closest(".js-edit-question");
      if (editBtn) {
        abrirEditar(parseInt(editBtn.dataset.qid));
        return;
      }

      const deleteBtn = event.target.closest(".js-delete-question");
      if (deleteBtn) {
        confirmarEliminar(parseInt(deleteBtn.dataset.qid), deleteBtn.dataset.question);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    modalPregunta = new bootstrap.Modal($("#modalPregunta"));
    modalEliminar = new bootstrap.Modal($("#modalEliminar"));
    ui.initLayout();
    bindEvents();
    cargarLista(0);
  });
})();
