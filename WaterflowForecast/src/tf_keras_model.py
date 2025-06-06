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