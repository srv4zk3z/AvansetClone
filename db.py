from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
import os
import urllib.parse

# Datos de conexion con defaults para desarrollo local.
MONGO_USER = urllib.parse.quote_plus(os.getenv("MONGO_USER", "admin"))
MONGO_PASS = urllib.parse.quote_plus(os.getenv("MONGO_PASSWORD", "secret"))
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = os.getenv("MONGO_PORT", "27017")
MONGO_DB = os.getenv("MONGO_DB", "simulador")
MONGO_AUTH_SOURCE = os.getenv("MONGO_AUTH_SOURCE", "admin")

# Si MONGO_URI existe, tiene prioridad sobre las piezas anteriores.
MONGO_URI = os.getenv(
    "MONGO_URI",
    f"mongodb://{MONGO_USER}:{MONGO_PASS}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}?authSource={MONGO_AUTH_SOURCE}"
)

client = AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB]
collection = db["preguntas"]
attempts_collection = db["intentos"]         # Para registrar los examenes
stats_collection = db["estadisticas_preg"]   # Para llevar stats por pregunta

# Crear indice si no existe
async def init_indexes():
    await collection.create_index([("qid", ASCENDING)], unique=True)
