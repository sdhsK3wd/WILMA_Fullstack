import sqlite3
import os
import pandas as pd # Importiere pandas für Datumsoperationen
import traceback # Für detailliertere Fehlerausgaben

# === Datenbank-Dateipfad ===
# Stellt sicher, dass die DB im Hauptverzeichnis des Projekts liegt (eine Ebene über src)
DB_FILE = os.path.join(os.path.dirname(__file__), "..", "forecast.db")

# === Datenbank initialisieren ===
def init_db():
    """Initialisiert die Forecasts- und Actuals-Datenbank und erstellt Tabellen, falls sie nicht existieren."""
    conn = None
    try:
        print(f"INFO: Connecting to database at {DB_FILE}...")
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        print("INFO: Database connection successful. Creating tables if not exist...")

        # Forecasts Tabelle
        # Überlege, ob 'date' wirklich UNIQUE sein soll. Wenn du Forecasts aus verschiedenen
        # Quellen oder zu verschiedenen Zeiten hochlädst, könnte das zu Problemen führen.
        # Wenn UNIQUE, werden alte Einträge mit demselben Datum überschrieben (wegen INSERT OR REPLACE).
        c.execute('''
            CREATE TABLE IF NOT EXISTS forecasts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE,
                value REAL NOT NULL,
                source_file TEXT
            )
        ''')
        print("INFO: 'forecasts' table checked/created.")

        # Actuals Tabelle
        # Auch hier überlegen, ob 'date' UNIQUE sein soll.
        c.execute('''
            CREATE TABLE IF NOT EXISTS actuals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE,
                value REAL NOT NULL,
                source_file TEXT
            )
        ''')
        print("INFO: 'actuals' table checked/created.")

        conn.commit()
        print("INFO: Database changes committed.")
    except sqlite3.Error as e:
        print(f"ERROR: SQLite error during init_db: {e}")
        traceback.print_exc() # Zeige den Stack Trace
    except Exception as e:
        print(f"ERROR: Unexpected error during init_db: {e}")
        traceback.print_exc()
    finally:
        if conn:
            conn.close()
            print("INFO: Database connection closed after init.")

# === Forecast speichern ===
def save_forecast_to_db(forecast_df, source_file="uploaded_forecast.csv"):
    """Speichert eine Forecast-DataFrame in der Datenbank.
       Erwartet Spalten 'ds' (datetime-ähnlich) und 'yhat' (numerisch)."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        print(f"INFO: Saving {len(forecast_df)} forecast records from {source_file}...")

        if 'ds' not in forecast_df.columns or 'yhat' not in forecast_df.columns:
             raise ValueError("DataFrame für Forecast muss Spalten 'ds' und 'yhat' enthalten.")

        insert_count = 0
        skipped_count = 0
        for _, row in forecast_df.iterrows():
            if pd.isnull(row['ds']) or pd.isnull(row['yhat']):
                skipped_count += 1
                continue

            try:
                # Konvertiere zu datetime und formatiere KONSISTENT
                date_obj = pd.to_datetime(row['ds'])
                date_str = date_obj.strftime('%Y-%m-%dT%H:%M:%SZ') # ISO Format mit Z
                value = float(row['yhat'])

                # Füge hinzu oder ersetze, falls Datum UNIQUE ist
                c.execute('''
                    INSERT OR REPLACE INTO forecasts (date, value, source_file)
                    VALUES (?, ?, ?)
                ''', (date_str, value, source_file))
                insert_count += 1
            except ValueError as conversion_err:
                print(f"WARNUNG (Forecast): Konnte Datum '{row['ds']}' oder Wert '{row['yhat']}' nicht verarbeiten, überspringe Zeile: {conversion_err}")
                skipped_count += 1
            except sqlite3.IntegrityError as ie:
                 print(f"WARNUNG (Forecast): Integritätsfehler (Datum '{date_str}' evtl. schon vorhanden?), überspringe Zeile: {ie}")
                 skipped_count += 1
            except Exception as inner_e:
                 print(f"WARNUNG (Forecast): Unerwarteter Fehler beim Verarbeiten der Zeile {row}, überspringe: {inner_e}")
                 skipped_count += 1


        conn.commit()
        print(f"INFO: Successfully processed {insert_count} forecast records (skipped: {skipped_count}).")
    except sqlite3.Error as e:
        print(f"ERROR: SQLite error during save_forecast_to_db: {e}")
        traceback.print_exc()
        if conn: conn.rollback()
    except ValueError as ve:
         print(f"ERROR: ValueError during save_forecast_to_db: {ve}")
         traceback.print_exc()
    except Exception as e:
        print(f"ERROR: Unexpected error during save_forecast_to_db: {e}")
        traceback.print_exc()
        if conn: conn.rollback()
    finally:
        if conn:
            conn.close()

# === Forecast laden ===
def load_forecasts():
    """Lädt alle Forecast-Daten aus der Datenbank."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        # Wähle die Spalten aus, die in main.py erwartet werden
        c.execute('SELECT date, value, source_file FROM forecasts ORDER BY date')
        rows = c.fetchall()
        print(f"INFO: Loaded {len(rows)} forecast records.")
        return rows # Gibt Liste von Tupeln zurück
    except sqlite3.Error as e:
        print(f"ERROR: SQLite error during load_forecasts: {e}")
        traceback.print_exc()
        return []
    except Exception as e:
        print(f"ERROR: Unexpected error during load_forecasts: {e}")
        traceback.print_exc()
        return []
    finally:
        if conn:
            conn.close()

# === Actuals speichern ===
def save_actual_to_db(actual_df, source_file="uploaded_actual.csv"):
    """Speichert echte Messdaten (Actuals) in der Datenbank.
       Erwartet Spalten 'Date' (datetime-ähnlich) und 'Value' (numerisch)."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        print(f"INFO: Saving {len(actual_df)} actual records from {source_file}...")

        if 'Date' not in actual_df.columns or 'Value' not in actual_df.columns:
            raise ValueError("DataFrame für Actuals muss Spalten 'Date' und 'Value' enthalten.")

        insert_count = 0
        skipped_count = 0
        for _, row in actual_df.iterrows():
             if pd.isnull(row['Date']) or pd.isnull(row['Value']):
                 skipped_count += 1
                 continue

             try:
                 # Konvertiere ZUERST zu datetime, DANN formatiere KONSISTENT
                 date_obj = pd.to_datetime(row['Date'])
                 date_str = date_obj.strftime('%Y-%m-%dT%H:%M:%SZ') # ISO Format mit Z
                 value = float(row['Value'])

                 # Füge hinzu oder ersetze, falls Datum UNIQUE ist
                 c.execute('''
                     INSERT OR REPLACE INTO actuals (date, value, source_file)
                     VALUES (?, ?, ?)
                 ''', (date_str, value, source_file))
                 insert_count += 1
             except ValueError as conversion_err:
                 print(f"WARNUNG (Actual): Konnte Datum '{row['Date']}' oder Wert '{row['Value']}' nicht verarbeiten, überspringe Zeile: {conversion_err}")
                 skipped_count += 1
             except sqlite3.IntegrityError as ie:
                 print(f"WARNUNG (Actual): Integritätsfehler (Datum '{date_str}' evtl. schon vorhanden?), überspringe Zeile: {ie}")
                 skipped_count += 1
             except Exception as inner_e:
                 print(f"WARNUNG (Actual): Unerwarteter Fehler beim Verarbeiten der Zeile {row}, überspringe: {inner_e}")
                 skipped_count += 1

        conn.commit()
        print(f"INFO: Successfully processed {insert_count} actual records (skipped: {skipped_count}).")
    except sqlite3.Error as e:
        print(f"ERROR: SQLite error during save_actual_to_db: {e}")
        traceback.print_exc()
        if conn: conn.rollback()
    except ValueError as ve:
         print(f"ERROR: ValueError during save_actual_to_db: {ve}")
         traceback.print_exc()
    except Exception as e:
        print(f"ERROR: Unexpected error during save_actual_to_db: {e}")
        traceback.print_exc()
        if conn: conn.rollback()
    finally:
        if conn:
            conn.close()

# === Actuals laden ===
def load_actuals():
    """Lädt alle tatsächlichen Werte aus der Datenbank."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        # Wähle die Spalten aus, die in main.py erwartet werden
        c.execute('SELECT date, value FROM actuals ORDER BY date')
        rows = c.fetchall()
        print(f"INFO: Loaded {len(rows)} actual records.")
        return rows # Gibt Liste von Tupeln zurück
    except sqlite3.Error as e:
        print(f"ERROR: SQLite error during load_actuals: {e}")
        traceback.print_exc()
        return []
    except Exception as e:
        print(f"ERROR: Unexpected error during load_actuals: {e}")
        traceback.print_exc()
        return []
    finally:
        if conn:
            conn.close()