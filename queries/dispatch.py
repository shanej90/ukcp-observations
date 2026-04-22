"""
Shared dispatch logic used by both the CLI and bulk runner.

Translates a friendly variable name + location row into a (job_id, url, dest_path)
tuple ready to pass to UKCPClient.add().
"""

import os
import pandas as pd

from queries.observations import (
    daily_rainfall,
    daily_min_temp,
    daily_max_temp,
    monthly_sunshine,
)

LOCATIONS_CSV = os.path.join(
    os.path.dirname(__file__), "..", "data", "locations.csv"
)

# Friendly name -> (api_variable, query_function)
VARIABLE_MAP = {
    "rainfall":  ("rainfall", daily_rainfall),
    "min_temp":  ("tasmin",   daily_min_temp),
    "max_temp":  ("tasmax",   daily_max_temp),
    "sunshine":  ("sun",      monthly_sunshine),
}


def load_locations() -> pd.DataFrame:
    return pd.read_csv(LOCATIONS_CSV, index_col = "rank")


def find_location(name: str, locations: pd.DataFrame) -> pd.Series:
    """Case-insensitive lookup by name. Raises ValueError if not found."""
    match = locations[locations["name"].str.lower() == name.lower()]
    if match.empty:
        available = ", ".join(locations["name"].tolist())
        raise ValueError(
            f"Location '{name}' not found in locations.csv.\n"
            f"Available: {available}"
        )
    return match.iloc[0]


def location_slug(name: str) -> str:
    return name.lower().replace(" ", "_")


def build_job(
    row:        pd.Series,
    variable:   str,
    api_key:    str,
    start_year: int,
    end_year:   int,
) -> tuple[str, str, str]:
    """
    Build a (job_id, url, dest_path) tuple for a single location + variable.

    Args:
        row:        A row from locations.csv (from find_location).
        variable:   Friendly variable name — one of: rainfall, min_temp, max_temp, sunshine.
        api_key:    UKCP API key.
        start_year: First year of the requested period (inclusive).
        end_year:   Last year of the requested period (inclusive).

    Returns:
        (job_id, url, dest_path)
    """
    if variable not in VARIABLE_MAP:
        raise ValueError(
            f"Unknown variable '{variable}'. "
            f"Choose from: {', '.join(VARIABLE_MAP)}"
        )

    api_var, query_fn = VARIABLE_MAP[variable]
    slug = location_slug(row["name"])

    label = f"{row['name']} | {variable} | {start_year}-{end_year}"

    if variable == "sunshine":
        url = query_fn(
            api_key    = api_key,
            min_e      = int(row["bbox_min_e"]),
            min_n      = int(row["bbox_min_n"]),
            max_e      = int(row["bbox_max_e"]),
            max_n      = int(row["bbox_max_n"]),
            start_year = start_year,
            end_year   = end_year,
            job_label  = label,
        )
    else:
        url = query_fn(
            api_key    = api_key,
            easting    = int(row["easting"]),
            northing   = int(row["northing"]),
            start_year = start_year,
            end_year   = end_year,
            job_label  = label,
        )

    job_id    = f"{slug}_{api_var}"
    dest_path = os.path.join("data", "results", slug, f"{api_var}_{slug}.csv")

    return job_id, url, dest_path
