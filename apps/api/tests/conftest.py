"""Pytest config and fixtures. Smoke tests run against running backend (docker-compose up)."""
import os
import pytest
import httpx

# Base URL for API (default: local backend)
BASE_URL = os.environ.get("TEST_API_URL", "http://localhost:8000")


@pytest.fixture
def api_client():
    """HTTP client for API requests."""
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        yield client
