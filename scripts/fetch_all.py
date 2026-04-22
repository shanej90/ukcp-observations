"""
Bulk runner: fetches all four variables for every location in locations.csv.

All jobs are queued into a single UKCPClient so the 3-concurrent-job limit is
respected across the entire run, rather than per location.

By default, any file already present in data/results/ is skipped with a warning.
Pass --overwrite to replace all existing files — use this for annual updates when
a new end year has been added.

Usage:
    python scripts/fetch_all.py <start_year> <end_year> [--overwrite]

Examples:
    python scripts/fetch_all.py 1980 2023            # initial fetch
    python scripts/fetch_all.py 1980 2024 --overwrite  # annual update
"""

import argparse
import configparser
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from queries.client import UKCPClient
from queries.dispatch import VARIABLE_MAP, build_job, load_locations

logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt = "%H:%M:%S",
)
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(
        description = "Fetch all variables for every location in locations.csv.",
    )
    parser.add_argument("start_year", type = int, help = "First year (inclusive)")
    parser.add_argument("end_year",   type = int, help = "Last year (inclusive)")
    parser.add_argument(
        "--overwrite",
        action  = "store_true",
        default = False,
        help    = (
            "Overwrite existing output files. "
            "Use when updating to a new end year."
        ),
    )
    args = parser.parse_args()

    config = configparser.ConfigParser()
    config.read(os.path.join(os.path.dirname(__file__), "..", "env.ini"))
    api_key = config["default"]["UKCP_API_KEY"]

    locations = load_locations()
    client    = UKCPClient(api_key = api_key)
    skipped   = 0
    queued    = 0

    for _, row in locations.iterrows():
        for variable in VARIABLE_MAP:
            job_id, url, dest_path = build_job(
                row        = row,
                variable   = variable,
                api_key    = api_key,
                start_year = args.start_year,
                end_year   = args.end_year,
            )

            if os.path.exists(dest_path) and not args.overwrite:
                skipped += 1
                continue

            client.add(job_id = job_id, url = url, dest_path = dest_path)
            queued += 1

    if skipped:
        logger.warning(
            "%d output file(s) already exist and were skipped. "
            "Run with --overwrite to replace them (e.g. after adding a new year).",
            skipped,
        )

    logger.info(
        "Queued %d job(s) across %d location(s)  (%d skipped)",
        queued, len(locations), skipped,
    )

    if queued == 0:
        logger.info("Nothing to do.")
        return

    outcomes  = client.run()
    succeeded = sum(1 for v in outcomes.values() if v == "succeeded")
    failed    = sum(1 for v in outcomes.values() if v == "failed")

    logger.info("Complete - succeeded: %d  failed: %d", succeeded, failed)

    if failed:
        logger.error("Failed jobs:")
        for job_id, outcome in outcomes.items():
            if outcome == "failed":
                logger.error("  %s", job_id)
        sys.exit(1)


if __name__ == "__main__":
    main()
