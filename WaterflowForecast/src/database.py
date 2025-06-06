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