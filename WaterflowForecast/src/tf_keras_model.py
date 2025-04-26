import pandas as pd
import numpy as np
import os
import datetime
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Input, Dropout
# from tensorflow.keras.callbacks import EarlyStopping # Optional: Can add back
import tensorflow as tf
import matplotlib.pyplot as plt

# --- Configuration ---
INPUT_FILENAME = "data/synthetic/synthetic_data_predictable_3y.csv"
TRAIN_END_DATE = "2025-03-31"
FORECAST_DAYS = 30
LOOK_BACK = 60 # Sequence length to look back
RESULTS_DIR = "results"
FIGURES_DIR = os.path.join(RESULTS_DIR, "figures")

# LSTM Model Params (Simplified)
LSTM_UNITS = 50 # Reduced from 128/64
DROPOUT_RATE = 0.2
EPOCHS = 50 # Might need more/less depending on convergence
BATCH_SIZE = 32

# Parameters from the generation script (needed to generate ground truth)
MIN_VALUE = 50
MAX_VALUE = 1000
BASE_LEVEL = 450
TREND_SLOPE = 0.05
YEARLY_AMP = 200
WEEKLY_AMP = 100
# NOISE_LEVEL = 5 # Don't add noise to ground truth comparison

# --- Helper to generate ground truth ---
def generate_ground_truth(start_date_str, end_date_str):
    """Generates ground truth data for comparison, WITHOUT noise."""
    print(f"Generating ground truth for comparison ({start_date_str} to {end_date_str})")
    start_date = pd.to_datetime(start_date_str)
    end_date = pd.to_datetime(end_date_str)
    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    num_days = len(dates)
    # Need days elapsed from the *original* start of the series for consistent trend
    # Make sure this matches the start date of the INPUT_FILENAME used
    original_start_date = pd.to_datetime("2022-03-31") # Start date of the 3y file
    days_elapsed = (dates - original_start_date).days

    day_of_year = dates.dayofyear
    day_of_week = dates.dayofweek

    trend = TREND_SLOPE * days_elapsed
    yearly = YEARLY_AMP * np.cos(2 * np.pi * (day_of_year - 180) / 365.25)
    weekly = WEEKLY_AMP * np.cos(2 * np.pi * (day_of_week - 2.5) / 7)
    # Generate WITHOUT noise for a clean comparison baseline
    true_values = BASE_LEVEL + trend + yearly + weekly
    true_values = np.clip(true_values, MIN_VALUE, MAX_VALUE)

    # Create DataFrame first
    df_true = pd.DataFrame({'Date': dates, 'Actual': true_values})
    # THEN round the 'Actual' column (pandas Series)
    df_true['Actual'] = df_true['Actual'].round(2)

    df_true.set_index('Date', inplace=True)
    return df_true

# Helper to create sequences
def create_sequences(data, look_back):
    X, y = [], []
    for i in range(len(data) - look_back):
        X.append(data[i:(i + look_back), 0])
        y.append(data[i + look_back, 0])
    return np.array(X), np.array(y)

# --- Main Script ---
if __name__ == "__main__":
    print("--- Running TensorFlow/Keras LSTM Forecasting ---")
    os.makedirs(RESULTS_DIR, exist_ok=True)
    os.makedirs(FIGURES_DIR, exist_ok=True)

    # Load data
    try:
        df = pd.read_csv(INPUT_FILENAME, sep=';', parse_dates=['Date'], index_col='Date')
        print(f"Loaded data shape: {df.shape}")
    except FileNotFoundError:
        print(f"Error: Input file not found at {INPUT_FILENAME}")
        exit()

    # Filter training data
    train_data = df[df.index <= TRAIN_END_DATE][['Value']]
    print(f"Training data shape: {train_data.shape}")

    if train_data.empty or len(train_data) <= LOOK_BACK:
        print(f"Error: Not enough training data ({len(train_data)}) found for look_back={LOOK_BACK}.")
        exit()

    # Scale data
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_train_data = scaler.fit_transform(train_data)

    # Create sequences
    X_train, y_train = create_sequences(scaled_train_data, LOOK_BACK)

    # Reshape input for LSTM [samples, time steps, features]
    X_train = np.reshape(X_train, (X_train.shape[0], X_train.shape[1], 1))
    print(f"X_train shape: {X_train.shape}, y_train shape: {y_train.shape}")

    # --- Build LSTM Model (Simplified) ---
    print("Building LSTM model...")
    model = Sequential()
    model.add(Input(shape=(LOOK_BACK, 1))) # Input shape requires n_features=1
    model.add(LSTM(LSTM_UNITS, return_sequences=False)) # Only one LSTM layer
    model.add(Dropout(DROPOUT_RATE))
    model.add(Dense(1)) # Output layer
    model.compile(optimizer='adam', loss='mean_squared_error')
    model.summary()

    # --- Train LSTM Model ---
    print("Training LSTM model...")
    # Can add callbacks=[EarlyStopping(monitor='loss', patience=10)]
    history = model.fit(
        X_train, y_train,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        verbose=1, # Set to 1 or 2 to see progress, 0 for silent
        shuffle=False # Important for time series
    )
    print("Training complete.")

    # --- Generate Forecast ---
    print("Generating forecast...")
    last_sequence_scaled = scaled_train_data[-LOOK_BACK:]
    current_batch = last_sequence_scaled.reshape((1, LOOK_BACK, 1))
    future_predictions_scaled = []

    for i in range(FORECAST_DAYS):
        # Predict next step (extract scalar value)
        current_pred_scaled = model.predict(current_batch, verbose=0)[0, 0]
        future_predictions_scaled.append(current_pred_scaled)

        # *** CORRECTED RESHAPE ***
        # Reshape the prediction to (1, 1, 1) to match the expected input dimensions [batch, timestep, feature]
        next_input_step_scaled = np.reshape(current_pred_scaled, (1, 1, 1))

        # Append prediction and remove oldest value from the batch
        # Shape of current_batch[:, 1:, :] is (1, LOOK_BACK-1, 1)
        # Shape of next_input_step_scaled is (1, 1, 1)
        # Result shape after append along axis=1 will be (1, LOOK_BACK, 1)
        current_batch = np.append(current_batch[:, 1:, :], next_input_step_scaled, axis=1)
        # *** END CORRECTION ***

    # Inverse transform predictions
    predictions_scaled_array = np.array(future_predictions_scaled).reshape(-1, 1)
    final_predictions = scaler.inverse_transform(predictions_scaled_array)

    # Create forecast dataframe
    forecast_start_date = pd.to_datetime(TRAIN_END_DATE) + pd.Timedelta(days=1)
    forecast_dates = pd.date_range(start=forecast_start_date, periods=FORECAST_DAYS, freq='D')
    forecast_df = pd.DataFrame({'Date': forecast_dates, 'TF_Keras_Forecast': final_predictions.flatten().round(2)})
    forecast_df.set_index('Date', inplace=True)

    # Generate ground truth for comparison
    april_actual = generate_ground_truth(forecast_start_date.strftime('%Y-%m-%d'), forecast_dates[-1].strftime('%Y-%m-%d'))

    # Combine actual and forecast
    comparison_df = april_actual.join(forecast_df)

    # Save results
    output_filename = f"tf_keras_forecast_vs_actual_{FORECAST_DAYS}d.csv"
    output_path = os.path.join(RESULTS_DIR, output_filename)
    comparison_df.to_csv(output_path, sep=';')
    print(f"Comparison results saved to {output_path}")

    # --- Plotting ---
    print("Generating plots...")
    try:
        # Plot training loss
        plt.figure(figsize=(10, 5))
        plt.plot(history.history['loss'], label='Training Loss')
        plt.title('LSTM Model Training Loss')
        plt.xlabel('Epoch')
        plt.ylabel('Loss (MSE)')
        plt.legend()
        plot1_path = os.path.join(FIGURES_DIR, "tf_keras_training_loss.png")
        plt.savefig(plot1_path)
        plt.close()
        print(f"Training loss plot saved to {plot1_path}")


        # Plot actual vs forecast for April
        plt.figure(figsize=(12, 6))
        plt.plot(comparison_df.index, comparison_df['Actual'], label='Actual (Generated)', color='black', linewidth=2)
        plt.plot(comparison_df.index, comparison_df['TF_Keras_Forecast'], label='TF/Keras Forecast', color='red', linestyle=':')
        plt.title(f'TF/Keras LSTM Forecast vs Actual for April {forecast_start_date.year}')
        plt.xlabel('Date')
        plt.ylabel('Value')
        plt.legend()
        plt.grid(True)
        plot2_path = os.path.join(FIGURES_DIR, "tf_keras_april_comparison.png")
        plt.savefig(plot2_path)
        plt.close()
        print(f"April comparison plot saved to {plot2_path}")

    except Exception as e:
        print(f"An error occurred during plotting: {e}")

    print("--- TensorFlow/Keras script finished ---")