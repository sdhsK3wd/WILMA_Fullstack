# src/darts_models.py
import pandas as pd
from darts import TimeSeries
from darts.models import NBEATSModel, ExponentialSmoothing, ARIMA # Beispielmodelle
# from darts.models import TFTModel # Weitere Beispiele
from darts.utils.timeseries_generation import datetime_attribute_timeseries # Für Datumsattribute als Kovariaten

from src import config

def forecast_with_darts_model(
    history_df: pd.DataFrame, 
    periods: int, 
    model_name: str = "nbeats",
    past_covariates_df: pd.DataFrame = None,
    future_covariates_df: pd.DataFrame = None
):
    """
    Erstellt eine Prognose mit einem ausgewählten Darts-Modell.

    Args:
        history_df (pd.DataFrame): DataFrame mit Spalten 'ds' (datetime, timezone-naive) und 'y' (numerisch).
        periods (int): Anzahl der zu prognostizierenden Perioden.
        model_name (str): Name des zu verwendenden Darts-Modells (z.B. "nbeats", "ets", "arima").
        past_covariates_df (pd.DataFrame, optional): DataFrame mit vergangenen Kovariaten.
                                                     Muss 'ds' und die Kovariaten-Spalten enthalten.
                                                     Muss die gleiche Länge und Frequenz wie history_df haben.
        future_covariates_df (pd.DataFrame, optional): DataFrame mit zukünftigen Kovariaten.
                                                       Muss 'ds' und die Kovariaten-Spalten enthalten.
                                                       Muss die Prognoseperiode abdecken.

    Returns:
        pd.DataFrame: DataFrame mit Prognose ('ds', 'yhat').
    """
    print(f"INFO (darts_models.py): Starte Darts Forecast für {periods} Perioden mit Modell: {model_name}")

    if history_df.empty or len(history_df) < 2:
        raise ValueError(f"Darts ({model_name}): Nicht genügend Trainingsdaten ({len(history_df)} Zeilen).")
    if 'ds' not in history_df.columns or 'y' not in history_df.columns:
        raise ValueError("Darts: Trainings-DataFrame muss Spalten 'ds' und 'y' enthalten.")
    if history_df['ds'].dt.tz is not None: # Darts erwartet oft timezone-naive Daten für interne Konvertierung
        history_df = history_df.copy()
        history_df['ds'] = history_df['ds'].dt.tz_localize(None)

    # Konvertiere Hauptzeitreihe
    try:
        # Frequenz 'D' für tägliche Daten annehmen. Dies sollte aus den Daten oder der Konfiguration stammen.
        series = TimeSeries.from_dataframe(history_df, time_col='ds', value_cols=['y'], freq='D', fill_missing_dates=True, ffill=True)
    except Exception as e:
        raise ValueError(f"Darts: Fehler bei Konvertierung der Hauptzeitreihe zu TimeSeries: {e}. Sicherstellen, dass 'ds' sortiert ist, eine klare Frequenz hat und keine Duplikate.")

    # Konvertiere vergangene Kovariaten, falls vorhanden
    past_covariates_ts = None
    if past_covariates_df is not None and not past_covariates_df.empty:
        if 'ds' not in past_covariates_df.columns:
            raise ValueError("Darts: past_covariates_df muss eine 'ds'-Spalte enthalten.")
        if past_covariates_df['ds'].dt.tz is not None:
            past_covariates_df = past_covariates_df.copy()
            past_covariates_df['ds'] = past_covariates_df['ds'].dt.tz_localize(None)
        
        # Sicherstellen, dass past_covariates_df die gleichen Datenpunkte wie history_df hat
        # Ein Outer Join kann hier helfen, um Lücken zu identifizieren
        merged_history_past_cov = pd.merge(history_df[['ds']], past_covariates_df, on='ds', how='left')
        if merged_history_past_cov.isnull().values.any():
            # Fülle NaNs in Kovariaten (z.B. durch ffill/bfill oder 0, je nach Kontext)
            # Hier eine einfache ffill/bfill Strategie
            print("WARNUNG (darts_models.py): NaNs in past_covariates_df nach Merge mit History. Fülle mit ffill/bfill.")
            for col in merged_history_past_cov.columns:
                if col != 'ds':
                    merged_history_past_cov[col] = merged_history_past_cov[col].fillna(method='ffill').fillna(method='bfill').fillna(0)
        
        value_cols_past_cov = [col for col in merged_history_past_cov.columns if col != 'ds']
        if not value_cols_past_cov:
             raise ValueError("Darts: past_covariates_df enthält keine Wertespalten außer 'ds'.")

        try:
            past_covariates_ts = TimeSeries.from_dataframe(merged_history_past_cov, time_col='ds', value_cols=value_cols_past_cov, freq='D', fill_missing_dates=True, ffill=True)
            print(f"INFO (darts_models.py): Past covariates TimeSeries erstellt mit Spalten: {value_cols_past_cov}")
        except Exception as e:
            raise ValueError(f"Darts: Fehler bei Konvertierung von past_covariates_df zu TimeSeries: {e}")


    # Konvertiere zukünftige Kovariaten, falls vorhanden
    future_covariates_ts = None
    if future_covariates_df is not None and not future_covariates_df.empty:
        if 'ds' not in future_covariates_df.columns:
            raise ValueError("Darts: future_covariates_df muss eine 'ds'-Spalte enthalten.")
        if future_covariates_df['ds'].dt.tz is not None:
            future_covariates_df = future_covariates_df.copy()
            future_covariates_df['ds'] = future_covariates_df['ds'].dt.tz_localize(None)

        # Sicherstellen, dass future_covariates_df die Prognoseperiode abdeckt
        # Erstelle einen Zeitbereich für die Prognose
        forecast_start_date = series.end_time() + series.freq
        expected_future_dates = pd.date_range(start=forecast_start_date, periods=periods, freq=series.freq)
        
        # Merge mit erwarteten Daten, um sicherzustellen, dass alle Tage abgedeckt sind
        expected_future_df = pd.DataFrame({'ds': expected_future_dates})
        merged_future_cov = pd.merge(expected_future_df, future_covariates_df, on='ds', how='left')

        if merged_future_cov.isnull().values.any():
            print("WARNUNG (darts_models.py): NaNs in future_covariates_df für die Prognoseperiode. Fülle mit ffill/bfill.")
            for col in merged_future_cov.columns:
                 if col != 'ds':
                    merged_future_cov[col] = merged_future_cov[col].fillna(method='ffill').fillna(method='bfill').fillna(0)

        value_cols_future_cov = [col for col in merged_future_cov.columns if col != 'ds']
        if not value_cols_future_cov:
             raise ValueError("Darts: future_covariates_df enthält keine Wertespalten außer 'ds'.")
        try:
            future_covariates_ts = TimeSeries.from_dataframe(merged_future_cov, time_col='ds', value_cols=value_cols_future_cov, freq='D', fill_missing_dates=True, ffill=True)
            print(f"INFO (darts_models.py): Future covariates TimeSeries erstellt mit Spalten: {value_cols_future_cov}")
        except Exception as e:
            raise ValueError(f"Darts: Fehler bei Konvertierung von future_covariates_df zu TimeSeries: {e}")
            
    # Modellauswahl und Initialisierung
    if model_name.lower() == "nbeats":
        model = NBEATSModel(
            input_chunk_length=config.DARTS_NBEATS_INPUT_CHUNK_LENGTH,
            output_chunk_length=config.DARTS_NBEATS_OUTPUT_CHUNK_LENGTH,
            n_epochs=config.DARTS_NBEATS_N_EPOCHS,
            generic_architecture=True,
            random_state=42,
            # Optional: GPU-Nutzung, falls PyTorch Lightning konfiguriert ist
            # pl_trainer_kwargs={"accelerator": "gpu", "devices": 1} if torch.cuda.is_available() else None
        )
    elif model_name.lower() == "ets":
        model = ExponentialSmoothing()
    elif model_name.lower() == "arima":
        model = ARIMA() # Darts versucht, p,d,q automatisch zu finden, oder sie können hier gesetzt werden
    # Beispiel für ein Modell, das Kovariaten unterstützt:
    # elif model_name.lower() == "tft":
    #     model = TFTModel(
    #         input_chunk_length=config.DARTS_NBEATS_INPUT_CHUNK_LENGTH, # Beispiel
    #         output_chunk_length=config.DARTS_NBEATS_OUTPUT_CHUNK_LENGTH, # Beispiel
    #         hidden_size=32, # Beispiel
    #         lstm_layers=2,  # Beispiel
    #         num_attention_heads=4, # Beispiel
    #         n_epochs=config.DARTS_NBEATS_N_EPOCHS, # Beispiel
    #         add_relative_index=True, # Wichtig für TFT
    #         random_state=42
    #     )
    else:
        raise ValueError(f"Darts: Unbekanntes Modell '{model_name}'. Verfügbar: 'nbeats', 'ets', 'arima'.")

    print(f"INFO (darts_models.py): Training Darts Modell ({model_name})...")
    
    # Fit-Argumente basierend auf verfügbaren Kovariaten zusammenstellen
    fit_kwargs = {}
    if past_covariates_ts is not None and model.supports_past_covariates:
        fit_kwargs['past_covariates'] = past_covariates_ts
    if future_covariates_ts is not None and model.supports_future_covariates and model_name.lower() != "nbeats": # NBEATS unterstützt future_covariates nicht direkt im fit, sondern im predict
        # Für Modelle wie TFT, die future_covariates schon beim Training erwarten (für die Trainingsperiode)
        # müssen wir future_covariates für die Trainingsperiode bereitstellen.
        # Hier nehmen wir an, dass future_covariates_df die gesamte Periode (Training + Forecast) abdeckt
        # und schneiden es für das Training zu.
        # Dies ist eine Vereinfachung. Im Idealfall werden Trainings-Future-Covariates separat vorbereitet.
        
        # Erstelle Future Covariates für die Trainingsperiode, falls das Modell sie benötigt
        # Annahme: future_covariates_df wurde für Training + Forecast Periode übergeben.
        # Wir filtern es hier für die Trainingsperiode.
        if future_covariates_df is not None and not future_covariates_df.empty:
            # Nur die Wertespalten nehmen
            val_cols_fut_cov = [c for c in future_covariates_df.columns if c != 'ds']
            if val_cols_fut_cov:
                # Erstelle eine TimeSeries für future_covariates, die die historische Periode der `series` abdeckt
                # Dies ist notwendig, wenn das Modell future_covariates während des Trainings erwartet.
                historical_future_cov_ts = TimeSeries.from_dataframe(
                    future_covariates_df, # Annahme: deckt auch History ab
                    time_col='ds',
                    value_cols=val_cols_fut_cov,
                    freq=series.freq_str,
                    fill_missing_dates=True, ffill=True)
                
                # Schneide auf die Länge der Trainingsserie zu
                historical_future_cov_ts = historical_future_cov_ts.slice_intersect(series)
                
                if len(historical_future_cov_ts) == len(series):
                     fit_kwargs['future_covariates'] = historical_future_cov_ts
                else:
                    print(f"WARNUNG (darts_models.py): Konnte future_covariates für die Trainingsperiode nicht exakt anpassen. Längen: series={len(series)}, hist_fut_cov={len(historical_future_cov_ts)}")


    model.fit(series, **fit_kwargs)
    print(f"INFO (darts_models.py): Training abgeschlossen.")

    print(f"INFO (darts_models.py): Generiere Prognose für {periods} Perioden...")
    # Predict-Argumente
    predict_kwargs = {}
    if future_covariates_ts is not None and model.supports_future_covariates:
        # Stelle sicher, dass future_covariates_ts die korrekte Länge für die Vorhersage hat
        # Darts erwartet, dass future_covariates hier für die Vorhersageperiode `n` übergeben werden.
        # future_covariates_ts wurde oben bereits für `periods` erstellt.
         predict_kwargs['future_covariates'] = future_covariates_ts
    
    # Bei NBEATS und einigen anderen Modellen, die keine Future Covariates im `fit` aber im `predict` nehmen können
    if model_name.lower() == "nbeats" and past_covariates_ts is not None and model.supports_past_covariates:
        # NBEATS kann past_covariates auch für die Vorhersage verwenden, wenn sie bekannt sind (was selten der Fall ist)
        # Normalerweise werden past_covariates nur für das Training verwendet.
        # Wenn man sie für die Vorhersage übergibt, müssen sie die Länge der input_chunk_length + n haben.
        # Hier lassen wir es für NBEATS im predict weg, da es unüblich ist, zukünftige *past_covariates* zu haben.
        pass

    forecast_darts = model.predict(n=periods, **predict_kwargs)
    print(f"INFO (darts_models.py): Prognose abgeschlossen.")

    forecast_df = forecast_darts.pd_dataframe()
    forecast_df.reset_index(inplace=True)
    
    # Spalten umbenennen, um konsistent zu sein ('ds', 'yhat')
    # Darts nennt die Zeitspalte oft 'time' oder den Namen der Indexspalte des ursprünglichen DataFrames
    original_time_col_name = forecast_df.columns[0] # Annahme: Erste Spalte ist die Zeit
    # Die Wertespalte hat oft den Namen der ursprünglichen Wertespalte (hier 'y' oder bei NBEATS ggf. spezifischer)
    # Finde die erste Spalte, die nicht die Zeitspalte ist, als yhat
    potential_yhat_cols = [col for col in forecast_df.columns if col != original_time_col_name]
    if not potential_yhat_cols:
        raise ValueError("Darts: Prognose-DataFrame enthält keine Wertespalte.")
    yhat_col_name = potential_yhat_cols[0] # Nimm die erste gefundene Wertespalte

    forecast_df.rename(columns={original_time_col_name: 'ds', yhat_col_name: 'yhat'}, inplace=True)

    return forecast_df[['ds', 'yhat']]


if __name__ == '__main__':
    print("--- Testing darts_models.py ---")
    periods_to_forecast = 30

    # Erstelle Beispieldaten
    dates_hist = pd.date_range(start="2023-01-01", periods=100, freq="D")
    values_hist = np.random.rand(100) * 50 + np.arange(100) * 0.5
    history_test_df = pd.DataFrame({'ds': dates_hist, 'y': values_hist})

    # Beispiel für Kovariaten
    past_cov_values = np.random.rand(100) * 10
    past_cov_test_df = pd.DataFrame({'ds': dates_hist, 'temp_past': past_cov_values, 'event_past': (np.arange(100) % 7 == 0).astype(int)})

    future_start_date = dates_hist.max() + pd.Timedelta(days=1)
    dates_future = pd.date_range(start=future_start_date, periods=periods_to_forecast, freq="D")
    # Erstelle Future Covariates für die gesamte Periode (History + Forecast) für Modelle, die sie im Training brauchen
    all_dates_for_future_cov = pd.date_range(start=dates_hist.min(), periods=100 + periods_to_forecast, freq="D")

    future_cov_test_df_full = pd.DataFrame({'ds': all_dates_for_future_cov})
    # Beispiel: Datumsattribute als zukünftige Kovariaten
    # Wichtig: Darts `datetime_attribute_timeseries` erwartet eine TimeSeries oder einen DatetimeIndex
    # Erstelle sie hier manuell für das DataFrame
    future_cov_test_df_full['month_sin'] = np.sin(2 * np.pi * future_cov_test_df_full['ds'].dt.month / 12)
    future_cov_test_df_full['month_cos'] = np.cos(2 * np.pi * future_cov_test_df_full['ds'].dt.month / 12)
    
    # Schneide für die reine Vorhersageperiode zu (wird intern in der Funktion gemacht)
    future_cov_test_df_forecast_period = future_cov_test_df_full[future_cov_test_df_full['ds'] >= future_start_date].copy()


    models_to_test = ["nbeats", "ets", "arima"]
    for model_name_test in models_to_test:
        print(f"\n--- Testing Darts Model: {model_name_test} ---")
        try:
            # Test ohne Kovariaten
            print("Testing without covariates...")
            fc_no_cov = forecast_with_darts_model(history_test_df.copy(), periods_to_forecast, model_name_test)
            print(f"{model_name_test} forecast (no covariates) head:\n{fc_no_cov.head()}")
            assert not fc_no_cov.empty
            assert 'yhat' in fc_no_cov.columns

            # Test mit Kovariaten (wenn das Modell sie unterstützt)
            # Diese Logik ist vereinfacht; nicht alle Modelle hier unterstützen alle Kovariatentypen gleich
            print("Testing with covariates (if supported by model)...")
            # Für ARIMA/ETS sind past_covariates als `exog` möglich, future_covariates nicht direkt im selben Sinn wie bei NNs.
            # NBEATS in Darts unterstützt `past_covariates` im `fit` und `predict`.
            if model_name_test == "nbeats": # NBEATS kann past_covariates
                 fc_with_cov = forecast_with_darts_model(
                     history_test_df.copy(), periods_to_forecast, model_name_test,
                     past_covariates_df=past_cov_test_df.copy(),
                     future_covariates_df=future_cov_test_df_forecast_period.copy() # NBEATS kann future_covariates im predict bekommen
                 )
                 print(f"{model_name_test} forecast (with covariates) head:\n{fc_with_cov.head()}")
                 assert not fc_with_cov.empty
            elif model_name_test == "arima": # ARIMA kann `exog` (past_covariates)
                 fc_with_cov = forecast_with_darts_model(
                     history_test_df.copy(), periods_to_forecast, model_name_test,
                     past_covariates_df=past_cov_test_df.copy()
                     # future_covariates für ARIMA müssen als Teil der exogenen Variablen für die Zukunft übergeben werden.
                 )
                 print(f"{model_name_test} forecast (with past_covariates) head:\n{fc_with_cov.head()}")
                 assert not fc_with_cov.empty
            else: # ETS unterstützt Kovariaten nicht in der Standardimplementierung von Darts
                print(f"Skipping covariate test for {model_name_test} as it might not support them or require specific setup.")


        except Exception as e:
            print(f"Error testing {model_name_test}: {e}")
            import traceback
            traceback.print_exc()
    print("\n--- darts_models.py testing finished ---")