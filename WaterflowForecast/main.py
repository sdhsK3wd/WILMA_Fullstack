from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
from src.prophet_model import forecast_with_prophet

app = FastAPI()

# 🛡️ CORS aktivieren, damit Frontend auf Server zugreifen kann
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Im echten Projekt später evtl. auf "http://localhost:5178" einschränken
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload_csv/")
async def upload_csv(file: UploadFile = File(...)):
    try:
        # Dateiinhalt lesen
        contents = await file.read()
        file_path = f"temp_{file.filename}"

        # Datei speichern
        with open(file_path, "wb") as f:
            f.write(contents)

        # CSV laden (automatisches Trennzeichen erkennen + Spalten aufräumen)
        df = pd.read_csv(file_path, sep=None, engine='python')
        df.columns = df.columns.str.strip()  # Entfernt mögliche Leerzeichen in Spaltennamen

        # Check ob 'Date' und 'Value' Spalten existieren
        if 'Date' not in df.columns or 'Value' not in df.columns:
            os.remove(file_path)
            return {"error": "CSV muss 'Date' und 'Value' Spalten haben."}

        # KI-Modell ausführen
        forecast = forecast_with_prophet(df)

        # Temporäre Datei löschen
        os.remove(file_path)

        # Vorhersage zurückgeben
        return forecast.to_dict(orient="records")

    except Exception as e:
        # Fehlerbehandlung
        if os.path.exists(file_path):
            os.remove(file_path)
        return {"error": str(e)}
