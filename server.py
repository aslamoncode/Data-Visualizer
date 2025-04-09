from flask import Flask, request, jsonify
import pandas as pd
import json
from pymongo import MongoClient
from flask_cors import CORS
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Connect to MongoDB
MONGO_URI = "mongodb+srv://farhanshaik600:Farhan#1474@cluster0.gpnjw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = MongoClient(MONGO_URI)
db = client["data_visualizer"]  # Database name
collection = db["datasets"]  # Collection name

# Datasets (Spotify & Uber)
datasets = {
    "Spotify": "spotify.csv",
    "Uber": "uber.csv",
    "Amazon": "Amazon.csv",
    "netflix": "netflix.csv"
}

#Function to load CSV into MongoDB (Run once)
def load_csv_to_mongodb():
    for dataset_name, file_path in datasets.items():
        try:
            df = pd.read_csv(file_path)  # Read CSV file
            data = df.to_dict(orient="records")  # Convert to list of dictionaries
            
            # Delete existing dataset before inserting new one
            collection.delete_many({"dataset_name": dataset_name})

            # Store in MongoDB with a proper dataset structure
            collection.insert_one({"dataset_name": dataset_name, "data": data})
            print(f"Successfully loaded {dataset_name} data into MongoDB.")
        except Exception as e:
            print(f"Error loading {dataset_name}: {e}")

# Uncomment this and run once to load CSV into MongoDB
#load_csv_to_mongodb()

# API to fetch dataset from MongoDB
@app.route("/get_data", methods=["GET"])
def get_data():
    dataset_name = request.args.get("dataset")  # Get dataset name

    if not dataset_name:
        return jsonify({"error": "Dataset name is required"}), 400

    dataset = collection.find_one({"dataset_name": dataset_name})  # Match dataset name

    if dataset and "data" in dataset:
        return jsonify({"data": dataset["data"]})  # Return stored data
    else:
        return jsonify({"error": "Dataset not found"}), 404

if __name__ == "__main__":
    app.run(debug=False)
