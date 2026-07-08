// Utilidades de formato compartidas por todas las paginas.

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Formato en linea: **negritas**, *cursivas*, `codigo` y 'texto entre
// comillas simples' para nombres de campos como 'src_ip'.
function mdInline(t) {
  return t
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(\S(?:[^*\n]*\S)?)\*/g, "<em>$1</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/&#39;((?!\s)(?:(?!&#39;)[^\n]){1,80}(?<!\s))&#39;/g, "<code>$1</code>");
}

// Convierte el mini-Markdown de explicaciones a HTML.
// Recibe texto YA escapado; puede incluir <mark> del buscador.
function mdToHTML(escapedText) {
  const lines = mdInline(String(escapedText ?? "")).split("\n");
  let html = "";
  let list = null;

  const closeList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);

    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (list !== type) {
        closeList();
        html += `<${type} class="md-list">`;
        list = type;
      }
      html += `<li>${(bullet || numbered)[1]}</li>`;
    } else {
      closeList();
      html += line + "<br>";
    }
  }
  closeList();

  return html.replace(/(<br>)+$/, "");
}

function formatText(str) {
  return mdToHTML(escapeHTML(str));
}

function imageSrcFromBase64(b64) {
  if (!b64) return "";
  let mime = "image/png";
  if (b64.startsWith("/9j/")) mime = "image/jpeg";
  else if (b64.startsWith("R0lGOD")) mime = "image/gif";
  else if (b64.startsWith("UklGR")) mime = "image/webp";
  return `data:${mime};base64,${b64}`;
}

function imagenPreguntaHTML(b64) {
  const src = imageSrcFromBase64(b64);
  return src
    ? `<img src="${src}" class="img-fluid rounded question-image my-2" alt="Imagen de la pregunta">`
    : "";
}
