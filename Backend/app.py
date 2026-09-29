import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient

from data_profiler import profile_dataframe
import pandas as pd

from chart_recommender import recommend_charts
from data_profiler import profile_dataframe
import pandas as pd

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
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://data-visualizer-self.vercel.app",
    ]
)


# ==========================================
# MongoDB connection
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

        # Test MongoDB connection
        client.admin.command("ping")

        db = client["data_visualizer"]
        collection = db["datasets"]

        print("MongoDB connection successful!")

    except Exception as error:
        mongo_connection_error = str(error)

        print("MongoDB connection failed!")
        print(error)

        # The application will still start.
        # /health will report the MongoDB problem.


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
            "error": (
                mongo_connection_error
                or "MongoDB client was never initialized"
            )
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
# Get all datasets
# ==========================================

@app.route("/datasets", methods=["GET"])
def get_datasets():

    if collection is None:
        return jsonify({
            "error": "Database is not connected",
            "details": mongo_connection_error
        }), 503

    try:

        datasets = collection.find(
            {},
            {
                "_id": 0,
                "dataset_name": 1,
                "data": 1
            }
        )

        result = []

        for dataset in datasets:

            data = dataset.get("data", [])

            result.append({
                "name": dataset.get("dataset_name"),
                "rows": len(data)
            })

        return jsonify({
            "datasets": result,
            "count": len(result)
        })

    except Exception as error:

        return jsonify({
            "error": "Failed to retrieve datasets",
            "details": str(error)
        }), 500

# ==========================================
# Profile uploaded CSV
# ==========================================

@app.route("/profile", methods=["POST"])
def profile_dataset():

    if "file" not in request.files:
        return jsonify({
            "error": "No file uploaded"
        }), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({
            "error": "No file selected"
        }), 400

    if not file.filename.lower().endswith(".csv"):
        return jsonify({
            "error": "Only CSV files are supported"
        }), 400

    try:
        df = pd.read_csv(file)

        if df.empty:
            return jsonify({
                "error": "The uploaded CSV is empty"
            }), 400

        profile = profile_dataframe(df)

        return jsonify({
            "filename": file.filename,
            "profile": profile
        })

    except Exception as error:
        return jsonify({
            "error": "Failed to profile dataset",
            "details": str(error)
        }), 500
    
# ==========================================
# Get one dataset
# ==========================================

@app.route("/datasets/<dataset_name>", methods=["GET"])
def get_dataset(dataset_name):

    if collection is None:
        return jsonify({
            "error": "Database is not connected",
            "details": mongo_connection_error
        }), 503

    try:

        dataset = collection.find_one({
            "dataset_name": dataset_name
        })

        if not dataset:
            return jsonify({
                "error": "Dataset not found"
            }), 404

        return jsonify({
            "name": dataset.get("dataset_name"),
            "data": dataset.get("data", [])
        })

    except Exception as error:

        return jsonify({
            "error": "Failed to retrieve dataset",
            "details": str(error)
        }), 500

# ==========================================
# Chart recommendations for MongoDB dataset
# ==========================================

@app.route("/datasets/<dataset_name>/recommendations", methods=["GET"])
def get_recommendations(dataset_name):

    if collection is None:
        return jsonify({
            "error": "Database is not connected",
            "details": mongo_connection_error
        }), 503

    try:
        # Get dataset from MongoDB
        dataset = collection.find_one({
            "dataset_name": dataset_name
        })

        if not dataset:
            return jsonify({
                "error": "Dataset not found"
            }), 404

        data = dataset.get("data", [])

        if not data:
            return jsonify({
                "error": "Dataset contains no data"
            }), 400

        # Convert MongoDB data to DataFrame
        df = pd.DataFrame(data)

        if df.empty:
            return jsonify({
                "error": "Dataset could not be converted into a DataFrame"
            }), 400

        # Profile the dataset
        profile = profile_dataframe(df)

        # Generate ranked chart recommendations
        recommendations = recommend_charts(profile)

        return jsonify({
            "dataset": dataset_name,
            "profile": profile,
            "recommendations": recommendations
        })

    except Exception as error:

        return jsonify({
            "error": "Failed to generate chart recommendations",
            "details": str(error)
        }), 500
    
# ==========================================
# Profile an existing MongoDB dataset
# ==========================================

@app.route("/datasets/<dataset_name>/profile", methods=["GET"])
def profile_mongodb_dataset(dataset_name):

    if collection is None:
        return jsonify({
            "error": "Database is not connected",
            "details": mongo_connection_error
        }), 503

    try:
        dataset = collection.find_one({
            "dataset_name": dataset_name
        })

        if not dataset:
            return jsonify({
                "error": "Dataset not found"
            }), 404

        data = dataset.get("data", [])

        if not data:
            return jsonify({
                "error": "Dataset contains no data"
            }), 400

        # Convert MongoDB records into a Pandas DataFrame
        df = pd.DataFrame(data)

        if df.empty:
            return jsonify({
                "error": "Dataset could not be converted into a DataFrame"
            }), 400

        # Run CloudViz data profiler
        profile = profile_dataframe(df)

        return jsonify({
            "dataset": dataset_name,
            "profile": profile
        })

    except Exception as error:

        return jsonify({
            "error": "Failed to profile MongoDB dataset",
            "details": str(error)
        }), 500
    
# ==========================================
# Existing dataset endpoint
# Keep this temporarily so the current
# frontend does not break.
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

@app.route("/recommendations", methods=["POST"])
def get_uploaded_recommendations():
    try:
        payload = request.get_json(silent=True) or {}
        data = payload.get("data", [])

        if not data:
            return jsonify({
                "error": "No data provided"
            }), 400

        df = pd.DataFrame(data)

        recommendations = recommend_charts(df)

        return jsonify(recommendations)

    except Exception as error:
        print("Recommendation error:", error)
        return jsonify({
            "error": str(error)
        }), 500
    
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