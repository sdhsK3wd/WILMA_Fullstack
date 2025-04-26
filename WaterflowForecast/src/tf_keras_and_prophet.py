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
