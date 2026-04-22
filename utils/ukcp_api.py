"""
UKCP WPS API reference constants, sourced from GetCapabilities and DescribeProcess endpoints.

Base URL: https://ukclimateprojections-ui.metoffice.gov.uk/wps
API key is read from env.ini — never hard-code it here.
"""

WPS_BASE_URL = "https://ukclimateprojections-ui.metoffice.gov.uk/wps"

# ---------------------------------------------------------------------------
# Process identifiers
# Source: GetCapabilities
# ---------------------------------------------------------------------------

PROCESSES = {
    # --- Land probabilistic projections (25km) ---
    "LS1_CDF_PDF_01": "Plot: PDF/CDF for probabilistic projections (25km) over UK, 1961-2100",
    "LS1_JP_01":      "Plot: Joint probabilities of two metrics for probabilistic projections (25km) over UK, 1961-2100",
    "LS1_Maps_01":    "Maps: Anomalies for probabilistic projections (25km) over UK, 1961-2100",
    "LS1_Maps_02":    "Maps: Probabilistic projections of climate extremes (25km) over UK, 1961-2100",
    "LS1_Plume_01":   "Plot: Plume of time series anomalies for probabilistic projections (25km) over UK, 1961-2100",
    "LS1_Plume_02":   "Plot: Plume of time series of probabilistic projections of climate extremes (25km) over UK, 1961-2100",
    "LS1_Sample_01":  "Data: Anomalies for probabilistic projections (25km) over UK, 1961-2100",
    "LS1_Subset_02":  "Data: Variables from probabilistic projections of climate extremes (25km) over UK, 1961-2100",

    # --- Land probabilistic projections at global warming levels ---
    "LS1A_CDF_01":    "Plot: CDF for probabilistic projections at global warming levels",
    "LS1A_Maps_01":   "Maps: Global Warming Levels for probabilistic projections (25km) over UK, 1961-2100",

    # --- Global projections (60km) ---
    "LS2_Maps_02":    "Maps: Anomalies for global projections (60km) over UK",
    "LS2_Plume_01":   "Plot: Plume of time series anomalies for global projections (60km) over UK",
    "LS2_Subset_01":  "Data: Variables from global projections (60km) over UK for monthly/seasonal/annual data",
    "LS2_Subset_02":  "Data: Variables from global projections (60km) over UK for daily data",

    # --- Regional projections (12km) ---
    "LS3_Maps_02":    "Maps: Anomalies for regional projections (12km) over UK",
    "LS3_Plume_01":   "Plot: Plume of time series anomalies for regional projections (12km) over UK",
    "LS3_Subset_01":  "Data: Variables from regional projections (12km) over UK for monthly/seasonal/annual data",
    "LS3_Subset_02":  "Data: Variables from regional projections (12km) over UK for daily data",

    # --- Local projections (2.2km regridded to 5km) ---
    "LS3A_Maps_02":   "Maps: Anomalies for local projections (2.2km) regridded to 5km over UK",
    "LS3A_Plume_01":  "Plot: Plume of time series anomalies for local projections (2.2km) regridded to 5km over UK",
    "LS3A_Subset_01": "Data: Variables from local projections (2.2km→5km) over UK for monthly/seasonal/annual data",
    "LS3A_Subset_02": "Data: Variables from local projections (2.2km→5km) over UK for daily data",
    "LS3A_Subset_03": "Data: Variables from local projections (2.2km→5km) over UK for hourly data",

    # --- Regional projections at global warming levels ---
    "LS3B_Subset_01": "Data: Variables from UKCP Regional (12km) at Global Warming Levels for monthly/seasonal/annual data",
    "LS3B_Subset_02": "Data: Variables from UKCP Regional (12km) at Global Warming Levels for daily data",

    # --- Historical observations: HadUK-Grid ---
    "LS6_Maps_01":       "Maps: Absolute values for past data from HadUK-Grid dataset over UK",
    "LS6_Subset_01":     "Data: Variables from HadUK-Grid over UK for monthly/seasonal/annual data",
    "LS6_Subset_02":     "Data: Variables from HadUK-Grid over UK for daily data",
    "LS6_Time_Series_01":"Time series: Absolute values for past data from HadUK-Grid dataset over UK",

    # --- Marine projections ---
    "MS4_Anomalies_Subset_01": "Data: Sea level anomalies for marine projections around UK coastline, 2007-2100",
    "MS4_Anomalies_Subset_02": "Data: Sea level anomalies for marine projections (exploratory), 2007-2300",
    "MS4_ESL_Plot_01":         "Plot: Future extreme sea levels at selected UK tide gauge locations, 2020-2300",
    "MS4_ESL_Subset_01":       "Data: Future extreme sea levels around UK coastline (standard), 2020-2100",
    "MS4_ESL_Subset_02":       "Data: Future extreme sea levels around UK coastline (extended), 2020-2300",
    "MS4_Plume_01":            "Plot: Plume of sea level anomalies for marine projections, 2007-2100",
    "MS4_Plume_02":            "Plot: Plume of sea level anomalies for marine projections (exploratory), 2007-2300",
}

# ---------------------------------------------------------------------------
# HadUK-Grid observation parameters
# Source: DescribeProcess for LS6_Subset_01 and LS6_Subset_02
# ---------------------------------------------------------------------------

# Grid resolution collections (number = km resolution)
COLLECTIONS_OBS = [
    "land-obs_1",            # 1km grid
    "land-obs_5",            # 5km grid
    "land-obs_12",           # 12km grid
    "land-obs_25",           # 25km grid
    "land-obs_60",           # 60km grid
    "land-obs_admin_region", # administrative regions
    "land-obs_river_basin",  # river basins
    "land-obs_country",      # country level
]

# Variables available for monthly/seasonal/annual (LS6_Subset_01)
VARIABLES_OBS_MONTHLY = [
    "tas",         # mean air temperature
    "tasmax",      # maximum air temperature
    "tasmin",      # minimum air temperature
    "rainfall",    # precipitation
    "sun",         # sunshine duration
    "sfcWind",     # mean wind speed
    "psl",         # mean sea level pressure
    "hurs",        # relative humidity
    "pv",          # potential evapotranspiration
    "groundfrost", # days of ground frost
    "snowLying",   # days of snow lying
]

# Variables available for daily (LS6_Subset_02) — subset of above
VARIABLES_OBS_DAILY = [
    "rainfall",
    "tasmax",
    "tasmin",
]

# Temporal averaging options for monthly/seasonal/annual (LS6_Subset_01)
TEMPORAL_AVERAGES_MONTHLY = [
    # Monthly
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
    "mall",  # all months (monthly time series)
    # Seasonal
    "djf",   # Dec-Jan-Feb (winter)
    "mam",   # Mar-Apr-May (spring)
    "jja",   # Jun-Jul-Aug (summer)
    "son",   # Sep-Oct-Nov (autumn)
    "sall",  # all seasons
    # Annual
    "ann",
]

# For daily data the only option is:
TEMPORAL_AVERAGES_DAILY = ["day"]

DATA_FORMAT = "csv"  # only supported output format for data subsets

# ---------------------------------------------------------------------------
# Area format helpers
# ---------------------------------------------------------------------------

def point_area(easting: float, northing: float) -> str:
    """Return a point Area string in British National Grid (OSGB36) metres."""
    return f"point|{easting}|{northing}"


def bbox_area(min_easting: float, min_northing: float,
              max_easting: float, max_northing: float) -> str:
    """Return a bounding-box Area string in British National Grid (OSGB36) metres."""
    return f"bbox|{min_easting}|{min_northing}|{max_easting}|{max_northing}"
