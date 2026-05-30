#!/bin/bash
# Azure App Service (Linux) — Portal Startup Command:  bash startup.sh
set -euo pipefail
cd /home/site/wwwroot

WWW_PKG="/home/site/wwwroot/.python_packages/lib/site-packages"
HOME_PKG="/home/site/packages"

_use_pkg() {
  export PYTHONPATH="${1}${PYTHONPATH:+:$PYTHONPATH}"
  python3 -c "import uvicorn, gunicorn, fastapi" >/dev/null 2>&1
}

_pick_requirements() {
  if [[ -f requirements-azure.txt ]]; then
    echo "requirements-azure.txt"
    return
  fi
  if [[ -f requirements.txt ]] && ! grep -qE '^(faster-whisper|torch|opensmile|spacy)' requirements.txt 2>/dev/null; then
    echo "requirements.txt"
    return
  fi
  echo ""
}

if [[ -d "$WWW_PKG" ]] && _use_pkg "$WWW_PKG"; then
  echo "Using bundled packages in wwwroot (.python_packages)"
elif [[ -d "$HOME_PKG" ]] && _use_pkg "$HOME_PKG"; then
  echo "Using cached packages in /home/site/packages"
else
  REQ="$(_pick_requirements)"
  if [[ -z "$REQ" ]]; then
    echo "ERROR: wwwroot has the heavy requirements.txt (torch/whisper) but no requirements-azure.txt."
    echo "Redeploy via GitHub Actions (main_caredata-api-uow.yml) or add requirements-azure.txt to wwwroot."
    echo "To clear a stuck partial install: delete /home/site/packages via SSH/Kudu, then restart."
    ls -la
    exit 1
  fi
  echo "Installing from $REQ into /home/site/packages (~2-4 min, not 30+ min)..."
  rm -rf "$HOME_PKG"
  mkdir -p "$HOME_PKG"
  python3 -m pip install -r "$REQ" -t "$HOME_PKG" --no-cache-dir
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
