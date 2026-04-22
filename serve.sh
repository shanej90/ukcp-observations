#!/usr/bin/env bash
# Serve the dashboard locally at http://localhost:8000
set -e

cd "$(dirname "$0")/docs"

PORT=8000
echo "Dashboard: http://localhost:${PORT}"
echo "Press Ctrl+C to stop."

# Open browser (works on Windows/Mac/Linux)
if command -v start  &>/dev/null; then start  "http://localhost:${PORT}"
elif command -v open &>/dev/null; then open   "http://localhost:${PORT}"
elif command -v xdg-open &>/dev/null; then xdg-open "http://localhost:${PORT}"
fi

python -m http.server "${PORT}"
