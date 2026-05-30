#!/bin/bash
# Azure App Service (Linux) — use as Startup Command: bash startup.sh
set -euo pipefail
cd /home/site/wwwroot

if [[ -f antenv/bin/activate ]]; then
  # Dependencies installed in CI (antenv bundled in deploy zip).
  source antenv/bin/activate
elif [[ -f requirements.txt ]]; then
  # Fallback: install on first boot if venv missing (slow; prefer CI-built antenv).
  python -m venv antenv
  antenv/bin/pip install --upgrade pip
  antenv/bin/pip install -r requirements.txt
  source antenv/bin/activate
fi

exec gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers 1 \
  --timeout 600 \
  --access-logfile - \
  --error-logfile -
