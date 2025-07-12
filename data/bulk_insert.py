import json
from pymongo import MongoClient
import urllib.parse
from bson import ObjectId

MONGO_USER = urllib.parse.quote_plus("admin")
MONGO_PASS = urllib.parse.quote_plus("secret")

# Configura la conexión a MongoDB (puedes modificar la URI si es necesario)
client = MongoClient(f"mongodb://{MONGO_USER}:{MONGO_PASS}@localhost:27017")
db = client["simulador"]
collection = db["preguntas"]

# Ruta al archivo JSON
ruta_archivo = "preguntas.json"

# Cargar el JSON y convertir $oid a ObjectId real
with open(ruta_archivo, "r", exncoding="utf-8") as f:
    data = json.load(f)

    for doc in data:
        if "_id" in doc and isinstance(doc["_id"], dict) and "$oid" in doc["_id"]:
            doc["_id"] = ObjectId(doc["_id"]["$oid"])

# Insertar en MongoDB
result = collection.insert_many(data)
print(f"Se insertaron {len(result.inserted_ids)} documentos.")
