from fastapi import FastAPI, UploadFile, File
import pandas as pd
from src.prophet_model import forecast_with_prophet  # Dein Modell
import os

app = FastAPI()

@app.post("/upload_csv/")
async def upload_csv(file: UploadFile = File(...)):
    # Speichere die hochgeladene CSV temporär
    contents = await file.read()
    file_path = f"temp_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Lade CSV in ein DataFrame
    df = pd.read_csv(file_path)

    # KI-Modell aufrufen
    forecast = forecast_with_prophet(df)  # ⬅️ Dein Modell nutzen

    # Lösche die temporäre Datei
    os.remove(file_path)

    # Ergebnis als JSON zurückgeben
    return forecast.to_dict(orient="records")
