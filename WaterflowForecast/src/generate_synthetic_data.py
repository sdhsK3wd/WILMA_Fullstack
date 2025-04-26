import pandas as pd
import numpy as np
import os
import datetime

# --- Configuration ---
# Shared parameters for all datasets
BASE_FILENAME = "synthetic_data_predictable" # New base name
OUTPUT_DIRECTORY = "data/synthetic" # Relative path to save the file

# Value Range Constraints
MIN_VALUE = 50 # Keep values comfortably above 0
MAX_VALUE = 1000

# Pattern Components Configuration (Strong patterns, LOW noise)
BASE_LEVEL = 450     # Start slightly higher to stay away from lower bound
TREND_SLOPE = 0.05   # Gentle positive trend per day

YEARLY_AMP = 200     # Strong yearly cycle
WEEKLY_AMP = 100     # Strong weekly cycle (e.g., lower on weekends)
NOISE_LEVEL = 5      # *** VERY LOW noise standard deviation ***

# --- End Configuration ---

def generate_predictable_data(start_date_str, end_date_str, duration_label, base_filename, output_dir):
    """Generates and saves predictable synthetic time series data."""

    print(f"\n--- Generating predictable data for '{duration_label}' ({start_date_str} to {end_date_str}) ---")
    start_date = pd.to_datetime(start_date_str)
    end_date = pd.to_datetime(end_date_str)

    # Check if calculated bounds are reasonable (adjust if needed based on final values)
    max_potential = BASE_LEVEL + TREND_SLOPE * (end_date - start_date).days + YEARLY_AMP + WEEKLY_AMP
    min_potential = BASE_LEVEL + 0 - YEARLY_AMP - WEEKLY_AMP # Approx min at start
    print(f"Approximate signal range before noise/clipping: {min_potential:.0f} to {max_potential:.0f}")
    if max_potential > MAX_VALUE * 0.95:
        print("Warning: Upper signal range is high, might clip.")
    if min_potential < MIN_VALUE * 1.05:
         print("Warning: Lower signal range is low, might clip.")

    # Create date range
    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    num_days = len(dates)

    # Create time-based features for seasonality calculation
    day_of_year = dates.dayofyear
    day_of_week = dates.dayofweek # Monday=0, Sunday=6
    days_elapsed = np.arange(num_days)

    # 1. Generate Trend Component
    trend = TREND_SLOPE * days_elapsed

    # 2. Generate Seasonal Components
    yearly_seasonality = YEARLY_AMP * np.cos(2 * np.pi * (day_of_year - 180) / 365.25) # Peaks mid-year
    weekly_seasonality = WEEKLY_AMP * np.cos(2 * np.pi * (day_of_week - 2.5) / 7) # Peaks mid-week

    # 3. Generate VERY LOW Noise Component
    noise = np.random.normal(loc=0, scale=NOISE_LEVEL, size=num_days)

    # 4. Combine Components
    synthetic_values = BASE_LEVEL + trend + yearly_seasonality + weekly_seasonality + noise

    # 5. Clamp values to the specified range [MIN_VALUE, MAX_VALUE]
    synthetic_values = np.clip(synthetic_values, MIN_VALUE, MAX_VALUE)

    # --- Create DataFrame and Save ---
    df_synthetic = pd.DataFrame({
        'Date': dates,
        'Value': synthetic_values # Assign raw values first
    })
    # Round the pandas Series AFTER creation (safer method)
    df_synthetic['Value'] = df_synthetic['Value'].round(2)

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    # Create filename with duration label
    output_filename = f"{base_filename}_{duration_label}.csv"
    output_path = os.path.join(output_dir, output_filename)

    df_synthetic.to_csv(output_path, index=False, sep=';') # Using semicolon separator

    print(f"Predictable synthetic data generated successfully.")
    print(f"Data shape: {df_synthetic.shape}")
    print(f"Value range: Min={df_synthetic['Value'].min():.2f}, Max={df_synthetic['Value'].max():.2f}")
    print(f"Saved to: {output_path}")

    # Optional: Plotting preview (requires matplotlib)
    try:
        import matplotlib.pyplot as plt
        plt.figure(figsize=(15, 6))
        plt.plot(df_synthetic['Date'], df_synthetic['Value'], linewidth=1) # Thinner line for clarity
        plt.title(f'Generated Predictable Data Preview ({duration_label})')
        plt.xlabel('Date')
        plt.ylabel('Value')
        plt.grid(True)
        # Save plot (optional)
        plot_path = os.path.join(output_dir, output_filename.replace('.csv', '.png'))
        plt.savefig(plot_path)
        print(f"Plot saved to: {plot_path}")
        plt.close() # Close the plot figure
    except ImportError:
        # Only print warning once if matplotlib is missing
        if not plt_warning_printed[0]:
             print("\nMatplotlib not installed. Skipping plot generation.")
             print("Install it via: pip install matplotlib")
             plt_warning_printed[0] = True # Set flag
    except Exception as e:
        print(f"An error occurred during plotting: {e}")


# --- Main Execution ---
if __name__ == "__main__":
    start_time = datetime.datetime.now()
    print("Starting predictable data generation script...")
    # Use a list as a mutable flag for the warning
    plt_warning_printed = [False]

    # Define the scenarios
    scenarios = [
        {"label": "3m", "start": "2025-01-01", "end": "2025-03-31"},
        {"label": "3y", "start": "2022-03-31", "end": "2025-03-31"},
        {"label": "10y", "start": "2015-03-31", "end": "2025-03-31"},
    ]

    # Generate data for defined scenarios
    for scenario in scenarios:
        generate_predictable_data(
            start_date_str=scenario["start"],
            end_date_str=scenario["end"],
            duration_label=scenario["label"],
            base_filename=BASE_FILENAME,
            output_dir=OUTPUT_DIRECTORY
        )

    end_time = datetime.datetime.now()
    print(f"\n--- Script finished in {(end_time - start_time).total_seconds():.2f} seconds ---")