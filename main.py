import random
from typing import List, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from db import collection, init_indexes, attempts_collection, stats_collection
from collections import defaultdict

from models import Question
from models import RespuestaUsuario

# Para entrar a mongo express 
# http://localhost:8081
# usuario: admin
# contraseña: pass por defecto


app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # o restringe a ["http://localhost:5500"] si usas Live Server
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.on_event("startup")
async def startup():
    await init_indexes()

@app.get("/questions")
async def get_all_questions(
    skip: int = Query(0, ge=0, description="Número de preguntas a omitir"),
    limit: int = Query(10, ge=1, le=100, description="Cantidad de preguntas a devolver"),
    search: Optional[str] = Query(None, description="Texto a buscar en la pregunta")
):
    query = {}
    if search:
        query = {"question": {"$regex": search, "$options": "i"}}

    total = await collection.count_documents(query)
    cursor = collection.find(query).skip(skip).limit(limit)

    preguntas = {}
    async for doc in cursor:
        doc.pop("_id", None)
        preguntas[doc["qid"]] = doc

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "preguntas": preguntas
    }

@app.get("/questions/{qid}")
async def get_question(qid: str):
    pregunta = await collection.find_one({"qid": qid})
    if not pregunta:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    pregunta.pop("_id", None)
    return pregunta

@app.post("/questions", status_code=201)
async def create_question_auto(q: Question):
    doc = await collection.find_one(sort=[("qid", -1)])
    next_qid = (doc["qid"] + 1) if doc else 1
    q.qid = next_qid

    await collection.insert_one(q.model_dump(exclude_none=True))
    return {"msg": f"Pregunta {q.qid} creada correctamente", "qid": q.qid}

@app.put("/questions/{qid}")
async def update_question(qid: int, q: Question):
    result = await collection.update_one(
        {"qid": qid},
        {"$set": q.model_dump(exclude_none=True)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    return {"msg": f"Pregunta {qid} actualizada correctamente"}

@app.delete("/questions/{qid}")
async def delete_question(qid: int):  # tipo int porque así están tus qids
    result = await collection.delete_one({"qid": qid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    # ✅ Eliminar estadísticas asociadas
    await stats_collection.delete_one({"qid": qid})

    return {"msg": f"Pregunta {qid} y sus estadísticas eliminadas correctamente"}

@app.get("/exam")
async def generar_examen(limit: int = Query(10, ge=1, le=500)):
    preguntas_cursor = collection.find({})
    preguntas = []
    async for doc in preguntas_cursor:
        tipo = doc.get("type", "multiple_choice")

        if tipo == "multiple_choice":
            preguntas.append({
                "qid": doc["qid"],
                "question": doc["question"],
                "type": "multiple_choice",
                "options": doc.get("options", []),
            })
        elif tipo == "match":
            preguntas.append({
                "qid": doc["qid"],
                "question": doc["question"],
                "type": "match",
                "match_items": doc.get("match_items", []),
                "match_targets": doc.get("match_targets", [])
            })

    if not preguntas:
        raise HTTPException(status_code=404, detail="No hay preguntas disponibles.")

    seleccionadas = random.sample(preguntas, min(limit, len(preguntas)))
    return {"total": len(seleccionadas), "exam": seleccionadas}

@app.post("/exam/submit")
async def calificar_examen(respuestas: List[RespuestaUsuario]):
    resultados = []
    puntaje = 0

    for entrada in respuestas:
        pregunta = await collection.find_one({"qid": entrada.qid})
        if not pregunta:
            resultados.append({
                "qid": entrada.qid,
                "status": "❓ No encontrada",
                "user_answers": entrada.answers,
                "correct_answers": []
            })
            continue

        correctas = set(pregunta["answer"])
        dadas = set(entrada.answers)
        es_correcta = correctas == dadas

        if es_correcta:
            puntaje += 1

        # ✅ ACTUALIZAR ESTADÍSTICAS por pregunta
        await stats_collection.update_one(
            {"qid": entrada.qid},
            {
                "$inc": {
                    "times_answered": 1,
                    "times_correct": 1 if es_correcta else 0,
                    "times_wrong": 0 if es_correcta else 1
                },
                "$set": {
                    "last_answered": datetime.utcnow()
                }
            },
            upsert=True
        )
        resultados.append({
            "qid": pregunta["qid"],
            "question": pregunta["question"],
            "domain": pregunta.get("domain", "Unknown"),
            "explanation": pregunta.get("explanation", "No disponible"),
            "status": "✅ Correcta" if es_correcta else "❌ Incorrecta",
            "user_answers": list(dadas),
            "correct_answers": list(correctas)
        })

    # ✅ GUARDAR EL INTENTO COMPLETO
    await attempts_collection.insert_one({
        "date": datetime.utcnow(),
        "total": len(respuestas),
        "correctas": puntaje,
        "incorrectas": len(respuestas) - puntaje,
        "detalle": resultados
    })

    # Calcular puntaje por dominio
    dominio_stats = defaultdict(lambda: {"correctas": 0, "incorrectas": 0, "total": 0})

    for r in resultados:
        domain = r.get("domain", "Unknown")
        es_correcta = "✅" in r["status"]
        dominio_stats[domain]["total"] += 1
        if es_correcta:
            dominio_stats[domain]["correctas"] += 1
        else:
            dominio_stats[domain]["incorrectas"] += 1

    # Calcular porcentajes
    for dom in dominio_stats:
        stats = dominio_stats[dom]
        stats["porcentaje"] = round(100 * stats["correctas"] / stats["total"], 2)

    # Devolver resultado final
    return {
        "total": len(respuestas),
        "correctas": puntaje,
        "incorrectas": len(respuestas) - puntaje,
        "detalle": resultados,
        "resumen_por_dominio": dominio_stats
    }


@app.get("/attempts/progress/domain")
async def progreso_por_dominio():
    cursor = attempts_collection.find().sort("date", 1)
    dominio_stats = {}

    async for intento in cursor:
        for detalle in intento.get("detalle", []):
            domain = detalle.get("domain", "Unknown")
            correcto = "✅" in detalle.get("status", "")
            if domain not in dominio_stats:
                dominio_stats[domain] = {"correctas": 0, "incorrectas": 0, "total": 0}

            dominio_stats[domain]["total"] += 1
            if correcto:
                dominio_stats[domain]["correctas"] += 1
            else:
                dominio_stats[domain]["incorrectas"] += 1

    # Calcular porcentaje
    for d in dominio_stats:
        tot = dominio_stats[d]["total"]
        if tot > 0:
            dominio_stats[d]["porcentaje"] = round(100 * dominio_stats[d]["correctas"] / tot, 2)

    return {"progreso_por_dominio": dominio_stats}

@app.get("/attempts/history")
async def obtener_historial(limit: int = 10):
    cursor = attempts_collection.find().sort("date", -1).limit(limit)
    historial = []
    async for intento in cursor:
        historial.append({
            "fecha": intento["date"],
            "total": intento["total"],
            "correctas": intento["correctas"],
            "incorrectas": intento["incorrectas"]
        })
    return {"historial": historial}

@app.get("/attempts/progress")
async def progreso():
    cursor = attempts_collection.find().sort("date", 1)
    progreso = []
    async for intento in cursor:
        porcentaje = round(100 * intento["correctas"] / intento["total"], 2)
        progreso.append({
            "fecha": intento["date"],
            "correctas": intento["correctas"],
            "incorrectas": intento["incorrectas"],
            "porcentaje": porcentaje
        })
    return {"progreso": progreso}



@app.get("/exam/focus")
async def examen_por_errores(limit: int = Query(10, ge=1, le=100)):
    # Obtener los qid con más errores
    stats_cursor = stats_collection.find().sort("times_wrong", -1).limit(limit)
    qids = [doc["qid"] async for doc in stats_cursor]

    if not qids:
        raise HTTPException(status_code=404, detail="No hay suficientes estadísticas para generar el examen.")

    # Obtener preguntas correspondientes
    preguntas_cursor = collection.find({"qid": {"$in": qids}})
    preguntas = []
    async for doc in preguntas_cursor:
        tipo = doc.get("type", "multiple_choice")

        if tipo == "multiple_choice":
            preguntas.append({
                "qid": doc["qid"],
                "question": doc["question"],
                "type": "multiple_choice",
                "options": doc.get("options", []),
            })
        elif tipo == "match":
            preguntas.append({
                "qid": doc["qid"],
                "question": doc["question"],
                "type": "match",
                "match_items": doc.get("match_items", []),
                "match_targets": doc.get("match_targets", [])
            })

    return {"based_on_stats": True, "total": len(preguntas), "exam": preguntas}
