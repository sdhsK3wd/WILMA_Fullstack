import pandas as pd
import numpy as np
import os
import datetime
from prophet import Prophet
import matplotlib.pyplot as plt

# --- Configuration ---
INPUT_FILENAME = "data/synthetic/synthetic_data_predictable_3y.csv"
TRAIN_END_DATE = "2025-03-31"
FORECAST_DAYS = 30
RESULTS_DIR = "results"
FIGURES_DIR = os.path.join(RESULTS_DIR, "figures")

# Parameters from the generation script (needed to generate ground truth)
MIN_VALUE = 50
MAX_VALUE = 1000
BASE_LEVEL = 450
TREND_SLOPE = 0.05
YEARLY_AMP = 200
WEEKLY_AMP = 100

# --- Helper to generate ground truth ---
def generate_ground_truth(start_date_str, end_date_str):
    """Generates ground truth data for comparison, WITHOUT noise."""
    start_date = pd.to_datetime(start_date_str)
    end_date = pd.to_datetime(end_date_str)
    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    num_days = len(dates)
    
    original_start_date = pd.to_datetime("2022-03-31")  # Start date of the 3y file
    days_elapsed = (dates - original_start_date).days

    day_of_year = dates.dayofyear
    day_of_week = dates.dayofweek

    trend = TREND_SLOPE * days_elapsed
    yearly = YEARLY_AMP * np.cos(2 * np.pi * (day_of_year - 180) / 365.25)
    weekly = WEEKLY_AMP * np.cos(2 * np.pi * (day_of_week - 2.5) / 7)

    true_values = BASE_LEVEL + trend + yearly + weekly
    true_values = np.clip(true_values, MIN_VALUE, MAX_VALUE)

    df_true = pd.DataFrame({'Date': dates, 'Actual': true_values})
    df_true['Actual'] = df_true['Actual'].round(2)
    df_true.set_index('Date', inplace=True)
    
    return df_true

# --- Funktion für FastAPI Integration ---
def forecast_with_prophet(input_df):
    """Nimmt ein DataFrame mit Spalten 'Date' und 'Value' und macht eine 30-Tage-Vorhersage"""
    df_prophet = input_df[['Date', 'Value']].rename(columns={'Date': 'ds', 'Value': 'y'})

    df_train = df_prophet[df_prophet['ds'] <= TRAIN_END_DATE]

    if df_train.empty:
        raise ValueError("Keine Trainingsdaten vor dem Enddatum gefunden.")

    model = Prophet(daily_seasonality=False)
    model.fit(df_train)

    future_df = model.make_future_dataframe(periods=FORECAST_DAYS, freq='D')

    forecast_df = model.predict(future_df)

    forecast_result = forecast_df[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(FORECAST_DAYS)

    return forecast_result

# --- Haupt-Skript ---
if __name__ == "__main__":
    print("--- Running Prophet Forecasting ---")
    os.makedirs(RESULTS_DIR, exist_ok=True)
    os.makedirs(FIGURES_DIR, exist_ok=True)

    try:
        df = pd.read_csv(INPUT_FILENAME, sep=';', parse_dates=['Date'])
        print(f"Loaded data shape: {df.shape}")
    except FileNotFoundError:
        print(f"Error: Input file not found at {INPUT_FILENAME}")
        exit()

    df_prophet = df[['Date', 'Value']].rename(columns={'Date': 'ds', 'Value': 'y'})
    df_train = df_prophet[df_prophet['ds'] <= TRAIN_END_DATE]
    print(f"Training data shape: {df_train.shape}")

    if df_train.empty:
        print("Error: No training data found before or on the end date.")
        exit()

    model = Prophet(daily_seasonality=False)
    print("Fitting Prophet model...")
    model.fit(df_train)
    print("Fitting complete.")

    future_df = model.make_future_dataframe(periods=FORECAST_DAYS, freq='D')

    print("Generating forecast...")
    forecast_df = model.predict(future_df)
    print("Forecast complete.")

    forecast_start_date = pd.to_datetime(TRAIN_END_DATE) + pd.Timedelta(days=1)
    forecast_end_date = forecast_start_date + pd.Timedelta(days=FORECAST_DAYS - 1)
    april_forecast = forecast_df[
        (forecast_df['ds'] >= forecast_start_date) &
        (forecast_df['ds'] <= forecast_end_date)
    ][['ds', 'yhat', 'yhat_lower', 'yhat_upper']]
    april_forecast.rename(columns={'yhat': 'Prophet_Forecast'}, inplace=True)

    april_actual = generate_ground_truth(forecast_start_date.strftime('%Y-%m-%d'), forecast_end_date.strftime('%Y-%m-%d'))

    comparison_df = april_actual.join(april_forecast.set_index('ds'))

    output_filename = f"prophet_forecast_vs_actual_{FORECAST_DAYS}d.csv"
    output_path = os.path.join(RESULTS_DIR, output_filename)
    comparison_df.to_csv(output_path, sep=';')
    print(f"Comparison results saved to {output_path}")

    print("Generating plots...")
    try:
        fig1 = model.plot(forecast_df)
        plt.title("Prophet Forecast (History + Future)")
        plot1_path = os.path.join(FIGURES_DIR, "prophet_full_forecast.png")
        plt.savefig(plot1_path)
        plt.close(fig1)
        print(f"Full forecast plot saved to {plot1_path}")

        fig2 = model.plot_components(forecast_df)
        plt.suptitle("Prophet Components")
        plot2_path = os.path.join(FIGURES_DIR, "prophet_components.png")
        plt.savefig(plot2_path)
        plt.close(fig2)
        print(f"Components plot saved to {plot2_path}")

        plt.figure(figsize=(12, 6))
        plt.plot(comparison_df.index, comparison_df['Actual'], label='Actual (Generated)', color='red', linewidth=2)
        plt.plot(comparison_df.index, comparison_df['Prophet_Forecast'], label='Prophet Forecast', color='blue', linestyle='--')
        plt.title(f'Prophet Forecast vs Actual for April {forecast_start_date.year}')
        plt.xlabel('Date')
        plt.ylabel('Value')
        plt.legend()
        plt.grid(True)
        plot3_path = os.path.join(FIGURES_DIR, "prophet_april_comparison.png")
        plt.savefig(plot3_path)
        plt.close()
        print(f"April comparison plot saved to {plot3_path}")

    except Exception as e:
        print(f"An error occurred during plotting: {e}")

    print("--- Prophet script finished ---")
