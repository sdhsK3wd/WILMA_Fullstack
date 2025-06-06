# src/prophet_model.py
import pandas as pd
import numpy as np
import os
import sys
import traceback
from prophet import Prophet
from src import config
from typing import Tuple, Dict, Any # Für Typ-Annotationen

# Placeholder for holidays DataFrame (wie in der vorherigen Antwort)
holidays_df = None


def forecast_with_prophet(history_df: pd.DataFrame, periods: int, extra_regressors_df: pd.DataFrame = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    print(f"INFO (prophet_model): Starting Prophet Forecast for {periods} periods.")

    if history_df.empty:
        raise ValueError("Prophet: Empty DataFrame provided for training data.")
    required_cols = ['ds', 'y']
    for col in required_cols:
        if col not in history_df.columns:
            raise ValueError(f"Prophet: Training DataFrame must contain column '{col}'.")

    if not pd.api.types.is_datetime64_any_dtype(history_df['ds']):
         history_df['ds'] = pd.to_datetime(history_df['ds'], errors='coerce')
         if history_df['ds'].isnull().any():
             raise ValueError("Prophet: Could not reliably convert 'ds' column to datetime.")

    history_df_prophet = history_df.copy()
    if history_df_prophet['ds'].dt.tz is not None:
        print("INFO (prophet_model): Removing timezone from 'ds' for Prophet.")
        history_df_prophet['ds'] = history_df_prophet['ds'].dt.tz_localize(None)

    if not pd.api.types.is_numeric_dtype(history_df_prophet['y']):
         history_df_prophet['y'] = pd.to_numeric(history_df_prophet['y'], errors='coerce')

    if history_df_prophet['y'].isnull().any():
        print(f"WARNING (prophet_model): Column 'y' contains {history_df_prophet['y'].isnull().sum()} NaN values. Prophet will ignore these rows during training.")

    if len(history_df_prophet.dropna(subset=['y'])) < 2:
        raise ValueError(f"Prophet: Not enough valid (non-NaN) training data points ({len(history_df_prophet.dropna(subset=['y']))} rows). At least 2 are required.")

    print("INFO (prophet_model): Initializing Prophet model with parameters from config.py...")
    model = Prophet(
        changepoint_prior_scale=config.PROPHET_CHANGEPOINT_PRIOR,
        seasonality_prior_scale=config.PROPHET_SEASONALITY_PRIOR,
        daily_seasonality=config.PROPHET_DAILY_SEASONALITY,
        weekly_seasonality='auto',
        yearly_seasonality='auto',
        seasonality_mode=config.PROPHET_SEASONALITY_MODE,
        holidays=holidays_df
    )

    potential_regressors_in_history = [
        col for col in history_df_prophet.columns if col not in ['ds', 'y', 'cap', 'floor']
    ]
    actual_regressors_for_model = []
    extra_regressors_df_prepared = None

    if extra_regressors_df is not None and not extra_regressors_df.empty:
        extra_regressors_df_prepared = extra_regressors_df.copy()
        if 'ds' not in extra_regressors_df_prepared.columns and isinstance(extra_regressors_df_prepared.index, pd.DatetimeIndex):
            extra_regressors_df_prepared = extra_regressors_df_prepared.reset_index()

        if 'ds' not in extra_regressors_df_prepared.columns:
             raise ValueError("Prophet: extra_regressors_df must have a 'ds' column or a DatetimeIndex.")

        if not pd.api.types.is_datetime64_any_dtype(extra_regressors_df_prepared['ds']):
            extra_regressors_df_prepared['ds'] = pd.to_datetime(extra_regressors_df_prepared['ds'], errors='coerce')
        if extra_regressors_df_prepared['ds'].dt.tz is not None:
            extra_regressors_df_prepared['ds'] = extra_regressors_df_prepared['ds'].dt.tz_localize(None)

        for regressor_name in potential_regressors_in_history:
            if regressor_name in extra_regressors_df_prepared.columns:
                if not pd.api.types.is_numeric_dtype(history_df_prophet[regressor_name]):
                    history_df_prophet[regressor_name] = pd.to_numeric(history_df_prophet[regressor_name], errors='coerce')
                if not pd.api.types.is_numeric_dtype(extra_regressors_df_prepared[regressor_name]):
                    extra_regressors_df_prepared[regressor_name] = pd.to_numeric(extra_regressors_df_prepared[regressor_name], errors='coerce')

                history_df_prophet[regressor_name] = history_df_prophet[regressor_name].ffill().bfill().fillna(0)
                extra_regressors_df_prepared[regressor_name] = extra_regressors_df_prepared[regressor_name].ffill().bfill().fillna(0)

                try:
                    model.add_regressor(regressor_name)
                    actual_regressors_for_model.append(regressor_name)
                    print(f"INFO (prophet_model): Regressor '{regressor_name}' added.")
                except Exception as e_reg:
                    print(f"WARNING (prophet_model): Error adding regressor '{regressor_name}': {e_reg}. Skipping.")

    print("INFO (prophet_model): Fitting Prophet model...")
    try:
        # Prophet doesn't return a direct 'loss' like Keras during fit
        model.fit(history_df_prophet)
        training_loss_info = "N/A (Prophet does not expose direct training loss like Keras)"
    except Exception as fit_err:
        print(f"ERROR (prophet_model): Error during Prophet model.fit(): {fit_err}")
        traceback.print_exc()
        raise ValueError(f"Prophet model.fit() failed: {fit_err}")
    print("INFO (prophet_model): Fitting complete.")

    model_training_report = {
        "changepoint_prior_scale_used": model.changepoint_prior_scale,
        "seasonality_prior_scale_used": model.seasonality_prior_scale,
        "seasonality_mode_used": model.seasonality_mode,
        "holidays_prior_scale_used": model.holidays_prior_scale if model.holidays is not None else None,
        "detected_changepoints_count": len(model.changepoints),
        "active_seasonalities": list(model.seasonalities.keys()),
        "active_regressors": actual_regressors_for_model,
        "daily_seasonality_setting": config.PROPHET_DAILY_SEASONALITY,
        "training_loss": training_loss_info, # Placeholder
        "validation_loss": None # Not applicable for Prophet's direct fit method
    }
    if holidays_df is not None:
        model_training_report["holidays_configured_count"] = len(holidays_df)
    else:
        model_training_report["holidays_configured_count"] = 0

    print(f"INFO (prophet_model): Creating future DataFrame for {periods} periods...")
    future_df = model.make_future_dataframe(periods=periods, freq='D')

    if actual_regressors_for_model and extra_regressors_df_prepared is not None:
        columns_to_select_from_extra = ['ds'] + [
            reg for reg in actual_regressors_for_model if reg in extra_regressors_df_prepared.columns
        ]
        if len(columns_to_select_from_extra) > 1:
            future_df = pd.merge(future_df, extra_regressors_df_prepared[columns_to_select_from_extra], on='ds', how='left')
            for regressor in actual_regressors_for_model:
                if regressor in future_df.columns and future_df[regressor].isnull().any():
                    print(f"WARNING (prophet_model): Missing future values for regressor '{regressor}' after merge. Filling with ffill, bfill, then 0.")
                    future_df[regressor] = future_df[regressor].ffill().bfill().fillna(0)
                elif regressor not in future_df.columns:
                    print(f"ERROR (prophet_model): Regressor '{regressor}' added to model but not found in future_df after merge. Setting to 0 for forecast.")
                    future_df[regressor] = 0
    elif actual_regressors_for_model and extra_regressors_df_prepared is None:
         print(f"ERROR (prophet_model): Regressors {actual_regressors_for_model} were added to the model, but no extra_regressors_df_prepared was available for the future.")
         for regressor in actual_regressors_for_model:
             if regressor not in future_df.columns:
                future_df[regressor] = 0

    print("INFO (prophet_model): Generating forecast...")
    try:
        forecast_df_output = model.predict(future_df)
    except Exception as pred_err:
        print(f"ERROR (prophet_model): Error during Prophet model.predict(): {pred_err}")
        traceback.print_exc()
        raise ValueError(f"Prophet model.predict() failed: {pred_err}. Check regressors in future_df.")

    print("INFO (prophet_model): Forecast complete.")

    output_columns = ['ds', 'yhat', 'yhat_lower', 'yhat_upper', 'trend']
    final_forecast_df = forecast_df_output[[col for col in output_columns if col in forecast_df_output.columns]].copy()

    return final_forecast_df, model_training_report