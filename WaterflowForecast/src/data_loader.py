import pandas as pd
import os
import glob
import numpy as np
from src import config

def add_features(df, target_column):
    df_out = df.copy()
    base_feature_names = []
    date_feature_names = []

    if config.CREATE_LAG_FEATURES:
        for lag in config.LAG_VALUES:
            feature_name = f'{target_column}_lag_{lag}'
            df_out[feature_name] = df_out[target_column].shift(lag)
            base_feature_names.append(feature_name)

    if config.CREATE_ROLLING_FEATURES:
        for window in config.ROLLING_WINDOWS:
            shifted_series = df_out[target_column].shift(1)
            feature_name_mean = f'{target_column}_roll_mean_{window}'
            feature_name_std = f'{target_column}_roll_std_{window}'
            df_out[feature_name_mean] = shifted_series.rolling(window=window, min_periods=1).mean()
            df_out[feature_name_std] = shifted_series.rolling(window=window, min_periods=1).std()
            base_feature_names.extend([feature_name_mean, feature_name_std])

    if config.CREATE_DATE_FEATURES:
        df_out['date_dayofweek'] = df_out.index.dayofweek
        df_out['date_dayofyear'] = df_out.index.dayofyear
        df_out['date_dayofyear_sin'] = np.sin(2 * np.pi * df_out['date_dayofyear'] / 365.25)
        df_out['date_dayofyear_cos'] = np.cos(2 * np.pi * df_out['date_dayofyear'] / 365.25)
        date_feature_names.extend(['date_dayofweek', 'date_dayofyear_sin', 'date_dayofyear_cos'])
        df_out = df_out.drop(columns=['date_dayofyear'])


    all_feature_names = base_feature_names + date_feature_names
    print(f"Added features for {target_column}: {all_feature_names}")

    if all_feature_names:
        df_out[all_feature_names] = df_out[all_feature_names].bfill().ffill().fillna(0)

    return df_out, all_feature_names, date_feature_names


def load_and_preprocess_data(data_dir, file_pattern, date_column_name='ds',
                             start_date=None, end_date=None, sep=';'):

    all_files = glob.glob(os.path.join(data_dir, file_pattern))
    if not all_files:
        raise FileNotFoundError(f"No files found matching pattern '{file_pattern}' in directory '{data_dir}'")

    all_files.sort()

    df_list = []
    print(f"Found {len(all_files)} files. Loading...")
    for f in all_files:
        try:
            df_temp = pd.read_csv(f, sep=sep, parse_dates=[0], dayfirst=False)
            df_list.append(df_temp)
        except Exception as e:
            print(f"Warning: Could not read or parse {os.path.basename(f)}. Error: {e}")
            continue

    if not df_list:
         raise ValueError("No data could be loaded from the files.")

    df = pd.concat(df_list, ignore_index=True)

    original_date_col = df.columns[0]
    df.rename(columns={original_date_col: date_column_name}, inplace=True)

    df.set_index(date_column_name, inplace=True)
    df.sort_index(inplace=True)

    numeric_cols = df.select_dtypes(include=np.number).columns.tolist()

    if not numeric_cols:
        raise ValueError("No numeric columns found in the loaded data.")

    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    df = df[numeric_cols].copy()
    df = df.asfreq('D')

    df.ffill(inplace=True)
    df.bfill(inplace=True)

    df_filtered = df.copy()
    if start_date:
        df_filtered = df_filtered[df_filtered.index >= pd.to_datetime(start_date)]
    if end_date:
        df_filtered = df_filtered[df_filtered.index <= pd.to_datetime(end_date)]

    for col in df_filtered.select_dtypes(include=np.number).columns:
        if df_filtered[col].isnull().any():
            print(f"Warning: NaNs remain in column '{col}' after processing. Filling with 0.")
            df_filtered[col].fillna(0, inplace=True)

    print(f"Base data loaded successfully. Shape: {df_filtered.shape}")
    print(f"Date range: {df_filtered.index.min()} to {df_filtered.index.max()}")

    return df_filtered

if __name__ == '__main__':
    try:
        base_df = load_and_preprocess_data(
            data_dir=config.DATA_DIR,
            file_pattern=config.FILE_PATTERN,
            date_column_name=config.DATE_COLUMN,
            start_date=config.TRAIN_START_DATE,
            end_date=config.FORECAST_END_DATE,
            sep=config.DATA_SEPARATOR
        )
        print("\n--- Base DataFrame Head ---")
        print(base_df.head())

        target_test = base_df.columns[0]
        df_with_features, features, date_features = add_features(base_df, target_test)
        print(f"\n--- DataFrame with Features Head (Target: {target_test}) ---")
        print(df_with_features.head())
        print(f"\nFeatures added: {features}")

    except (FileNotFoundError, ValueError) as e:
        print(f"Error during data loading test: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")