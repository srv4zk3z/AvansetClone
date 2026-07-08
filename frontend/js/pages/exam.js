// Modulo: simulador de examen.
// Responsabilidad: orquestar inicio del examen, paginacion, respuestas,
// cronometro y render de resultados.
(function () {
  const App = window.App;
  const { $, $$ } = App.dom;
  const api = App.api;

  const QUESTIONS_PER_PAGE = 2;
  const PASSING_SCORE = 72;

  const state = {
    questions: [],
    currentPage: 0,
    answers: {}
  };

  class ExamTimer {
    constructor({ timer, display, questionContainer, onExpire }) {
      this.timer = timer;
      this.display = display;
      this.questionContainer = questionContainer;
      this.onExpire = onExpire;
      this.interval = null;
      this.remaining = 0;
      this.total = 0;
    }

    start(minutes) {
      this.stop();
      this.total = minutes * 60;
      this.remaining = this.total;
      this.timer.style.display = "flex";
      this.render();

      this.interval = setInterval(() => {
        this.remaining--;
        this.render();
        if (this.remaining <= 0) {
          this.stop();
          this.onExpire();
        }
      }, 1000);
    }

    stop() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
    }

    hide() {
      this.stop();
      this.timer.style.display = "none";
      this.clearQuestionStates();
    }

    render() {
      this.display.textContent = formatTime(Math.max(this.remaining, 0));

      // Los estados del reloj tambien colorean las tarjetas del examen.
      let status = "";
      if (this.remaining <= 300) status = "danger";
      else if (this.remaining <= 600) status = "warning";
      else if (this.remaining <= this.total / 2) status = "half";

      ["half", "warning", "danger"].forEach(item => {
        this.timer.classList.toggle(item, status === item);
      });
      this.clearQuestionStates();
      if (status) this.questionContainer.classList.add(`time-${status}`);
    }

    clearQuestionStates() {
      ["time-half", "time-warning", "time-danger"].forEach(item => {
        this.questionContainer.classList.remove(item);
      });
    }
  }

  let timer;

  function readExamMinutes() {
    const value = parseInt($("#tiempoExamen").value);
    return Number.isNaN(value) || value < 1 || value > 600 ? 120 : value;
  }

  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(secs).padStart(2, "0");
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function readQuestionLimit() {
    const input = $("#numPreguntas");
    const limit = parseInt(input.value);
    if (Number.isNaN(limit) || limit < 1 || limit > 300) {
      alert("Por favor, ingresa un numero entre 1 y 300.");
      return null;
    }
    return limit;
  }

  async function startExam(endpoint, emptyMessage) {
    const limit = readQuestionLimit();
    if (!limit) return;

    let result;
    try {
      result = await api.get(endpoint, { limit });
    } catch (e) {
      $("#resultContainer").innerHTML = App.ui.connectionError();
      return;
    }

    const questions = result.data.exam || [];
    if (!questions.length) {
      $("#resultContainer").innerHTML = `
        <div class="alert alert-warning text-center">${escapeHTML(emptyMessage)}</div>
      `;
      return;
    }

    state.questions = questions;
    state.answers = {};
    state.currentPage = 0;

    $("#examSetup").style.display = "none";
    renderExam();
    timer.start(readExamMinutes());
  }

  function renderExam() {
    renderPage();
    $("#submitExam").style.display = "block";
  }

  function renderPage() {
    const container = $("#examContainer");
    container.innerHTML = "";

    const start = state.currentPage * QUESTIONS_PER_PAGE;
    const pageQuestions = state.questions.slice(start, start + QUESTIONS_PER_PAGE);

    pageQuestions.forEach((question, index) => {
      container.appendChild(renderQuestionCard(question, start + index + 1));
    });

    renderPaginationControls(container);
  }

  function renderQuestionCard(question, number) {
    const card = document.createElement("div");
    card.className = "card mb-4";

    const body = document.createElement("div");
    body.className = "card-body p-4";
    body.innerHTML = `
      <h5 class="card-title mb-3 fw-semibold">
        <i class="fas fa-circle-question me-2 text-warning"></i>
        ${number}. ${escapeHTML(question.question)}
      </h5>
      ${imagenPreguntaHTML(question.image_base64)}
    `;

    if ((question.type || "multiple_choice") === "match") {
      body.appendChild(renderMatchQuestion(question));
    } else {
      body.appendChild(renderMultipleChoiceQuestion(question));
    }

    card.appendChild(body);
    return card;
  }

  function renderMatchQuestion(question) {
    state.answers[question.qid] = state.answers[question.qid] || {};

    const row = document.createElement("div");
    row.className = "row";

    const sourceCol = document.createElement("div");
    sourceCol.className = "col-md-6";
    sourceCol.innerHTML = "<p><strong>Arrastra:</strong></p>";

    const targetCol = document.createElement("div");
    targetCol.className = "col-md-6";
    targetCol.innerHTML = "<p><strong>Y suelta aqui:</strong></p>";

    question.match_items.forEach((item, index) => {
      const dragEl = document.createElement("div");
      dragEl.className = "btn btn-outline-warning w-100 mb-2";
      dragEl.draggable = true;
      dragEl.textContent = item;
      dragEl.id = `drag-${question.qid}-${index}`;
      dragEl.addEventListener("dragstart", event => {
        event.dataTransfer.setData("text/plain", item);
      });
      sourceCol.appendChild(dragEl);
    });

    question.match_targets.forEach((target, index) => {
      targetCol.appendChild(renderDropZone(question, target, index));
    });

    row.appendChild(sourceCol);
    row.appendChild(targetCol);
    return row;
  }

  function renderDropZone(question, target, index) {
    const dropZone = document.createElement("div");
    dropZone.className = "drop-zone";
    dropZone.textContent = target;
    dropZone.id = `drop-${question.qid}-${index}`;

    const matchedItem = Object.entries(state.answers[question.qid]).find(([, value]) => value === target);
    if (matchedItem) renderDroppedBadge(dropZone, matchedItem[0]);

    dropZone.addEventListener("dragover", event => {
      event.preventDefault();
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", event => {
      event.preventDefault();
      dropZone.classList.remove("drag-over");
      const item = event.dataTransfer.getData("text/plain");
      state.answers[question.qid][item] = target;
      renderDroppedBadge(dropZone, item);
    });

    return dropZone;
  }

  function renderDroppedBadge(dropZone, item) {
    dropZone.innerHTML = "";
    const badge = document.createElement("div");
    badge.textContent = item;
    badge.className = "badge bg-warning text-dark me-2";
    dropZone.appendChild(badge);
  }

  function renderMultipleChoiceQuestion(question) {
    const wrap = document.createElement("div");
    const answerCount = question.num_answers ?? (Array.isArray(question.answer) ? question.answer.length : 1);
    const singleAnswer = answerCount <= 1;
    const inputType = singleAnswer ? "radio" : "checkbox";

    wrap.insertAdjacentHTML("beforeend", `
      <p class="select-hint">
        <i class="fas fa-hand-pointer me-1"></i>
        ${singleAnswer ? "Selecciona una respuesta" : `Selecciona ${answerCount} respuestas`}
      </p>
    `);

    const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
    shuffledOptions.forEach(option => {
      const optionId = `q${question.qid}_${option.replace(/\s+/g, "_")}`;
      const checked = state.answers[question.qid]?.includes(option) ? "checked" : "";
      wrap.insertAdjacentHTML("beforeend", `
        <div class="form-check mb-2">
          <input class="form-check-input" type="${inputType}" id="${escapeHTML(optionId)}" name="q${question.qid}" value="${escapeHTML(option)}" ${checked} data-max="${answerCount}">
          <label class="form-check-label" for="${escapeHTML(optionId)}">${escapeHTML(option)}</label>
        </div>
      `);
    });

    if (!singleAnswer) {
      wrap.addEventListener("change", event => limitCheckboxSelection(event, answerCount));
    }

    return wrap;
  }

  function limitCheckboxSelection(event, max) {
    const input = event.target;
    if (!input.matches('input[type="checkbox"]')) return;

    const selected = $$(`input[name="${input.name}"]:checked`);
    if (selected.length > max) {
      input.checked = false;
      const hint = input.closest(".card-body")?.querySelector(".select-hint");
      if (hint) {
        hint.classList.add("select-hint-alert");
        setTimeout(() => hint.classList.remove("select-hint-alert"), 800);
      }
    }
  }

  function renderPaginationControls(container) {
    const totalPages = Math.ceil(state.questions.length / QUESTIONS_PER_PAGE);
    const pagination = document.createElement("div");
    pagination.className = "d-flex justify-content-center align-items-center gap-3 mt-4";

    const prev = document.createElement("button");
    prev.className = "btn btn-outline-secondary";
    prev.innerHTML = '<i class="fas fa-chevron-left me-1"></i>Anterior';
    prev.disabled = state.currentPage === 0;
    prev.addEventListener("click", () => goToPage(state.currentPage - 1));

    const next = document.createElement("button");
    next.className = "btn btn-outline-secondary";
    next.innerHTML = 'Siguiente<i class="fas fa-chevron-right ms-1"></i>';
    next.disabled = state.currentPage >= totalPages - 1;
    next.addEventListener("click", () => goToPage(state.currentPage + 1));

    const indicator = document.createElement("span");
    indicator.className = "text-secondary";
    indicator.textContent = `Pagina ${state.currentPage + 1} de ${totalPages}`;

    pagination.appendChild(prev);
    pagination.appendChild(indicator);
    pagination.appendChild(next);
    container.appendChild(pagination);

    saveCurrentAnswers();
  }

  function goToPage(page) {
    saveCurrentAnswers();
    state.currentPage = page;
    renderPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveCurrentAnswers() {
    state.questions.forEach(question => {
      const type = question.type || "multiple_choice";

      if (type === "multiple_choice") {
        const selected = $$(`input[name="q${question.qid}"]:checked`).map(input => input.value);
        if (selected.length > 0) state.answers[question.qid] = selected;
      } else if (type === "match") {
        const result = {};
        question.match_targets.forEach((target, index) => {
          const dropZone = $(`#drop-${question.qid}-${index}`);
          const dropped = dropZone?.querySelector(".badge");
          if (dropped) result[dropped.textContent] = target;
        });
        if (Object.keys(result).length > 0) state.answers[question.qid] = result;
      }
    });
  }

  async function submitExam(byTimeout = false) {
    timer.hide();
    saveCurrentAnswers();

    const payload = state.questions.map(question => ({
      qid: question.qid,
      answers: state.answers[question.qid] || []
    }));

    let result;
    try {
      result = await api.post("/exam/submit", payload);
    } catch (e) {
      $("#resultContainer").innerHTML = App.ui.connectionError();
      return;
    }

    renderResults(result.data);
    if (byTimeout) {
      $("#resultContainer").insertAdjacentHTML("afterbegin", `
        <div class="alert alert-warning text-center fs-6">
          <i class="fas fa-hourglass-end me-2"></i>Se agoto el tiempo: tus respuestas se enviaron automaticamente.
        </div>
      `);
    }
  }

  function renderResults(data) {
    const resultContainer = $("#resultContainer");
    const percentage = Math.round((data.correctas / data.total) * 100);
    const passed = percentage >= PASSING_SCORE;

    resultContainer.innerHTML = `
      <div class="alert ${passed ? "alert-success" : "alert-danger"} text-center fs-5">
        Obtuviste <strong>${data.correctas}</strong> de <strong>${data.total}</strong> respuestas correctas
        (<strong>${percentage}%</strong>)<br>
        ${passed ? "Felicidades, aprobaste el examen PCSAE." : "No alcanzaste el puntaje minimo para aprobar el PCSAE."}
      </div>
    `;

    data.detalle.forEach((result, index) => {
      resultContainer.appendChild(renderResultCard(result, index + 1));
    });

    if (data.resumen_por_dominio) {
      resultContainer.insertAdjacentHTML("beforeend", renderDomainSummary(data.resumen_por_dominio));
    }

    $("#examContainer").innerHTML = "";
    $("#submitExam").style.display = "none";
    $("#startExam").style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });

    const retryBtn = document.createElement("button");
    retryBtn.className = "btn btn-primary mt-3";
    retryBtn.id = "reloadPage";
    retryBtn.innerHTML = '<i class="fas fa-rotate-left me-1"></i>Hacer otro examen';
    retryBtn.addEventListener("click", () => location.reload());
    resultContainer.appendChild(retryBtn);
  }

  function renderResultCard(result, number) {
    const isCorrect = result.status.includes("✅");
    const card = document.createElement("div");
    card.className = `card mb-3 ${isCorrect ? "card-correct" : "card-incorrect"}`;
    card.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start gap-3 mb-2 flex-wrap">
          <h5 class="card-title mb-0">${number}. ${escapeHTML(result.question)}</h5>
          <span class="badge ${isCorrect ? "text-bg-success" : "text-bg-danger"} flex-shrink-0">
            ${isCorrect ? "Correcta" : "Incorrecta"}
          </span>
        </div>
        <p class="mb-1"><strong>Tu respuesta:</strong> ${result.user_answers.map(escapeHTML).join(", ") || "<em>Sin respuesta</em>"}</p>
        <p class="mb-1"><strong>Respuesta correcta:</strong> <span class="text-success">${result.correct_answers.map(escapeHTML).join(", ")}</span></p>
        <div class="explanation-box">
          <span class="explanation-label"><i class="fas fa-lightbulb me-1"></i>Explicacion:</span>
          ${formatText(result.explanation)}
        </div>
      </div>
    `;
    return card;
  }

  function renderDomainSummary(summary) {
    return `
      <div class="card mt-4">
        <div class="card-body">
          <h5 class="card-title mb-3"><i class="fas fa-chart-column text-info me-2"></i>Resumen por dominio</h5>
          <div class="table-responsive">
            <table class="table table-sm table-bordered text-center">
              <thead>
                <tr>
                  <th>Dominio</th>
                  <th>Total</th>
                  <th>Correctas</th>
                  <th>Incorrectas</th>
                  <th>% Acierto</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(summary).map(([domain, stats]) => `
                  <tr>
                    <td>${escapeHTML(domain)}</td>
                    <td>${stats.total}</td>
                    <td class="text-success">${stats.correctas}</td>
                    <td class="text-danger">${stats.incorrectas}</td>
                    <td>${stats.porcentaje}%</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", () => {
    App.ui.initLayout();
    timer = new ExamTimer({
      timer: $("#examTimer"),
      display: $("#timerDisplay"),
      questionContainer: $("#examContainer"),
      onExpire: () => submitExam(true)
    });

    $("#startExam").addEventListener("click", () => {
      startExam("/exam", "No hay preguntas disponibles para generar el examen.");
    });
    $("#startFocusExam").addEventListener("click", () => {
      startExam("/exam/focus", "No se encontraron errores suficientes para generar un examen.");
    });
    $("#submitExam").addEventListener("click", () => submitExam(false));
  });
})();
