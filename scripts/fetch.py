"""
CLI tool to fetch UKCP HadUK-Grid data for a single location and variable.

Usage:
    python scripts/fetch.py <location> <variable> <start_year> <end_year> [--overwrite]

Arguments:
    location    City name as it appears in data/locations.csv (case-insensitive).
    variable    One of: rainfall, min_temp, max_temp, sunshine.
    start_year  First year of the requested period (e.g. 1980).
    end_year    Last year of the requested period (e.g. 2020).

Options:
    --overwrite  Re-download and overwrite any existing output file.
                 Use this when updating to a new end year.

Examples:
    python scripts/fetch.py London rainfall 1980 2020
    python scripts/fetch.py London rainfall 1980 2021 --overwrite
    python scripts/fetch.py "Milton Keynes" sunshine 2000 2023
"""

import argparse
import configparser
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from queries.client import UKCPClient
from queries.dispatch import VARIABLE_MAP, build_job, find_location, load_locations

logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt = "%H:%M:%S",
)
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(
        description = "Fetch UKCP HadUK-Grid data for a single location and variable.",
    )
    parser.add_argument("location",   help = "City name (as in locations.csv)")
    parser.add_argument(
        "variable",
        choices = list(VARIABLE_MAP),
        help    = "Variable to fetch",
    )
    parser.add_argument("start_year", type = int, help = "First year (inclusive)")
    parser.add_argument("end_year",   type = int, help = "Last year (inclusive)")
    parser.add_argument(
        "--overwrite",
        action  = "store_true",
        default = False,
        help    = "Overwrite existing output file (use when updating to a new end year)",
    )
    args = parser.parse_args()

    config = configparser.ConfigParser()
    config.read(os.path.join(os.path.dirname(__file__), "..", "env.ini"))
    api_key = config["default"]["UKCP_API_KEY"]

    locations = load_locations()
    try:
        row = find_location(args.location, locations)
    except ValueError as exc:
        logger.error(exc)
        sys.exit(1)

    job_id, url, dest_path = build_job(
        row        = row,
        variable   = args.variable,
        api_key    = api_key,
        start_year = args.start_year,
        end_year   = args.end_year,
    )

    if os.path.exists(dest_path) and not args.overwrite:
        logger.warning(
            "Output file already exists and will not be overwritten: %s\n"
            "         Re-run with --overwrite to replace it (e.g. after adding a new year).",
            dest_path,
        )
        return

    logger.info("Location : %s", row["name"])
    logger.info("Variable : %s (%s)", args.variable, job_id)
    logger.info("Period   : %d - %d", args.start_year, args.end_year)
    logger.info("Output   : %s", dest_path)
    if args.overwrite and os.path.exists(dest_path):
        logger.info("Overwrite: existing file will be replaced")

    client = UKCPClient(api_key = api_key)
    client.add(job_id = job_id, url = url, dest_path = dest_path)
    outcomes = client.run()

    if outcomes.get(job_id) == "succeeded":
        logger.info("Done.")
    else:
        logger.error("Job failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
