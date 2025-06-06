# api.py
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Body, Path
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from io import StringIO
import os
import traceback
from typing import Dict, Any, List, Tuple, Optional # Add Optional
from pydantic import BaseModel # NEW: Import BaseModel for Pydantic models

app = FastAPI()
print("FastAPI app instance created.")

try:
    from src.database import (
        save_actual_to_db, load_actuals, init_db,
        update_anomaly_flags_in_db, update_single_data_point_anomaly_status,
        update_imputed_values_in_db,
        # NEW IMPORTS
        get_containers, add_container, update_container_name, delete_container
    )
    from src.prophet_model import forecast_with_prophet
    from src.tf_keras_model import forecast_with_tensorflow
    from src.data_loader import add_features, identify_anomalies_iqr, clean_actual_data_interpolate
    from src import config
except ImportError as e:
    print(f"ERROR: Could not import module: {e}")
    # Dummy functions for database operations
    def save_actual_to_db(*args, **kwargs): print("WARN: save_actual_to_db (dummy) called"); return []
    def load_actuals(*args, **kwargs): print("WARN: load_actuals (dummy) called"); return []
    def init_db(*args, **kwargs): print("WARN: init_db (dummy) called")
    def update_anomaly_flags_in_db(*args, **kwargs): print("WARN: update_anomaly_flags_in_db (dummy) called"); return 0
    def update_single_data_point_anomaly_status(*args, **kwargs): print("WARN: update_single_data_point_anomaly_status (dummy) called"); return 0
    def update_imputed_values_in_db(*args, **kwargs): print("WARN: update_imputed_values_in_db (dummy) called"); return 0
    # Dummy functions for NEW container management
    def get_containers(*args, **kwargs): print("WARN: get_containers (dummy) called"); return []
    def add_container(*args, **kwargs): print("WARN: add_container (dummy) called"); return False
    def update_container_name(*args, **kwargs): print("WARN: update_container_name (dummy) called"); return False
    def delete_container(*args, **kwargs): print("WARN: delete_container (dummy) called"); return False
    # Ensure dummy forecast_with_prophet returns two values now
    def forecast_with_prophet(*args, **kwargs):
        print("WARN: forecast_with_prophet (dummy) called")
        return pd.DataFrame({'ds': [], 'yhat': [], 'yhat_lower': [], 'yhat_upper': [], 'trend': []}), {}
    def forecast_with_tensorflow(*args, **kwargs):
        print("WARN: forecast_with_tensorflow (dummy) called")
        # TF model might also return a report in the future, for now, empty dict
        return pd.DataFrame({'ds': [], 'yhat': []}), {}
    def identify_anomalies_iqr(df, value_column_name, iqr_factor=1.5) -> Tuple[pd.DataFrame, int]:
        print("WARN: identify_anomalies_iqr (dummy) called")
        df_copy = df.copy(); df_copy['is_anomaly'] = False; return df_copy, 0
    def add_features(df, target_column, include_lag_rolling=True): print("WARN: add_features (dummy) called"); return df, [], []
    def clean_actual_data_interpolate(*args, **kwargs) -> Tuple[pd.DataFrame, List[Tuple[str, float]], int]:
        print("WARN: clean_actual_data_interpolate (dummy) called")
        return pd.DataFrame(columns=['date','actual','is_anomaly']), [], 0

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)
print("CORS middleware added.")

@app.on_event("startup")
async def startup_event():
    print("Application startup event triggered.")
    init_db()
    # Add default containers if the containers table is empty
    # This ensures there are always some containers available initially
    existing_containers = get_containers()
    if not existing_containers:
        print("INFO (api.py - startup): No containers found, adding default ones.")
        default_containers = [ "HB/DST Kleinhadersdorf (M616.F1)", "DST Kleinhadersdorf (M960.F1)", "Ortsnetz Poysdorf (M617.F1)", "Zulauf HB Poysdorf (M100.F1)", "Ablauf HB Poysdorf (M130.F1)", "DST Poysdorf (M150.F1)", "Zulauf v. Poysdorf HB Poysbrunn (M320.F1)", "Zulauf v. Bru. HB Poysbrunn (M310.F1)", "Ablauf HB Poysbrunn (M230.F1)", "Brunnen 3 Poysbrunn (M950.F1)" ]
        for container_name in default_containers:
            add_container(container_name)
        print("INFO (api.py - startup): Default containers added.")
    print("Database initialization complete (called from startup event).")

@app.post("/api/upload_data/")
async def upload_data_endpoint(file: UploadFile = File(...), container_id: str = Form(...)):
    if not file.filename or not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Nur CSV Dateien (.csv) sind erlaubt.")
    
    # Check if the container_id exists in the containers table
    if container_id not in get_containers():
        raise HTTPException(status_code=404, detail=f"Container '{container_id}' existiert nicht in der Datenbank. Bitte erstellen Sie ihn zuerst.")

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Die hochgeladene Datei ist leer.")

        try: decoded_content = content.decode('utf-8-sig')
        except UnicodeDecodeError:
            try: decoded_content = content.decode('utf-8')
            except UnicodeDecodeError:
                decoded_content = content.decode('latin1', errors='replace')
                print(f"WARN (api.py - upload): File '{file.filename}' for '{container_id}' was not UTF-8. Decoded with latin1 (errors replaced).")

        df_uploaded = pd.read_csv(StringIO(decoded_content), sep=config.DATA_SEPARATOR)
        if df_uploaded.empty: raise HTTPException(status_code=400, detail="CSV enthält keine Datenzeilen.")

        df_uploaded.columns = [str(col).strip().lower() for col in df_uploaded.columns]
        date_col_variants = ['date', 'datum', 'zeitstempel', 'timestamp', 'ds']
        value_col_variants = ['value', 'wert', 'verbrauch', 'y']
        actual_date_col = next((col for col in df_uploaded.columns if col in date_col_variants), None)
        actual_value_col = next((col for col in df_uploaded.columns if col in value_col_variants), None)
        error_details_for_user = []
        if not actual_date_col: error_details_for_user.append(f"Datum ('{'/'.join(date_col_variants)}')")
        if not actual_value_col: error_details_for_user.append(f"Wert ('{'/'.join(value_col_variants)}')")

        if error_details_for_user:
            detail_msg = f"CSV muss Spalten für { ' und '.join(error_details_for_user) } enthalten."
            return JSONResponse(status_code=422, content={"message": "Fehlerhafte CSV-Struktur.", "detail": detail_msg, "errors": [{"row_csv": 1, "column_name": "Header", "error_message": detail_msg, "original_value": f"Gefundene Spalten (normalisiert): {df_uploaded.columns.tolist()}"}]})

        df_to_save = df_uploaded[[actual_date_col, actual_value_col]].rename(columns={actual_date_col: 'Date', actual_value_col: 'Value'})
        processing_errors = save_actual_to_db(df_to_save, container_id, source_file=file.filename or "unknown.csv")
        if processing_errors: return JSONResponse(status_code=422, content={"message": "Fehler bei Verarbeitung.", "detail": "Einige Zeilen fehlerhaft.", "errors": processing_errors})
        return JSONResponse(status_code=200, content={"message": f"Daten für '{container_id}' erfolgreich hochgeladen."})
    except HTTPException as he: raise he
    except UnicodeDecodeError: traceback.print_exc(); raise HTTPException(status_code=400, detail="Fehler beim Dekodieren der Datei. Bitte stellen Sie sicher, dass die Datei UTF-8 kodiert ist.")
    except Exception as e: traceback.print_exc(); raise HTTPException(status_code=500, detail=f"Interner Serverfehler beim Upload: {str(e)}.")

@app.get("/api/historical_data/{container_id:path}")
async def get_historical_data_endpoint(container_id: str = Path(..., title="The ID of the container, can contain slashes")):
    # Check if the container_id exists in the containers table
    if container_id not in get_containers():
        raise HTTPException(status_code=404, detail=f"Container '{container_id}' existiert nicht.")
    try:
        rows: List[Tuple[str, float | None, bool]] = load_actuals(container_id)
        if not rows: return JSONResponse(status_code=200, content=[])
        df_from_db = pd.DataFrame(rows, columns=['date', 'actual', 'is_anomaly'])
        df_for_json = df_from_db.replace({pd.NA: None, np.nan: None})
        df_for_json = df_for_json.sort_values(by='date')
        records = df_for_json.to_dict(orient='records')
        return JSONResponse(status_code=200, content=records)
    except Exception as e: traceback.print_exc(); raise HTTPException(status_code=500, detail=f"Failed to load historical data: {str(e)}")

@app.post("/api/actuals/{container_id:path}/analyze_and_mark_anomalies")
async def analyze_and_mark_anomalies_endpoint(container_id: str = Path(..., title="The ID of the container, can contain slashes")):
    print(f"--- POST /api/actuals/{container_id}/analyze_and_mark_anomalies ---")
    # Check if the container_id exists in the containers table
    if container_id not in get_containers():
        raise HTTPException(status_code=404, detail=f"Container '{container_id}' existiert nicht.")
    try:
        historical_rows = load_actuals(container_id)
        if not historical_rows: raise HTTPException(status_code=404, detail=f"Keine historischen Daten für Container '{container_id}' gefunden.")
        df_for_identification = pd.DataFrame(historical_rows, columns=['date_iso', 'value_num', 'is_anomaly_initial'])
        df_for_identification.rename(columns={'date_iso': config.DATE_COLUMN, 'value_num': config.TARGET_COLUMN}, inplace=True)
        df_for_identification[config.DATE_COLUMN] = pd.to_datetime(df_for_identification[config.DATE_COLUMN])
        df_for_identification = df_for_identification.sort_values(by=config.DATE_COLUMN).reset_index(drop=True)
        df_with_identified_anomalies, num_anomalies_identified = identify_anomalies_iqr(
            df_for_identification[[config.DATE_COLUMN, config.TARGET_COLUMN]].copy(),
            value_column_name=config.TARGET_COLUMN, iqr_factor=1.5)
        print(f"INFO (api.py - analyze_and_mark): {num_anomalies_identified} anomalies for container '{container_id}' identified by IQR.")
        marked_count_in_db = update_anomaly_flags_in_db(container_id, df_with_identified_anomalies.copy(), date_col_name=config.DATE_COLUMN)
        anomaly_sample_list = []
        if marked_count_in_db > 0:
            anomalies_df_sample = df_with_identified_anomalies[df_with_identified_anomalies['is_anomaly']].copy()
            anomalies_df_sample[config.DATE_COLUMN] = pd.to_datetime(anomalies_df_sample[config.DATE_COLUMN]).dt.strftime('%Y-%m-%dT%H:%M:%SZ')
            for _, row in anomalies_df_sample.head(5).iterrows():
                anomaly_sample_list.append({"date": row[config.DATE_COLUMN], "value": round(row[config.TARGET_COLUMN], 2) if pd.notnull(row[config.TARGET_COLUMN]) else None})
        return JSONResponse(status_code=200, content={"message": f"Anomalie-Analyse für Container '{container_id}' abgeschlossen. {marked_count_in_db} Datenpunkte als Anomalie markiert/aktualisiert.", "container_id": container_id, "anomalies_marked_count": marked_count_in_db, "anomaly_sample": anomaly_sample_list})
    except HTTPException as he: raise he
    except Exception as e: traceback.print_exc(); raise HTTPException(status_code=500, detail=f"Fehler bei der Anomalie-Analyse für Container '{container_id}': {str(e)}")

@app.post("/api/actuals/{container_id:path}/update_anomaly_datapoint")
async def update_anomaly_datapoint_status_endpoint(container_id: str = Path(..., title="The ID of the container, can contain slashes"), payload: Dict[str, Any] = Body(...)):
    print(f"--- POST /api/actuals/{container_id}/update_anomaly_datapoint ---")
    # Check if the container_id exists in the containers table
    if container_id not in get_containers():
        raise HTTPException(status_code=404, detail=f"Container '{container_id}' existiert nicht.")
    datapoint_date_str = payload.get("date"); new_status = payload.get("is_anomaly")
    if datapoint_date_str is None or not isinstance(new_status, bool): raise HTTPException(status_code=400, detail="Payload must include 'date' (string) and 'is_anomaly' (boolean).")
    try:
        pd.to_datetime(datapoint_date_str)
        if not (datapoint_date_str.endswith('Z') and 'T' in datapoint_date_str and len(datapoint_date_str) == 20): print(f"WARN (api.py - update_datapoint): Date string '{datapoint_date_str}' might not be in expected ISO8601 with Z notation 'YYYY-MM-DDTHH:MM:SSZ'.")
    except ValueError: raise HTTPException(status_code=400, detail=f"Ungültiges Datumsformat: '{datapoint_date_str}'. Erwartet ISO-Format wie 'YYYY-MM-DDTHH:MM:SSZ'.")
    try:
        updated_count = update_single_data_point_anomaly_status(container_id, datapoint_date_str, new_status)
        if updated_count > 0: return JSONResponse(status_code=200, content={"message": f"Anomalie-Status für Datenpunkt am {datapoint_date_str} für Container '{container_id}' erfolgreich auf {new_status} gesetzt.", "container_id": container_id, "date": datapoint_date_str, "new_status": new_status})
        else: return JSONResponse(status_code=404, content={"message": f"Datenpunkt am {datapoint_date_str} für Container '{container_id}' nicht gefunden oder Status war bereits {new_status}. Keine Änderung vorgenommen.", "detail": "Stellen Sie sicher, dass das Datum exakt mit einem existierenden Datensatz übereinstimmt und der Status geändert werden muss."})
    except Exception as e: traceback.print_exc(); raise HTTPException(status_code=500, detail=f"Fehler beim Aktualisieren des Anomalie-Status für Datenpunkt: {str(e)}")

@app.post("/api/actuals/{container_id:path}/clean_data")
async def clean_data_endpoint(container_id: str = Path(..., title="The ID of the container, can contain slashes")):
    print(f"--- POST /api/actuals/{container_id}/clean_data ---")
    # Check if the container_id exists in the containers table
    if container_id not in get_containers():
        raise HTTPException(status_code=404, detail=f"Container '{container_id}' existiert nicht.")
    try:
        historical_rows: List[Tuple[str, float | None, bool]] = load_actuals(container_id)
        if not historical_rows: raise HTTPException(status_code=404, detail=f"Keine historischen Daten für Container '{container_id}' zum Bereinigen gefunden.")
        df_to_clean = pd.DataFrame(historical_rows, columns=['date', 'actual', 'is_anomaly'])
        nans_before = df_to_clean['actual'].isnull().sum()
        cleaned_df, imputed_rows_details, num_imputed = clean_actual_data_interpolate(df_to_clean, value_col_name='actual')
        nans_after = cleaned_df['actual'].isnull().sum()
        db_update_count = 0
        if num_imputed > 0:
            db_update_count = update_imputed_values_in_db(container_id, imputed_rows_details)
            if db_update_count != num_imputed and db_update_count != -1 : print(f"WARN (api.py - clean_data): Discrepancy between imputed count ({num_imputed}) and DB update count ({db_update_count}) for '{container_id}'.")

        response_message = f"Datenbereinigung für Container '{container_id}' abgeschlossen. {num_imputed} Werte wurden mittels linearer Interpolation gefüllt."
        status_code = 200; additional_detail_for_user = None
        if nans_before == 0: response_message = f"Keine fehlenden Werte (NaNs) in den Daten für Container '{container_id}' gefunden. Keine Bereinigung notwendig."; num_imputed = 0
        elif nans_before > 0 and nans_after > 0:
            response_message = f"Datenbereinigung für Container '{container_id}' teilweise durchgeführt. {num_imputed} von {nans_before} fehlenden Werten wurden interpoliert. {nans_after} fehlende Werte konnten nicht gefüllt werden."
            additional_detail_for_user = "Einige fehlende Werte konnten nicht durch lineare Interpolation gefüllt werden (möglicherweise am Anfang/Ende der Zeitreihe oder in durchgehend fehlenden Blöcken). Bitte überprüfen Sie die Daten bei Bedarf manuell."
            print(f"INFO (api.py - clean_data): For container '{container_id}', {nans_after} NaNs remain after interpolation. Initial NaNs: {nans_before}, Imputed count: {num_imputed}.")
        elif nans_before > 0 and nans_after == 0: response_message = f"Datenbereinigung für Container '{container_id}' erfolgreich. Alle {num_imputed} (von {nans_before}) fehlenden Werte wurden interpoliert."

        response_content = {"message": response_message, "container_id": container_id, "values_imputed": num_imputed, "db_rows_updated": db_update_count if db_update_count != -1 else num_imputed, "nans_before": int(nans_before), "nans_after": int(nans_after)}
        if additional_detail_for_user: response_content["detail"] = additional_detail_for_user
        return JSONResponse(status_code=status_code, content=response_content)
    except HTTPException as he: raise he
    except Exception as e: traceback.print_exc(); raise HTTPException(status_code=500, detail=f"Fehler bei der Datenbereinigung für Container '{container_id}': {str(e)}")

@app.post("/api/generate_forecast/")
async def generate_forecast_endpoint(payload: Dict[str, Any] = Body(...)):
    containerId = payload.get("containerId")
    duration = payload.get("duration")
    model_choice = payload.get("model")
    prophet_train_with_anomalies = payload.get("prophet_train_with_anomalies", False)

    if not all([containerId, duration, model_choice]):
        raise HTTPException(status_code=400, detail="Fehlende Parameter: containerId, duration und model sind erforderlich.")
    
    # Check if the containerId exists in the containers table
    if containerId not in get_containers():
        raise HTTPException(status_code=404, detail=f"Container '{containerId}' existiert nicht.")

    try:
        historical_rows = load_actuals(containerId)
        if not historical_rows:
            raise HTTPException(status_code=404, detail=f"Keine historischen Daten für Container '{containerId}' gefunden, um eine Prognose zu erstellen.")

        history_df_raw = pd.DataFrame(historical_rows, columns=[config.DATE_COLUMN, config.TARGET_COLUMN, 'is_anomaly'])
        history_df_raw[config.DATE_COLUMN] = pd.to_datetime(history_df_raw[config.DATE_COLUMN])
        history_df_raw[config.TARGET_COLUMN] = pd.to_numeric(history_df_raw[config.TARGET_COLUMN], errors='coerce')
        history_df_raw['is_anomaly'] = history_df_raw['is_anomaly'].astype(bool)

        if history_df_raw[config.TARGET_COLUMN].isnull().any():
            print(f"WARNING (api.py - forecast): Zielspalte '{config.TARGET_COLUMN}' für '{containerId}' enthält {history_df_raw[config.TARGET_COLUMN].isnull().sum()} NaNs. Fülle mit ffill/bfill vor Modelltraining.")
            history_df_raw[config.TARGET_COLUMN] = history_df_raw[config.TARGET_COLUMN].ffill().bfill()
            if history_df_raw[config.TARGET_COLUMN].isnull().any():
                print(f"WARNUNG (api.py - forecast): Zielspalte '{config.TARGET_COLUMN}' enthält immer noch NaNs nach ffill/bfill. Fülle mit 0 für Modell '{model_choice}'.")
                history_df_raw[config.TARGET_COLUMN] = history_df_raw[config.TARGET_COLUMN].fillna(0)

        history_df_raw = history_df_raw.sort_values(by=config.DATE_COLUMN).reset_index(drop=True)
        print(f"INFO (api.py - forecast): Rohdaten für '{containerId}' (nach initialer NaN-Füllung der Zielspalte): {len(history_df_raw)} Zeilen.")

        history_df_for_feature_eng = pd.DataFrame()
        if model_choice == 'prophet' and prophet_train_with_anomalies:
            history_df_for_feature_eng = history_df_raw.copy()
            print(f"INFO (api.py - forecast): Prophet wird MIT Anomalien (gemäß Payload-Option) für '{containerId}' trainiert. Daten für Feature Engineering: {len(history_df_for_feature_eng)} Zeilen.")
        else:
            history_df_for_feature_eng = history_df_raw[~history_df_raw['is_anomaly']].copy()
            removed_count = len(history_df_raw) - len(history_df_for_feature_eng)
            print(f"INFO (api.py - forecast): {removed_count} Anomalien basierend auf DB-Flag entfernt. Daten für Feature Engineering: {len(history_df_for_feature_eng)} Zeilen.")

        if 'is_anomaly' in history_df_for_feature_eng.columns:
             history_df_for_feature_eng = history_df_for_feature_eng.drop(columns=['is_anomaly'])

        if history_df_for_feature_eng.empty:
            detail_message = f"Keine gültigen Datenpunkte für die Prognose für Container '{containerId}' nach der optionalen Anomalieentfernung vorhanden."
            print(f"WARN (api.py - forecast): {detail_message}")
            return JSONResponse(status_code=200, content={"forecast_data": [], "message": detail_message}) # Changed "data" to "forecast_data" for clarity

        if history_df_for_feature_eng[config.DATE_COLUMN].dt.tz is not None:
            history_df_for_feature_eng[config.DATE_COLUMN] = history_df_for_feature_eng[config.DATE_COLUMN].dt.tz_localize(None)

        history_df_indexed = history_df_for_feature_eng.set_index(config.DATE_COLUMN)
        history_df_model_input, _, _ = add_features(
            history_df_indexed.copy(), target_column=config.TARGET_COLUMN, include_lag_rolling=True
        )
        history_df_model_input = history_df_model_input.reset_index()

        min_data_prophet = 2; min_data_tf = config.LSTM_LOOK_BACK + 1
        data_length_check = len(history_df_model_input); min_data_required = 0
        if model_choice == 'prophet':
            min_data_required = min_data_prophet
            data_length_check = history_df_model_input[config.TARGET_COLUMN].notna().sum()
        elif model_choice == 'tensorflow': min_data_required = min_data_tf
        else: min_data_required = 2

        if data_length_check < min_data_required:
            detail_message = f"Nicht genügend Datenpunkte ({data_length_check} gültige) für Modell '{model_choice}' für Container '{containerId}'. Benötigt: {min_data_required}."
            print(f"ERROR (api.py - forecast): {detail_message}")
            return JSONResponse(status_code=200, content={"forecast_data": [], "message": detail_message})

        periods_map = {'1d': 1, '7d': 7, '30d': 30, '90d': 90}
        periods = periods_map.get(duration)
        if periods is None: raise HTTPException(status_code=400, detail=f"Ungültige Prognosedauer: '{duration}'. Erlaubt: {list(periods_map.keys())}")

        forecast_df = pd.DataFrame()
        model_training_report = None

        if model_choice == 'prophet':
            future_start_date = history_df_model_input[config.DATE_COLUMN].max() + pd.Timedelta(days=1)
            future_dates_for_regressors = pd.date_range(start=future_start_date, periods=periods, freq='D')
            future_regressors_df_base = pd.DataFrame({config.DATE_COLUMN: future_dates_for_regressors})
            future_regressors_df_base = future_regressors_df_base.set_index(config.DATE_COLUMN)
            future_regressors_df_with_features, _, _ = add_features(
                future_regressors_df_base.copy(), target_column=config.TARGET_COLUMN, include_lag_rolling=False
            )
            future_regressors_df_with_features = future_regressors_df_with_features.reset_index()

            forecast_df, model_training_report = forecast_with_prophet(
                history_df_model_input.copy(), periods,
                extra_regressors_df=future_regressors_df_with_features.copy()
            )
        elif model_choice == 'tensorflow':
            forecast_df_tf, tf_report = forecast_with_tensorflow(history_df_model_input.copy(), periods)
            forecast_df = forecast_df_tf
            model_training_report = tf_report
        else:
            raise HTTPException(status_code=400, detail=f"Ungültiges Modell ausgewählt: {model_choice}")

        if forecast_df is None or forecast_df.empty or 'ds' not in forecast_df.columns or 'yhat' not in forecast_df.columns:
            detail_message = f"Modell '{model_choice}' lieferte kein Ergebnis für Container '{containerId}'."
            print(f"ERROR (api.py - forecast): {detail_message}")
            return JSONResponse(status_code=200, content={"forecast_data": [], "message": detail_message, "model_training_report": model_training_report})

        forecast_df['ds'] = pd.to_datetime(forecast_df['ds'])
        if forecast_df['ds'].dt.tz is not None: forecast_df['ds'] = forecast_df['ds'].dt.tz_localize(None)

        last_hist_date = history_df_model_input[config.DATE_COLUMN].max()
        future_forecast_df = forecast_df[forecast_df['ds'] > last_hist_date].copy()

        if future_forecast_df.empty:
            detail_message = f"Keine zukünftigen Prognosepunkte von Modell '{model_choice}' für Container '{containerId}' generiert."
            print(f"WARN (api.py - forecast): {detail_message}")
            return JSONResponse(status_code=200, content={"forecast_data": [], "message": detail_message, "model_training_report": model_training_report})

        result_columns = ['ds', 'yhat']
        if 'yhat_lower' in future_forecast_df.columns and 'yhat_upper' in future_forecast_df.columns:
            result_columns.extend(['yhat_lower', 'yhat_upper'])
        if 'trend' in future_forecast_df.columns and model_choice == 'prophet': result_columns.append('trend')

        result_df = future_forecast_df[result_columns].rename(columns={'ds': 'date', 'yhat': 'forecast'})
        result_df['date'] = pd.to_datetime(result_df['date']).dt.tz_localize('UTC').dt.strftime('%Y-%m-%dT%H:%M:%SZ')

        response_payload = {
            "forecast_data": result_df.to_dict(orient='records'),
            "message": f"Prognose für Container '{containerId}' mit Modell '{model_choice}' erfolgreich generiert."
        }
        if model_training_report:
            response_payload["model_training_report"] = model_training_report

        return JSONResponse(status_code=200, content=response_payload)

    except HTTPException as he: raise he
    except ValueError as ve: traceback.print_exc(); raise HTTPException(status_code=400, detail=f"Datenverarbeitungs- oder Modellkonfigurationsfehler: {str(ve)}")
    except Exception as e: traceback.print_exc(); raise HTTPException(status_code=500, detail=f"Interner Serverfehler bei Prognoseerstellung: {str(e)}")

@app.get("/api/forecast_vs_actual/{container_id:path}")
async def get_forecast_vs_actual_endpoint(container_id: str = Path(..., title="The ID of the container, can contain slashes")):
    print(f"WARN: /api/forecast_vs_actual/{container_id} endpoint called but not fully implemented in provided code.")
    return JSONResponse(status_code=501, content={"message": "Endpoint not implemented yet."})

# --- NEW ENDPOINTS FOR CONTAINER MANAGEMENT ---

class ContainerCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ContainerUpdate(BaseModel):
    new_name: str
    description: Optional[str] = None # Optional, if you want to update description as well

@app.get("/api/containers")
async def get_containers_endpoint():
    """Get a list of all available container names."""
    try:
        containers = get_containers()
        return JSONResponse(status_code=200, content=containers)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to retrieve containers: {str(e)}")

@app.post("/api/containers")
async def add_container_endpoint(container_data: ContainerCreate):
    """Add a new water container."""
    # Ensure the container name does not contain problematic characters
    sanitized_name = config.sanitize_filename(container_data.name)
    if sanitized_name != container_data.name:
        raise HTTPException(status_code=400, detail=f"Ungültiger Container-Name. Erlaubt sind nur alphanumerische Zeichen, '_', '-' und '.'. Sonderzeichen wurden entfernt oder ersetzt: '{sanitized_name}'")

    if not sanitized_name:
        raise HTTPException(status_code=400, detail="Container-Name darf nicht leer sein.")

    success = add_container(sanitized_name, container_data.description)
    if success:
        return JSONResponse(status_code=201, content={"message": f"Container '{sanitized_name}' erfolgreich hinzugefügt."})
    else:
        raise HTTPException(status_code=409, detail=f"Container '{sanitized_name}' existiert bereits.")

@app.put("/api/containers/{old_name:path}")
async def update_container_endpoint(old_name: str = Path(..., title="Old container name"), container_data: ContainerUpdate = Body(...)):
    """Update the name of an existing water container."""
    # Ensure the new container name does not contain problematic characters
    sanitized_new_name = config.sanitize_filename(container_data.new_name)
    if sanitized_new_name != container_data.new_name:
        raise HTTPException(status_code=400, detail=f"Ungültiger neuer Container-Name. Erlaubt sind nur alphanumerische Zeichen, '_', '-' und '.'. Sonderzeichen wurden entfernt oder ersetzt: '{sanitized_new_name}'")
    if not sanitized_new_name:
        raise HTTPException(status_code=400, detail="Neuer Container-Name darf nicht leer sein.")

    if old_name not in get_containers():
        raise HTTPException(status_code=404, detail=f"Container '{old_name}' nicht gefunden.")
    
    if old_name == sanitized_new_name:
        return JSONResponse(status_code=200, content={"message": f"Containername ist bereits '{old_name}'. Keine Änderung vorgenommen."})

    success = update_container_name(old_name, sanitized_new_name)
    if success:
        return JSONResponse(status_code=200, content={"message": f"Container '{old_name}' erfolgreich in '{sanitized_new_name}' umbenannt."})
    else:
        # The database function returns False if the new name exists for another container
        raise HTTPException(status_code=409, detail=f"Container '{sanitized_new_name}' existiert bereits oder es gab einen Konflikt beim Umbenennen.")

@app.delete("/api/containers/{name:path}")
async def delete_container_endpoint(name: str = Path(..., title="Name of the container to delete")):
    """Delete a water container and all its associated data."""
    if name not in get_containers():
        raise HTTPException(status_code=404, detail=f"Container '{name}' nicht gefunden.")
    
    success = delete_container(name)
    if success:
        return JSONResponse(status_code=200, content={"message": f"Container '{name}' und zugehörige Daten erfolgreich gelöscht."})
    else:
        raise HTTPException(status_code=500, detail=f"Fehler beim Löschen von Container '{name}'.")


print("FastAPI routes defined.")