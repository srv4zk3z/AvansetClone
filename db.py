from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
import urllib.parse

# Datos de conexión
MONGO_USER = urllib.parse.quote_plus("admin")
MONGO_PASS = urllib.parse.quote_plus("secret")
MONGO_HOST = "localhost"
MONGO_PORT = "27017"
MONGO_DB   = "simulador"

# URI con autenticación
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
import urllib.parse

MONGO_USER = urllib.parse.quote_plus("admin")
MONGO_PASS = urllib.parse.quote_plus("secret")
MONGO_URI = f"mongodb://{MONGO_USER}:{MONGO_PASS}@localhost:27017/simulador?authSource=admin"

client = AsyncIOMotorClient(MONGO_URI)
db = client["simulador"]
collection = db["preguntas"]

async def init_indexes():
    await collection.create_index([("qid", ASCENDING)], unique=True)
# Conexión
client = AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB]
collection = db["preguntas"]

# Crear índice si no existe
async def init_indexes():
    await collection.create_index([("qid", ASCENDING)], unique=True)
