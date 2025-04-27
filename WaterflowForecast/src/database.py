import sqlite3
import os

# === Datenbank-Dateipfad ===
DB_FILE = os.path.join(os.path.dirname(__file__), "..", "forecast.db")

# === Datenbank initialisieren ===
def init_db():
    """Initialisiert die Forecasts- und Actuals-Datenbank und erstellt Tabellen, falls sie nicht existieren."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()

    # Forecasts Tabelle
    c.execute('''
        CREATE TABLE IF NOT EXISTS forecasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            value REAL NOT NULL,
            source_file TEXT
        )
    ''')

    # Actuals Tabelle (NEU!)
    c.execute('''
        CREATE TABLE IF NOT EXISTS actuals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            value REAL NOT NULL,
            source_file TEXT
        )
    ''')

    conn.commit()
    conn.close()

# === Forecast speichern ===
def save_forecast_to_db(forecast_df, source_file="uploaded_forecast.csv"):
    """Speichert eine Forecast-DataFrame in der Datenbank."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()

    for _, row in forecast_df.iterrows():
        c.execute('''
            INSERT INTO forecasts (date, value, source_file)
            VALUES (?, ?, ?)
        ''', (row['ds'].strftime('%Y-%m-%d'), row['yhat'], source_file))

    conn.commit()
    conn.close()

# === Forecast laden ===
def load_forecasts():
    """Lädt alle Forecast-Daten aus der Datenbank."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT date, value, source_file FROM forecasts ORDER BY date')
    rows = c.fetchall()
    conn.close()
    return rows

# === Actuals speichern (NEU) ===
def save_actual_to_db(actual_df, source_file="uploaded_actual.csv"):
    """Speichert echte Messdaten (Actuals) in der Datenbank."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()

    for _, row in actual_df.iterrows():
        c.execute('''
            INSERT INTO actuals (date, value, source_file)
            VALUES (?, ?, ?)
        ''', (row['Date'], row['Value'], source_file))

    conn.commit()
    conn.close()

# === Actuals laden (NEU) ===
def load_actuals():
    """Lädt alle tatsächlichen Werte aus der Datenbank."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT date, value FROM actuals ORDER BY date')
    rows = c.fetchall()
    conn.close()
    return rows
