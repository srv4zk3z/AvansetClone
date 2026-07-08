// Componentes para mostrar preguntas, respuestas correctas y explicaciones.
(function () {
  function highlight(text, term) {
    const safe = escapeHTML(text);
    if (!term) return safe;
    const escapedTerm = escapeHTML(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return safe.replace(new RegExp(`(${escapedTerm})`, "gi"), "<mark>$1</mark>");
  }

  function domainBadge(domain) {
    return domain
      ? `<span class="badge badge-domain flex-shrink-0"><i class="fas fa-layer-group me-1"></i>${escapeHTML(domain)}</span>`
      : "";
  }

  function matchAnswerList(answer, { term = "" } = {}) {
    if (!answer || typeof answer !== "object") return "";
    return `
      <ul class="list-unstyled mb-0">
        ${Object.entries(answer).map(([item, target]) => `
          <li class="option-item correct">
            <span class="option-mark"><i class="fas fa-check"></i></span>
            <span><strong>${highlight(item, term)}</strong> &rarr; ${highlight(target, term)}</span>
          </li>`).join("")}
      </ul>
    `;
  }

  function optionsList(question, { term = "" } = {}) {
    const correctas = Array.isArray(question.answer) ? question.answer : [];
    return `
      <ul class="list-unstyled mb-0">
        ${(question.options || []).map(option => {
          const isCorrect = correctas.includes(option);
          return `
            <li class="option-item ${isCorrect ? "correct" : ""}">
              <span class="option-mark">${isCorrect ? '<i class="fas fa-check"></i>' : ""}</span>
              <span>${highlight(option, term)}</span>
            </li>`;
        }).join("")}
      </ul>
      <small class="text-secondary d-block mt-1">
        <i class="fas fa-check text-success me-1"></i>Las opciones marcadas en verde son las respuestas correctas.
      </small>
    `;
  }

  function answerBlock(question, { term = "" } = {}) {
    if (question.type === "match") {
      return `
        <p class="mb-2 text-secondary"><i class="fas fa-arrows-left-right me-1"></i> Emparejamiento correcto:</p>
        ${matchAnswerList(question.answer, { term })}
      `;
    }
    return question.options ? optionsList(question, { term }) : "";
  }

  function questionReviewCard(question, {
    number,
    term = "",
    showDomain = true,
    explanationMode = "format"
  } = {}) {
    const title = term ? highlight(question.question, term) : escapeHTML(question.question);
    const explanation = question.explanation
      ? (explanationMode === "highlight" ? mdToHTML(highlight(question.explanation, term)) : formatText(question.explanation))
      : "";

    return `
      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start gap-3 mb-3 flex-wrap">
            <h5 class="card-title mb-0">${number ? `${number}. ` : ""}${title}</h5>
            ${showDomain ? domainBadge(question.domain || "Sin dominio") : ""}
          </div>
          ${imagenPreguntaHTML(question.image_base64)}
          ${answerBlock(question, { term })}
          ${explanation ? `
            <div class="explanation-box">
              <span class="explanation-label"><i class="fas fa-lightbulb me-1"></i>Explicacion:</span>
              ${explanation}
            </div>` : ""}
        </div>
      </div>
    `;
  }

  Object.assign(window.App.ui, {
    highlight,
    domainBadge,
    matchAnswerList,
    optionsList,
    answerBlock,
    questionReviewCard
  });
})();
