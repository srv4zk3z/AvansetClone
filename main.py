import random
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from db import collection, init_indexes

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
async def delete_question(qid: str):
    result = await collection.delete_one({"qid": qid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    return {"msg": f"Pregunta {qid} eliminada"}


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

        resultados.append({
            "qid": pregunta["qid"],
            "question": pregunta["question"],
            "explanation": pregunta.get("explanation", "No disponible"),
            "status": "✅ Correcta" if es_correcta else "❌ Incorrecta",
            "user_answers": list(dadas),
            "correct_answers": list(correctas)
        })

    return {
        "total": len(respuestas),
        "correctas": puntaje,
        "incorrectas": len(respuestas) - puntaje,
        "detalle": resultados
    }