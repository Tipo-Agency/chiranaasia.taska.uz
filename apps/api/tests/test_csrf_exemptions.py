"""Список исключений CSRF: только явные пути; login/refresh/logout без «prefix»-обхода."""

from __future__ import annotations

import pytest

from app.middleware.http_security import _csrf_exempt


@pytest.mark.parametrize(
    ("method", "path", "exempt"),
    [
        ("POST", "/api/auth/login", True),
        ("POST", "/api/auth/login/", True),
        ("POST", "/api/auth/refresh", True),
        ("POST", "/api/integrations/site/leads", True),
        ("POST", "/api/integrations/site/leads/", True),
        ("POST", "/api/integrations/telegram/webhook/funnel-uuid-1", True),
        ("POST", "/api/integrations/telegram/webhook/register", False),
        ("POST", "/api/auth/logout", True),
        ("POST", "/api/auth/login-evil", False),
        ("PUT", "/api/auth/login", False),
        ("PATCH", "/api/tasks", False),
        ("DELETE", "/api/deals/x", False),
    ],
)
def test_csrf_exempt_only_documented_routes(method: str, path: str, exempt: bool):
    assert _csrf_exempt(path, method) is exempt
