import os
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYNTHETIC_DATA_DIR = os.path.join(BASE_DIR, 'data', 'synthetic')
SYNTHETIC_FILE_NAME = "synthetic_waterflow_5y.csv"

DATA_DIR = SYNTHETIC_DATA_DIR
FILE_PATTERN = SYNTHETIC_FILE_NAME

RESULTS_DIR = os.path.join(BASE_DIR, 'results')

DATE_COLUMN = 'ds'
DATA_SEPARATOR = ';'
EXCLUDE_COLUMNS_FROM_FORECASTING = [] # <-- THIS LINE WAS MISSING

TRAIN_START_DATE = '2000-01-01'
TRAIN_END_DATE = '2003-12-31'
FORECAST_START_DATE = '2004-01-01'
FORECAST_END_DATE = '2004-01-31'

PROPHET_CHANGEPOINT_PRIOR = 0.5
PROPHET_SEASONALITY_PRIOR = 20.0

LSTM_LOOK_BACK = 30
LSTM_UNITS_L1 = 128
LSTM_UNITS_L2 = 64
LSTM_DROPOUT = 0.2
LSTM_EPOCHS = 100
LSTM_BATCH_SIZE = 32

CREATE_LAG_FEATURES = True
LAG_VALUES = [1, 2, 7, 14]
CREATE_ROLLING_FEATURES = True
ROLLING_WINDOWS = [7, 14]
CREATE_DATE_FEATURES = True

ADD_ARTIFICIAL_REGRESSOR = False
ARTIFICIAL_REGRESSOR_NAME = ''

os.makedirs(RESULTS_DIR, exist_ok=True)

print(f"Project Base Directory: {BASE_DIR}")
print(f"Using Synthetic Data From: {os.path.join(DATA_DIR, FILE_PATTERN)}")
print(f"Results Directory: {RESULTS_DIR}")

def sanitize_filename(name):
    name = name.strip()
    name = name.replace('/', '_').replace('\\', '_').replace(':', '_')
    name = name.replace('*', '_').replace('?', '_').replace('"', '_')
    name = name.replace('<', '_').replace('>', '_').replace('|', '_')
    name = name.replace('.', '_').replace(' ', '_')
    name = "".join(c if c.isalnum() or c == '_' else '' for c in name)
    name = name.strip('_')
    if not name:
        return "unnamed_column"
    return name