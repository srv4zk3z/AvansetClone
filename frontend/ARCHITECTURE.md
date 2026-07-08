# Arquitectura del frontend

El frontend usa HTML estatico, Bootstrap y JavaScript vanilla. No hay bundler ni framework moderno, asi que el orden y la claridad dependen de una estructura de carpetas y de scripts cargados explicitamente.

## Estructura

```text
frontend/
  index.html
  preguntas.html
  preguntasmalas.html
  metricas.html
  admin.html
  style.css

  js/
    core/
      namespace.js
      dom.js
      format.js
      api.js
      theme.js

    components/
      layout.js
      feedback.js
      pagination.js
      question-card.js

    pages/
      exam.js
      questions.js
      weak-questions.js
      metrics.js
      admin.js
```

## Estrategia

La app se separa en tres capas:

1. **Core**
   - Define infraestructura base.
   - No conoce pantallas concretas.
   - Ejemplos: namespace global, helpers DOM, formateo, HTTP, tema.

2. **Components**
   - Genera piezas reutilizables de interfaz.
   - No llama a la API.
   - No decide flujos de negocio.
   - Ejemplos: layout del sidebar, estados de carga/error/vacio, paginacion, tarjetas de preguntas.

3. **Pages**
   - Orquesta cada modulo.
   - Conecta eventos de su HTML.
   - Pide datos con `App.api`.
   - Usa componentes de `App.ui`.
   - Mantiene solo el estado que le pertenece a esa pantalla.

## Regla de acoplamiento

El acoplamiento permitido va en una sola direccion:

```text
pages -> components -> core
pages -> core
```

Lo que evitamos:

- `core` no depende de pantallas.
- `components` no hace `fetch`.
- Un modulo de `pages/` no llama funciones internas de otro modulo de `pages/`.
- El HTML no tiene `onclick`, `onchange` ni scripts inline de negocio.

## Orden de carga

Como no hay imports, cada HTML carga scripts en orden:

```html
<script src="js/core/namespace.js"></script>
<script src="js/core/dom.js"></script>
<script src="js/core/format.js"></script>
<script src="js/core/api.js"></script>

<script src="js/components/layout.js"></script>
<script src="js/components/feedback.js"></script>
<script src="js/components/pagination.js"></script>
<script src="js/components/question-card.js"></script>

<script src="js/pages/modulo.js"></script>
```

`js/core/theme.js` se carga en el `<head>` porque debe aplicar el tema antes de que la pagina termine de pintar.

## Como decidir donde va codigo nuevo

- Si habla con backend: `js/core/api.js`.
- Si es una utilidad general de texto, DOM o formato: `js/core/`.
- Si pinta un bloque reusable de interfaz: `js/components/`.
- Si maneja un flujo concreto de una pagina: `js/pages/`.
- Si aparece repetido en dos paginas, se mueve de `pages/` a `components/`.

## Modulos actuales

- `pages/exam.js`: simulador, cronometro, respuestas y resultados.
- `pages/questions.js`: buscador del banco de preguntas.
- `pages/weak-questions.js`: preguntas mas falladas.
- `pages/metrics.js`: graficas y tablas de progreso.
- `pages/admin.js`: administracion CRUD del banco.
