"""Асинхронный клиент к FastAPI `/api` (httpx)."""
from __future__ import annotations

from typing import Any, Optional

import httpx


class ApiClient:
    def __init__(self, backend_base: str) -> None:
        base = backend_base.rstrip("/") + "/api"
        self._http = httpx.AsyncClient(base_url=base, timeout=httpx.Timeout(60.0))

    async def aclose(self) -> None:
        await self._http.aclose()

    async def login(self, login: str, password: str) -> Optional[dict]:
        r = await self._http.post("/auth/login", json={"login": login.strip(), "password": password})
        if r.status_code != 200:
            return None
        return r.json()

    async def get_users(self) -> list[dict]:
        r = await self._http.get("/auth/users")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def put_users(self, users: list[dict]) -> bool:
        r = await self._http.put("/auth/users", json=users)
        return r.status_code == 200

    async def get_tasks(self) -> list[dict]:
        r = await self._http.get("/tasks")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def get_deals(self) -> list[dict]:
        r = await self._http.get("/deals")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def get_funnels(self) -> list[dict]:
        r = await self._http.get("/funnels")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def get_clients(self) -> list[dict]:
        r = await self._http.get("/clients")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def get_tables(self) -> list[dict]:
        r = await self._http.get("/tables")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def get_content_posts(self) -> list[dict]:
        r = await self._http.get("/content-posts")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def get_notification_prefs(self, user_id: str = "default") -> Optional[dict]:
        r = await self._http.get("/notification-prefs", params={"user_id": user_id})
        if r.status_code != 200:
            return None
        data = r.json()
        return data if isinstance(data, dict) else None

    async def put_notification_prefs(self, prefs: dict, user_id: str = "default") -> bool:
        body = dict(prefs)
        r = await self._http.put("/notification-prefs", params={"user_id": user_id}, json=body)
        return r.status_code == 200

    async def find_user_by_telegram_id(self, telegram_user_id: str | int) -> Optional[dict]:
        tid = str(telegram_user_id).strip()
        for u in await self.get_users():
            if u.get("isArchived"):
                continue
            u_tid = u.get("telegramUserId")
            if u_tid is not None and str(u_tid).strip() == tid:
                return u
        return None

    async def link_telegram_to_user(self, crm_user_id: str, telegram_user_id: str) -> bool:
        users = await self.get_users()
        if not users:
            return False
        found = False
        out: list[dict[str, Any]] = []
        for u in users:
            u2 = dict(u)
            u2.pop("password", None)
            if u.get("id") == crm_user_id:
                u2["telegramUserId"] = str(telegram_user_id)
                found = True
            out.append(u2)
        if not found:
            return False
        return await self.put_users(out)
