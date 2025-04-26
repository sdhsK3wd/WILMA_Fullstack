import sqlite3
import os

DB_FILE = os.path.join(os.path.dirname(__file__), "..", "forecasts.db")

def init_db():
    """Initialisiert die Forecasts-Datenbank und erstellt die Tabelle, falls sie nicht existiert."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS forecasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            value REAL NOT NULL,
            source_file TEXT
        )
    ''')
    conn.commit()
    conn.close()

def save_forecast_to_db(forecast_df, source_file="uploaded_csv"):
    """Speichert eine Forecast DataFrame in die Datenbank."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()

    for _, row in forecast_df.iterrows():
        c.execute('''
            INSERT INTO forecasts (date, value, source_file)
            VALUES (?, ?, ?)
        ''', (row['ds'].strftime('%Y-%m-%d'), row['yhat'], source_file))

    conn.commit()
    conn.close()


def load_forecasts():
    """Lädt alle Forecasts aus der Datenbank."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT date, value, source_file FROM forecasts ORDER BY date')
    rows = c.fetchall()
    conn.close()
    return rows
