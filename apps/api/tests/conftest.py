"""Pytest config and fixtures. Smoke tests run against running backend (docker-compose up)."""
import os

# До импорта любых тестовых модулей, тянущих `app.*` (collect phase).
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@127.0.0.1:5432/test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-minimum-32-characters-long")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/0")
os.environ.setdefault("PROMETHEUS_SCRAPE_TOKEN", "pytest-metrics-token")

import httpx
import pytest

# Base URL for API (default: local backend)
BASE_URL = os.environ.get("TEST_API_URL", "http://localhost:8000")

# Модули, где тесты ходят в сеть на живой backend — в CI гоняются отдельно (`-m "not integration"`).
_INTEGRATION_TEST_MODULES = frozenset(
    {
        "test_admin_metrics",
        "test_admin_rbac",
        "test_auth",
        "test_business_routes_auth",
        "test_finance_auth",
        "test_finance_requests",
        "test_health",
        "test_idempotency",
        "test_request_id_http",
        "test_tasks",
        "test_zu_rate_limits",
    }
)


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    for item in items:
        path = getattr(item, "path", None)
        if path is None:
            continue
        if path.stem in _INTEGRATION_TEST_MODULES:
            item.add_marker(pytest.mark.integration)


@pytest.fixture
def api_client():
    """HTTP client for API requests."""
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        yield client
