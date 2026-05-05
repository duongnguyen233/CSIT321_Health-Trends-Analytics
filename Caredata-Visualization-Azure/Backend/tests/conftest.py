"""Pytest configuration for the Caredata backend test suite.

Adds the Backend/ directory to sys.path so tests can `from app...` import.

Critically, this conftest also forces the in-memory data-layer path for
ALL tests by clearing the Azure Tables connection string before `app.*`
modules import their settings. Without this, the tests would hit the real
Azure Storage account configured in `.env` and pollute production tables.
"""
from __future__ import annotations

import os
import sys


# 1. Strip the env var BEFORE anything imports settings.
os.environ.pop("AZURE_STORAGE_CONNECTION_STRING", None)
# Also defang any *_CONNECTION_STRING propagation that might have leaked in.
os.environ["AZURE_STORAGE_CONNECTION_STRING"] = ""

# 2. Add Backend/ to sys.path so `from app...` works.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# 3. Now neutralise the loaded settings object as well, since pydantic-settings
#    will already have consumed the .env at this point.
from app.core import config as _config  # noqa: E402

_config.settings.AZURE_STORAGE_CONNECTION_STRING = None
