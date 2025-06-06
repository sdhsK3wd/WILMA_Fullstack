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


import pandas as pd
import numpy as np
import os
import matplotlib.pyplot as plt
from sklearn.metrics import mean_absolute_error, mean_squared_error

# --- Configuration ---
RESULTS_DIR = "results"
FIGURES_DIR = os.path.join(RESULTS_DIR, "figures")

# Input files generated by the modeling scripts
PROPHET_FILE = os.path.join(RESULTS_DIR, "prophet_forecast_vs_actual_30d.csv")
TF_KERAS_FILE = os.path.join(RESULTS_DIR, "tf_keras_forecast_vs_actual_30d.csv")

# Output file for combined results
COMBINED_FILE = os.path.join(RESULTS_DIR, "combined_forecast_comparison.csv")
METRICS_FILE = os.path.join(RESULTS_DIR, "forecast_metrics.csv")

# --- Main Comparison Script ---
if __name__ == "__main__":
    print("--- Running Comparison for Prophet vs TF/Keras Forecasts ---")
    os.makedirs(FIGURES_DIR, exist_ok=True) # Ensure figures dir exists

    # Load Prophet results
    try:
        df_prophet = pd.read_csv(PROPHET_FILE, sep=';', parse_dates=['Date'], index_col='Date')
        # Keep only Actual and Prophet forecast (drop uncertainty if present)
        if 'Actual' not in df_prophet.columns or 'Prophet_Forecast' not in df_prophet.columns:
             raise ValueError("Prophet file missing required 'Actual' or 'Prophet_Forecast' columns.")
        df_prophet = df_prophet[['Actual', 'Prophet_Forecast']]
        print(f"Loaded Prophet results: {df_prophet.shape}")
    except FileNotFoundError:
        print(f"Error: Prophet results file not found: {PROPHET_FILE}")
        exit()
    except ValueError as e:
        print(f"Error loading Prophet file: {e}")
        exit()

    # Load TF/Keras results
    try:
        df_tf = pd.read_csv(TF_KERAS_FILE, sep=';', parse_dates=['Date'], index_col='Date')
        if 'TF_Keras_Forecast' not in df_tf.columns:
             raise ValueError("TF/Keras file missing required 'TF_Keras_Forecast' column.")
        # Only keep the forecast column, as 'Actual' is already in df_prophet
        df_tf = df_tf[['TF_Keras_Forecast']]
        print(f"Loaded TF/Keras results: {df_tf.shape}")
    except FileNotFoundError:
        print(f"Error: TF/Keras results file not found: {TF_KERAS_FILE}")
        exit()
    except ValueError as e:
        print(f"Error loading TF/Keras file: {e}")
        exit()

    # Merge the dataframes
    # df_prophet already has 'Actual' and 'Prophet_Forecast'
    df_comparison = df_prophet.join(df_tf)

    # Drop rows where any forecast is missing (if files had different date ranges somehow)
    df_comparison.dropna(inplace=True)

    if df_comparison.empty:
        print("Error: No common dates found between forecast files or files are empty.")
        exit()

    print(f"\nCombined comparison data shape: {df_comparison.shape}")
    print("First 5 rows of combined data:")
    print(df_comparison.head())

    # Save combined data
    df_comparison.to_csv(COMBINED_FILE, sep=';')
    print(f"\nCombined forecast data saved to {COMBINED_FILE}")

    # --- Calculate Metrics ---
    print("\nCalculating forecast metrics...")
    metrics = {}
    actual = df_comparison['Actual']

    # Prophet Metrics
    prophet_fc = df_comparison['Prophet_Forecast']
    mae_prophet = mean_absolute_error(actual, prophet_fc)
    rmse_prophet = np.sqrt(mean_squared_error(actual, prophet_fc))
    # MAPE - Handle potential zero values in actual
    mape_prophet = np.mean(np.abs((actual - prophet_fc) / np.where(actual == 0, 1e-6, actual))) * 100
    metrics['Prophet'] = {'MAE': mae_prophet, 'RMSE': rmse_prophet, 'MAPE (%)': mape_prophet}
    print(f"Prophet - MAE: {mae_prophet:.2f}, RMSE: {rmse_prophet:.2f}, MAPE: {mape_prophet:.2f}%")

    # TF/Keras Metrics
    tf_keras_fc = df_comparison['TF_Keras_Forecast']
    mae_tf = mean_absolute_error(actual, tf_keras_fc)
    rmse_tf = np.sqrt(mean_squared_error(actual, tf_keras_fc))
    mape_tf = np.mean(np.abs((actual - tf_keras_fc) / np.where(actual == 0, 1e-6, actual))) * 100
    metrics['TF_Keras'] = {'MAE': mae_tf, 'RMSE': rmse_tf, 'MAPE (%)': mape_tf}
    print(f"TF/Keras - MAE: {mae_tf:.2f}, RMSE: {rmse_tf:.2f}, MAPE: {mape_tf:.2f}%")

    # Save metrics
    df_metrics = pd.DataFrame(metrics).T # Transpose for better readability
    df_metrics.to_csv(METRICS_FILE, sep=';')
    print(f"\nMetrics saved to {METRICS_FILE}")

    # --- Plotting Comparison ---
    print("\nGenerating comparison plot...")
    try:
        plt.figure(figsize=(14, 7))
        plt.plot(df_comparison.index, df_comparison['Actual'], label='Actual (Generated)', color='black', linewidth=2.5, marker='o', markersize=4)
        plt.plot(df_comparison.index, df_comparison['Prophet_Forecast'], label=f'Prophet (MAE: {mae_prophet:.2f})', color='blue', linestyle='--', marker='x', markersize=4)
        plt.plot(df_comparison.index, df_comparison['TF_Keras_Forecast'], label=f'TF/Keras (MAE: {mae_tf:.2f})', color='red', linestyle=':', marker='+', markersize=5)

        plt.title('Model Forecast Comparison vs Actual (April 2025)')
        plt.xlabel('Date')
        plt.ylabel('Value')
        plt.legend()
        plt.grid(True)
        plt.xticks(rotation=45)
        plt.tight_layout() # Adjust layout

        plot_path = os.path.join(FIGURES_DIR, "combined_forecast_comparison.png")
        plt.savefig(plot_path)
        plt.close()
        print(f"Comparison plot saved to {plot_path}")

    except Exception as e:
        print(f"An error occurred during plotting: {e}")

    print("\n--- Comparison script finished ---")
# src/config.py
import os
import numpy as np # Wird hier nicht direkt verwendet, aber oft in Projekten

# --- Basisverzeichnisse ---
# Annahme: config.py ist in src/, src/ ist im Hauptprojektverzeichnis
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYNTHETIC_DATA_DIR = os.path.join(BASE_DIR, 'data', 'synthetic')
RESULTS_DIR = os.path.join(BASE_DIR, 'results') # Ergebnisse im Hauptverzeichnis/results

# --- Aktuell zu verwendende Daten (Beispielhaft) ---
DATA_DIR = SYNTHETIC_DATA_DIR
FILE_PATTERN = "synthetic_waterflow_5y.csv" # Beispiel, wähle deine Testdatei

# --- Spaltennamen und Trennzeichen ---
DATE_COLUMN = 'ds' # Standard für Prophet und oft intern verwendet
TARGET_COLUMN = 'y' # Interner Name für die Zielvariable in den Modellen
DATA_SEPARATOR = ';'

# --- Plausibilitätsprüfung ---
MAX_PLAUSIBLE_CONSUMPTION_VALUE = 10000.0 # Beispiel: Maximal plausibler Verbrauchswert pro Zeiteinheit

# --- Zeiträume (Beispielhaft, nicht global von API genutzt, aber für lokale Skripte) ---
TRAIN_START_DATE = '2022-01-01'
TRAIN_END_DATE = '2024-12-31'
FORECAST_START_DATE = '2025-01-01'
FORECAST_END_DATE = '2025-03-31'

# --- Prophet Konfiguration ---
# To make Prophet more sensitive to trend changes and capture more dynamic behavior,
# increase changepoint_prior_scale. Default was 0.05. Try values like 0.1, 0.2, or up to 0.5.
PROPHET_CHANGEPOINT_PRIOR = 0.15 # Example: Increased from 0.05
# This controls the flexibility of the seasonality.
# If seasonality seems too rigid, try increasing this. If too erratic, decrease.
PROPHET_SEASONALITY_PRIOR = 10.0 # Default is 10.0, can be tuned.
# For daily data points (one value per day), daily_seasonality refers to a pattern *within* each day,
# which is not applicable. Day-of-week is handled by weekly_seasonality.
# Day-of-year is handled by yearly_seasonality.
# So, PROPHET_DAILY_SEASONALITY = False is usually correct for daily data.
PROPHET_DAILY_SEASONALITY = False
# Consider 'multiplicative' if seasonal fluctuations scale with the trend.
# Options: 'additive' (default) or 'multiplicative'
PROPHET_SEASONALITY_MODE = 'additive' # or 'multiplicative'

# --- LSTM Konfiguration ---
LSTM_LOOK_BACK = 60
LSTM_UNITS_L1 = 100
LSTM_UNITS_L2 = 50
LSTM_DROPOUT = 0.2
LSTM_EPOCHS = 50
LSTM_BATCH_SIZE = 32
LSTM_EARLY_STOPPING_PATIENCE = 10

# --- Feature Engineering Konfiguration (für data_loader.py) ---
CREATE_LAG_FEATURES = True
LAG_VALUES = [1, 2, 7, 14, 30]

CREATE_ROLLING_FEATURES = True
ROLLING_WINDOWS = [7, 14, 30]

CREATE_DATE_FEATURES = True
EXCLUDE_COLUMNS_FROM_FEATURES = []

os.makedirs(RESULTS_DIR, exist_ok=True)

print(f"INFO (config.py): Project Base Directory: {BASE_DIR}")
print(f"INFO (config.py): Using Data From: {os.path.join(DATA_DIR, FILE_PATTERN if FILE_PATTERN else '')}")
print(f"INFO (config.py): Results Directory: {RESULTS_DIR}")
print(f"INFO (config.py): MAX_PLAUSIBLE_CONSUMPTION_VALUE set to: {MAX_PLAUSIBLE_CONSUMPTION_VALUE}")
print(f"INFO (config.py): PROPHET_CHANGEPOINT_PRIOR set to {PROPHET_CHANGEPOINT_PRIOR}")
print(f"INFO (config.py): PROPHET_SEASONALITY_MODE set to {PROPHET_SEASONALITY_MODE}")


def sanitize_filename(name: str) -> str:
    name = str(name).strip()
    name = name.replace('/', '_').replace('\\', '_').replace(':', '_') # Fixed double backslash, handled single backslash
    name = name.replace('*', '_').replace('?', '_').replace('"', '_')
    name = name.replace('<', '_').replace('>', '_').replace('|', '_')
    # Ersetze alle Zeichen, die nicht alphanumerisch sind oder in einer erlaubten Liste (inkl. Leerzeichen)
    # in einen Unterstrich. Und dann mehrere Unterstriche zu einem einzigen.
    name = "".join(c if c.isalnum() or c in ['_', '.', '-', ' '] else '_' for c in name) # Allow space temporarily
    name = "_".join(name.split()) # Replace spaces with single underscore, multiple spaces become one
    return name# src/darts_models.py
import pandas as pd
from darts import TimeSeries
from darts.models import NBEATSModel, ExponentialSmoothing, ARIMA # Beispielmodelle
# from darts.models import TFTModel # Weitere Beispiele
from darts.utils.timeseries_generation import datetime_attribute_timeseries # Für Datumsattribute als Kovariaten

from src import config

def forecast_with_darts_model(
    history_df: pd.DataFrame, 
    periods: int, 
    model_name: str = "nbeats",
    past_covariates_df: pd.DataFrame = None,
    future_covariates_df: pd.DataFrame = None
):
    """
    Erstellt eine Prognose mit einem ausgewählten Darts-Modell.

    Args:
        history_df (pd.DataFrame): DataFrame mit Spalten 'ds' (datetime, timezone-naive) und 'y' (numerisch).
        periods (int): Anzahl der zu prognostizierenden Perioden.
        model_name (str): Name des zu verwendenden Darts-Modells (z.B. "nbeats", "ets", "arima").
        past_covariates_df (pd.DataFrame, optional): DataFrame mit vergangenen Kovariaten.
                                                     Muss 'ds' und die Kovariaten-Spalten enthalten.
                                                     Muss die gleiche Länge und Frequenz wie history_df haben.
        future_covariates_df (pd.DataFrame, optional): DataFrame mit zukünftigen Kovariaten.
                                                       Muss 'ds' und die Kovariaten-Spalten enthalten.
                                                       Muss die Prognoseperiode abdecken.

    Returns:
        pd.DataFrame: DataFrame mit Prognose ('ds', 'yhat').
    """
    print(f"INFO (darts_models.py): Starte Darts Forecast für {periods} Perioden mit Modell: {model_name}")

    if history_df.empty or len(history_df) < 2:
        raise ValueError(f"Darts ({model_name}): Nicht genügend Trainingsdaten ({len(history_df)} Zeilen).")
    if 'ds' not in history_df.columns or 'y' not in history_df.columns:
        raise ValueError("Darts: Trainings-DataFrame muss Spalten 'ds' und 'y' enthalten.")
    if history_df['ds'].dt.tz is not None: # Darts erwartet oft timezone-naive Daten für interne Konvertierung
        history_df = history_df.copy()
        history_df['ds'] = history_df['ds'].dt.tz_localize(None)

    # Konvertiere Hauptzeitreihe
    try:
        # Frequenz 'D' für tägliche Daten annehmen. Dies sollte aus den Daten oder der Konfiguration stammen.
        series = TimeSeries.from_dataframe(history_df, time_col='ds', value_cols=['y'], freq='D', fill_missing_dates=True, ffill=True)
    except Exception as e:
        raise ValueError(f"Darts: Fehler bei Konvertierung der Hauptzeitreihe zu TimeSeries: {e}. Sicherstellen, dass 'ds' sortiert ist, eine klare Frequenz hat und keine Duplikate.")

    # Konvertiere vergangene Kovariaten, falls vorhanden
    past_covariates_ts = None
    if past_covariates_df is not None and not past_covariates_df.empty:
        if 'ds' not in past_covariates_df.columns:
            raise ValueError("Darts: past_covariates_df muss eine 'ds'-Spalte enthalten.")
        if past_covariates_df['ds'].dt.tz is not None:
            past_covariates_df = past_covariates_df.copy()
            past_covariates_df['ds'] = past_covariates_df['ds'].dt.tz_localize(None)
        
        # Sicherstellen, dass past_covariates_df die gleichen Datenpunkte wie history_df hat
        # Ein Outer Join kann hier helfen, um Lücken zu identifizieren
        merged_history_past_cov = pd.merge(history_df[['ds']], past_covariates_df, on='ds', how='left')
        if merged_history_past_cov.isnull().values.any():
            # Fülle NaNs in Kovariaten (z.B. durch ffill/bfill oder 0, je nach Kontext)
            # Hier eine einfache ffill/bfill Strategie
            print("WARNUNG (darts_models.py): NaNs in past_covariates_df nach Merge mit History. Fülle mit ffill/bfill.")
            for col in merged_history_past_cov.columns:
                if col != 'ds':
                    merged_history_past_cov[col] = merged_history_past_cov[col].fillna(method='ffill').fillna(method='bfill').fillna(0)
        
        value_cols_past_cov = [col for col in merged_history_past_cov.columns if col != 'ds']
        if not value_cols_past_cov:
             raise ValueError("Darts: past_covariates_df enthält keine Wertespalten außer 'ds'.")

        try:
            past_covariates_ts = TimeSeries.from_dataframe(merged_history_past_cov, time_col='ds', value_cols=value_cols_past_cov, freq='D', fill_missing_dates=True, ffill=True)
            print(f"INFO (darts_models.py): Past covariates TimeSeries erstellt mit Spalten: {value_cols_past_cov}")
        except Exception as e:
            raise ValueError(f"Darts: Fehler bei Konvertierung von past_covariates_df zu TimeSeries: {e}")


    # Konvertiere zukünftige Kovariaten, falls vorhanden
    future_covariates_ts = None
    if future_covariates_df is not None and not future_covariates_df.empty:
        if 'ds' not in future_covariates_df.columns:
            raise ValueError("Darts: future_covariates_df muss eine 'ds'-Spalte enthalten.")
        if future_covariates_df['ds'].dt.tz is not None:
            future_covariates_df = future_covariates_df.copy()
            future_covariates_df['ds'] = future_covariates_df['ds'].dt.tz_localize(None)

        # Sicherstellen, dass future_covariates_df die Prognoseperiode abdeckt
        # Erstelle einen Zeitbereich für die Prognose
        forecast_start_date = series.end_time() + series.freq
        expected_future_dates = pd.date_range(start=forecast_start_date, periods=periods, freq=series.freq)
        
        # Merge mit erwarteten Daten, um sicherzustellen, dass alle Tage abgedeckt sind
        expected_future_df = pd.DataFrame({'ds': expected_future_dates})
        merged_future_cov = pd.merge(expected_future_df, future_covariates_df, on='ds', how='left')

        if merged_future_cov.isnull().values.any():
            print("WARNUNG (darts_models.py): NaNs in future_covariates_df für die Prognoseperiode. Fülle mit ffill/bfill.")
            for col in merged_future_cov.columns:
                 if col != 'ds':
                    merged_future_cov[col] = merged_future_cov[col].fillna(method='ffill').fillna(method='bfill').fillna(0)

        value_cols_future_cov = [col for col in merged_future_cov.columns if col != 'ds']
        if not value_cols_future_cov:
             raise ValueError("Darts: future_covariates_df enthält keine Wertespalten außer 'ds'.")
        try:
            future_covariates_ts = TimeSeries.from_dataframe(merged_future_cov, time_col='ds', value_cols=value_cols_future_cov, freq='D', fill_missing_dates=True, ffill=True)
            print(f"INFO (darts_models.py): Future covariates TimeSeries erstellt mit Spalten: {value_cols_future_cov}")
        except Exception as e:
            raise ValueError(f"Darts: Fehler bei Konvertierung von future_covariates_df zu TimeSeries: {e}")
            
    # Modellauswahl und Initialisierung
    if model_name.lower() == "nbeats":
        model = NBEATSModel(
            input_chunk_length=config.DARTS_NBEATS_INPUT_CHUNK_LENGTH,
            output_chunk_length=config.DARTS_NBEATS_OUTPUT_CHUNK_LENGTH,
            n_epochs=config.DARTS_NBEATS_N_EPOCHS,
            generic_architecture=True,
            random_state=42,
            # Optional: GPU-Nutzung, falls PyTorch Lightning konfiguriert ist
            # pl_trainer_kwargs={"accelerator": "gpu", "devices": 1} if torch.cuda.is_available() else None
        )
    elif model_name.lower() == "ets":
        model = ExponentialSmoothing()
    elif model_name.lower() == "arima":
        model = ARIMA() # Darts versucht, p,d,q automatisch zu finden, oder sie können hier gesetzt werden
    # Beispiel für ein Modell, das Kovariaten unterstützt:
    # elif model_name.lower() == "tft":
    #     model = TFTModel(
    #         input_chunk_length=config.DARTS_NBEATS_INPUT_CHUNK_LENGTH, # Beispiel
    #         output_chunk_length=config.DARTS_NBEATS_OUTPUT_CHUNK_LENGTH, # Beispiel
    #         hidden_size=32, # Beispiel
    #         lstm_layers=2,  # Beispiel
    #         num_attention_heads=4, # Beispiel
    #         n_epochs=config.DARTS_NBEATS_N_EPOCHS, # Beispiel
    #         add_relative_index=True, # Wichtig für TFT
    #         random_state=42
    #     )
    else:
        raise ValueError(f"Darts: Unbekanntes Modell '{model_name}'. Verfügbar: 'nbeats', 'ets', 'arima'.")

    print(f"INFO (darts_models.py): Training Darts Modell ({model_name})...")
    
    # Fit-Argumente basierend auf verfügbaren Kovariaten zusammenstellen
    fit_kwargs = {}
    if past_covariates_ts is not None and model.supports_past_covariates:
        fit_kwargs['past_covariates'] = past_covariates_ts
    if future_covariates_ts is not None and model.supports_future_covariates and model_name.lower() != "nbeats": # NBEATS unterstützt future_covariates nicht direkt im fit, sondern im predict
        # Für Modelle wie TFT, die future_covariates schon beim Training erwarten (für die Trainingsperiode)
        # müssen wir future_covariates für die Trainingsperiode bereitstellen.
        # Hier nehmen wir an, dass future_covariates_df die gesamte Periode (Training + Forecast) abdeckt
        # und schneiden es für das Training zu.
        # Dies ist eine Vereinfachung. Im Idealfall werden Trainings-Future-Covariates separat vorbereitet.
        
        # Erstelle Future Covariates für die Trainingsperiode, falls das Modell sie benötigt
        # Annahme: future_covariates_df wurde für Training + Forecast Periode übergeben.
        # Wir filtern es hier für die Trainingsperiode.
        if future_covariates_df is not None and not future_covariates_df.empty:
            # Nur die Wertespalten nehmen
            val_cols_fut_cov = [c for c in future_covariates_df.columns if c != 'ds']
            if val_cols_fut_cov:
                # Erstelle eine TimeSeries für future_covariates, die die historische Periode der `series` abdeckt
                # Dies ist notwendig, wenn das Modell future_covariates während des Trainings erwartet.
                historical_future_cov_ts = TimeSeries.from_dataframe(
                    future_covariates_df, # Annahme: deckt auch History ab
                    time_col='ds',
                    value_cols=val_cols_fut_cov,
                    freq=series.freq_str,
                    fill_missing_dates=True, ffill=True)
                
                # Schneide auf die Länge der Trainingsserie zu
                historical_future_cov_ts = historical_future_cov_ts.slice_intersect(series)
                
                if len(historical_future_cov_ts) == len(series):
                     fit_kwargs['future_covariates'] = historical_future_cov_ts
                else:
                    print(f"WARNUNG (darts_models.py): Konnte future_covariates für die Trainingsperiode nicht exakt anpassen. Längen: series={len(series)}, hist_fut_cov={len(historical_future_cov_ts)}")


    model.fit(series, **fit_kwargs)
    print(f"INFO (darts_models.py): Training abgeschlossen.")

    print(f"INFO (darts_models.py): Generiere Prognose für {periods} Perioden...")
    # Predict-Argumente
    predict_kwargs = {}
    if future_covariates_ts is not None and model.supports_future_covariates:
        # Stelle sicher, dass future_covariates_ts die korrekte Länge für die Vorhersage hat
        # Darts erwartet, dass future_covariates hier für die Vorhersageperiode `n` übergeben werden.
        # future_covariates_ts wurde oben bereits für `periods` erstellt.
         predict_kwargs['future_covariates'] = future_covariates_ts
    
    # Bei NBEATS und einigen anderen Modellen, die keine Future Covariates im `fit` aber im `predict` nehmen können
    if model_name.lower() == "nbeats" and past_covariates_ts is not None and model.supports_past_covariates:
        # NBEATS kann past_covariates auch für die Vorhersage verwenden, wenn sie bekannt sind (was selten der Fall ist)
        # Normalerweise werden past_covariates nur für das Training verwendet.
        # Wenn man sie für die Vorhersage übergibt, müssen sie die Länge der input_chunk_length + n haben.
        # Hier lassen wir es für NBEATS im predict weg, da es unüblich ist, zukünftige *past_covariates* zu haben.
        pass

    forecast_darts = model.predict(n=periods, **predict_kwargs)
    print(f"INFO (darts_models.py): Prognose abgeschlossen.")

    forecast_df = forecast_darts.pd_dataframe()
    forecast_df.reset_index(inplace=True)
    
    # Spalten umbenennen, um konsistent zu sein ('ds', 'yhat')
    # Darts nennt die Zeitspalte oft 'time' oder den Namen der Indexspalte des ursprünglichen DataFrames
    original_time_col_name = forecast_df.columns[0] # Annahme: Erste Spalte ist die Zeit
    # Die Wertespalte hat oft den Namen der ursprünglichen Wertespalte (hier 'y' oder bei NBEATS ggf. spezifischer)
    # Finde die erste Spalte, die nicht die Zeitspalte ist, als yhat
    potential_yhat_cols = [col for col in forecast_df.columns if col != original_time_col_name]
    if not potential_yhat_cols:
        raise ValueError("Darts: Prognose-DataFrame enthält keine Wertespalte.")
    yhat_col_name = potential_yhat_cols[0] # Nimm die erste gefundene Wertespalte

    forecast_df.rename(columns={original_time_col_name: 'ds', yhat_col_name: 'yhat'}, inplace=True)

    return forecast_df[['ds', 'yhat']]


if __name__ == '__main__':
    print("--- Testing darts_models.py ---")
    periods_to_forecast = 30

    # Erstelle Beispieldaten
    dates_hist = pd.date_range(start="2023-01-01", periods=100, freq="D")
    values_hist = np.random.rand(100) * 50 + np.arange(100) * 0.5
    history_test_df = pd.DataFrame({'ds': dates_hist, 'y': values_hist})

    # Beispiel für Kovariaten
    past_cov_values = np.random.rand(100) * 10
    past_cov_test_df = pd.DataFrame({'ds': dates_hist, 'temp_past': past_cov_values, 'event_past': (np.arange(100) % 7 == 0).astype(int)})

    future_start_date = dates_hist.max() + pd.Timedelta(days=1)
    dates_future = pd.date_range(start=future_start_date, periods=periods_to_forecast, freq="D")
    # Erstelle Future Covariates für die gesamte Periode (History + Forecast) für Modelle, die sie im Training brauchen
    all_dates_for_future_cov = pd.date_range(start=dates_hist.min(), periods=100 + periods_to_forecast, freq="D")

    future_cov_test_df_full = pd.DataFrame({'ds': all_dates_for_future_cov})
    # Beispiel: Datumsattribute als zukünftige Kovariaten
    # Wichtig: Darts `datetime_attribute_timeseries` erwartet eine TimeSeries oder einen DatetimeIndex
    # Erstelle sie hier manuell für das DataFrame
    future_cov_test_df_full['month_sin'] = np.sin(2 * np.pi * future_cov_test_df_full['ds'].dt.month / 12)
    future_cov_test_df_full['month_cos'] = np.cos(2 * np.pi * future_cov_test_df_full['ds'].dt.month / 12)
    
    # Schneide für die reine Vorhersageperiode zu (wird intern in der Funktion gemacht)
    future_cov_test_df_forecast_period = future_cov_test_df_full[future_cov_test_df_full['ds'] >= future_start_date].copy()


    models_to_test = ["nbeats", "ets", "arima"]
    for model_name_test in models_to_test:
        print(f"\n--- Testing Darts Model: {model_name_test} ---")
        try:
            # Test ohne Kovariaten
            print("Testing without covariates...")
            fc_no_cov = forecast_with_darts_model(history_test_df.copy(), periods_to_forecast, model_name_test)
            print(f"{model_name_test} forecast (no covariates) head:\n{fc_no_cov.head()}")
            assert not fc_no_cov.empty
            assert 'yhat' in fc_no_cov.columns

            # Test mit Kovariaten (wenn das Modell sie unterstützt)
            # Diese Logik ist vereinfacht; nicht alle Modelle hier unterstützen alle Kovariatentypen gleich
            print("Testing with covariates (if supported by model)...")
            # Für ARIMA/ETS sind past_covariates als `exog` möglich, future_covariates nicht direkt im selben Sinn wie bei NNs.
            # NBEATS in Darts unterstützt `past_covariates` im `fit` und `predict`.
            if model_name_test == "nbeats": # NBEATS kann past_covariates
                 fc_with_cov = forecast_with_darts_model(
                     history_test_df.copy(), periods_to_forecast, model_name_test,
                     past_covariates_df=past_cov_test_df.copy(),
                     future_covariates_df=future_cov_test_df_forecast_period.copy() # NBEATS kann future_covariates im predict bekommen
                 )
                 print(f"{model_name_test} forecast (with covariates) head:\n{fc_with_cov.head()}")
                 assert not fc_with_cov.empty
            elif model_name_test == "arima": # ARIMA kann `exog` (past_covariates)
                 fc_with_cov = forecast_with_darts_model(
                     history_test_df.copy(), periods_to_forecast, model_name_test,
                     past_covariates_df=past_cov_test_df.copy()
                     # future_covariates für ARIMA müssen als Teil der exogenen Variablen für die Zukunft übergeben werden.
                 )
                 print(f"{model_name_test} forecast (with past_covariates) head:\n{fc_with_cov.head()}")
                 assert not fc_with_cov.empty
            else: # ETS unterstützt Kovariaten nicht in der Standardimplementierung von Darts
                print(f"Skipping covariate test for {model_name_test} as it might not support them or require specific setup.")


        except Exception as e:
            print(f"Error testing {model_name_test}: {e}")
            import traceback
            traceback.print_exc()
    print("\n--- darts_models.py testing finished ---")
# src/data_loader.py
import pandas as pd
import os
import glob
import numpy as np
from typing import Tuple, List # Für Typ-Annotationen
from src import config

def add_features(df: pd.DataFrame, target_column: str, include_lag_rolling: bool = True):
    df_out = df.copy()
    created_base_features = []
    created_date_features = []

    if config.CREATE_DATE_FEATURES:
        if not isinstance(df_out.index, pd.DatetimeIndex):
            if config.DATE_COLUMN in df_out.columns and pd.api.types.is_datetime64_any_dtype(df_out[config.DATE_COLUMN]):
                df_out = df_out.set_index(pd.to_datetime(df_out[config.DATE_COLUMN]))
                if config.DATE_COLUMN in df_out.columns and (df_out.index.name == config.DATE_COLUMN or df_out.index.name != config.DATE_COLUMN) :
                     df_out = df_out.drop(columns=[config.DATE_COLUMN])
            else:
                try:
                    df_out.index = pd.to_datetime(df_out.index)
                except Exception as e:
                    raise ValueError(
                        f"data_loader.py: DataFrame-Index ist kein DatetimeIndex und konnte nicht konvertiert werden, "
                        f"oder eine als '{config.DATE_COLUMN}' benannte Spalte fehlt oder ist kein Datumsformat. Fehler: {e}"
                    )
        
        df_out['date_dayofweek'] = df_out.index.dayofweek
        df_out['date_dayofyear_sin'] = np.sin(2 * np.pi * df_out.index.dayofyear / 365.25)
        df_out['date_dayofyear_cos'] = np.cos(2 * np.pi * df_out.index.dayofyear / 365.25)
        df_out['date_month_sin'] = np.sin(2 * np.pi * df_out.index.month / 12)
        df_out['date_month_cos'] = np.cos(2 * np.pi * df_out.index.month / 12)
        if hasattr(df_out.index.isocalendar(), 'week'):
            df_out['date_weekofyear'] = df_out.index.isocalendar().week.astype(float)
        else:
            df_out['date_weekofyear'] = df_out.index.weekofyear.astype(float)
        
        created_date_features.extend(['date_dayofweek', 'date_dayofyear_sin', 'date_dayofyear_cos', 'date_month_sin', 'date_month_cos', 'date_weekofyear'])

    if include_lag_rolling:
        if target_column not in df_out.columns:
            if config.CREATE_LAG_FEATURES or config.CREATE_ROLLING_FEATURES:
                print(f"WARN (data_loader.py): Zielspalte '{target_column}' nicht im DataFrame vorhanden. Überspringe Lag/Rolling-Features.")
        else:
            if config.CREATE_LAG_FEATURES:
                for lag in config.LAG_VALUES:
                    df_out[f'{target_column}_lag_{lag}'] = df_out[target_column].shift(lag)
                    created_base_features.append(f'{target_column}_lag_{lag}')
            
            if config.CREATE_ROLLING_FEATURES:
                shifted_target = df_out[target_column].shift(1)
                for window in config.ROLLING_WINDOWS:
                    df_out[f'{target_column}_roll_mean_{window}'] = shifted_target.rolling(window=window, min_periods=1).mean()
                    df_out[f'{target_column}_roll_std_{window}'] = shifted_target.rolling(window=window, min_periods=1).std()
                    created_base_features.extend([f'{target_column}_roll_mean_{window}', f'{target_column}_roll_std_{window}'])
    
    all_newly_created_features = created_base_features + created_date_features
    if all_newly_created_features:
        features_to_fill = [name for name in all_newly_created_features if name in df_out.columns]
        if features_to_fill:
            df_out[features_to_fill] = df_out[features_to_fill].ffill().bfill().fillna(0)

    all_potential_feature_names = []
    if config.CREATE_DATE_FEATURES:
        all_potential_feature_names.extend(created_date_features) # Nur die tatsächlich erstellten
    if config.CREATE_LAG_FEATURES and include_lag_rolling:
        all_potential_feature_names.extend([f'{target_column}_lag_{lag}' for lag in config.LAG_VALUES if f'{target_column}_lag_{lag}' in df_out.columns])
    if config.CREATE_ROLLING_FEATURES and include_lag_rolling:
        all_potential_feature_names.extend([f'{target_column}_roll_mean_{window}' for window in config.ROLLING_WINDOWS if f'{target_column}_roll_mean_{window}' in df_out.columns])
        all_potential_feature_names.extend([f'{target_column}_roll_std_{window}' for window in config.ROLLING_WINDOWS if f'{target_column}_roll_std_{window}' in df_out.columns])
    
    all_potential_feature_names = sorted(list(set(all_potential_feature_names)))
    return df_out, all_potential_feature_names, created_date_features


def identify_anomalies_iqr(df: pd.DataFrame, value_column_name: str, iqr_factor: float = 1.5) -> Tuple[pd.DataFrame, int]:
    df_with_anomalies = df.copy()
    df_with_anomalies['is_anomaly'] = False

    if df.empty or value_column_name not in df.columns:
        print(f"WARN (data_loader.py - identify_anomalies_iqr): DataFrame empty or column '{value_column_name}' not found.")
        return df_with_anomalies, 0

    if not pd.api.types.is_numeric_dtype(df[value_column_name]):
        print(f"WARN (data_loader.py - identify_anomalies_iqr): Column '{value_column_name}' not numeric. Skipping anomaly detection.")
        return df_with_anomalies, 0

    series_for_iqr = df[value_column_name].dropna()
    if len(series_for_iqr) < 2:
        print(f"WARN (data_loader.py - identify_anomalies_iqr): Not enough non-NaN data points ({len(series_for_iqr)}) in '{value_column_name}' for IQR.")
        return df_with_anomalies, 0

    Q1 = series_for_iqr.quantile(0.25)
    Q3 = series_for_iqr.quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - (iqr_factor * IQR)
    upper_bound = Q3 + (iqr_factor * IQR)
    
    if IQR == 0:
        print(f"INFO (data_loader.py - identify_anomalies_iqr): IQR is 0 for '{value_column_name}'. Bounds: [{lower_bound}, {upper_bound}].")

    condition_not_nan = df_with_anomalies[value_column_name].notna()
    anomalies_condition = (df_with_anomalies[value_column_name] < lower_bound) | (df_with_anomalies[value_column_name] > upper_bound)
    
    df_with_anomalies.loc[condition_not_nan & anomalies_condition, 'is_anomaly'] = True
    num_anomalies_identified = df_with_anomalies['is_anomaly'].sum()
    
    if num_anomalies_identified > 0:
        print(f"INFO (data_loader.py - identify_anomalies_iqr): {num_anomalies_identified} anomalies in '{value_column_name}' identified by IQR. Bounds: [{lower_bound:.2f}, {upper_bound:.2f}], Q1={Q1:.2f}, Q3={Q3:.2f}, IQR={IQR:.2f}")
    else:
        print(f"INFO (data_loader.py - identify_anomalies_iqr): No anomalies in '{value_column_name}' identified by IQR. Bounds: [{lower_bound:.2f}, {upper_bound:.2f}], Q1={Q1:.2f}, Q3={Q3:.2f}, IQR={IQR:.2f}")
        
    return df_with_anomalies, num_anomalies_identified

def clean_actual_data_interpolate(df_actuals: pd.DataFrame, value_col_name: str = 'actual') -> Tuple[pd.DataFrame, List[Tuple[str, float]], int]:
    if value_col_name not in df_actuals.columns:
        print(f"WARN (data_loader.py - clean_actual_data_interpolate): Value column '{value_col_name}' not found in DataFrame.")
        return df_actuals, [], 0
    if 'date' not in df_actuals.columns:
        raise ValueError("DataFrame für die Bereinigung muss eine 'date'-Spalte mit ISO-Strings enthalten.")

    cleaned_df = df_actuals.copy()
    
    # Konvertiere Wertespalte zu numerisch, falls sie es nicht ist (z.B. object wegen gemischten Typen oder None)
    # errors='coerce' wandelt nicht-numerische Werte in NaN um, die dann interpoliert werden können
    if not pd.api.types.is_numeric_dtype(cleaned_df[value_col_name]):
        cleaned_df[value_col_name] = pd.to_numeric(cleaned_df[value_col_name], errors='coerce')

    nan_indices_before = cleaned_df[cleaned_df[value_col_name].isnull()].index
    
    # Führe lineare Interpolation durch.
    # Pandas interpolate behandelt bereits den Fall, dass der erste/letzte Wert NaN ist (bleibt dann NaN, wenn limit_direction nicht 'both' ist)
    # oder füllt, wenn limit_direction='both' und Nachbarn existieren.
    cleaned_df[value_col_name] = cleaned_df[value_col_name].interpolate(method='linear', limit_direction='both')
    
    imputed_rows_details = []
    actually_imputed_count = 0
    for idx in nan_indices_before:
        if pd.notnull(cleaned_df.loc[idx, value_col_name]):
            actually_imputed_count += 1
            date_str = str(cleaned_df.loc[idx, 'date']) # Sicherstellen, dass es ein String ist
            imputed_value = float(cleaned_df.loc[idx, value_col_name]) # Sicherstellen, dass es float ist
            imputed_rows_details.append((date_str, imputed_value))
            
    if actually_imputed_count > 0:
        print(f"INFO (data_loader.py - clean_actual_data_interpolate): Linearly interpolated {actually_imputed_count} missing values in column '{value_col_name}'.")
    else:
        print(f"INFO (data_loader.py - clean_actual_data_interpolate): No missing values found or could be interpolated in column '{value_col_name}'.")
        
    return cleaned_df, imputed_rows_details, actually_imputed_count
# src/database.py
import sqlite3
import os
import pandas as pd
import numpy as np
import traceback
from typing import List, Tuple, Optional # Für Typ-Annotationen
from src import config

DB_FILE = os.path.join(os.path.dirname(__file__), "..", "forecast.db")

def init_db():
    conn = None
    try:
        db_dir = os.path.dirname(DB_FILE)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir)
            print(f"INFO (database.py): Created directory for database: {db_dir}")

        print(f"INFO (database.py): Connecting to database at {DB_FILE} with timeout...")
        conn = sqlite3.connect(DB_FILE, timeout=10)
        c = conn.cursor()
        print("INFO (database.py): Database connection successful. Creating tables if not exist...")

        # Existing actuals table
        c.execute('''
            CREATE TABLE IF NOT EXISTS actuals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                container_id TEXT NOT NULL,
                date TEXT NOT NULL,
                value REAL, -- WICHTIG: Akzeptiert jetzt NULL-Werte
                source_file TEXT,
                is_anomaly BOOLEAN DEFAULT FALSE,
                UNIQUE(container_id, date)
            )
        ''')
        print("INFO (database.py): 'actuals' table schema checked/created (value can be NULL).")

        c.execute("PRAGMA table_info(actuals);")
        columns = [row[1] for row in c.fetchall()]
        if 'is_anomaly' not in columns:
            print("INFO (database.py): Spalte 'is_anomaly' existiert nicht in 'actuals'. Füge sie hinzu.")
            c.execute("ALTER TABLE actuals ADD COLUMN is_anomaly BOOLEAN DEFAULT FALSE;")
            print("INFO (database.py): Spalte 'is_anomaly' zu 'actuals' hinzugefügt.")

        # New containers table
        c.execute('''
            CREATE TABLE IF NOT EXISTS containers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("INFO (database.py): 'containers' table schema checked/created.")

        # Existing forecasts table
        c.execute('''
            CREATE TABLE IF NOT EXISTS forecasts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                container_id TEXT NOT NULL,
                model_name TEXT NOT NULL,
                forecast_date TEXT NOT NULL,
                target_date TEXT NOT NULL,
                forecast_value REAL NOT NULL,
                UNIQUE(container_id, model_name, target_date, forecast_date)
            )
        ''')
        print("INFO (database.py): 'forecasts' table schema checked/created.")
        conn.commit()
        print("INFO (database.py): Database changes committed.")
    except sqlite3.Error as e:
        print(f"ERROR (database.py): SQLite error during init_db: {e}")
        traceback.print_exc()
    finally:
        if conn:
            conn.close()
            print("INFO (database.py): Database connection closed after init.")

def save_actual_to_db(actual_df: pd.DataFrame, container_id: str, source_file="uploaded_data.csv"):
    conn = None
    processed_count = 0
    skipped_count = 0
    processing_errors = []

    print(f"INFO (database.py): Preparing to save {len(actual_df)} actual records for container '{container_id}' from {source_file}...")

    if not all(col in actual_df.columns for col in ['Date', 'Value']):
        missing_cols = [col for col in ['Date', 'Value'] if col not in actual_df.columns]
        error_msg = f"DataFrame für Ist-Werte muss Spalten 'Date' und 'Value' enthalten. Fehlend: {', '.join(missing_cols)}"
        processing_errors.append({ "row_csv": 1, "column_name": "Header", "error_message": error_msg, "original_value": f"Gefundene Spalten: {actual_df.columns.tolist()}"})
        print(f"ERROR (database.py): {error_msg}")
        return processing_errors

    records_to_insert = []
    for df_index, row in actual_df.iterrows():
        csv_row_number = df_index + 2
        date_val_raw = row.get('Date')
        value_val_raw = row.get('Value')
        original_row_snippet = f"Date='{date_val_raw if not pd.isnull(date_val_raw) else 'N/A'}', Value='{value_val_raw if not pd.isnull(value_val_raw) else 'N/A'}'"

        if pd.isnull(date_val_raw):
            skipped_count += 1
            error_msg = "Fehlender Wert für 'Date'."
            processing_errors.append({ "row_csv": csv_row_number, "column_name": "Date", "error_message": error_msg, "original_value": original_row_snippet })
            continue

        try:
            date_obj = pd.to_datetime(date_val_raw)
            date_str = date_obj.strftime('%Y-%m-%dT%H:%M:%SZ')

            value_to_store = None
            if pd.notnull(value_val_raw) and str(value_val_raw).strip() != "": # Nur verarbeiten, wenn Wert nicht explizit NaN oder leer ist
                current_value_str = str(value_val_raw).replace(',', '.')
                try:
                    value = float(current_value_str)
                    if pd.isnull(value): # Falls Konvertierung zu float('nan') führt
                         value_to_store = None
                    elif value < 0:
                        skipped_count += 1
                        processing_errors.append({"row_csv": csv_row_number, "column_name": "Value", "error_message": f"Unplausibler Wert: Negativer Verbrauch ({value}) nicht erlaubt.", "original_value": original_row_snippet})
                        continue # Diese Zeile überspringen
                    elif value > config.MAX_PLAUSIBLE_CONSUMPTION_VALUE:
                        skipped_count += 1
                        processing_errors.append({"row_csv": csv_row_number, "column_name": "Value", "error_message": f"Unplausibler Wert: Verbrauch ({value}) überschreitet Maximum ({config.MAX_PLAUSIBLE_CONSUMPTION_VALUE}).", "original_value": original_row_snippet})
                        continue # Diese Zeile überspringen
                    else:
                        value_to_store = value
                except ValueError: # Wenn Konvertierung zu float fehlschlägt
                    # Im neuen Workflow wollen wir diese Zeile trotzdem mit NULL für Value speichern,
                    # wenn das Datum valide ist, damit sie später bereinigt werden kann.
                    # Wenn ein nicht-konvertierbarer String ein harter Fehler sein soll, müsste hier `continue` stehen.
                    print(f"WARN (database.py): Zeile {csv_row_number} - Wert '{value_val_raw}' nicht numerisch, wird als NULL gespeichert, falls Datum valide.")
                    value_to_store = None

            records_to_insert.append((container_id, date_str, value_to_store, source_file))
        except ValueError as conversion_err: # Fehler bei Datums-Konvertierung
            skipped_count += 1
            processing_errors.append({ "row_csv": csv_row_number, "column_name": "Date", "error_message": f"Datums-Konvertierungsfehler: {str(conversion_err)}", "original_value": original_row_snippet })
            continue # Ungültiges Datum -> Zeile überspringen
        except Exception as e: # Andere unerwartete Fehler
            skipped_count += 1
            processing_errors.append({ "row_csv": csv_row_number, "column_name": "Unbekannt", "error_message": f"Unerwarteter Fehler: {str(e)}", "original_row_snippet": original_row_snippet })
            continue # Zeile überspringen

    if records_to_insert:
        try:
            conn = sqlite3.connect(DB_FILE, timeout=10)
            c = conn.cursor()
            # is_anomaly wird beim initialen Upload immer auf FALSE gesetzt
            c.executemany(''' INSERT OR REPLACE INTO actuals (container_id, date, value, source_file, is_anomaly)
                              VALUES (?, ?, ?, ?, FALSE) ''', records_to_insert)
            conn.commit()
            processed_count = len(records_to_insert)
            print(f"INFO (database.py): Successfully processed and saved/replaced {processed_count} actual records for container '{container_id}'. Skipped: {skipped_count}.")
        except sqlite3.Error as e:
            print(f"ERROR (database.py): SQLite error during batch insert for '{container_id}': {e}")
            if conn: conn.rollback()
            # Füge einen allgemeinen DB-Fehler hinzu, der im Frontend angezeigt werden kann
            processing_errors.append({ "row_csv": "Datenbank", "column_name": "Operation", "error_message": f"DB-Fehler: {str(e)}", "original_value": "Massen-Insert" })
        finally:
            if conn: conn.close()
    else:
        print(f"INFO (database.py): No valid records to insert for container '{container_id}'. Skipped: {skipped_count}.")

    if skipped_count > 0:
        print(f"WARN (database.py): Skipped {skipped_count} records for container '{container_id}' due to errors.")

    return processing_errors

def load_actuals(container_id: str) -> List[Tuple[str, float | None, bool]]:
    print(f"DEBUG (database.py): load_actuals called for container_id: '{container_id}'")
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=10)
        # row_factory, um sicherzustellen, dass None korrekt als None (und nicht z.B. als String 'None') behandelt wird
        conn.row_factory = lambda cursor, row: (row[0], row[1] if row[1] is not None else None, bool(row[2]))
        c = conn.cursor()
        c.execute('SELECT date, value, is_anomaly FROM actuals WHERE container_id = ? ORDER BY date', (container_id,))
        rows: List[Tuple[str, float | None, bool]] = c.fetchall() # Expliziter Typ-Hinweis
        print(f"DEBUG (database.py): SQL query for load_actuals executed. Found rows for '{container_id}': {len(rows)}")
        if rows:
            print(f"DEBUG (database.py): Example processed rows (load_actuals): {rows[:3]}")
        return rows
    except sqlite3.Error as e:
        print(f"ERROR (database.py): SQLite error during load_actuals for '{container_id}': {e}")
        return []
    finally:
        if conn: conn.close()

def update_anomaly_flags_in_db(container_id: str, df_with_anomalies: pd.DataFrame, date_col_name: str = 'ds'):
    conn = None
    updated_anomaly_count = 0
    print(f"INFO (database.py): Starting update of anomaly flags for container '{container_id}'.")

    if df_with_anomalies.empty:
        print(f"INFO (database.py): DataFrame for anomaly update is empty for '{container_id}'. Resetting existing flags.")
    elif date_col_name not in df_with_anomalies.columns or 'is_anomaly' not in df_with_anomalies.columns:
        print(f"ERROR (database.py): DataFrame for anomaly update missing column '{date_col_name}' or 'is_anomaly'.")
        return 0

    try:
        conn = sqlite3.connect(DB_FILE, timeout=10)
        c = conn.cursor()
        print(f"INFO (database.py): Resetting all 'is_anomaly' flags for '{container_id}' to FALSE before update.")
        c.execute("UPDATE actuals SET is_anomaly = FALSE WHERE container_id = ?", (container_id,))

        anomalies_to_mark_true = []
        if not df_with_anomalies.empty:
            for _, row in df_with_anomalies[df_with_anomalies['is_anomaly']].iterrows():
                date_as_datetime = pd.to_datetime(row[date_col_name])
                date_str_for_db = date_as_datetime.strftime('%Y-%m-%dT%H:%M:%SZ')
                anomalies_to_mark_true.append((date_str_for_db, container_id))

        if anomalies_to_mark_true:
            print(f"INFO (database.py): Marking {len(anomalies_to_mark_true)} data points for '{container_id}' as TRUE anomalies.")
            c.executemany("UPDATE actuals SET is_anomaly = TRUE WHERE date = ? AND container_id = ?", anomalies_to_mark_true)
            updated_anomaly_count = len(anomalies_to_mark_true)

        conn.commit()
        print(f"INFO (database.py): Anomaly flags for '{container_id}' updated. {updated_anomaly_count} marked as anomaly (TRUE).")
        return updated_anomaly_count
    except sqlite3.Error as e:
        print(f"ERROR (database.py): SQLite error during update_anomaly_flags_in_db for '{container_id}': {e}")
        if conn: conn.rollback()
        return 0
    finally:
        if conn: conn.close()

def update_single_data_point_anomaly_status(container_id: str, date_str_iso: str, new_is_anomaly_status: bool):
    conn = None
    updated_rows = 0
    print(f"INFO (database.py): Updating anomaly status for container '{container_id}', date '{date_str_iso}' to {new_is_anomaly_status}.")
    try:
        conn = sqlite3.connect(DB_FILE, timeout=10)
        c = conn.cursor()
        c.execute(''' UPDATE actuals SET is_anomaly = ?
                       WHERE container_id = ? AND date = ? ''',
                  (new_is_anomaly_status, container_id, date_str_iso))
        conn.commit()
        updated_rows = c.rowcount
        if updated_rows > 0:
            print(f"INFO (database.py): Successfully updated anomaly status for {updated_rows} record(s) for '{container_id}' on '{date_str_iso}'.")
        else:
            print(f"WARN (database.py): No record found to update for '{container_id}' on '{date_str_iso}'. Check date format/existence or if status was already {new_is_anomaly_status}.")
        return updated_rows
    except sqlite3.Error as e:
        print(f"ERROR (database.py): SQLite error during update_single_data_point_anomaly_status for '{container_id}', date '{date_str_iso}': {e}")
        if conn: conn.rollback()
        return 0
    finally:
        if conn: conn.close()

def update_imputed_values_in_db(container_id: str, imputed_rows_data: List[Tuple[str, float]]):
    conn = None
    updated_row_count = 0
    if not imputed_rows_data:
        print(f"INFO (database.py): No imputed rows to update for container '{container_id}'.")
        return 0

    # Parameter für executemany: (new_value, container_id, date_str)
    update_params = [(imputed_value, container_id, date_str) for date_str, imputed_value in imputed_rows_data]

    print(f"INFO (database.py): Preparing to update {len(update_params)} imputed values for container '{container_id}'.")
    try:
        conn = sqlite3.connect(DB_FILE, timeout=10)
        c = conn.cursor()
        c.executemany(''' UPDATE actuals SET value = ?
                           WHERE container_id = ? AND date = ? ''', update_params)
        conn.commit()
        updated_row_count = c.rowcount

        # SQLite gibt bei executemany oft -1 zurück, wenn die Anzahl der Zeilen nicht ermittelt werden kann
        # oder die Anzahl der tatsächlich ausgeführten Statements.
        # Wenn kein Fehler auftritt, können wir annehmen, dass alle Updates versucht wurden.
        if updated_row_count == -1 and len(update_params) > 0:
            updated_row_count = len(update_params) # Dies ist eine Annahme
            print(f"INFO (database.py): Assumed {updated_row_count} rows processed for update for container '{container_id}' (driver may not report exact affected rows for executemany).")
        elif updated_row_count != len(update_params): # Falls eine andere positive Zahl zurückkommt
             print(f"WARN (database.py): Expected to process {len(update_params)} updates, but driver reported {updated_row_count} for container '{container_id}'. Check for partial updates.")
        else: # Wenn updated_row_count == len(update_params)
            print(f"INFO (database.py): Successfully processed {updated_row_count} imputed values for update in container '{container_id}'.")
        return updated_row_count # Gibt die Anzahl der verarbeiteten Statements zurück (oder angenommene Anzahl)
    except sqlite3.Error as e:
        print(f"ERROR (database.py): SQLite error during update_imputed_values_in_db for '{container_id}': {e}")
        if conn: conn.rollback()
        return 0
    finally:
        if conn: conn.close()

# --- NEW FUNCTIONS FOR CONTAINER MANAGEMENT ---

def get_containers() -> List[str]:
    """Loads all container names from the database."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=10)
        c = conn.cursor()
        c.execute('SELECT name FROM containers ORDER BY name')
        # fetchall() gibt eine Liste von Tupeln zurück, z.B. [('Container1',), ('Container2',)]
        # Wir wollen nur die Namen als Liste von Strings
        container_names = [row[0] for row in c.fetchall()]
        print(f"INFO (database.py): Loaded {len(container_names)} container names.")
        return container_names
    except sqlite3.Error as e:
        print(f"ERROR (database.py): SQLite error during get_containers: {e}")
        return []
    finally:
        if conn: conn.close()

def add_container(name: str, description: Optional[str] = None) -> bool:
    """Adds a new container to the database."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=10)
        c = conn.cursor()
        # Check if container already exists
        c.execute('SELECT COUNT(*) FROM containers WHERE name = ?', (name,))
        if c.fetchone()[0] > 0:
            print(f"WARN (database.py): Container '{name}' already exists.")
            return False # Indicate that it already exists
        c.execute('INSERT INTO containers (name, description) VALUES (?, ?)', (name, description))
        conn.commit()
        print(f"INFO (database.py): Container '{name}' added to database.")
        return True
    except sqlite3.IntegrityError: # Specifically for UNIQUE constraint violation
        print(f"WARN (database.py): Container '{name}' already exists (IntegrityError).")
        return False
    except sqlite3.Error as e:
        print(f"ERROR (database.py): SQLite error during add_container: {e}")
        if conn: conn.rollback()
        return False
    finally:
        if conn: conn.close()

def update_container_name(old_name: str, new_name: str) -> bool:
    """Updates the name of an existing container and updates related actuals."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=10)
        c = conn.cursor()
        # Start transaction
        conn.execute("BEGIN TRANSACTION")

        # Check if new name already exists for another container
        c.execute('SELECT COUNT(*) FROM containers WHERE name = ? AND name != ?', (new_name, old_name))
        if c.fetchone()[0] > 0:
            conn.rollback()
            print(f"WARN (database.py): Cannot rename container '{old_name}' to '{new_name}'. New name already exists.")
            return False

        # 1. Update container name in 'containers' table
        c.execute('UPDATE containers SET name = ? WHERE name = ?', (new_name, old_name))
        if c.rowcount == 0:
            conn.rollback()
            print(f"WARN (database.py): Container '{old_name}' not found for update.")
            return False
        
        # 2. Update container_id in 'actuals' table
        c.execute('UPDATE actuals SET container_id = ? WHERE container_id = ?', (new_name, old_name))
        print(f"INFO (database.py): Updated {c.rowcount} actuals for container '{old_name}' to '{new_name}'.")

        # 3. Update container_id in 'forecasts' table (if you start storing forecasts)
        c.execute('UPDATE forecasts SET container_id = ? WHERE container_id = ?', (new_name, old_name))
        print(f"INFO (database.py): Updated {c.rowcount} forecasts for container '{old_name}' to '{new_name}'.")

        conn.commit()
        print(f"INFO (database.py): Container '{old_name}' successfully renamed to '{new_name}' and related records updated.")
        return True
    except sqlite3.Error as e:
        print(f"ERROR (database.py): SQLite error during update_container_name: {e}")
        if conn: conn.rollback()
        return False
    finally:
        if conn: conn.close()

def delete_container(name: str) -> bool:
    """Deletes a container and all its associated actuals and forecasts."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=10)
        c = conn.cursor()
        # Start transaction
        conn.execute("BEGIN TRANSACTION")

        # Delete from 'actuals'
        c.execute('DELETE FROM actuals WHERE container_id = ?', (name,))
        deleted_actuals = c.rowcount
        print(f"INFO (database.py): Deleted {deleted_actuals} actuals records for container '{name}'.")

        # Delete from 'forecasts' (if you start storing forecasts)
        c.execute('DELETE FROM forecasts WHERE container_id = ?', (name,))
        deleted_forecasts = c.rowcount
        print(f"INFO (database.py): Deleted {deleted_forecasts} forecasts records for container '{name}'.")

        # Delete from 'containers'
        c.execute('DELETE FROM containers WHERE name = ?', (name,))
        deleted_container_entry = c.rowcount
        
        if deleted_container_entry == 0:
            conn.rollback()
            print(f"WARN (database.py): Container '{name}' not found for deletion in containers table.")
            return False

        conn.commit()
        print(f"INFO (database.py): Container '{name}' and its related data successfully deleted.")
        return True
    except sqlite3.Error as e:
        print(f"ERROR (database.py): SQLite error during delete_container: {e}")
        if conn: conn.rollback()
        return False
    finally:
        if conn: conn.close()

def save_forecast_to_db(*args, **kwargs):
    # print("WARN: save_forecast_to_db (dummy) called") # Auskommentiert für weniger Logs
    pass
def load_forecasts(*args, **kwargs):
    # print("WARN: load_forecasts (dummy) called") # Auskommentiert für weniger Logs
    return []
import pandas as pd
import numpy as np
import os
import datetime

# --- Configuration ---
# Shared parameters for all datasets
BASE_FILENAME = "synthetic_data_predictable" # New base name
OUTPUT_DIRECTORY = "data/synthetic" # Relative path to save the file

# Value Range Constraints
MIN_VALUE = 50 # Keep values comfortably above 0
MAX_VALUE = 1000

# Pattern Components Configuration (Strong patterns, LOW noise)
BASE_LEVEL = 450     # Start slightly higher to stay away from lower bound
TREND_SLOPE = 0.05   # Gentle positive trend per day

YEARLY_AMP = 200     # Strong yearly cycle
WEEKLY_AMP = 100     # Strong weekly cycle (e.g., lower on weekends)
NOISE_LEVEL = 5      # *** VERY LOW noise standard deviation ***

# --- End Configuration ---

def generate_predictable_data(start_date_str, end_date_str, duration_label, base_filename, output_dir):
    """Generates and saves predictable synthetic time series data."""

    print(f"\n--- Generating predictable data for '{duration_label}' ({start_date_str} to {end_date_str}) ---")
    start_date = pd.to_datetime(start_date_str)
    end_date = pd.to_datetime(end_date_str)

    # Check if calculated bounds are reasonable (adjust if needed based on final values)
    max_potential = BASE_LEVEL + TREND_SLOPE * (end_date - start_date).days + YEARLY_AMP + WEEKLY_AMP
    min_potential = BASE_LEVEL + 0 - YEARLY_AMP - WEEKLY_AMP # Approx min at start
    print(f"Approximate signal range before noise/clipping: {min_potential:.0f} to {max_potential:.0f}")
    if max_potential > MAX_VALUE * 0.95:
        print("Warning: Upper signal range is high, might clip.")
    if min_potential < MIN_VALUE * 1.05:
         print("Warning: Lower signal range is low, might clip.")

    # Create date range
    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    num_days = len(dates)

    # Create time-based features for seasonality calculation
    day_of_year = dates.dayofyear
    day_of_week = dates.dayofweek # Monday=0, Sunday=6
    days_elapsed = np.arange(num_days)

    # 1. Generate Trend Component
    trend = TREND_SLOPE * days_elapsed

    # 2. Generate Seasonal Components
    yearly_seasonality = YEARLY_AMP * np.cos(2 * np.pi * (day_of_year - 180) / 365.25) # Peaks mid-year
    weekly_seasonality = WEEKLY_AMP * np.cos(2 * np.pi * (day_of_week - 2.5) / 7) # Peaks mid-week

    # 3. Generate VERY LOW Noise Component
    noise = np.random.normal(loc=0, scale=NOISE_LEVEL, size=num_days)

    # 4. Combine Components
    synthetic_values = BASE_LEVEL + trend + yearly_seasonality + weekly_seasonality + noise

    # 5. Clamp values to the specified range [MIN_VALUE, MAX_VALUE]
    synthetic_values = np.clip(synthetic_values, MIN_VALUE, MAX_VALUE)

    # --- Create DataFrame and Save ---
    df_synthetic = pd.DataFrame({
        'Date': dates,
        'Value': synthetic_values # Assign raw values first
    })
    # Round the pandas Series AFTER creation (safer method)
    df_synthetic['Value'] = df_synthetic['Value'].round(2)

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    # Create filename with duration label
    output_filename = f"{base_filename}_{duration_label}.csv"
    output_path = os.path.join(output_dir, output_filename)

    df_synthetic.to_csv(output_path, index=False, sep=';') # Using semicolon separator

    print(f"Predictable synthetic data generated successfully.")
    print(f"Data shape: {df_synthetic.shape}")
    print(f"Value range: Min={df_synthetic['Value'].min():.2f}, Max={df_synthetic['Value'].max():.2f}")
    print(f"Saved to: {output_path}")

    # Optional: Plotting preview (requires matplotlib)
    try:
        import matplotlib.pyplot as plt
        plt.figure(figsize=(15, 6))
        plt.plot(df_synthetic['Date'], df_synthetic['Value'], linewidth=1) # Thinner line for clarity
        plt.title(f'Generated Predictable Data Preview ({duration_label})')
        plt.xlabel('Date')
        plt.ylabel('Value')
        plt.grid(True)
        # Save plot (optional)
        plot_path = os.path.join(output_dir, output_filename.replace('.csv', '.png'))
        plt.savefig(plot_path)
        print(f"Plot saved to: {plot_path}")
        plt.close() # Close the plot figure
    except ImportError:
        # Only print warning once if matplotlib is missing
        if not plt_warning_printed[0]:
             print("\nMatplotlib not installed. Skipping plot generation.")
             print("Install it via: pip install matplotlib")
             plt_warning_printed[0] = True # Set flag
    except Exception as e:
        print(f"An error occurred during plotting: {e}")


# --- Main Execution ---
if __name__ == "__main__":
    start_time = datetime.datetime.now()
    print("Starting predictable data generation script...")
    # Use a list as a mutable flag for the warning
    plt_warning_printed = [False]

    # Define the scenarios
    scenarios = [
        {"label": "3m", "start": "2025-01-01", "end": "2025-03-31"},
        {"label": "3y", "start": "2022-03-31", "end": "2025-03-31"},
        {"label": "10y", "start": "2015-03-31", "end": "2025-03-31"},
    ]

    # Generate data for defined scenarios
    for scenario in scenarios:
        generate_predictable_data(
            start_date_str=scenario["start"],
            end_date_str=scenario["end"],
            duration_label=scenario["label"],
            base_filename=BASE_FILENAME,
            output_dir=OUTPUT_DIRECTORY
        )

    end_time = datetime.datetime.now()
    print(f"\n--- Script finished in {(end_time - start_time).total_seconds():.2f} seconds ---")
# src/prophet_model.py
import pandas as pd
import numpy as np
import os
import sys
import traceback
from prophet import Prophet
from src import config
from typing import Tuple, Dict, Any # Für Typ-Annotationen

# Placeholder for holidays DataFrame (wie in der vorherigen Antwort)
holidays_df = None


def forecast_with_prophet(history_df: pd.DataFrame, periods: int, extra_regressors_df: pd.DataFrame = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    print(f"INFO (prophet_model): Starting Prophet Forecast for {periods} periods.")

    if history_df.empty:
        raise ValueError("Prophet: Empty DataFrame provided for training data.")
    required_cols = ['ds', 'y']
    for col in required_cols:
        if col not in history_df.columns:
            raise ValueError(f"Prophet: Training DataFrame must contain column '{col}'.")

    if not pd.api.types.is_datetime64_any_dtype(history_df['ds']):
         history_df['ds'] = pd.to_datetime(history_df['ds'], errors='coerce')
         if history_df['ds'].isnull().any():
             raise ValueError("Prophet: Could not reliably convert 'ds' column to datetime.")

    history_df_prophet = history_df.copy()
    if history_df_prophet['ds'].dt.tz is not None:
        print("INFO (prophet_model): Removing timezone from 'ds' for Prophet.")
        history_df_prophet['ds'] = history_df_prophet['ds'].dt.tz_localize(None)

    if not pd.api.types.is_numeric_dtype(history_df_prophet['y']):
         history_df_prophet['y'] = pd.to_numeric(history_df_prophet['y'], errors='coerce')

    if history_df_prophet['y'].isnull().any():
        print(f"WARNING (prophet_model): Column 'y' contains {history_df_prophet['y'].isnull().sum()} NaN values. Prophet will ignore these rows during training.")

    if len(history_df_prophet.dropna(subset=['y'])) < 2:
        raise ValueError(f"Prophet: Not enough valid (non-NaN) training data points ({len(history_df_prophet.dropna(subset=['y']))} rows). At least 2 are required.")

    print("INFO (prophet_model): Initializing Prophet model with parameters from config.py...")
    model = Prophet(
        changepoint_prior_scale=config.PROPHET_CHANGEPOINT_PRIOR,
        seasonality_prior_scale=config.PROPHET_SEASONALITY_PRIOR,
        daily_seasonality=config.PROPHET_DAILY_SEASONALITY,
        weekly_seasonality='auto',
        yearly_seasonality='auto',
        seasonality_mode=config.PROPHET_SEASONALITY_MODE,
        holidays=holidays_df
    )

    potential_regressors_in_history = [
        col for col in history_df_prophet.columns if col not in ['ds', 'y', 'cap', 'floor']
    ]
    actual_regressors_for_model = []
    extra_regressors_df_prepared = None

    if extra_regressors_df is not None and not extra_regressors_df.empty:
        extra_regressors_df_prepared = extra_regressors_df.copy()
        if 'ds' not in extra_regressors_df_prepared.columns and isinstance(extra_regressors_df_prepared.index, pd.DatetimeIndex):
            extra_regressors_df_prepared = extra_regressors_df_prepared.reset_index()

        if 'ds' not in extra_regressors_df_prepared.columns:
             raise ValueError("Prophet: extra_regressors_df must have a 'ds' column or a DatetimeIndex.")

        if not pd.api.types.is_datetime64_any_dtype(extra_regressors_df_prepared['ds']):
            extra_regressors_df_prepared['ds'] = pd.to_datetime(extra_regressors_df_prepared['ds'], errors='coerce')
        if extra_regressors_df_prepared['ds'].dt.tz is not None:
            extra_regressors_df_prepared['ds'] = extra_regressors_df_prepared['ds'].dt.tz_localize(None)

        for regressor_name in potential_regressors_in_history:
            if regressor_name in extra_regressors_df_prepared.columns:
                if not pd.api.types.is_numeric_dtype(history_df_prophet[regressor_name]):
                    history_df_prophet[regressor_name] = pd.to_numeric(history_df_prophet[regressor_name], errors='coerce')
                if not pd.api.types.is_numeric_dtype(extra_regressors_df_prepared[regressor_name]):
                    extra_regressors_df_prepared[regressor_name] = pd.to_numeric(extra_regressors_df_prepared[regressor_name], errors='coerce')

                history_df_prophet[regressor_name] = history_df_prophet[regressor_name].ffill().bfill().fillna(0)
                extra_regressors_df_prepared[regressor_name] = extra_regressors_df_prepared[regressor_name].ffill().bfill().fillna(0)

                try:
                    model.add_regressor(regressor_name)
                    actual_regressors_for_model.append(regressor_name)
                    print(f"INFO (prophet_model): Regressor '{regressor_name}' added.")
                except Exception as e_reg:
                    print(f"WARNING (prophet_model): Error adding regressor '{regressor_name}': {e_reg}. Skipping.")

    print("INFO (prophet_model): Fitting Prophet model...")
    try:
        # Prophet doesn't return a direct 'loss' like Keras during fit
        model.fit(history_df_prophet)
        training_loss_info = "N/A (Prophet does not expose direct training loss like Keras)"
    except Exception as fit_err:
        print(f"ERROR (prophet_model): Error during Prophet model.fit(): {fit_err}")
        traceback.print_exc()
        raise ValueError(f"Prophet model.fit() failed: {fit_err}")
    print("INFO (prophet_model): Fitting complete.")

    model_training_report = {
        "changepoint_prior_scale_used": model.changepoint_prior_scale,
        "seasonality_prior_scale_used": model.seasonality_prior_scale,
        "seasonality_mode_used": model.seasonality_mode,
        "holidays_prior_scale_used": model.holidays_prior_scale if model.holidays is not None else None,
        "detected_changepoints_count": len(model.changepoints),
        "active_seasonalities": list(model.seasonalities.keys()),
        "active_regressors": actual_regressors_for_model,
        "daily_seasonality_setting": config.PROPHET_DAILY_SEASONALITY,
        "training_loss": training_loss_info, # Placeholder
        "validation_loss": None # Not applicable for Prophet's direct fit method
    }
    if holidays_df is not None:
        model_training_report["holidays_configured_count"] = len(holidays_df)
    else:
        model_training_report["holidays_configured_count"] = 0

    print(f"INFO (prophet_model): Creating future DataFrame for {periods} periods...")
    future_df = model.make_future_dataframe(periods=periods, freq='D')

    if actual_regressors_for_model and extra_regressors_df_prepared is not None:
        columns_to_select_from_extra = ['ds'] + [
            reg for reg in actual_regressors_for_model if reg in extra_regressors_df_prepared.columns
        ]
        if len(columns_to_select_from_extra) > 1:
            future_df = pd.merge(future_df, extra_regressors_df_prepared[columns_to_select_from_extra], on='ds', how='left')
            for regressor in actual_regressors_for_model:
                if regressor in future_df.columns and future_df[regressor].isnull().any():
                    print(f"WARNING (prophet_model): Missing future values for regressor '{regressor}' after merge. Filling with ffill, bfill, then 0.")
                    future_df[regressor] = future_df[regressor].ffill().bfill().fillna(0)
                elif regressor not in future_df.columns:
                    print(f"ERROR (prophet_model): Regressor '{regressor}' added to model but not found in future_df after merge. Setting to 0 for forecast.")
                    future_df[regressor] = 0
    elif actual_regressors_for_model and extra_regressors_df_prepared is None:
         print(f"ERROR (prophet_model): Regressors {actual_regressors_for_model} were added to the model, but no extra_regressors_df_prepared was available for the future.")
         for regressor in actual_regressors_for_model:
             if regressor not in future_df.columns:
                future_df[regressor] = 0

    print("INFO (prophet_model): Generating forecast...")
    try:
        forecast_df_output = model.predict(future_df)
    except Exception as pred_err:
        print(f"ERROR (prophet_model): Error during Prophet model.predict(): {pred_err}")
        traceback.print_exc()
        raise ValueError(f"Prophet model.predict() failed: {pred_err}. Check regressors in future_df.")

    print("INFO (prophet_model): Forecast complete.")

    output_columns = ['ds', 'yhat', 'yhat_lower', 'yhat_upper', 'trend']
    final_forecast_df = forecast_df_output[[col for col in output_columns if col in forecast_df_output.columns]].copy()

    return final_forecast_df, model_training_report
import pandas as pd
import numpy as np
import os
import datetime
import time
import matplotlib.pyplot as plt
from prophet import Prophet

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Input, Dropout
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

OUTPUT_DIRECTORY = "data/synthetic"
RESULTS_DIR = "results/model_comparison"
FIGURES_DIR = os.path.join(RESULTS_DIR, "figures")
TRAIN_TEST_SPLIT_DAYS = 30

PROPHET_WINS_CONFIG = {
    "filename": "synthetic_data_prophet_wins.csv", "start_date": "2020-01-01", "end_date": "2024-12-31",
    "base_level": 500, "noise_std": 15, "min_val": 0, "max_val": 1000,
    "trend_segments": [{"slope": 0.1, "until": "2021-06-30"}, {"slope": -0.05, "until": "2023-01-31"}, {"slope": 0.2, "until": "2024-12-31"}],
    "yearly_amp": 150, "weekly_amp": 50, "daily_amp": 10,
    "holidays": [{"date": "12-25", "effect": 100}, {"dayofweek": 0, "effect": -30}],
    "outlier_pct": 0.01, "outlier_mag": 200
}

LSTM_WINS_CONFIG = {
    "filename": "synthetic_data_lstm_wins.csv", "start_date": "2020-01-01", "end_date": "2024-12-31",
    "base_level": 300, "noise_std": 5, "min_val": 0, "max_val": 1000,
    "logistic_k": 700, "logistic_m": 1000, "logistic_b": 0.01,
    "complex_season_period": 90, "complex_season_base_amp": 30,
    "lag_1_coeff": 0.6, "lag_long_coeff": 0.3, "lag_long_days": 45
}

def generate_prophet_wins_data(config, output_dir):
    dates = pd.date_range(start=config['start_date'], end=config['end_date'], freq='D')
    num_days = len(dates)
    days_elapsed = np.arange(num_days)
    values = np.zeros(num_days) + config['base_level']
    current_trend_val = 0
    last_segment_end_day = -1
    start_date_dt = pd.to_datetime(config['start_date'])
    for segment in config['trend_segments']:
        segment_end_date = pd.to_datetime(segment['until'])
        segment_end_day = (segment_end_date - start_date_dt).days
        start_index = last_segment_end_day + 1
        end_index = segment_end_day + 1
        if start_index < num_days and start_index < end_index:
             actual_end_index = min(end_index, num_days)
             segment_indices = np.arange(start_index, actual_end_index)
             segment_len = len(segment_indices)
             if segment_len > 0:
                 segment_days = np.arange(segment_len)
                 values[segment_indices] += current_trend_val + segment['slope'] * segment_days
                 current_trend_val += segment['slope'] * (segment_len -1) if segment_len > 1 else segment['slope'] * 0
                 last_segment_end_day = actual_end_index -1
    day_of_year = dates.dayofyear
    day_of_week = dates.dayofweek
    values += config['yearly_amp'] * np.sin(2 * np.pi * day_of_year / 365.25)
    values += config['weekly_amp'] * np.sin(2 * np.pi * day_of_week / 7)
    for holiday in config['holidays']:
        if 'date' in holiday:
            month_day = dates.strftime('%m-%d')
            values[month_day == holiday['date']] += holiday['effect']
        elif 'dayofweek' in holiday:
             values[day_of_week == holiday['dayofweek']] += holiday['effect']
    values += np.random.normal(0, config['noise_std'], num_days)
    num_outliers = int(config['outlier_pct'] * num_days)
    if num_outliers > 0:
        outlier_indices = np.random.choice(num_days, num_outliers, replace=False)
        outlier_noise = np.random.choice([-1, 1], num_outliers) * config['outlier_mag']
        values[outlier_indices] += outlier_noise
    values = np.clip(values, config['min_val'], config['max_val'])
    df = pd.DataFrame({'Date': dates, 'Value': values})
    df['Value'] = df['Value'].round(2)
    save_path = os.path.join(output_dir, config['filename'])
    os.makedirs(output_dir, exist_ok=True)
    df.to_csv(save_path, index=False, sep=';')
    return df

def generate_lstm_wins_data(config, output_dir):
    dates = pd.date_range(start=config['start_date'], end=config['end_date'], freq='D')
    num_days = len(dates)
    days_elapsed = np.arange(num_days)
    values = np.zeros(num_days)
    trend = config['base_level'] + config['logistic_k'] / (1 + np.exp(-config['logistic_b'] * (days_elapsed - config['logistic_m'])))

    complex_seasonality = np.zeros(num_days)
    for t in range(num_days):
        period_phase = (t % config['complex_season_period']) / config['complex_season_period']
        current_amp = config['complex_season_base_amp'] * (1 + 0.2 * (trend[t] - config['base_level']) / config['logistic_k'])
        complex_seasonality[t] = current_amp * (2 * period_phase - 1) if period_phase < 0.5 else current_amp * (1 - 2 * (period_phase - 0.5))

    lag1 = config['lag_1_coeff']
    lagL = config['lag_long_coeff']
    lagL_days = config['lag_long_days']
    noise_std = config['noise_std']
    values[:lagL_days] = trend[:lagL_days] + complex_seasonality[:lagL_days] + np.random.normal(0, noise_std * 5, lagL_days)
    for t in range(lagL_days, num_days):
        ar_component = lag1 * values[t-1] + lagL * values[t-lagL_days]
        deterministic_part = trend[t] + complex_seasonality[t]
        noise = np.random.normal(0, noise_std)
        values[t] = 0.5 * ar_component + 0.5 * deterministic_part + noise
    values = np.clip(values, config['min_val'], config['max_val'])
    df = pd.DataFrame({'Date': dates, 'Value': values})
    df['Value'] = df['Value'].round(2)
    save_path = os.path.join(output_dir, config['filename'])
    os.makedirs(output_dir, exist_ok=True)
    df.to_csv(save_path, index=False, sep=';')
    return df

def run_comparison(df, dataset_label):
    os.makedirs(FIGURES_DIR, exist_ok=True)
    df['Date'] = pd.to_datetime(df['Date'])
    split_date = df['Date'].max() - pd.Timedelta(days=TRAIN_TEST_SPLIT_DAYS -1)
    df_train_orig = df[df['Date'] < split_date].copy()
    df_test_orig = df[df['Date'] >= split_date].copy()
    actual_values = df_test_orig['Value'].values

    prophet_train_df = df_train_orig[['Date', 'Value']].rename(columns={'Date': 'ds', 'Value': 'y'})
    prophet_model = Prophet(daily_seasonality='auto')
    prophet_model.fit(prophet_train_df)
    future_df = prophet_model.make_future_dataframe(periods=TRAIN_TEST_SPLIT_DAYS, freq='D')
    prophet_forecast_df = prophet_model.predict(future_df)
    prophet_forecast = prophet_forecast_df['yhat'][-TRAIN_TEST_SPLIT_DAYS:].values

    lstm_forecast = np.full(TRAIN_TEST_SPLIT_DAYS, np.nan)
    LOOK_BACK = 60
    df_diff = df.set_index('Date').copy()
    df_diff['Value_diff'] = df_diff['Value'].diff()
    df_diff = df_diff.dropna()
    df_train_diff = df_diff[df_diff.index < split_date]
    last_actual_train_value = df_train_orig['Value'].iloc[-1]
    if len(df_train_diff) > LOOK_BACK + TRAIN_TEST_SPLIT_DAYS:
        scaler = MinMaxScaler(feature_range=(-1, 1))
        scaled_data_train_diff = scaler.fit_transform(df_train_diff[['Value_diff']])
        n_features = 1
        X, y = [], []
        for i in range(LOOK_BACK, len(scaled_data_train_diff)):
            X.append(scaled_data_train_diff[i-LOOK_BACK:i, 0])
            y.append(scaled_data_train_diff[i, 0])
        X, y = np.array(X), np.array(y)
        X = np.reshape(X, (X.shape[0], X.shape[1], n_features))
        val_split_index = int(len(X) * 0.9)
        X_train, X_val = X[:val_split_index], X[val_split_index:]
        y_train, y_val = y[:val_split_index], y[val_split_index:]

        tf.keras.backend.clear_session()
        lstm_model = Sequential([
            Input(shape=(LOOK_BACK, n_features)),
            LSTM(75, return_sequences=True),
            Dropout(0.2),
            LSTM(35, return_sequences=False),
            Dropout(0.2),
            Dense(1)
        ])
        lstm_model.compile(optimizer='adam', loss='mean_squared_error')

        early_stopping = EarlyStopping(monitor='val_loss', patience=25, restore_best_weights=True, verbose=1)
        reduce_lr = ReduceLROnPlateau(monitor='val_loss', factor=0.2, patience=10, min_lr=1e-6, verbose=1)

        lstm_model.fit(X_train, y_train, epochs=300, batch_size=32, validation_data=(X_val, y_val),
                       callbacks=[early_stopping, reduce_lr], verbose=1, shuffle=False)

        last_sequence_scaled_diff = scaled_data_train_diff[-LOOK_BACK:]
        current_batch_scaled_diff = last_sequence_scaled_diff.reshape((1, LOOK_BACK, n_features))
        future_predictions_scaled_diff = []
        for _ in range(TRAIN_TEST_SPLIT_DAYS):
            pred_scaled_diff = lstm_model.predict(current_batch_scaled_diff, verbose=0)[0, 0]
            future_predictions_scaled_diff.append(pred_scaled_diff)
            next_input_step_scaled_diff = np.reshape(pred_scaled_diff, (1, 1, n_features))
            current_batch_scaled_diff = np.append(current_batch_scaled_diff[:, 1:, :], next_input_step_scaled_diff, axis=1)

        predicted_diffs = scaler.inverse_transform(np.array(future_predictions_scaled_diff).reshape(-1, 1)).flatten()
        lstm_forecast[0] = last_actual_train_value + predicted_diffs[0]
        for i in range(1, TRAIN_TEST_SPLIT_DAYS):
            lstm_forecast[i] = lstm_forecast[i-1] + predicted_diffs[i]

        lstm_forecast = lstm_forecast.round(2)

    metrics = {}
    mae_prophet = mean_absolute_error(actual_values, prophet_forecast)
    rmse_prophet = np.sqrt(mean_squared_error(actual_values, prophet_forecast))
    metrics['Prophet'] = {'MAE': mae_prophet, 'RMSE': rmse_prophet}

    if not np.isnan(lstm_forecast).any():
        mae_lstm = mean_absolute_error(actual_values, lstm_forecast)
        rmse_lstm = np.sqrt(mean_squared_error(actual_values, lstm_forecast))
        metrics['LSTM'] = {'MAE': mae_lstm, 'RMSE': rmse_lstm}

    plt.figure(figsize=(14, 7))
    plt.plot(df_test_orig['Date'], actual_values, label='Actual', color='black', linewidth=2)
    plt.plot(df_test_orig['Date'], prophet_forecast, label=f'Prophet (MAE: {mae_prophet:.2f})', color='blue', linestyle='--')
    if not np.isnan(lstm_forecast).any():
        plt.plot(df_test_orig['Date'], lstm_forecast, label=f'LSTM (MAE: {mae_lstm:.2f})', color='red', linestyle=':')

    plt.title(f'Model Comparison on: {dataset_label}')
    plt.xlabel('Date')
    plt.ylabel('Value')
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plot_path = os.path.join(FIGURES_DIR, f"comparison_{dataset_label.replace(' ', '_')}.png")
    plt.savefig(plot_path)
    plt.close()

if __name__ == "__main__":
    start_run_time = time.time()
    os.makedirs(OUTPUT_DIRECTORY, exist_ok=True)

    df_prophet_wins = generate_prophet_wins_data(PROPHET_WINS_CONFIG, OUTPUT_DIRECTORY)
    run_comparison(df_prophet_wins, "Prophet Wins Data")

    df_lstm_wins = generate_lstm_wins_data(LSTM_WINS_CONFIG, OUTPUT_DIRECTORY)
    run_comparison(df_lstm_wins, "LSTM Wins Data")

    end_run_time = time.time()
    print(f"\n--- Full script finished in {end_run_time - start_run_time:.2f} seconds ---")

# src/tf_keras_model.py
import pandas as pd
import numpy as np
import os
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Input, Dropout
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
import tensorflow as tf
from src import config
from src.data_loader import add_features # Used to generate features, including iteratively
from typing import Tuple, Dict, Any

def create_multivariate_sequences(input_data: np.ndarray, target_data: np.ndarray, look_back: int):
    X, y = [], []
    if input_data.ndim == 1: # Ensure input_data is 2D
        input_data = input_data.reshape(-1,1)
    if target_data.ndim == 1:
        target_data = target_data.reshape(-1,1) # target_data also as 2D for consistency

    if len(input_data) <= look_back: # Not enough data for one sequence
        return np.array(X), np.array(y) # Return empty arrays

    for i in range(len(input_data) - look_back): # target_data[i + look_back] is the y-value
        X.append(input_data[i:(i + look_back), :]) # All features for the lookback period
        y.append(target_data[i + look_back, 0])    # Only the target value (first column of target_data)
    return np.array(X), np.array(y)

def forecast_with_tensorflow(history_df_with_all_features: pd.DataFrame, periods: int) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    print(f"INFO (tf_keras_model): Starting TensorFlow/Keras Forecast for {periods} periods.")

    df_for_model = history_df_with_all_features.copy()

    if config.DATE_COLUMN not in df_for_model.columns or config.TARGET_COLUMN not in df_for_model.columns:
        raise ValueError(f"TF: Input DataFrame must contain '{config.DATE_COLUMN}' and '{config.TARGET_COLUMN}' columns.")

    if df_for_model[config.DATE_COLUMN].dt.tz is not None:
        print(f"INFO (tf_keras_model): Removing timezone from '{config.DATE_COLUMN}' column.")
        df_for_model[config.DATE_COLUMN] = df_for_model[config.DATE_COLUMN].dt.tz_localize(None)

    if not pd.api.types.is_numeric_dtype(df_for_model[config.TARGET_COLUMN]):
        df_for_model[config.TARGET_COLUMN] = pd.to_numeric(df_for_model[config.TARGET_COLUMN], errors='coerce')

    if df_for_model[config.TARGET_COLUMN].isnull().any():
        print(f"WARNING (tf_keras_model): Target column '{config.TARGET_COLUMN}' contains {df_for_model[config.TARGET_COLUMN].isnull().sum()} NaNs. Filling with ffill/bfill.")
        df_for_model[config.TARGET_COLUMN] = df_for_model[config.TARGET_COLUMN].ffill().bfill()
        if df_for_model[config.TARGET_COLUMN].isnull().any():
            print(f"WARNING (tf_keras_model): Target column '{config.TARGET_COLUMN}' still contains NaNs after ffill/bfill. Filling with 0.")
            df_for_model[config.TARGET_COLUMN] = df_for_model[config.TARGET_COLUMN].fillna(0)

    features_for_lstm_input = [config.TARGET_COLUMN] + [
        col for col in df_for_model.columns if col not in [config.DATE_COLUMN, config.TARGET_COLUMN]
    ]
    features_for_lstm_input = sorted(list(set(features_for_lstm_input)))
    if config.TARGET_COLUMN in features_for_lstm_input:
        features_for_lstm_input.remove(config.TARGET_COLUMN)
    features_for_lstm_input = [config.TARGET_COLUMN] + features_for_lstm_input

    print(f"INFO (tf_keras_model): LSTM input features (ordered): {features_for_lstm_input}")

    lstm_input_data_df = df_for_model[features_for_lstm_input].copy()

    for col in lstm_input_data_df.columns:
        if col != config.TARGET_COLUMN and lstm_input_data_df[col].isnull().any():
            print(f"WARNING (tf_keras_model): Feature column '{col}' contains NaNs. Filling with ffill/bfill/0.")
            lstm_input_data_df[col] = lstm_input_data_df[col].ffill().bfill().fillna(0)

    if len(lstm_input_data_df) < config.LSTM_LOOK_BACK + 1:
        raise ValueError(f"TF: Not enough data ({len(lstm_input_data_df)}) for look_back={config.LSTM_LOOK_BACK} + 1.")

    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_data_np = scaler.fit_transform(lstm_input_data_df)

    target_col_index_in_scaled = 0

    X_train_val, y_train_val = create_multivariate_sequences(
        scaled_data_np,
        scaled_data_np[:, target_col_index_in_scaled],
        config.LSTM_LOOK_BACK
    )

    if X_train_val.shape[0] == 0:
        raise ValueError("TF: Could not create training sequences. Not enough data after look_back application.")

    val_split_percentage = 0.2
    num_val_samples = int(X_train_val.shape[0] * val_split_percentage)
    num_train_samples = X_train_val.shape[0] - num_val_samples

    use_validation_set = True
    if num_train_samples < config.LSTM_BATCH_SIZE or num_val_samples < 1:
        print(f"WARNING (tf_keras_model): Insufficient sequences ({X_train_val.shape[0]}) for train/val split. Training without explicit validation set.")
        X_train, y_train = X_train_val, y_train_val
        X_val, y_val = None, None
        use_validation_set = False
    else:
        X_train, y_train = X_train_val[:num_train_samples], y_train_val[:num_train_samples]
        X_val, y_val = X_train_val[num_train_samples:], y_train_val[num_train_samples:]
        print(f"INFO (tf_keras_model): Training data shape: {X_train.shape}, Validation data shape: {X_val.shape}")

    n_features_in_model = X_train.shape[2]
    print(f"INFO (tf_keras_model): Number of features for LSTM input layer: {n_features_in_model}")

    tf.keras.backend.clear_session()
    model = Sequential()
    model.add(Input(shape=(config.LSTM_LOOK_BACK, n_features_in_model)))
    model.add(LSTM(config.LSTM_UNITS_L1, return_sequences=(True if config.LSTM_UNITS_L2 > 0 else False)))
    model.add(Dropout(config.LSTM_DROPOUT))
    if config.LSTM_UNITS_L2 > 0:
        model.add(LSTM(config.LSTM_UNITS_L2, return_sequences=False))
        model.add(Dropout(config.LSTM_DROPOUT))
    model.add(Dense(1))
    model.compile(optimizer='adam', loss='mean_squared_error')
    model.summary()

    callbacks = [
        EarlyStopping(
            monitor='val_loss' if use_validation_set and X_val is not None else 'loss',
            patience=config.LSTM_EARLY_STOPPING_PATIENCE,
            restore_best_weights=True, verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss' if use_validation_set and X_val is not None else 'loss',
            factor=0.2, patience=5, min_lr=1e-6, verbose=1
        )
    ]

    print("INFO (tf_keras_model): Training LSTM model...")
    history = model.fit( # Capture the history object here
        X_train, y_train, epochs=config.LSTM_EPOCHS, batch_size=config.LSTM_BATCH_SIZE,
        validation_data=(X_val, y_val) if use_validation_set and X_val is not None else None,
        callbacks=callbacks, verbose=1, shuffle=False
    )
    print("INFO (tf_keras_model): Training complete.")

    training_loss = history.history['loss'][-1]
    validation_loss = history.history['val_loss'][-1] if 'val_loss' in history.history else None

    model_training_report = {
        "training_loss": training_loss,
        "validation_loss": validation_loss,
        "look_back_window": config.LSTM_LOOK_BACK,
        "lstm_units_layer1": config.LSTM_UNITS_L1,
        "lstm_units_layer2": config.LSTM_UNITS_L2,
        "dropout_rate": config.LSTM_DROPOUT,
        "epochs_trained": len(history.history['loss']), # Actual epochs trained
        "early_stopping_patience": config.LSTM_EARLY_STOPPING_PATIENCE,
        "batch_size": config.LSTM_BATCH_SIZE,
        "features_used_count": n_features_in_model
    }

    print("INFO (tf_keras_model): Generating forecast with iterative feature updates...")

    iterative_history_df = df_for_model.copy()

    current_sequence_scaled = scaled_data_np[-config.LSTM_LOOK_BACK:].reshape((1, config.LSTM_LOOK_BACK, n_features_in_model))

    future_unscaled_y_predictions = []
    last_known_date_from_input_history = pd.to_datetime(df_for_model[config.DATE_COLUMN].iloc[-1])

    for i in range(periods):
        predicted_y_scaled_current_step = model.predict(current_sequence_scaled, verbose=0)[0, 0]

        temp_for_unscale = np.zeros((1, n_features_in_model))
        temp_for_unscale[0, target_col_index_in_scaled] = predicted_y_scaled_current_step
        predicted_y_unscaled_current_step = scaler.inverse_transform(temp_for_unscale)[0, target_col_index_in_scaled]
        future_unscaled_y_predictions.append(predicted_y_unscaled_current_step)

        if i < periods - 1:
            next_prediction_date = last_known_date_from_input_history + pd.Timedelta(days=i + 1)

            new_predicted_row_for_features = pd.DataFrame([{
                config.DATE_COLUMN: next_prediction_date,
                config.TARGET_COLUMN: predicted_y_unscaled_current_step
            }])

            temp_df_for_add_features = pd.concat([
                iterative_history_df[[config.DATE_COLUMN, config.TARGET_COLUMN]],
                new_predicted_row_for_features
            ], ignore_index=True).set_index(config.DATE_COLUMN)

            all_features_recalculated_df, _, _ = add_features(
                temp_df_for_add_features.copy(),
                target_column=config.TARGET_COLUMN,
                include_lag_rolling=True
            )

            next_step_all_unscaled_features_series = all_features_recalculated_df.iloc[-1]

            next_step_unscaled_feature_array = np.array([
                next_step_all_unscaled_features_series.get(feat_name, 0)
                for feat_name in features_for_lstm_input
            ])

            next_step_scaled_feature_array_row = scaler.transform(
                pd.DataFrame([next_step_unscaled_feature_array], columns=features_for_lstm_input)
            )

            current_sequence_scaled = np.append(
                current_sequence_scaled[:, 1:, :],
                next_step_scaled_feature_array_row.reshape(1, 1, n_features_in_model),
                axis=1
            )

            new_row_to_add_to_iterative_history = {
                config.DATE_COLUMN: next_prediction_date,
                config.TARGET_COLUMN: predicted_y_unscaled_current_step
            }
            for feat_name in features_for_lstm_input:
                if feat_name != config.TARGET_COLUMN:
                    new_row_to_add_to_iterative_history[feat_name] = next_step_all_unscaled_features_series.get(feat_name, 0)

            iterative_history_df = pd.concat([
                iterative_history_df,
                pd.DataFrame([new_row_to_add_to_iterative_history])
            ], ignore_index=True)

    forecast_dates = pd.date_range(
        start=last_known_date_from_input_history + pd.Timedelta(days=1),
        periods=periods,
        freq='D'
    )
    forecast_df = pd.DataFrame({
        'ds': forecast_dates,
        'yhat': np.array(future_unscaled_y_predictions).flatten().round(2)
    })
    print("INFO (tf_keras_model): Forecast complete.")
    return forecast_df, model_training_report


absl-py==2.2.2
annotated-types==0.7.0
anyio==4.6.2.post1
astunparse==1.6.3
certifi==2024.8.30
charset-normalizer==3.4.1
click==8.1.8
cmdstanpy==1.2.5
colorama==0.4.6
contourpy==1.3.2
cycler==0.12.1
distro==1.9.0
fastapi==0.115.12
flatbuffers==25.2.10
fonttools==4.57.0
gast==0.6.0
google-pasta==0.2.0
greenlet==3.2.1
grpcio==1.71.0
h11==0.14.0
h5py==3.13.0
holidays==0.71
httpcore==1.0.6
httpx==0.27.2
idna==3.10
importlib_resources==6.5.2
jiter==0.6.1
joblib==1.4.2
keras==3.9.2
kiwisolver==1.4.8
libclang==18.1.1
Markdown==3.8
markdown-it-py==3.0.0
MarkupSafe==3.0.2
matplotlib==3.10.1
mdurl==0.1.2
ml_dtypes==0.5.1
namex==0.0.9
narwhals==1.36.0
numpy==1.26.4
openai==1.52.0
opt_einsum==3.4.0
optree==0.15.0
packaging==25.0
pandas==2.2.3
patsy==1.0.1
pillow==11.2.1
plotly==6.0.1
prophet==1.1.6
protobuf==5.29.4
pydantic==2.9.2
pydantic_core==2.23.4
Pygments==2.19.1
pyparsing==3.2.3
python-dateutil==2.9.0.post0
python-multipart==0.0.20
pytz==2025.2
requests==2.32.3
rich==14.0.0
scikit-learn==1.6.1
scipy==1.15.2
setuptools==79.0.1
six==1.17.0
sniffio==1.3.1
SQLAlchemy==2.0.40
stanio==0.5.1
starlette==0.46.2
statsmodels==0.14.4
tabulate==0.9.0
tensorboard==2.19.0
tensorboard-data-server==0.7.2
tensorflow==2.19.0
termcolor==3.0.1
threadpoolctl==3.6.0
tqdm==4.66.5
typing_extensions==4.12.2
tzdata==2025.2
urllib3==2.4.0
uvicorn==0.34.2
Werkzeug==3.1.3
wheel==0.45.1
wrapt==1.17.2

