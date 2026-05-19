#!/bin/bash
# Azure App Service (Linux) startup — set in Portal → Configuration → Startup Command:
#   bash startup.sh
set -e
cd /home/site/wwwroot
exec gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers 1 \
  --timeout 600 \
  --access-logfile - \
  --error-logfile -
