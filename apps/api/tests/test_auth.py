"""Auth smoke tests."""
import uuid


def test_login_success(api_client):
    """POST /api/auth/login returns token for a valid user."""
    login = f"pytest_{uuid.uuid4().hex[:8]}"
    password = "pytest-pass-123"
    create_resp = api_client.put(
        "/api/auth/users",
        json=[
            {
                "name": "Pytest User",
                "role": "EMPLOYEE",
                "login": login,
                "password": password,
            }
        ],
    )
    assert create_resp.status_code == 200

    r = api_client.post(
        "/api/auth/login",
        json={"login": login, "password": password},
    )
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data.get("token_type") == "bearer"
    assert "user" in data and "id" in data["user"]


def test_login_invalid_returns_401(api_client):
    """POST /api/auth/login with wrong credentials returns 401."""
    r = api_client.post(
        "/api/auth/login",
        json={"login": "nonexistent", "password": "wrong"},
    )
    assert r.status_code == 401


def test_get_users_returns_list(api_client):
    """GET /api/auth/users returns list (no auth required in current API)."""
    r = api_client.get("/api/auth/users")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
