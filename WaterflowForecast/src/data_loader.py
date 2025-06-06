# src/data_loader.py
import pandas as pd
import os
import glob
import numpy as np
from typing import Tuple, List # Für Typ-Annotationen
from src import config

def add_features(df: pd.DataFrame, target_column: str, include_lag_rolling: bool = True):
    df_out = df.copy()
    created_base_features = []
    created_date_features = []

    if config.CREATE_DATE_FEATURES:
        if not isinstance(df_out.index, pd.DatetimeIndex):
            if config.DATE_COLUMN in df_out.columns and pd.api.types.is_datetime64_any_dtype(df_out[config.DATE_COLUMN]):
                df_out = df_out.set_index(pd.to_datetime(df_out[config.DATE_COLUMN]))
                if config.DATE_COLUMN in df_out.columns and (df_out.index.name == config.DATE_COLUMN or df_out.index.name != config.DATE_COLUMN) :
                     df_out = df_out.drop(columns=[config.DATE_COLUMN])
            else:
                try:
                    df_out.index = pd.to_datetime(df_out.index)
                except Exception as e:
                    raise ValueError(
                        f"data_loader.py: DataFrame-Index ist kein DatetimeIndex und konnte nicht konvertiert werden, "
                        f"oder eine als '{config.DATE_COLUMN}' benannte Spalte fehlt oder ist kein Datumsformat. Fehler: {e}"
                    )
        
        df_out['date_dayofweek'] = df_out.index.dayofweek
        df_out['date_dayofyear_sin'] = np.sin(2 * np.pi * df_out.index.dayofyear / 365.25)
        df_out['date_dayofyear_cos'] = np.cos(2 * np.pi * df_out.index.dayofyear / 365.25)
        df_out['date_month_sin'] = np.sin(2 * np.pi * df_out.index.month / 12)
        df_out['date_month_cos'] = np.cos(2 * np.pi * df_out.index.month / 12)
        if hasattr(df_out.index.isocalendar(), 'week'):
            df_out['date_weekofyear'] = df_out.index.isocalendar().week.astype(float)
        else:
            df_out['date_weekofyear'] = df_out.index.weekofyear.astype(float)
        
        created_date_features.extend(['date_dayofweek', 'date_dayofyear_sin', 'date_dayofyear_cos', 'date_month_sin', 'date_month_cos', 'date_weekofyear'])

    if include_lag_rolling:
        if target_column not in df_out.columns:
            if config.CREATE_LAG_FEATURES or config.CREATE_ROLLING_FEATURES:
                print(f"WARN (data_loader.py): Zielspalte '{target_column}' nicht im DataFrame vorhanden. Überspringe Lag/Rolling-Features.")
        else:
            if config.CREATE_LAG_FEATURES:
                for lag in config.LAG_VALUES:
                    df_out[f'{target_column}_lag_{lag}'] = df_out[target_column].shift(lag)
                    created_base_features.append(f'{target_column}_lag_{lag}')
            
            if config.CREATE_ROLLING_FEATURES:
                shifted_target = df_out[target_column].shift(1)
                for window in config.ROLLING_WINDOWS:
                    df_out[f'{target_column}_roll_mean_{window}'] = shifted_target.rolling(window=window, min_periods=1).mean()
                    df_out[f'{target_column}_roll_std_{window}'] = shifted_target.rolling(window=window, min_periods=1).std()
                    created_base_features.extend([f'{target_column}_roll_mean_{window}', f'{target_column}_roll_std_{window}'])
    
    all_newly_created_features = created_base_features + created_date_features
    if all_newly_created_features:
        features_to_fill = [name for name in all_newly_created_features if name in df_out.columns]
        if features_to_fill:
            df_out[features_to_fill] = df_out[features_to_fill].ffill().bfill().fillna(0)

    all_potential_feature_names = []
    if config.CREATE_DATE_FEATURES:
        all_potential_feature_names.extend(created_date_features) # Nur die tatsächlich erstellten
    if config.CREATE_LAG_FEATURES and include_lag_rolling:
        all_potential_feature_names.extend([f'{target_column}_lag_{lag}' for lag in config.LAG_VALUES if f'{target_column}_lag_{lag}' in df_out.columns])
    if config.CREATE_ROLLING_FEATURES and include_lag_rolling:
        all_potential_feature_names.extend([f'{target_column}_roll_mean_{window}' for window in config.ROLLING_WINDOWS if f'{target_column}_roll_mean_{window}' in df_out.columns])
        all_potential_feature_names.extend([f'{target_column}_roll_std_{window}' for window in config.ROLLING_WINDOWS if f'{target_column}_roll_std_{window}' in df_out.columns])
    
    all_potential_feature_names = sorted(list(set(all_potential_feature_names)))
    return df_out, all_potential_feature_names, created_date_features


def identify_anomalies_iqr(df: pd.DataFrame, value_column_name: str, iqr_factor: float = 1.5) -> Tuple[pd.DataFrame, int]:
    df_with_anomalies = df.copy()
    df_with_anomalies['is_anomaly'] = False

    if df.empty or value_column_name not in df.columns:
        print(f"WARN (data_loader.py - identify_anomalies_iqr): DataFrame empty or column '{value_column_name}' not found.")
        return df_with_anomalies, 0

    if not pd.api.types.is_numeric_dtype(df[value_column_name]):
        print(f"WARN (data_loader.py - identify_anomalies_iqr): Column '{value_column_name}' not numeric. Skipping anomaly detection.")
        return df_with_anomalies, 0

    series_for_iqr = df[value_column_name].dropna()
    if len(series_for_iqr) < 2:
        print(f"WARN (data_loader.py - identify_anomalies_iqr): Not enough non-NaN data points ({len(series_for_iqr)}) in '{value_column_name}' for IQR.")
        return df_with_anomalies, 0

    Q1 = series_for_iqr.quantile(0.25)
    Q3 = series_for_iqr.quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - (iqr_factor * IQR)
    upper_bound = Q3 + (iqr_factor * IQR)
    
    if IQR == 0:
        print(f"INFO (data_loader.py - identify_anomalies_iqr): IQR is 0 for '{value_column_name}'. Bounds: [{lower_bound}, {upper_bound}].")

    condition_not_nan = df_with_anomalies[value_column_name].notna()
    anomalies_condition = (df_with_anomalies[value_column_name] < lower_bound) | (df_with_anomalies[value_column_name] > upper_bound)
    
    df_with_anomalies.loc[condition_not_nan & anomalies_condition, 'is_anomaly'] = True
    num_anomalies_identified = df_with_anomalies['is_anomaly'].sum()
    
    if num_anomalies_identified > 0:
        print(f"INFO (data_loader.py - identify_anomalies_iqr): {num_anomalies_identified} anomalies in '{value_column_name}' identified by IQR. Bounds: [{lower_bound:.2f}, {upper_bound:.2f}], Q1={Q1:.2f}, Q3={Q3:.2f}, IQR={IQR:.2f}")
    else:
        print(f"INFO (data_loader.py - identify_anomalies_iqr): No anomalies in '{value_column_name}' identified by IQR. Bounds: [{lower_bound:.2f}, {upper_bound:.2f}], Q1={Q1:.2f}, Q3={Q3:.2f}, IQR={IQR:.2f}")
        
    return df_with_anomalies, num_anomalies_identified

def clean_actual_data_interpolate(df_actuals: pd.DataFrame, value_col_name: str = 'actual') -> Tuple[pd.DataFrame, List[Tuple[str, float]], int]:
    if value_col_name not in df_actuals.columns:
        print(f"WARN (data_loader.py - clean_actual_data_interpolate): Value column '{value_col_name}' not found in DataFrame.")
        return df_actuals, [], 0
    if 'date' not in df_actuals.columns:
        raise ValueError("DataFrame für die Bereinigung muss eine 'date'-Spalte mit ISO-Strings enthalten.")

    cleaned_df = df_actuals.copy()
    
    # Konvertiere Wertespalte zu numerisch, falls sie es nicht ist (z.B. object wegen gemischten Typen oder None)
    # errors='coerce' wandelt nicht-numerische Werte in NaN um, die dann interpoliert werden können
    if not pd.api.types.is_numeric_dtype(cleaned_df[value_col_name]):
        cleaned_df[value_col_name] = pd.to_numeric(cleaned_df[value_col_name], errors='coerce')

    nan_indices_before = cleaned_df[cleaned_df[value_col_name].isnull()].index
    
    # Führe lineare Interpolation durch.
    # Pandas interpolate behandelt bereits den Fall, dass der erste/letzte Wert NaN ist (bleibt dann NaN, wenn limit_direction nicht 'both' ist)
    # oder füllt, wenn limit_direction='both' und Nachbarn existieren.
    cleaned_df[value_col_name] = cleaned_df[value_col_name].interpolate(method='linear', limit_direction='both')
    
    imputed_rows_details = []
    actually_imputed_count = 0
    for idx in nan_indices_before:
        if pd.notnull(cleaned_df.loc[idx, value_col_name]):
            actually_imputed_count += 1
            date_str = str(cleaned_df.loc[idx, 'date']) # Sicherstellen, dass es ein String ist
            imputed_value = float(cleaned_df.loc[idx, value_col_name]) # Sicherstellen, dass es float ist
            imputed_rows_details.append((date_str, imputed_value))
            
    if actually_imputed_count > 0:
        print(f"INFO (data_loader.py - clean_actual_data_interpolate): Linearly interpolated {actually_imputed_count} missing values in column '{value_col_name}'.")
    else:
        print(f"INFO (data_loader.py - clean_actual_data_interpolate): No missing values found or could be interpolated in column '{value_col_name}'.")
        
    return cleaned_df, imputed_rows_details, actually_imputed_count