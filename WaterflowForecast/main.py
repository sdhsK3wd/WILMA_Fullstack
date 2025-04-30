# main.py (Korrigiert für Prophet Timezone-Anforderung)

import os
import pandas as pd
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
# Stelle sicher, dass deine Modell- und DB-Funktionen korrekt importiert werden
from src.prophet_model import forecast_with_prophet # Beispiel
# from src.tensorflow_model import forecast_with_tensorflow # Beispiel
from src.database import init_db, save_forecast_to_db, load_forecasts, save_actual_to_db, load_actuals
from pydantic import BaseModel
from typing import Literal
# ✅ timezone wird nicht mehr benötigt, da wir naive Daten verwenden
from datetime import datetime, timedelta
import traceback
import io

# === Konfiguration ===
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
# Der Stichtag, bis zu dem trainiert wird und ab dem die Prognose beginnt
# ✅ Mache FORECAST_START_DATE wieder naiv
FORECAST_START_DATE = datetime(2025, 1, 1)

# === FastAPI App erstellen ===
app = FastAPI(title="Waterflow Forecast KI API")

# === CORS Einstellungen ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Datenbank Initialisierung (beim Start) ===
@app.on_event("startup")
async def startup_event():
    print("INFO: Initializing database...")
    init_db()
    print("INFO: Database initialized.")

# === Root Endpoint ===
@app.get("/")
async def root():
    return {"message": "Python KI Backend läuft! 🚀"}

# === Modell für die Forecast-Anfrage ===
class ForecastRequest(BaseModel):
    containerId: str
    duration: Literal['1d', '7d', '30d', '90d']
    model: Literal['prophet', 'tensorflow']

# === Endpoint: Forecast on-demand generieren ===
@app.post("/generate_forecast/")
async def generate_forecast_endpoint(request: ForecastRequest):
    print(f"Anfrage erhalten: Generate forecast für {request.containerId}, Dauer: {request.duration}, Modell: {request.model}")
    try:
        # --- Lade ECHTE historische Daten (Actuals) für das Modell ---
        print(f"INFO: Lade historische Actual-Daten für Training/Initialisierung...")
        actuals_raw = load_actuals()
        if not actuals_raw:
             raise HTTPException(status_code=404, detail="Keine historischen Actual-Daten zum Trainieren gefunden. Bitte zuerst Actual CSV hochladen.")

        df_history = pd.DataFrame(actuals_raw, columns=['date_str', 'value'])
        try:
            # Konvertiere zu datetime (wird wahrscheinlich tz-aware wegen 'Z')
            df_history['ds_temp'] = pd.to_datetime(df_history['date_str'], errors='coerce')
            # ✅ Entferne die Zeitzone, um naive Datetimes für Prophet zu erhalten
            df_history['ds'] = df_history['ds_temp'].dt.tz_localize(None)
            df_history = df_history.dropna(subset=['ds']) # Entferne Zeilen mit ungültigem Datum
            df_history = df_history.drop(columns=['ds_temp']) # Temporäre Spalte entfernen
        except Exception as date_err:
            raise HTTPException(status_code=400, detail=f"Fehler beim Konvertieren der Datumsspalte in Actuals: {date_err}")

        df_history = df_history.rename(columns={'value': 'y'})
        # ✅ Vergleich funktioniert jetzt (naive vs naive)
        df_history = df_history[df_history['ds'] < FORECAST_START_DATE].sort_values('ds')

        if df_history.empty:
             raise HTTPException(status_code=404, detail="Keine historischen Actual-Daten VOR dem Forecast-Startdatum gefunden.")

        print(f"INFO: Verwende {len(df_history)} historische Datenpunkte für Modell {request.model}.")
        periods_map = {'1d': 1, '7d': 7, '30d': 30, '90d': 90}
        periods = periods_map.get(request.duration, 30)

        # --- Wähle das Modell und generiere den Forecast AB DEM 01.01.2025 ---
        if request.model == 'prophet':
            print(f"INFO: Generiere Prophet Forecast für {periods} Tage...")
            # ✅ Übergib das DataFrame mit der naiven 'ds'-Spalte
            forecast_df_raw = forecast_with_prophet(df_history[['ds', 'y']], periods=periods) # Nur relevante Spalten übergeben
            # Wähle nur Zukunftsprognose aus und benenne Spalten um
            # Wichtig: forecast_df_raw['ds'] ist jetzt naiv
            forecast_df = forecast_df_raw[forecast_df_raw['ds'] >= FORECAST_START_DATE][['ds', 'yhat']].rename(columns={'ds': 'date', 'yhat': 'forecast'})

        elif request.model == 'tensorflow':
            print(f"INFO: Generiere TensorFlow Forecast für {periods} Tage...")
            # forecast_df_raw = forecast_with_tensorflow(df_history, ...) # Ähnliche Prüfung nötig
            raise HTTPException(status_code=501, detail="TensorFlow Modell noch nicht implementiert.")
        else:
            raise HTTPException(status_code=400, detail=f"Unbekanntes Modell: {request.model}")

        if forecast_df.empty: return []

        # Konvertiere Datum in ISO-String für JSON
        # Da 'date' jetzt naiv ist, fügen wir 'Z' manuell hinzu, um UTC anzuzeigen (oder lassen es weg)
        forecast_df['date'] = pd.to_datetime(forecast_df['date']).dt.strftime('%Y-%m-%dT%H:%M:%SZ')
        result_df = forecast_df[['date', 'forecast']].copy()
        result_df['forecast'] = pd.to_numeric(result_df['forecast'], errors='coerce').round(2)
        result_df = result_df.replace({np.nan: None})

        print(f"INFO: Sende {len(result_df)} Forecast-Punkte zurück (Start: {result_df['date'].iloc[0] if not result_df.empty else 'N/A'}).")
        return result_df.to_dict(orient="records")

    except HTTPException as http_exc: raise http_exc
    except TypeError as te:
        print(f"❌ TypeError bei /generate_forecast/: {str(te)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Fehler im Modellaufruf (TypeError): {str(te)}. Prüfe die Funktionsdefinition.")
    except Exception as e:
        print(f"❌ Fehler bei /generate_forecast/: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Fehler bei der Forecast-Generierung: {str(e)}")


# === Endpoint: Forecast vs Actual Vergleich ===
@app.get("/forecast_vs_actual/")
async def forecast_vs_actual():
    print("INFO: /forecast_vs_actual/ aufgerufen")
    try:
        forecasts_raw = load_forecasts()
        actuals_raw = load_actuals()

        if not actuals_raw and not forecasts_raw: return []

        df_forecast = pd.DataFrame(forecasts_raw, columns=['date_str', 'forecast_val', 'source_file'])
        df_actual = pd.DataFrame(actuals_raw, columns=['date_str', 'actual_val'])

        # Konvertiere Datum und benenne Spalten um, behandle Fehler
        if not df_forecast.empty:
            # ✅ Konvertiere zu datetime (wird tz-aware wegen 'Z' aus DB)
            df_forecast['date_aware'] = pd.to_datetime(df_forecast['date_str'], errors='coerce', utc=True)
            # ✅ Entferne Timezone für interne Verarbeitung/Merge
            df_forecast['date'] = df_forecast['date_aware'].dt.tz_localize(None)
            df_forecast = df_forecast.dropna(subset=['date'])
            df_forecast = df_forecast[['date', 'forecast_val']].rename(columns={'forecast_val': 'forecast'})
        else: df_forecast = pd.DataFrame(columns=['date', 'forecast'])

        if not df_actual.empty:
            # ✅ Konvertiere zu datetime (wird tz-aware wegen 'Z' aus DB)
            df_actual['date_aware'] = pd.to_datetime(df_actual['date_str'], errors='coerce', utc=True)
             # ✅ Entferne Timezone für interne Verarbeitung/Merge
            df_actual['date'] = df_actual['date_aware'].dt.tz_localize(None)
            df_actual = df_actual.dropna(subset=['date'])
            df_actual = df_actual[['date', 'actual_val']].rename(columns={'actual_val': 'actual'})
        else: df_actual = pd.DataFrame(columns=['date', 'actual'])

        # Kombiniere die DataFrames (Merge auf naive Datumsangaben)
        if df_actual.empty and df_forecast.empty: merged = pd.DataFrame(columns=['date', 'actual', 'forecast'])
        elif df_actual.empty: merged = df_forecast.copy(); merged['actual'] = np.nan
        elif df_forecast.empty: merged = df_actual.copy(); merged['forecast'] = np.nan
        else: merged = pd.merge(df_actual, df_forecast, on="date", how="outer").sort_values("date")

        # --- Robuste NaN zu None Konvertierung für JSON ---
        merged = merged.fillna(np.nan)
        records = merged.to_dict(orient="records")
        cleaned_records = []
        for record in records:
            cleaned_record = {}
            for key, value in record.items():
                if isinstance(value, float) and np.isnan(value): cleaned_record[key] = None
                elif pd.isna(value): cleaned_record[key] = None
                # ✅ Formatiere das naive Datum und füge 'Z' hinzu für ISO UTC String
                elif key == 'date' and isinstance(value, (pd.Timestamp, datetime)):
                     cleaned_record[key] = value.strftime('%Y-%m-%dT%H:%M:%SZ') if pd.notnull(value) else None
                elif key == 'date' and isinstance(value, str): cleaned_record[key] = value
                else: cleaned_record[key] = value
            cleaned_records.append(cleaned_record)

        print(f"INFO: /forecast_vs_actual/ sendet {len(cleaned_records)} kombinierte Punkte.")
        return cleaned_records

    except Exception as e:
        print(f"❌ Fehler bei /forecast_vs_actual/: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Fehler beim Laden der Vergleichsdaten: {str(e)}")


# === Endpoint: CSV hochladen (Forecast) ===
@app.post("/upload_csv/")
async def upload_csv(file: UploadFile = File(...)):
    # ... (Code wie vorher, stellt sicher, dass save_forecast_to_db 'ds' und 'yhat' bekommt) ...
     print(f"--- /upload_csv/ START: Empfange Datei {file.filename} ---")
     if not file.filename.endswith('.csv'): raise HTTPException(status_code=400, detail="Ungültiges Dateiformat.")
     try:
         content = await file.read(); df_forecast = pd.read_csv(io.BytesIO(content), sep=";")
         print("INFO (Upload CSV): DataFrame Info:"); print(df_forecast.info()); print(df_forecast.head())
         if 'Date' in df_forecast.columns and 'Value' in df_forecast.columns:
              df_forecast = df_forecast.rename(columns={'Date': 'ds', 'Value': 'yhat'})
              # Konvertiere zu datetime, aber lasse es erstmal naiv oder tz-aware, je nachdem was read_csv macht
              df_forecast['ds'] = pd.to_datetime(df_forecast['ds'], errors='coerce')
              df_forecast['yhat'] = pd.to_numeric(df_forecast['yhat'], errors='coerce')
              df_forecast = df_forecast.dropna(subset=['ds', 'yhat'])
         else: raise HTTPException(status_code=400, detail="Forecast CSV muss Spalten 'Date' und 'Value' enthalten.")
         if df_forecast.empty: raise HTTPException(status_code=400, detail="Keine gültigen Datenzeilen in Forecast CSV.")
         # save_forecast_to_db konvertiert intern zu ISO String mit Z
         save_forecast_to_db(df_forecast, source_file=file.filename)
         print("--- /upload_csv/ ENDE: Erfolgreich ---")
         return {"message": "Forecast CSV erfolgreich hochgeladen und gespeichert!"}
     except HTTPException as http_exc: raise http_exc
     except Exception as e: traceback.print_exc(); raise HTTPException(status_code=500, detail=f"Fehler Verarbeitung Forecast CSV: {e}")


# === Endpoint: CSV hochladen (Actual) ===
@app.post("/upload_actual/")
async def upload_actual(file: UploadFile = File(...)):
    # ... (Code wie vorher, stellt sicher, dass save_actual_to_db 'Date' und 'Value' bekommt) ...
    print(f"--- /upload_actual/ START: Empfange Datei {file.filename} ---")
    if not file.filename.endswith('.csv'): raise HTTPException(status_code=400, detail="Ungültiges Dateiformat.")
    try:
        content = await file.read(); df_actual = pd.read_csv(io.BytesIO(content), sep=";")
        print("INFO (Upload Actual): DataFrame Info:"); print(df_actual.info()); print(df_actual.head())
        if 'Date' not in df_actual.columns or 'Value' not in df_actual.columns: raise HTTPException(status_code=400, detail="Actual CSV muss Spalten 'Date' und 'Value' enthalten.")
        # Konvertiere zu datetime, aber lasse es erstmal naiv oder tz-aware
        df_actual['Date'] = pd.to_datetime(df_actual['Date'], errors='coerce')
        df_actual['Value'] = pd.to_numeric(df_actual['Value'], errors='coerce')
        df_actual = df_actual.dropna(subset=['Date', 'Value'])
        if df_actual.empty: raise HTTPException(status_code=400, detail="Keine gültigen Datenzeilen in Actual CSV.")
        # save_actual_to_db konvertiert intern zu ISO String mit Z
        save_actual_to_db(df_actual, source_file=file.filename)
        print("--- /upload_actual/ ENDE: Erfolgreich ---")
        return {"message": "Actual CSV erfolgreich hochgeladen und gespeichert!"}
    except HTTPException as http_exc: raise http_exc
    except Exception as e: traceback.print_exc(); raise HTTPException(status_code=500, detail=f"Fehler Verarbeitung Actual CSV: {e}")