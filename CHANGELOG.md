# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] — 2026-04-22

### Added

#### Data fetching
- Async UKCP WPS API client (`queries/client.py`) — queues, polls, and downloads jobs with a configurable concurrency cap (default 3 simultaneous jobs on the server)
- Low-level WPS URL construction and API constants (`queries/build.py`)
- Typed query builders for each variable (`queries/observations.py`)
- Variable-name mapping shared by both fetch scripts (`queries/dispatch.py`)
- `scripts/fetch.py` — CLI to fetch a single location and variable with optional overwrite flag
- `scripts/fetch_all.py` — bulk runner that queues all 600 jobs (150 locations × 4 variables); skips existing files by default; prints a succeeded/failed summary on completion
- `data/locations.csv` — 150 most-populated UK urban areas with BNG coordinates and 5 km grid bounding boxes
- API key configuration via `env.ini` (gitignored)

#### Data pipeline
- `scripts/build_dashboard_data.py` — pre-processes raw UKCP HadUK-Grid CSVs into per-location `docs/data/<slug>/summary.json` files and a `docs/data/index.json` location index
- Astronomical daylight-hours calculation per month from latitude using the Spencer solar declination formula (no external API dependency)
- Graceful handling of UKCP missing-value markers (`---`) via numeric coercion

#### Dashboard (`docs/`)
- Static site deployable to GitHub Pages with no build step — plain HTML, CSS, and vanilla JS
- 150 UK urban locations selectable via Tom Select search dropdowns
- Optional comparison location rendered alongside the primary in all charts and metrics
- Year range filter applied to every metric and chart
- Leaflet map pinning both selected locations with a full-UK default view
- **Temperature section** (monthly and annual tabs)
  - Range chart showing average low / average high box, mean line, average of yearly extremes, and all-time record dots
  - Frost days chart — average days per month below −10 °C, −5 °C, and 0 °C thresholds
  - Warm days chart — average days per month at or above 15 °C, 20 °C, 25 °C, and 30 °C thresholds
  - Annual view: mean temperature by year; frost and warm day totals by year
- **Rainfall section** (monthly and annual tabs)
  - Average monthly rainfall totals
  - Average rainy days per month at ≥ 0.25 mm, ≥ 1 mm, and ≥ 10 mm thresholds
  - Average wettest day of month
  - Annual view: annual totals by year; rainy days by year; wettest day of year
- **Sunshine section** (monthly and annual tabs)
  - Average monthly sunshine hours
  - Sunshine as a percentage of available daylight hours
  - Annual view: annual sunshine totals by year
- **Rolling trends section** — 30-year rolling average for nine selectable metrics (mean temperature, hottest/coldest day, annual rainfall, wettest day, rainy days, frost days, warm days, sunshine hours); uses all available data regardless of the year range filter
