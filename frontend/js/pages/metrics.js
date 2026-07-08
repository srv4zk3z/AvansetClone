// Modulo: metricas de progreso.
// Responsabilidad: cargar estadisticas y dibujar graficas/tablas.
(function () {
  const App = window.App;
  const { $ } = App.dom;
  const api = App.api;
  const ui = App.ui;

  const META_APROBATORIA = 72;

  let progresoTotal = [];
  let dominios = {};
  let chartEvolucion = null;
  let chartDominios = null;

  function coloresTema() {
    const oscuro = (document.documentElement.getAttribute("data-bs-theme") || "dark") === "dark";
    const css = getComputedStyle(document.body);
    return {
      marca: oscuro ? "#5288dd" : "#335f9f",
      marcaSuave: oscuro ? "rgba(82, 136, 221, 0.18)" : "rgba(51, 95, 159, 0.14)",
      meta: oscuro ? "#d9a53f" : "#7b5819",
      texto: css.getPropertyValue("--bs-secondary-color").trim() || "#9aa3ae",
      grid: oscuro ? "rgba(154, 163, 174, 0.15)" : "rgba(104, 113, 122, 0.18)"
    };
  }

  function fechaLocal(isoUtc, opciones) {
    // El backend guarda UTC sin zona; el sufijo Z lo hace explicito.
    return new Date(`${isoUtc}Z`).toLocaleString("es-MX", opciones);
  }

  const lineaMeta = {
    id: "lineaMeta",
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!scales.y || scales.y.max < META_APROBATORIA) return;
      const y = scales.y.getPixelForValue(META_APROBATORIA);
      const c = coloresTema();
      ctx.save();
      ctx.strokeStyle = c.meta;
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.meta;
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`aprobatorio ${META_APROBATORIA}%`, chartArea.right - 4, y - 5);
      ctx.restore();
    }
  };

  const etiquetasBarras = {
    id: "etiquetasBarras",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const c = coloresTema();
      ctx.save();
      ctx.fillStyle = c.texto;
      ctx.font = "12px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      chart.getDatasetMeta(0).data.forEach((bar, index) => {
        const value = chart.data.datasets[0].data[index];
        ctx.fillText(`${value}%`, bar.x + 6, bar.y);
      });
      ctx.restore();
    }
  };

  function dibujarEvolucion() {
    const range = parseInt($("#rangoIntentos").value);
    const data = range > 0 ? progresoTotal.slice(-range) : progresoTotal;
    const c = coloresTema();

    if (chartEvolucion) chartEvolucion.destroy();
    chartEvolucion = new Chart($("#chartEvolucion"), {
      type: "line",
      data: {
        labels: data.map((_, index) => `${progresoTotal.length - data.length + index + 1}`),
        datasets: [{
          data: data.map(item => item.porcentaje),
          borderColor: c.marca,
          backgroundColor: c.marcaSuave,
          pointBackgroundColor: c.marca,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.25
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => `Examen ${items[0].label} - ${fechaLocal(data[items[0].dataIndex].fecha, { dateStyle: "medium", timeStyle: "short" })}`,
              label: item => {
                const attempt = data[item.dataIndex];
                return ` ${attempt.porcentaje}% (${attempt.correctas} correctas, ${attempt.incorrectas} incorrectas)`;
              }
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { color: c.texto, callback: value => `${value}%` },
            grid: { color: c.grid }
          },
          x: {
            title: { display: true, text: "Numero de examen", color: c.texto, font: { size: 11 } },
            ticks: { color: c.texto, maxTicksLimit: 15 },
            grid: { display: false }
          }
        }
      },
      plugins: [lineaMeta]
    });
  }

  function dibujarDominios() {
    const c = coloresTema();
    const entries = Object.entries(dominios).sort((a, b) => b[1].porcentaje - a[1].porcentaje);
    $("#chartDominiosWrap").style.height = `${Math.max(140, entries.length * 44 + 60)}px`;

    if (chartDominios) chartDominios.destroy();
    chartDominios = new Chart($("#chartDominios"), {
      type: "bar",
      data: {
        labels: entries.map(([domain]) => domain),
        datasets: [{
          data: entries.map(([, stats]) => stats.porcentaje),
          backgroundColor: c.marca,
          borderRadius: 4,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 48 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: item => {
                const stats = entries[item.dataIndex][1];
                return ` ${stats.porcentaje}% - ${stats.correctas} correctas, ${stats.incorrectas} incorrectas (${stats.total} respondidas)`;
              }
            }
          }
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            ticks: { color: c.texto, callback: value => `${value}%` },
            grid: { color: c.grid }
          },
          y: {
            ticks: { color: c.texto, autoSkip: false, font: { size: 11 } },
            grid: { display: false }
          }
        }
      },
      plugins: [etiquetasBarras]
    });
  }

  function llenarTablas() {
    $("#tablaDominios tbody").innerHTML = Object.entries(dominios)
      .sort((a, b) => b[1].porcentaje - a[1].porcentaje)
      .map(([domain, stats]) => `
        <tr>
          <td>${escapeHTML(domain)}</td>
          <td class="text-end text-success">${stats.correctas}</td>
          <td class="text-end text-danger">${stats.incorrectas}</td>
          <td class="text-end">${stats.porcentaje}%</td>
        </tr>`).join("");

    $("#tablaHistorial tbody").innerHTML = [...progresoTotal].reverse().slice(0, 25).map(attempt => {
      const passed = attempt.porcentaje >= META_APROBATORIA;
      return `
        <tr>
          <td>${fechaLocal(attempt.fecha, { dateStyle: "medium", timeStyle: "short" })}</td>
          <td class="text-end">${attempt.correctas + attempt.incorrectas}</td>
          <td class="text-end text-success">${attempt.correctas}</td>
          <td class="text-end text-danger">${attempt.incorrectas}</td>
          <td class="text-end fw-semibold">${attempt.porcentaje}%</td>
          <td class="text-center">
            <span class="badge ${passed ? "text-bg-success" : "text-bg-danger"}">${passed ? "Aprobado" : "No aprobado"}</span>
          </td>
        </tr>`;
    }).join("");
  }

  function llenarStats() {
    const total = progresoTotal.length;
    const average = progresoTotal.reduce((sum, item) => sum + item.porcentaje, 0) / total;
    const best = Math.max(...progresoTotal.map(item => item.porcentaje));
    const last = progresoTotal[total - 1];

    $("#statIntentos").textContent = total;
    $("#statPromedio").textContent = `${average.toFixed(1)}%`;
    $("#statMejor").textContent = `${best}%`;
    $("#statUltimo").textContent = `${last.porcentaje}%`;
  }

  async function cargarMetricas() {
    const contenedor = $("#contenido");
    let progressResult;
    let domainsResult;

    try {
      [progressResult, domainsResult] = await Promise.all([
        api.get("/attempts/progress"),
        api.get("/attempts/progress/domain")
      ]);
    } catch (e) {
      contenedor.innerHTML = ui.connectionError();
      return;
    }

    const progreso = progressResult.data.progreso;
    if (!progreso || progreso.length === 0) {
      contenedor.innerHTML = ui.emptyState({
        icon: "fa-chart-line",
        title: "Aun no hay metricas",
        message: 'Haz tu primer examen en el <a href="./index.html">Simulador</a> y aqui veras tu progreso.'
      });
      return;
    }

    progresoTotal = progreso;
    dominios = domainsResult.data.progreso_por_dominio || {};

    contenedor.innerHTML = "";
    contenedor.appendChild($("#plantilla").content.cloneNode(true));

    llenarStats();
    dibujarEvolucion();
    dibujarDominios();
    llenarTablas();
    $("#rangoIntentos").addEventListener("change", dibujarEvolucion);
  }

  function redrawChartsOnThemeChange() {
    new MutationObserver(() => {
      if (progresoTotal.length) {
        dibujarEvolucion();
        dibujarDominios();
      }
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-bs-theme"]
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    ui.initLayout();
    redrawChartsOnThemeChange();
    cargarMetricas();
  });
})();
