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
    return name