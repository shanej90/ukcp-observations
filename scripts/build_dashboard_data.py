"""
Pre-process raw UKCP HadUK-Grid CSVs into summary JSON files for the dashboard.

For each location that has all four variable CSVs, produces:
  docs/data/<slug>/summary.json  — year/month organised data + daylight hours

Also produces:
  docs/data/index.json           — list of available locations with metadata

Run from the project root:
    python scripts/build_dashboard_data.py
"""

import calendar
import json
import math
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

RESULTS_DIR    = os.path.join("data", "results")
DOCS_DATA_DIR  = os.path.join("docs", "data")
LOCATIONS_CSV  = os.path.join("data", "locations.csv")

VARIABLES = ["rainfall", "tasmin", "tasmax"]   # daily
SUNSHINE   = "sun"                              # monthly


# ---------------------------------------------------------------------------
# CSV parsers
# ---------------------------------------------------------------------------

def parse_daily_csv(path: str) -> pd.Series:
    """Parse a daily UKCP CSV (rainfall / tasmin / tasmax).
    Returns a Series indexed by datetime.date."""
    s = pd.read_csv(
        path, skiprows = 10, header = 0,
        index_col = 0, parse_dates = True,
    ).iloc[:, 0]
    s.index = pd.to_datetime(s.index)
    s = pd.to_numeric(s, errors = "coerce")
    return s


def parse_sunshine_csv(path: str) -> dict:
    """Parse monthly sunshine UKCP CSV.
    Returns dict mapping 'YYYY-MM' -> float (hours)."""
    with open(path, "r") as f:
        lines = f.readlines()

    results = {}
    i = 13  # skip 13-line header
    while i < len(lines):
        line = lines[i].strip()
        if len(line) == 10 and line[4] == "-" and line[7] == "-":
            ym = line[:7]           # YYYY-MM
            if i + 2 < len(lines):
                val_line = lines[i + 2].strip()
                parts = val_line.split(",")
                if len(parts) >= 2:
                    try:
                        results[ym] = float(parts[1])
                    except ValueError:
                        results[ym] = None
            i += 3
        else:
            i += 1

    return results


# ---------------------------------------------------------------------------
# Daylight hours
# ---------------------------------------------------------------------------

def daylight_hours_per_month(lat: float) -> dict:
    """Total daylight hours for each calendar month at the given latitude.
    Uses the Spencer solar declination formula. Representative non-leap year."""
    lat_r  = math.radians(lat)
    result = {}
    doy    = 0
    for month in range(1, 13):
        days = calendar.monthrange(2001, month)[1]
        total = 0.0
        for day in range(1, days + 1):
            doy += 1
            decl = math.radians(
                23.45 * math.sin(math.radians(360 / 365 * (doy - 81)))
            )
            cos_ha = -math.tan(lat_r) * math.tan(decl)
            cos_ha = max(-1.0, min(1.0, cos_ha))
            ha     = math.acos(cos_ha)
            total += 2 * math.degrees(ha) / 15
        result[str(month)] = round(total, 2)
    return result


# ---------------------------------------------------------------------------
# Location slug
# ---------------------------------------------------------------------------

def slug(name: str) -> str:
    return name.lower().replace(" ", "_")


# ---------------------------------------------------------------------------
# Build one location
# ---------------------------------------------------------------------------

def build_location(row: pd.Series) -> dict | None:
    loc_slug = slug(row["name"])
    base     = os.path.join(RESULTS_DIR, loc_slug)

    paths = {
        "rainfall": os.path.join(base, f"rainfall_{loc_slug}.csv"),
        "tasmin":   os.path.join(base, f"tasmin_{loc_slug}.csv"),
        "tasmax":   os.path.join(base, f"tasmax_{loc_slug}.csv"),
        "sun":      os.path.join(base, f"sun_{loc_slug}.csv"),
    }

    missing = [k for k, p in paths.items() if not os.path.exists(p)]
    if missing:
        print(f"  Skipping {row['name']} — missing: {', '.join(missing)}")
        return None

    print(f"  Processing {row['name']}...")

    rain  = parse_daily_csv(paths["rainfall"])
    tmin  = parse_daily_csv(paths["tasmin"])
    tmax  = parse_daily_csv(paths["tasmax"])
    sun   = parse_sunshine_csv(paths["sun"])

    # Organise by year → month → variable
    data = {}
    for year, grp in rain.groupby(rain.index.year):
        data[str(year)] = {}
        for month in range(1, 13):
            m_str = str(month)
            mask  = grp.index.month == month

            rain_vals = [round(v, 3) for v in grp[mask].tolist()]
            tmin_vals = [round(v, 2) for v in tmin[tmin.index.year == year][tmin[tmin.index.year == year].index.month == month].tolist()]
            tmax_vals = [round(v, 2) for v in tmax[tmax.index.year == year][tmax[tmax.index.year == year].index.month == month].tolist()]
            ym        = f"{year}-{month:02d}"
            sun_val   = round(sun.get(ym), 2) if sun.get(ym) is not None else None

            data[str(year)][m_str] = {
                "rain": rain_vals,
                "tmin": tmin_vals,
                "tmax": tmax_vals,
                "sun":  sun_val,
            }

    years = sorted(int(y) for y in data)

    return {
        "meta": {
            "name":       row["name"],
            "slug":       loc_slug,
            "lat":        round(float(row["latitude"]),  5),
            "lon":        round(float(row["longitude"]), 5),
            "country":    row["country"],
            "population": int(row["population"]),
        },
        "year_min": min(years),
        "year_max": max(years),
        "data":     data,
        "daylight": daylight_hours_per_month(float(row["latitude"])),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    os.makedirs(DOCS_DATA_DIR, exist_ok = True)

    locations = pd.read_csv(LOCATIONS_CSV, index_col = "rank")
    index     = []

    for _, row in locations.iterrows():
        result = build_location(row)
        if result is None:
            continue

        loc_slug = result["meta"]["slug"]
        out_dir  = os.path.join(DOCS_DATA_DIR, loc_slug)
        os.makedirs(out_dir, exist_ok = True)
        out_path = os.path.join(out_dir, "summary.json")

        with open(out_path, "w") as f:
            json.dump(result, f, separators = (",", ":"))

        size_kb = os.path.getsize(out_path) / 1024
        print(f"    -> {out_path}  ({size_kb:.0f} KB)")

        index.append({
            "name":    result["meta"]["name"],
            "slug":    loc_slug,
            "lat":     result["meta"]["lat"],
            "lon":     result["meta"]["lon"],
            "country": result["meta"]["country"],
        })

    index_path = os.path.join(DOCS_DATA_DIR, "index.json")
    with open(index_path, "w") as f:
        json.dump(sorted(index, key = lambda x: x["name"]), f, indent = 2)

    print(f"\nWrote {len(index)} location(s) to {DOCS_DATA_DIR}/")
    print(f"Index: {index_path}")


if __name__ == "__main__":
    main()
