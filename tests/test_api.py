"""
Pruebas de integración de la API del simulador.

Requisitos para ejecutarlas:
  1. MongoDB corriendo (docker compose up -d)
  2. La API corriendo (uvicorn main:app --reload --host 0.0.0.0 --port 8000)

Ejecutar desde la raíz del proyecto:
  pytest tests/ -v

Las pruebas crean preguntas temporales (marcadas con [TEST]) y las
eliminan al terminar, por lo que no ensucian el banco real.
"""
import uuid

import httpx
import pytest

BASE_URL = "http://localhost:8000"


@pytest.fixture(scope="session")
def client():
    c = httpx.Client(base_url=BASE_URL, timeout=15)
    try:
        c.get("/questions", params={"limit": 1}).raise_for_status()
    except Exception:
        pytest.skip(
            "La API no responde en http://localhost:8000. "
            "Levanta MongoDB (docker compose up -d) y la API (uvicorn main:app ...) antes de correr las pruebas."
        )
    yield c
    c.close()


def _pregunta_mc(marker: str) -> dict:
    return {
        "question": f"{marker} ¿Pregunta de prueba de opción múltiple?",
        "type": "multiple_choice",
        "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
        "answer": ["Opción B", "Opción D"],
        "explanation": "Explicación de **prueba** con `código`.",
        "domain": "Testing",
    }


def _pregunta_match(marker: str) -> dict:
    return {
        "question": f"{marker} Relaciona cada elemento de prueba",
        "type": "match",
        "match_items": ["Item 1", "Item 2"],
        "match_targets": ["Target 1", "Target 2"],
        "answer": {"Item 1": "Target 1", "Item 2": "Target 2"},
        "domain": "Testing",
    }


@pytest.fixture
def marker():
    return f"[TEST-{uuid.uuid4().hex[:8]}]"


@pytest.fixture
def limpiar(client):
    """Elimina al final las preguntas que la prueba haya creado."""
    creados = []
    yield creados
    for qid in creados:
        client.delete(f"/questions/{qid}")


# ---------------------------------------------------------------- CRUD

def test_ciclo_crud_opcion_multiple(client, marker, limpiar):
    # CREATE
    r = client.post("/questions", json=_pregunta_mc(marker))
    assert r.status_code == 201, r.text
    qid = r.json()["qid"]
    limpiar.append(qid)
    assert isinstance(qid, int)

    # READ (por id)
    r = client.get(f"/questions/{qid}")
    assert r.status_code == 200, r.text
    q = r.json()
    assert q["question"].startswith(marker)
    assert q["type"] == "multiple_choice"
    assert q["answer"] == ["Opción B", "Opción D"]
    assert q["domain"] == "Testing"

    # READ (búsqueda por texto)
    r = client.get("/questions", params={"search": marker})
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert str(qid) in {str(k) for k in data["preguntas"].keys()}

    # UPDATE
    actualizada = _pregunta_mc(marker)
    actualizada["qid"] = qid
    actualizada["question"] = f"{marker} Pregunta editada"
    actualizada["answer"] = ["Opción A"]
    r = client.put(f"/questions/{qid}", json=actualizada)
    assert r.status_code == 200, r.text

    r = client.get(f"/questions/{qid}")
    assert r.json()["question"] == f"{marker} Pregunta editada"
    assert r.json()["answer"] == ["Opción A"]

    # DELETE
    r = client.delete(f"/questions/{qid}")
    assert r.status_code == 200, r.text

    # Ya no debe existir
    assert client.get(f"/questions/{qid}").status_code == 404


def test_ciclo_crud_match(client, marker, limpiar):
    r = client.post("/questions", json=_pregunta_match(marker))
    assert r.status_code == 201, r.text
    qid = r.json()["qid"]
    limpiar.append(qid)

    r = client.get(f"/questions/{qid}")
    assert r.status_code == 200
    q = r.json()
    assert q["type"] == "match"
    assert q["answer"] == {"Item 1": "Target 1", "Item 2": "Target 2"}
    assert q["match_items"] == ["Item 1", "Item 2"]

    r = client.delete(f"/questions/{qid}")
    assert r.status_code == 200
    assert client.get(f"/questions/{qid}").status_code == 404


def test_qids_consecutivos_al_crear(client, marker, limpiar):
    r1 = client.post("/questions", json=_pregunta_mc(marker))
    r2 = client.post("/questions", json=_pregunta_mc(marker))
    qid1, qid2 = r1.json()["qid"], r2.json()["qid"]
    limpiar.extend([qid1, qid2])
    assert qid2 == qid1 + 1


# ---------------------------------------------------------------- Validaciones

def test_rechaza_respuesta_fuera_de_opciones(client, marker):
    pregunta = _pregunta_mc(marker)
    pregunta["answer"] = ["Opción inexistente"]
    r = client.post("/questions", json=pregunta)
    assert r.status_code == 422


def test_rechaza_opcion_multiple_sin_opciones(client, marker):
    pregunta = _pregunta_mc(marker)
    pregunta["options"] = None
    r = client.post("/questions", json=pregunta)
    assert r.status_code == 422


def test_rechaza_match_con_claves_incorrectas(client, marker):
    pregunta = _pregunta_match(marker)
    pregunta["answer"] = {"Item equivocado": "Target 1", "Item 2": "Target 2"}
    r = client.post("/questions", json=pregunta)
    assert r.status_code == 422


def test_rechaza_match_con_respuesta_lista(client, marker):
    pregunta = _pregunta_match(marker)
    pregunta["answer"] = ["Target 1"]
    r = client.post("/questions", json=pregunta)
    assert r.status_code == 422


# ---------------------------------------------------------------- Errores 404

def test_get_pregunta_inexistente(client):
    assert client.get("/questions/99999999").status_code == 404


def test_update_pregunta_inexistente(client, marker):
    pregunta = _pregunta_mc(marker)
    pregunta["qid"] = 99999999
    assert client.put("/questions/99999999", json=pregunta).status_code == 404


def test_delete_pregunta_inexistente(client):
    assert client.delete("/questions/99999999").status_code == 404


# ---------------------------------------------------------------- Examen

def test_generar_examen(client):
    r = client.get("/exam", params={"limit": 5})
    assert r.status_code == 200
    data = r.json()
    assert data["total"] <= 5
    for pregunta in data["exam"]:
        assert "qid" in pregunta and "question" in pregunta and "type" in pregunta
        if pregunta["type"] == "multiple_choice":
            assert isinstance(pregunta["options"], list)
            assert isinstance(pregunta["answer"], list)


def test_calificar_examen(client, marker, limpiar):
    r = client.post("/questions", json=_pregunta_mc(marker))
    qid = r.json()["qid"]
    limpiar.append(qid)

    # Una respuesta correcta y una incorrecta
    respuestas = [{"qid": qid, "answers": ["Opción B", "Opción D"]}]
    r = client.post("/exam/submit", json=respuestas)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert data["correctas"] == 1
    assert data["detalle"][0]["qid"] == qid
    assert "Testing" in data["resumen_por_dominio"]

    respuestas = [{"qid": qid, "answers": ["Opción A"]}]
    r = client.post("/exam/submit", json=respuestas)
    assert r.json()["correctas"] == 0
    assert r.json()["incorrectas"] == 1


def test_examen_focus_incluye_num_answers(client, marker, limpiar):
    # Crear una pregunta, fallarla a propósito y verificar que /exam/focus
    # la incluya con el campo num_answers (usado por el frontend para
    # decidir entre radio buttons y checkboxes) sin revelar las respuestas.
    r = client.post("/questions", json=_pregunta_mc(marker))
    qid = r.json()["qid"]
    limpiar.append(qid)

    client.post("/exam/submit", json=[{"qid": qid, "answers": ["Opción A"]}])

    r = client.get("/exam/focus", params={"limit": 100})
    assert r.status_code == 200
    encontradas = [p for p in r.json()["exam"] if p["qid"] == qid]
    assert encontradas, "La pregunta fallada debería aparecer en /exam/focus"
    assert encontradas[0]["num_answers"] == 2
    assert "answer" not in encontradas[0]


# ---------------------------------------------------------------- Imágenes

# PNG de 1x1 px, válido y diminuto: suficiente para validar el viaje completo
PNG_1PX = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
    "z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def test_imagen_viaje_completo(client, marker, limpiar):
    # CREATE con imagen
    pregunta = _pregunta_mc(marker)
    pregunta["image_base64"] = PNG_1PX
    r = client.post("/questions", json=pregunta)
    assert r.status_code == 201, r.text
    qid = r.json()["qid"]
    limpiar.append(qid)

    # La imagen regresa intacta al leer la pregunta
    r = client.get(f"/questions/{qid}")
    assert r.status_code == 200
    assert r.json()["image_base64"] == PNG_1PX

    # También en el listado (lo usa el buscador del frontend)
    r = client.get("/questions", params={"search": marker})
    encontrada = list(r.json()["preguntas"].values())[0]
    assert encontrada["image_base64"] == PNG_1PX

    # Y en el examen de repaso tras fallarla (lo usa "Estudiar mis errores")
    client.post("/exam/submit", json=[{"qid": qid, "answers": ["Opción A"]}])
    r = client.get("/exam/focus", params={"limit": 100})
    en_focus = [p for p in r.json()["exam"] if p["qid"] == qid]
    assert en_focus and en_focus[0]["image_base64"] == PNG_1PX

    # UPDATE con image_base64 = "" debe BORRAR la imagen
    # (así la limpia el formulario de administración)
    actualizada = _pregunta_mc(marker)
    actualizada["qid"] = qid
    actualizada["image_base64"] = ""
    r = client.put(f"/questions/{qid}", json=actualizada)
    assert r.status_code == 200
    assert client.get(f"/questions/{qid}").json()["image_base64"] == ""


def test_examen_incluye_campo_imagen(client):
    # Toda pregunta del examen debe traer image_base64 (aunque sea vacío)
    # para que el simulador pueda renderizarla sin casos especiales
    r = client.get("/exam", params={"limit": 5})
    assert r.status_code == 200
    for pregunta in r.json()["exam"]:
        assert "image_base64" in pregunta


# ---------------------------------------------------------------- Métricas

def test_metricas_historial(client):
    r = client.get("/attempts/history", params={"limit": 5})
    assert r.status_code == 200
    historial = r.json()["historial"]
    assert len(historial) <= 5
    for intento in historial:
        assert {"fecha", "total", "correctas", "incorrectas"} <= set(intento)
        assert intento["correctas"] + intento["incorrectas"] == intento["total"]


def test_metricas_progreso(client, marker, limpiar):
    # Registrar un intento conocido y verificar que aparece al final del progreso
    r = client.post("/questions", json=_pregunta_mc(marker))
    qid = r.json()["qid"]
    limpiar.append(qid)
    client.post("/exam/submit", json=[{"qid": qid, "answers": ["Opción B", "Opción D"]}])

    r = client.get("/attempts/progress")
    assert r.status_code == 200
    progreso = r.json()["progreso"]
    assert len(progreso) >= 1
    ultimo = progreso[-1]
    assert ultimo["correctas"] == 1
    assert ultimo["porcentaje"] == 100.0
    # En orden cronológico ascendente (así lo grafica la página de métricas)
    fechas = [p["fecha"] for p in progreso]
    assert fechas == sorted(fechas)


def test_metricas_por_dominio(client):
    r = client.get("/attempts/progress/domain")
    assert r.status_code == 200
    dominios = r.json()["progreso_por_dominio"]
    for stats in dominios.values():
        assert stats["correctas"] + stats["incorrectas"] == stats["total"]
        assert 0 <= stats["porcentaje"] <= 100


# ---------------------------------------------------------------- Paginación

def test_paginacion(client):
    r = client.get("/questions", params={"limit": 3, "skip": 0})
    data = r.json()
    assert data["limit"] == 3
    assert len(data["preguntas"]) <= 3

    if data["total"] > 3:
        r2 = client.get("/questions", params={"limit": 3, "skip": 3})
        qids_pagina1 = set(data["preguntas"].keys())
        qids_pagina2 = set(r2.json()["preguntas"].keys())
        assert qids_pagina1.isdisjoint(qids_pagina2)
