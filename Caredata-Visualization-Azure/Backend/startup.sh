#!/bin/bash
# Azure App Service (Linux) — set Portal Startup Command to:  bash startup.sh
#
# WEBSITE_RUN_FROM_PACKAGE mounts wwwroot read-only, so we install/load deps from
# /home/site/packages (writable) when they are not bundled in the deploy zip.
set -euo pipefail
cd /home/site/wwwroot

WWW_PKG="/home/site/wwwroot/.python_packages/lib/site-packages"
HOME_PKG="/home/site/packages"

_use_pkg() {
  export PYTHONPATH="${1}${PYTHONPATH:+:$PYTHONPATH}"
  python3 -c "import uvicorn, gunicorn, fastapi" >/dev/null 2>&1
}

if [[ -d "$WWW_PKG" ]] && _use_pkg "$WWW_PKG"; then
  echo "Using bundled packages in wwwroot"
elif [[ -d "$HOME_PKG" ]] && _use_pkg "$HOME_PKG"; then
  echo "Using cached packages in /home/site/packages"
else
  echo "Installing Python dependencies to /home/site/packages (first boot may take 2-5 min)..."
  mkdir -p "$HOME_PKG"
  python3 -m pip install --upgrade pip
  REQ="requirements.txt"
  if [[ -f requirements-azure.txt ]]; then
    REQ="requirements-azure.txt"
  fi
  if [[ ! -f "$REQ" ]]; then
    echo "ERROR: No requirements file in wwwroot"
    ls -la
    exit 1
  fi
  python3 -m pip install -r "$REQ" -t "$HOME_PKG"
  export PYTHONPATH="$HOME_PKG"
  python3 -c "import uvicorn, gunicorn, fastapi; print('dependencies ready')"
fi

echo "Starting gunicorn on port ${PORT:-8000}..."
exec python3 -m gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers 1 \
  --timeout 600 \
  --access-logfile - \
  --error-logfile -
