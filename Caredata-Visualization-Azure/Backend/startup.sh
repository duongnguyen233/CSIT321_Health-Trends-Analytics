#!/bin/bash
# Azure App Service (Linux) — Portal Startup Command:  bash startup.sh
# Deploy bundle: 2026-06-04-v5 (voice: av/onnxruntime/opensmile/torch in python_packages)
set -euo pipefail
cd /home/site/wwwroot
echo "CareData API startup bundle 2026-06-04-v5"

# CI deploy uses python_packages/ (visible). Legacy zips may use .python_packages/.
for SITE_PKG in \
  "/home/site/wwwroot/python_packages/lib/site-packages" \
  "/home/site/wwwroot/.python_packages/lib/site-packages"; do
  if [[ -d "$SITE_PKG" ]]; then
    export PYTHONPATH="${SITE_PKG}${PYTHONPATH:+:$PYTHONPATH}"
    if python3 -c "import uvicorn, gunicorn, fastapi" 2>/dev/null; then
      echo "Using bundled packages in ${SITE_PKG}"
      exec python3 -m gunicorn app.main:app \
        -k uvicorn.workers.UvicornWorker \
        --bind "0.0.0.0:${PORT:-8000}" \
        --workers 1 \
        --timeout 600 \
        --access-logfile - \
        --error-logfile -
    fi
  fi
done

HOME_PKG="/home/site/packages"
if [[ -d "$HOME_PKG" ]] && PYTHONPATH="$HOME_PKG" python3 -c "import uvicorn, gunicorn, fastapi" 2>/dev/null; then
  export PYTHONPATH="$HOME_PKG"
  echo "Using cached packages in /home/site/packages"
  exec python3 -m gunicorn app.main:app \
    -k uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers 1 \
    --timeout 600 \
    --access-logfile - \
    --error-logfile -
fi

_pick_requirements() {
  if [[ -f requirements-azure.txt ]]; then
    echo "requirements-azure.txt"
    return
  fi
  if [[ -f requirements.txt ]] && ! grep -qE '^(faster-whisper|spacy)' requirements.txt 2>/dev/null; then
    echo "requirements.txt"
    return
  fi
  echo ""
}

REQ="$(_pick_requirements)"
if [[ -z "$REQ" ]]; then
  echo "ERROR: No slim requirements file. Redeploy via GitHub Actions."
  ls -la
  exit 1
fi

echo "Installing from $REQ into /home/site/packages (~2-4 min)..."
rm -rf "$HOME_PKG"
mkdir -p "$HOME_PKG"
python3 -m pip install -r "$REQ" -t "$HOME_PKG" --no-cache-dir \
  --platform manylinux2014_x86_64 \
  --python-version 3.12 \
  --implementation cp \
  --abi cp312 \
  --only-binary=:all: || \
python3 -m pip install -r "$REQ" -t "$HOME_PKG" --no-cache-dir
export PYTHONPATH="$HOME_PKG"
python3 -c "import uvicorn, gunicorn, fastapi; print('dependencies ready')"

echo "Starting gunicorn on port ${PORT:-8000}..."
exec python3 -m gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers 1 \
  --timeout 600 \
  --access-logfile - \
  --error-logfile -
