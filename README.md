# ukcp-observations

A Python toolkit for fetching and working with UK climate observation data from the
[UKCP (UK Climate Projections)](https://ukclimateprojections-ui.metoffice.gov.uk/) service,
with a focus on HadUK-Grid gridded historical observations.

## Overview

The project queries the UKCP WPS (Web Processing Service) API to retrieve climate data
for the 150 most populated UK urban areas at 5 km grid resolution. The four primary
variables of interest are:

| Variable | Temporal resolution | Process |
|---|---|---|
| Rainfall | Daily | LS6_Subset_02 |
| Minimum temperature | Daily | LS6_Subset_02 |
| Maximum temperature | Daily | LS6_Subset_02 |
| Sunshine duration | Monthly | LS6_Subset_01 |

## Project structure

```
data/
  locations.csv         — 150 UK cities with BNG coordinates and 5km grid bounding boxes
  results/              — downloaded CSVs (gitignored)
    <location>/
      rainfall_<location>.csv
      tasmin_<location>.csv
      tasmax_<location>.csv
      sun_<location>.csv
docs/                   — static dashboard (served via GitHub Pages)
  index.html
  css/dashboard.css
  js/
    app.js              — state, events, and rendering orchestration
    charts.js           — Chart.js chart builders
    data.js             — JSON fetch and caching
    map.js              — Leaflet map
    metrics.js          — all metric calculations
  data/                 — pre-built JSON (gitignored if large, committed for deployment)
    index.json          — list of available locations with metadata
    <location>/
      summary.json      — year/month organised climate data + daylight hours
misc/                   — utility and build scripts (not part of the package)
queries/
  build.py              — low-level WPS URL construction and API constants
  client.py             — async job client: queues, polls, and downloads results
  dispatch.py           — variable name mapping and job construction shared by both scripts
  observations.py       — typed query builders for each variable
scripts/
  build_dashboard_data.py — pre-process raw CSVs into summary JSON for the dashboard
  fetch.py              — CLI: fetch one location and variable
  fetch_all.py          — bulk runner: fetch all locations and variables
utils/
  ukcp_api.py           — API reference: process identifiers, collections, variables
```

## Output file naming

Each location gets its own subfolder under `data/results/`. Within it, one CSV per
variable named `<variable>_<location>.csv`. The variable prefix is always the UKCP API
variable name, making files self-identifying when collated across locations:

| Variable | Filename pattern |
|---|---|
| Daily rainfall | `rainfall_<location>.csv` |
| Daily minimum temperature | `tasmin_<location>.csv` |
| Daily maximum temperature | `tasmax_<location>.csv` |
| Monthly sunshine duration | `sun_<location>.csv` |

Location names are lower-cased with spaces replaced by underscores, matching the folder
names in `data/results/`.

## Dashboard

The dashboard is a static site in `docs/` and is deployable to GitHub Pages with no build step.

### Build the data

After fetching all location CSVs, run from the project root:

```
python scripts/build_dashboard_data.py
```

This reads every `data/results/<location>/` folder that has all four variable CSVs and writes:

- `docs/data/<location>/summary.json` — year/month organised data plus astronomical daylight hours
- `docs/data/index.json` — list of all successfully built locations

Locations with any missing CSV files are skipped with a warning.

### Serve locally

```
python -m http.server --directory docs 8000
```

Then open <http://localhost:8000>.

---

## Requirements

- Python 3.12+

Install dependencies:

```
pip install -r requirements.txt
```

No shell other than a standard terminal is required. The scripts run with plain
`python` on Windows, macOS, and Linux — no bash needed.

## Configuration

Store your UKCP API key in `env.ini` at the project root:

```ini
[default]
UKCP_API_KEY=your_key_here
```

Your API key is available from your account page at
<https://ukclimateprojections-ui.metoffice.gov.uk/user>. `env.ini` is gitignored
and should never be committed.

## Usage

All scripts must be run from the **project root directory** so that imports and
relative paths resolve correctly.

### Fetch a single location and variable

```
python scripts/fetch.py <location> <variable> <start_year> <end_year> [--overwrite]
```

`<variable>` must be one of: `rainfall`, `min_temp`, `max_temp`, `sunshine`.

```
python scripts/fetch.py London rainfall 1980 2023
python scripts/fetch.py "Milton Keynes" sunshine 2000 2023
python scripts/fetch.py Birmingham min_temp 1960 2023
```

The script logs progress to the terminal and exits with code 1 on failure. If
the output file already exists a warning is printed and the job is skipped — no
data is overwritten accidentally.

### Fetch all locations and all variables

```
python scripts/fetch_all.py <start_year> <end_year> [--overwrite]
```

```
python scripts/fetch_all.py 1980 2023
```

This queues all 600 jobs (150 locations × 4 variables) into a single client
that keeps at most 3 jobs running on the UKCP server simultaneously. If any
output files already exist a warning is shown and those jobs are skipped. A
summary of succeeded and failed jobs is printed on completion.

### Annual updates

The dataset is updated each year as HadUK-Grid adds a new calendar year of
observations. To update, extend the end year and pass `--overwrite` to replace
existing files with the new full time series:

```
python scripts/fetch_all.py 1980 2024 --overwrite
```

Appending to existing files is not supported — the full time series is always
re-requested and the previous file overwritten.

### Variable names

The scripts accept plain English variable names which are translated to the
internal UKCP API names:

| Argument | UKCP variable | Description | Resolution |
|---|---|---|---|
| `rainfall` | `rainfall` | Precipitation | Daily |
| `min_temp` | `tasmin` | Minimum air temperature | Daily |
| `max_temp` | `tasmax` | Maximum air temperature | Daily |
| `sunshine` | `sun` | Sunshine duration | Monthly |

---

## Acknowledgements

### UKCP API Client

The `queries/build.py` module implements WPS URL construction and polling logic
that is conceptually derived from the
[ukcp-api-client](https://github.com/ukcp-data/ukcp-api-client) library by Ag Stephens
(STFC). That library is the recommended way to interact with the UKCP service and handles
the full asynchronous request lifecycle (submission, status polling, and file download).

**Copyright (c) 2019, Ag Stephens**
Licensed under the [BSD 2-Clause License](https://opensource.org/licenses/BSD-2-Clause).

The BSD 2-Clause licence permits use, modification, and redistribution for any purpose
(commercial or otherwise), provided the above copyright notice is retained and the
author's name is not used to endorse derived products without permission. This project
complies with those terms.

### UKCP / HadUK-Grid data

Climate data is sourced from the UKCP HadUK-Grid dataset, produced by the Met Office
Hadley Centre in partnership with DEFRA, BEIS, and the Environment Agency. Use of the
data is subject to the
[UKCP terms and conditions](https://ukclimateprojections-ui.metoffice.gov.uk/help/termsandconditions).
