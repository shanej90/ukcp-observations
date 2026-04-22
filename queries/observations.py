"""
Query builders for HadUK-Grid observational data (LS6 processes).

All functions return a WPS request URL string ready to pass to UKCPApiClient.submit().

Grid resolution: land-obs_5 (5km HadUK-Grid)

Daily processes use a point area; monthly use a bounding box.
Coordinates must be in British National Grid (OSGB36, EPSG:27700) metres.
"""

from queries.build import build_url, point_area, bbox_area, year_slice

_COLLECTION = "land-obs_5"
_FORMAT = "csv"

# LS6_Subset_02 — daily data (rainfall, tasmax, tasmin only)
_DAILY_PROCESS = "LS6_Subset_02"

# LS6_Subset_01 — monthly/seasonal/annual data (full variable set)
_MONTHLY_PROCESS = "LS6_Subset_01"


def daily_rainfall(
    api_key: str,
    easting: int,
    northing: int,
    start_year: int,
    end_year: int,
    job_label: str = "",
) -> str:
    """
    Daily rainfall (mm) at a 5km grid point.

    Args:
        api_key:    UKCP API key.
        easting:    BNG easting of the city centre (metres).
        northing:   BNG northing of the city centre (metres).
        start_year: First year of the requested period (inclusive).
        end_year:   Last year of the requested period (inclusive).
        job_label:  Optional label shown in the UKCP UI job viewer.

    Returns:
        WPS Execute URL string.
    """
    return build_url(
        process = _DAILY_PROCESS,
        api_key = api_key,
        Collection = _COLLECTION,
        Variable = "rainfall",
        Area = point_area(easting, northing),
        TemporalAverage = "day",
        TimeSlice = year_slice(start_year, end_year),
        DataFormat = _FORMAT,
        JobLabel = job_label,
    )


def daily_min_temp(
    api_key: str,
    easting: int,
    northing: int,
    start_year: int,
    end_year: int,
    job_label: str = "",
) -> str:
    """
    Daily minimum air temperature (°C) at a 5km grid point.

    Args:
        api_key:    UKCP API key.
        easting:    BNG easting of the city centre (metres).
        northing:   BNG northing of the city centre (metres).
        start_year: First year of the requested period (inclusive).
        end_year:   Last year of the requested period (inclusive).
        job_label:  Optional label shown in the UKCP UI job viewer.

    Returns:
        WPS Execute URL string.
    """
    return build_url(
        process = _DAILY_PROCESS,
        api_key = api_key,
        Collection = _COLLECTION,
        Variable = "tasmin",
        Area = point_area(easting, northing),
        TemporalAverage = "day",
        TimeSlice = year_slice(start_year, end_year),
        DataFormat = _FORMAT,
        JobLabel = job_label,
    )


def daily_max_temp(
    api_key: str,
    easting: int,
    northing: int,
    start_year: int,
    end_year: int,
    job_label: str = "",
) -> str:
    """
    Daily maximum air temperature (°C) at a 5km grid point.

    Args:
        api_key:    UKCP API key.
        easting:    BNG easting of the city centre (metres).
        northing:   BNG northing of the city centre (metres).
        start_year: First year of the requested period (inclusive).
        end_year:   Last year of the requested period (inclusive).
        job_label:  Optional label shown in the UKCP UI job viewer.

    Returns:
        WPS Execute URL string.
    """
    return build_url(
        process = _DAILY_PROCESS,
        api_key = api_key,
        Collection = _COLLECTION,
        Variable = "tasmax",
        Area = point_area(easting, northing),
        TemporalAverage = "day",
        TimeSlice = year_slice(start_year, end_year),
        DataFormat = _FORMAT,
        JobLabel = job_label,
    )


def monthly_sunshine(
    api_key: str,
    min_e: int,
    min_n: int,
    max_e: int,
    max_n: int,
    start_year: int,
    end_year: int,
    job_label: str = "",
) -> str:
    """
    Monthly sunshine duration (hours) for a 5km bounding box.

    Uses TemporalAverage=mall to return the full monthly time series
    (one value per calendar month across the requested year range).

    Args:
        api_key:    UKCP API key.
        min_e:      Bounding box minimum easting (metres, BNG).
        min_n:      Bounding box minimum northing (metres, BNG).
        max_e:      Bounding box maximum easting (metres, BNG).
        max_n:      Bounding box maximum northing (metres, BNG).
        start_year: First year of the requested period (inclusive).
        end_year:   Last year of the requested period (inclusive).
        job_label:  Optional label shown in the UKCP UI job viewer.

    Returns:
        WPS Execute URL string.
    """
    return build_url(
        process = _MONTHLY_PROCESS,
        api_key = api_key,
        Collection = _COLLECTION,
        Variable = "sun",
        Area = bbox_area(min_e, min_n, max_e, max_n),
        TemporalAverage = "mall",
        TimeSlice = year_slice(start_year, end_year),
        DataFormat = _FORMAT,
        JobLabel = job_label,
    )
