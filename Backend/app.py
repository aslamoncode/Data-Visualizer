
import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient


# ==========================================
# Load .env from the backend folder
# ==========================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(ENV_PATH)


# ==========================================
# Flask application
# ==========================================

app = Flask(__name__)

app.secret_key = os.getenv(
    "SECRET_KEY",
    "development-secret-key"
)


# ==========================================
# CORS
# ==========================================

CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:3000",
        "http://localhost:5173"
    ]
)


# ==========================================
# MongoDB connection
# ==========================================

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    raise RuntimeError(
        "MONGO_URI is missing from backend/.env"
    )

try:
    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000
    )

    # Test the MongoDB connection
    client.admin.command("ping")

    print("MongoDB connection successful!")

except Exception as error:
    print("MongoDB connection failed!")
    print(error)
    raise


# ==========================================
# Database
# ==========================================

db = client["data_visualizer"]

collection = db["datasets"]


# ==========================================
# Home route
# ==========================================

@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "status": "online",
        "message": "Data Visualizer API is running"
    })


# ==========================================
# MongoDB health check
# ==========================================

@app.route("/health", methods=["GET"])
def health():

    try:

        client.admin.command("ping")

        return jsonify({
            "status": "healthy",
            "mongodb": "connected"
        })

    except Exception as error:

        return jsonify({
            "status": "unhealthy",
            "mongodb": "disconnected",
            "error": str(error)
        }), 500


# ==========================================
# Get dataset
# ==========================================

@app.route("/get_data", methods=["GET"])
def get_data():

    dataset_name = request.args.get("dataset")

    if not dataset_name:

        return jsonify({
            "error": "Dataset name is required"
        }), 400

    dataset = collection.find_one({
        "dataset_name": dataset_name
    })

    if not dataset:

        return jsonify({
            "error": "Dataset not found"
        }), 404

    data = dataset.get("data", [])

    return jsonify({
        "dataset": dataset_name,
        "data": data
    })


# ==========================================
# Run Flask
# ==========================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
