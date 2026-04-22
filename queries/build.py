"""
Low-level WPS request URL construction for the UKCP HadUK-Grid API.

A WPS DataInputs string is a semicolon-separated list of key=value pairs.
The full request URL structure is:
  <WPS_BASE_URL>?service=WPS&request=Execute&version=1.0.0
    &Identifier=<process>
    &Format=text/xml
    &Inform=false
    &Store=false
    &Status=false
    &DataInputs=<semicolon-separated inputs>
    &ApiKey=<key>

Confirmed from live API responses:
  - XML namespace is http://www.opengeospatial.net/wps (not the opengis.net/wps/1.0.0 variant)
  - Status URL has no existing query params, so the API key is appended as ?ApiKey=<key>
"""

from utils.ukcp_api import WPS_BASE_URL

# Namespaces returned by the live API (differ from the WPS 1.0.0 spec)
WPS_NS = {
    "wps": "http://www.opengeospatial.net/wps",
    "ows": "http://www.opengeospatial.net/ows",
}


def status_url(status_location: str, api_key: str) -> str:
    """Append the API key to a status location URL."""
    return f"{status_location}?ApiKey={api_key}"


def _data_inputs(**kwargs) -> str:
    return ";".join(f"{k}={v}" for k, v in kwargs.items())


def build_url(process: str, api_key: str, **data_inputs) -> str:
    """Return a fully-formed WPS Execute URL."""
    inputs = _data_inputs(**data_inputs)
    return (
        f"{WPS_BASE_URL}"
        f"?service=WPS"
        f"&request=Execute"
        f"&version=1.0.0"
        f"&Identifier={process}"
        f"&Format=text/xml"
        f"&Inform=false"
        f"&Store=false"
        f"&Status=false"
        f"&DataInputs={inputs}"
        f"&ApiKey={api_key}"
    )


def point_area(easting: int, northing: int) -> str:
    return f"point|{easting}|{northing}"


def bbox_area(min_e: int, min_n: int, max_e: int, max_n: int) -> str:
    return f"bbox|{min_e}|{min_n}|{max_e}|{max_n}"


def year_slice(start_year: int, end_year: int) -> str:
    return f"{start_year}|{end_year}"
