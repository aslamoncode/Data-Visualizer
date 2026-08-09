import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient


# ==========================================
# Load .env from the backend folder
# (only matters locally — on Render, env vars
# are injected directly via their dashboard)
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
        "http://localhost:5173",
        # Add your deployed frontend URL here once you have it, e.g.:
        # "https://your-frontend.onrender.com",
    ]
)


# ==========================================
# MongoDB connection
#
# IMPORTANT: this no longer crashes the whole
# app on failure. If MongoDB can't connect,
# the app still starts and serves requests —
# routes that need the database will return a
# clear error instead of the entire service
# refusing to boot. This lets you actually see
# the app is alive and debug via /health,
# instead of an invisible crash loop.
# ==========================================

MONGO_URI = os.getenv("MONGO_URI")

client = None
db = None
collection = None
mongo_connection_error = None

if not MONGO_URI:
    mongo_connection_error = "MONGO_URI environment variable is not set"
    print("WARNING:", mongo_connection_error)
else:
    try:
        client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000
        )

        # Test the MongoDB connection
        client.admin.command("ping")

        db = client["data_visualizer"]
        collection = db["datasets"]

        print("MongoDB connection successful!")

    except Exception as error:
        mongo_connection_error = str(error)
        print("MongoDB connection failed!")
        print(error)
        # Deliberately NOT re-raising — app still starts,
        # so /health can report the real problem instead
        # of the whole service crash-looping invisibly.


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

    if client is None:

        return jsonify({
            "status": "unhealthy",
            "mongodb": "disconnected",
            "error": mongo_connection_error or "MongoDB client was never initialized"
        }), 500

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

    if collection is None:

        return jsonify({
            "error": "Database is not connected",
            "details": mongo_connection_error
        }), 503

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