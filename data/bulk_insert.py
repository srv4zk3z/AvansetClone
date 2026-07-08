import json
import os
from pymongo import MongoClient
import urllib.parse
from bson import ObjectId

MONGO_USER = urllib.parse.quote_plus(os.getenv("MONGO_USER", "admin"))
MONGO_PASS = urllib.parse.quote_plus(os.getenv("MONGO_PASSWORD", "secret"))
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = os.getenv("MONGO_PORT", "27017")
MONGO_DB = os.getenv("MONGO_DB", "simulador")
MONGO_AUTH_SOURCE = os.getenv("MONGO_AUTH_SOURCE", "admin")
MONGO_URI = os.getenv(
    "MONGO_URI",
    f"mongodb://{MONGO_USER}:{MONGO_PASS}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}?authSource={MONGO_AUTH_SOURCE}"
)

# Configura la conexion a MongoDB por variables de entorno.
client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
collection = db["preguntas"]

# Ruta al archivo JSON. Funciona desde la raiz del repo y desde /app en Docker.
ruta_archivo = os.getenv("QUESTIONS_FILE", "data/preguntas.json")
if not os.path.exists(ruta_archivo):
    ruta_archivo = "preguntas.json"

# Cargar el JSON y convertir $oid a ObjectId real
with open(ruta_archivo, "r", encoding="utf-8") as f:
    data = json.load(f)

    for doc in data:
        if "_id" in doc and isinstance(doc["_id"], dict) and "$oid" in doc["_id"]:
            doc["_id"] = ObjectId(doc["_id"]["$oid"])

# Insertar sin duplicar por qid. Esto permite correr el seed varias veces.
insertados = 0
actualizados = 0
for doc in data:
    qid = doc.get("qid")
    if qid is None:
        continue
    result = collection.update_one({"qid": qid}, {"$setOnInsert": doc}, upsert=True)
    if result.upserted_id:
        insertados += 1
    else:
        actualizados += 1

print(f"Seed completado. Insertados: {insertados}. Ya existentes: {actualizados}.")
