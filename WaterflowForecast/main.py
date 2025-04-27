import os
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.prophet_model import forecast_with_prophet
from src.database import init_db, save_forecast_to_db, load_forecasts, save_actual_to_db, load_actuals

# === Konfiguration ===
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# === FastAPI App erstellen ===
app = FastAPI()

# === CORS Einstellungen ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In Produktion besser einschränken!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Initialisiere die Datenbank ===
init_db()

# === Root Endpoint ===
@app.get("/")
async def root():
    return {"message": "Server läuft! 🚀"}

# === Endpoint: CSV hochladen, Forecast erstellen und speichern ===
@app.post("/upload_csv/")
async def upload_csv(file: UploadFile = File(...)):
    file_location = os.path.join(UPLOAD_FOLDER, file.filename)

    with open(file_location, "wb") as buffer:
        buffer.write(await file.read())

    try:
        df = pd.read_csv(file_location, sep=";")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fehler beim Einlesen der CSV-Datei: {str(e)}")

    try:
        forecast_df = forecast_with_prophet(df)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fehler beim Erstellen der Vorhersage: {str(e)}")

    save_forecast_to_db(forecast_df, source_file=file.filename)

    return {
        "message": "CSV erfolgreich hochgeladen und Vorhersage erstellt und gespeichert!",
        "forecast_preview": forecast_df.head(10).to_dict(orient="records")
    }

# === Endpoint: Forecast-Daten abrufen ===
@app.get("/forecasts/")
async def get_forecasts():
    forecasts = load_forecasts()
    forecasts_list = [{"date": f[0], "value": f[1], "source_file": f[2]} for f in forecasts]
    return forecasts_list

# === Endpoint: Echte Messdaten hochladen ===
@app.post("/upload_actual/")
async def upload_actual(file: UploadFile = File(...)):
    file_location = os.path.join(UPLOAD_FOLDER, file.filename)

    with open(file_location, "wb") as buffer:
        buffer.write(await file.read())

    try:
        df_actual = pd.read_csv(file_location, sep=";")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fehler beim Einlesen der tatsächlichen CSV-Datei: {str(e)}")

    save_actual_to_db(df_actual, source_file=file.filename)

    return {"message": "Tatsächliche Werte erfolgreich hochgeladen!"}

# === Endpoint: Forecast vs Actual Vergleich ===
@app.get("/forecast_vs_actual/")
async def forecast_vs_actual():
    try:
        forecasts = load_forecasts()
        actuals = load_actuals()

        if not forecasts or not actuals:
            raise HTTPException(status_code=404, detail="Forecast oder Actual Daten fehlen!")

        forecast_list = [{"date": f[0], "forecast": f[1]} for f in forecasts]
        actual_list = [{"date": a[0], "actual": a[1]} for a in actuals]

        df_forecast = pd.DataFrame(forecast_list)
        df_actual = pd.DataFrame(actual_list)

        merged = pd.merge(df_forecast, df_actual, on="date", how="outer").sort_values("date")

        # WICHTIG: NaN ersetzen durch None (damit JSON funktioniert)
        merged = merged.replace({pd.NA: None, float('nan'): None})

        return merged.to_dict(orient="records")

    except Exception as e:
        print("❌ Fehler bei forecast_vs_actual:", str(e))
        raise HTTPException(status_code=500, detail=f"Fehler beim Forecast vs Actual Vergleich: {str(e)}")
