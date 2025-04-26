import os
import pandas as pd
import sqlite3
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.prophet_model import forecast_with_prophet
from src.database import init_db, save_forecast_to_db, load_forecasts

# === Konfiguration ===
UPLOAD_FOLDER = "uploads"
DB_FILE = "forecasts.db"

# === FastAPI App erstellen ===
app = FastAPI()

# === CORS Einstellungen ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In Produktion auf bestimmte Domains einschränken!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Ordner vorbereiten ===
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# === Initialisiere Datenbank ===
init_db()

# === Root Endpoint ===
@app.get("/")
async def root():
    return {"message": "Server läuft! 🚀"}

# === CSV hochladen, Forecast erstellen und speichern ===
@app.post("/upload_csv/")
async def upload_csv(file: UploadFile = File(...)):
    file_location = os.path.join(UPLOAD_FOLDER, file.filename)
    
    # 1. Datei speichern
    with open(file_location, "wb") as buffer:
        buffer.write(await file.read())

    # 2. Datei lesen
    try:
        df = pd.read_csv(file_location, sep=";")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fehler beim Einlesen der CSV-Datei: {str(e)}")

    # 3. Forecast erstellen
    try:
        forecast_df = forecast_with_prophet(df)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fehler beim Erstellen der Vorhersage: {str(e)}")

    # 4. Forecast in DB speichern
    save_forecast_to_db(forecast_df, source_file=file.filename)

    # 5. Antwort senden
    return {
        "message": "CSV erfolgreich hochgeladen und Vorhersage gespeichert!",
        "forecast_preview": forecast_df.head(10).to_dict(orient="records")
    }

# === Forecast-Daten abrufen (alle aus der Datenbank) ===
@app.get("/forecasts/")
async def get_forecasts():
    try:
        forecasts = load_forecasts()
        forecasts_list = [{"date": f[0], "value": f[1], "source_file": f[2]} for f in forecasts]
        return forecasts_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Abrufen der Vorhersagen: {str(e)}")
