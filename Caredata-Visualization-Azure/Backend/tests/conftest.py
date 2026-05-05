"""Pytest configuration for the Caredata backend test suite.

Adds the Backend/ directory to sys.path so tests can `from app...` import.
"""
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
