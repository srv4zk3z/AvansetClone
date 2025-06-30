const API_BASE = "http://localhost:8000";
let currentQuestions = [];
let currentPage = 0;
const questionsPerPage = 2;
let userAnswers = {};  // Para guardar respuestas entre páginas

// Comenzar examen
document.getElementById('startExam').addEventListener('click', async () => {
  const input = document.getElementById('numPreguntas');
  let num = parseInt(input.value);

  if (isNaN(num) || num < 1 || num > 300) {
    alert("Por favor, ingresa un número entre 1 y 300.");
    return;
  }

  const res = await fetch(`${API_BASE}/exam?limit=${num}`);
  const data = await res.json();

  if (!data.exam || data.exam.length === 0) {
    document.getElementById('resultContainer').innerHTML = `
      <div class="alert alert-warning text-center">
        No hay preguntas disponibles para generar el examen.
      </div>
    `;
    return;
  }

  currentQuestions = data.exam;
  userAnswers = {};
  currentPage = 0;

  document.getElementById('examSetup').style.display = 'none';
  renderExam(currentQuestions);
});

// Renderiza todo el examen (por página)
function renderExam(questions) {
  renderPage(currentPage);
  document.getElementById('submitExam').style.display = 'block';
}

function renderPage(page) {
  const container = document.getElementById('examContainer');
  container.innerHTML = '';

  const start = page * questionsPerPage;
  const end = Math.min(start + questionsPerPage, currentQuestions.length);
  const pageQuestions = currentQuestions.slice(start, end);

  pageQuestions.forEach((q, index) => {
    const div = document.createElement('div');
    div.className = 'card mb-4 shadow-sm bg-dark text-light border border-secondary rounded-4';

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body p-4';

    cardBody.innerHTML = `
      <h5 class="card-title mb-3 fw-semibold">
        <i class="bi bi-question-circle-fill me-2 text-warning"></i>
        ${start + index + 1}. ${q.question}
      </h5>
    `;

    const tipo = q.type || "multiple_choice";

    if (tipo === "match") {
      userAnswers[q.qid] = userAnswers[q.qid] || {};

      const itemContainer = document.createElement('div');
      itemContainer.className = 'row';

      const sourceCol = document.createElement('div');
      sourceCol.className = 'col-md-6';
      sourceCol.innerHTML = '<p><strong>Arrastra:</strong></p>';

      const targetCol = document.createElement('div');
      targetCol.className = 'col-md-6';
      targetCol.innerHTML = '<p><strong>Y suelta aquí:</strong></p>';

      q.match_items.forEach((item, i) => {
        const dragEl = document.createElement('div');
        dragEl.className = 'btn btn-outline-warning w-100 mb-2';
        dragEl.setAttribute('draggable', 'true');
        dragEl.textContent = item;
        dragEl.id = `drag-${q.qid}-${i}`;

        dragEl.ondragstart = (e) => {
          e.dataTransfer.setData("text/plain", item);
        };

        sourceCol.appendChild(dragEl);
      });

      q.match_targets.forEach((target, i) => {
        const dropZone = document.createElement('div');
        dropZone.className = 'border border-secondary p-2 mb-2 rounded text-white bg-secondary';
        dropZone.textContent = target;
        dropZone.id = `drop-${q.qid}-${i}`;
        dropZone.style.minHeight = '45px';

        // Mostrar si ya hay una respuesta guardada
        const matchedItem = Object.entries(userAnswers[q.qid]).find(([k, v]) => v === target);
        if (matchedItem) {
          const el = document.createElement('div');
          el.textContent = matchedItem[0];
          el.className = 'badge bg-warning text-dark me-2';
          dropZone.appendChild(el);
        }

        dropZone.ondragover = (e) => e.preventDefault();
        dropZone.ondrop = (e) => {
          e.preventDefault();
          const item = e.dataTransfer.getData("text/plain");
          userAnswers[q.qid][item] = target;
          dropZone.innerHTML = '';
          const el = document.createElement('div');
          el.textContent = item;
          el.className = 'badge bg-warning text-dark me-2';
          dropZone.appendChild(el);
        };

        targetCol.appendChild(dropZone);
      });

      itemContainer.appendChild(sourceCol);
      itemContainer.appendChild(targetCol);
      cardBody.appendChild(itemContainer);
    } else {
      q.options.forEach(opt => {
        const checked = userAnswers[q.qid]?.includes(opt) ? "checked" : "";
        const optId = `q${q.qid}_${opt.replace(/\s+/g, "_")}`;

        cardBody.innerHTML += `
          <div class="form-check form-check-dark mb-2">
            <input class="form-check-input" type="checkbox" id="${optId}" name="q${q.qid}" value="${opt}" ${checked}>
            <label class="form-check-label" for="${optId}">
              ${opt}
            </label>
          </div>
        `;
      });
    }

    div.appendChild(cardBody);
    container.appendChild(div);
  });

  renderPaginationControls();
}
function renderPaginationControls() {
  const totalPages = Math.ceil(currentQuestions.length / questionsPerPage);
  const pagDiv = document.createElement('div');
  pagDiv.className = 'd-flex justify-content-center align-items-center gap-3 mt-4';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-outline-light';
  prevBtn.textContent = '← Anterior';
  prevBtn.disabled = currentPage === 0;
  prevBtn.onclick = () => goToPage(currentPage - 1);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-outline-light';
  nextBtn.textContent = 'Siguiente →';
  nextBtn.disabled = currentPage >= totalPages - 1;
  nextBtn.onclick = () => goToPage(currentPage + 1);

  const pageIndicator = document.createElement('span');
  pageIndicator.className = 'text-muted';
  pageIndicator.textContent = `Página ${currentPage + 1} de ${totalPages}`;

  pagDiv.appendChild(prevBtn);
  pagDiv.appendChild(pageIndicator);
  pagDiv.appendChild(nextBtn);

  document.getElementById('examContainer').appendChild(pagDiv);

  // Guardar selección antes de salir
  guardarRespuestasActuales();
}

function goToPage(page) {
  guardarRespuestasActuales();
  currentPage = page;
  renderPage(currentPage);
}

// Guardar respuestas antes de cambiar página
function guardarRespuestasActuales() {
  currentQuestions.forEach(q => {
    const tipo = q.type || "multiple_choice";

    if (tipo === "multiple_choice") {
      const seleccionados = Array.from(document.querySelectorAll(`input[name="q${q.qid}"]:checked`))
        .map(el => el.value);
      if (seleccionados.length > 0) {
        userAnswers[q.qid] = seleccionados;
      }
    } else if (tipo === "match") {
      // Ya se guarda en tiempo real en userAnswers, pero validamos consistencia
      const result = {};
q.match_targets.forEach((target, i) => {
  const dropZone = document.getElementById(`drop-${q.qid}-${i}`);
  if (dropZone) {
    const dropped = dropZone.querySelector('.badge');
    if (dropped) {
      result[dropped.textContent] = target;
    }
  }
});
      if (Object.keys(result).length > 0) {
        userAnswers[q.qid] = result;
      }
    }
  });
}

// Enviar respuestas
document.getElementById('submitExam').addEventListener('click', async () => {
  guardarRespuestasActuales();

  const respuestas = currentQuestions.map(q => ({
    qid: q.qid,
    answers: userAnswers[q.qid] || []
  }));

  const res = await fetch(`${API_BASE}/exam/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(respuestas)
  });

  const data = await res.json();
  mostrarResultados(data);
});

// Mostrar resultados
function mostrarResultados(data) {
  const resultDiv = document.getElementById('resultContainer');
  resultDiv.innerHTML = `
    <div class="alert alert-info text-center fs-5">
      Obtuviste <strong>${data.correctas}</strong> de <strong>${data.total}</strong> respuestas correctas
    </div>
  `;

    data.detalle.forEach((r, index) => {
    const isCorrect = r.status.includes("✅");

    const card = document.createElement('div');
    card.className = `card mb-3 shadow-sm border-0 ${isCorrect ? 'bg-success-subtle text-white' : 'bg-danger-subtle text-white'}`;

    const body = document.createElement('div');
    body.className = 'card-body';

    body.innerHTML = `
    <h5 class="card-title">${index + 1}. ${r.question}</h5>
      <p><strong>Tu respuesta:</strong> ${r.user_answers.join(', ') || 'Sin respuesta'}</p>
      <p><strong>Respuesta correcta:</strong> ${r.correct_answers.join(', ')}</p>
      <p class="fw-bold">Resultado: ${r.status}</p>
      <p class="line-through text-muted">Explicación: ${r.explanation}</p>
      
    `;

    card.appendChild(body);
    resultDiv.appendChild(card);
  });

// Ocultar examen y scroll arriba
document.getElementById('examContainer').innerHTML = '';
document.getElementById('submitExam').style.display = 'none';
document.getElementById('startExam').style.display = 'none';
window.scrollTo({ top: 0, behavior: 'smooth' });

// Agregar botón para reiniciar
const retryBtn = document.createElement('button');
retryBtn.className = 'btn btn-outline-light mt-3';
retryBtn.id = 'reloadPage';
retryBtn.textContent = 'Volver al inicio';
document.getElementById('resultContainer').appendChild(retryBtn);

// Activar evento de recarga
document.getElementById('reloadPage')?.addEventListener('click', () => location.reload());

}
