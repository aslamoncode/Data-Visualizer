"""
Import CSV files into MongoDB Atlas, wrapped in the exact
document shape that app.py's /get_data route expects:

    {
        "dataset_name": "Spotify",
        "data": [ {...row1}, {...row2}, ... ]
    }

Usage:
    1. Place this script inside your Backend folder
       (same place as app.py, so it can reuse the same .env)
    2. Make sure your CSV files are in Backend/datasets/
       (matches your existing folder structure)
    3. Run:  python import_data.py
"""

import os
import csv
from dotenv import load_dotenv
from pymongo import MongoClient


# ==========================================
# Load .env (same as app.py)
# ==========================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH)

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    raise RuntimeError("MONGO_URI is missing from .env")


# ==========================================
# Connect to MongoDB
# ==========================================

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
client.admin.command("ping")
print("Connected to MongoDB successfully!\n")

db = client["data_visualizer"]
collection = db["datasets"]


# ==========================================
# Map dataset names to their CSV file paths
# Adjust filenames here if yours differ
# ==========================================

DATASETS_DIR = os.path.join(BASE_DIR, "datasets")

datasets_to_import = {
    "Spotify": "spotify.csv",
    "Uber": "uber.csv",
    "Amazon": "Amazon.csv",
    "netflix": "netflix.csv",
}


def read_csv_as_dicts(filepath):
    """Read a CSV file and return a list of row dictionaries,
    with numeric-looking values converted to int/float."""
    rows = []

    with open(filepath, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        for row in reader:
            clean_row = {}

            for key, value in row.items():
                if value is None:
                    clean_row[key] = None
                    continue

                value = value.strip()

                # Try to convert to int, then float, else keep as string
                if value == "":
                    clean_row[key] = None
                elif value.lstrip("-").isdigit():
                    clean_row[key] = int(value)
                else:
                    try:
                        clean_row[key] = float(value)
                    except ValueError:
                        clean_row[key] = value

            rows.append(clean_row)

    return rows


# ==========================================
# Import each dataset
# ==========================================

for dataset_name, filename in datasets_to_import.items():

    filepath = os.path.join(DATASETS_DIR, filename)

    if not os.path.exists(filepath):
        print(f"⚠️  Skipping '{dataset_name}' — file not found: {filepath}")
        continue

    print(f"Reading {filename} ...")
    rows = read_csv_as_dicts(filepath)
    print(f"  → {len(rows)} rows parsed")

    # Replace any existing dataset with this name, then insert fresh
    collection.delete_many({"dataset_name": dataset_name})

    collection.insert_one({
        "dataset_name": dataset_name,
        "data": rows
    })

    print(f"✅ Imported '{dataset_name}' ({len(rows)} rows)\n")


print("All done! Your datasets are now in MongoDB.")
client.close()