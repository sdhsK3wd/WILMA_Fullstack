import pandas as pd
import numpy as np
import os
import datetime
from prophet import Prophet
import matplotlib.pyplot as plt

# --- Configuration (Wird teilweise nicht mehr direkt in der Funktion verwendet) ---
# INPUT_FILENAME = "data/synthetic/synthetic_data_predictable_3y.csv" # Wird nicht mehr hier gebraucht
# TRAIN_END_DATE = "2025-03-31" # Wird nicht mehr hier gebraucht
# FORECAST_DAYS = 30 # Wird jetzt als Argument übergeben
RESULTS_DIR = "results"
FIGURES_DIR = os.path.join(RESULTS_DIR, "figures")

# Parameters from the generation script (könnten für Validierung nützlich sein)
MIN_VALUE = 50
MAX_VALUE = 1000
BASE_LEVEL = 450
TREND_SLOPE = 0.05
YEARLY_AMP = 200
WEEKLY_AMP = 100

# --- Helper to generate ground truth (bleibt unverändert) ---
def generate_ground_truth(start_date_str, end_date_str):
    """Generates ground truth data for comparison, WITHOUT noise."""
    start_date = pd.to_datetime(start_date_str)
    end_date = pd.to_datetime(end_date_str)
    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    num_days = len(dates)

    original_start_date = pd.to_datetime("2022-03-31") # Start date of the 3y file
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

# --- Funktion für FastAPI Integration (KORRIGIERT) ---
# ✅ Akzeptiert jetzt 'history_df' und 'periods' als Argumente
def forecast_with_prophet(history_df, periods):
    """
    Nimmt ein DataFrame mit Spalten 'ds' (datetime) und 'y' (numeric)
    und macht eine Vorhersage für die angegebene Anzahl von 'periods' Tagen.
    Gibt ein DataFrame mit 'ds' und 'yhat' (und optional anderen Spalten) zurück.
    """
    print(f"INFO (prophet_model): Starte Prophet Forecast für {periods} Perioden.")
    print(f"INFO (prophet_model): Trainingsdaten Info:")
    history_df.info() # Zeige Info der übergebenen Daten
    print(history_df.head())
    print(history_df.tail())


    if history_df.empty:
        raise ValueError("Leeres DataFrame als Trainingsdaten übergeben.")
    if 'ds' not in history_df.columns or 'y' not in history_df.columns:
         raise ValueError("Trainings-DataFrame muss Spalten 'ds' und 'y' enthalten.")
    if not pd.api.types.is_datetime64_any_dtype(history_df['ds']):
         raise ValueError("Spalte 'ds' im Trainings-DataFrame muss vom Typ datetime sein.")
    if not pd.api.types.is_numeric_dtype(history_df['y']):
         raise ValueError("Spalte 'y' im Trainings-DataFrame muss numerisch sein.")


    # Initialisiere und trainiere das Prophet-Modell
    # Passe die Prophet-Parameter bei Bedarf an
    model = Prophet(daily_seasonality=False) # Behalte deine Einstellung bei
    print("INFO (prophet_model): Fitting model...")
    model.fit(history_df)
    print("INFO (prophet_model): Fitting complete.")

    # Erstelle das Future-DataFrame für die Vorhersage
    print(f"INFO (prophet_model): Erstelle Future DataFrame für {periods} Perioden...")
    # Wichtig: Verwende das übergebene 'periods'-Argument
    future_df = model.make_future_dataframe(periods=periods, freq='D')
    print(f"INFO (prophet_model): Future DataFrame erstellt (letztes Datum: {future_df['ds'].iloc[-1]})")


    # Generiere die Vorhersage
    print("INFO (prophet_model): Generating forecast...")
    forecast_df = model.predict(future_df)
    print("INFO (prophet_model): Forecast complete.")

    # Gib das gesamte Forecast-DataFrame zurück (main.py filtert dann nach Datum)
    # Enthält Spalten wie 'ds', 'yhat', 'yhat_lower', 'yhat_upper' etc.
    return forecast_df

# --- Haupt-Skript (bleibt für lokale Tests, wird von FastAPI nicht direkt genutzt) ---
if __name__ == "__main__":
    print("--- Running Prophet Forecasting (Local Test Script) ---")
    # Dieser Teil wird nur ausgeführt, wenn du `python src/prophet_model.py` direkt startest.
    # Er ist NICHT Teil der FastAPI-Anwendung.
    INPUT_FILENAME_LOCAL = "../data/synthetic/synthetic_data_predictable_3y.csv" # Pfad relativ zu prophet_model.py
    TRAIN_END_DATE_LOCAL = "2024-12-31" # Angepasst an unsere Logik
    FORECAST_DAYS_LOCAL = 30

    os.makedirs(RESULTS_DIR, exist_ok=True)
    os.makedirs(FIGURES_DIR, exist_ok=True)

    try:
        df = pd.read_csv(INPUT_FILENAME_LOCAL, sep=';')
        # Konvertiere Datum und benenne um für Prophet
        df['ds'] = pd.to_datetime(df['Date'])
        df = df.rename(columns={'Value': 'y'})[['ds', 'y']]
        print(f"Loaded data shape: {df.shape}")
    except FileNotFoundError:
        print(f"Error: Input file not found at {INPUT_FILENAME_LOCAL}")
        exit()

    # Filtere Trainingsdaten
    df_train = df[df['ds'] <= TRAIN_END_DATE_LOCAL]
    print(f"Training data shape: {df_train.shape}")

    if df_train.empty:
        print("Error: No training data found before or on the end date.")
        exit()

    try:
        # Rufe die Funktion mit den lokalen Daten und Tagen auf
        full_forecast_df = forecast_with_prophet(df_train, periods=FORECAST_DAYS_LOCAL)

        # --- Auswertung und Plots (wie vorher, aber mit full_forecast_df) ---
        forecast_start_date = pd.to_datetime(TRAIN_END_DATE_LOCAL) + pd.Timedelta(days=1)
        forecast_end_date = forecast_start_date + pd.Timedelta(days=FORECAST_DAYS_LOCAL - 1)

        # Filtere den relevanten Forecast-Zeitraum
        comparison_forecast = full_forecast_df[
            (full_forecast_df['ds'] >= forecast_start_date) &
            (full_forecast_df['ds'] <= forecast_end_date)
        ][['ds', 'yhat', 'yhat_lower', 'yhat_upper']] # Behalte relevante Spalten
        comparison_forecast = comparison_forecast.rename(columns={'yhat': 'Prophet_Forecast'})

        # Generiere Ground Truth für den Vergleichszeitraum
        comparison_actual = generate_ground_truth(forecast_start_date.strftime('%Y-%m-%d'), forecast_end_date.strftime('%Y-%m-%d'))

        # Verbinde Actual und Forecast für den Vergleich
        comparison_df = comparison_actual.join(comparison_forecast.set_index('ds'))

        # Speichere Vergleichs-CSV
        output_filename = f"prophet_forecast_vs_actual_{FORECAST_DAYS_LOCAL}d_LOCAL.csv"
        output_path = os.path.join(RESULTS_DIR, output_filename)
        comparison_df.to_csv(output_path, sep=';')
        print(f"Comparison results saved to {output_path}")

        # --- Plots erstellen ---
        print("Generating plots...")
        try:
            # Plot 1: Gesamter Forecast (Historie + Zukunft)
            fig1 = model.plot(full_forecast_df) # Verwende das von der Funktion zurückgegebene DataFrame
            plt.title("Prophet Forecast (History + Future)")
            plot1_path = os.path.join(FIGURES_DIR, "prophet_full_forecast_LOCAL.png")
            plt.savefig(plot1_path)
            plt.close(fig1)
            print(f"Full forecast plot saved to {plot1_path}")

            # Plot 2: Komponenten
            fig2 = model.plot_components(full_forecast_df)
            plt.suptitle("Prophet Components")
            plot2_path = os.path.join(FIGURES_DIR, "prophet_components_LOCAL.png")
            plt.savefig(plot2_path)
            plt.close(fig2)
            print(f"Components plot saved to {plot2_path}")

             # Plot 3: Vergleich Actual vs Forecast für den Forecast-Zeitraum
            plt.figure(figsize=(12, 6))
            plt.plot(comparison_df.index, comparison_df['Actual'], label='Actual (Generated)', color='red', linewidth=2)
            plt.plot(comparison_df.index, comparison_df['Prophet_Forecast'], label='Prophet Forecast', color='blue', linestyle='--')
            # Optional: Unsicherheitsintervall plotten
            # plt.fill_between(comparison_df.index, comparison_df['yhat_lower'], comparison_df['yhat_upper'], color='blue', alpha=0.2, label='Uncertainty Interval')
            plt.title(f'Prophet Forecast vs Actual for {FORECAST_DAYS_LOCAL} days starting {forecast_start_date.strftime("%Y-%m-%d")}')
            plt.xlabel('Date')
            plt.ylabel('Value')
            plt.legend()
            plt.grid(True)
            plot3_path = os.path.join(FIGURES_DIR, "prophet_comparison_LOCAL.png")
            plt.savefig(plot3_path)
            plt.close()
            print(f"Comparison plot saved to {plot3_path}")

        except Exception as e:
            print(f"An error occurred during plotting: {e}")

    except ValueError as ve:
        print(f"Error during forecasting: {ve}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        traceback.print_exc()

    print("--- Prophet local script finished ---")