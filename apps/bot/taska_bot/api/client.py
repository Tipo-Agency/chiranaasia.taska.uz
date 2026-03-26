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

    async def get_statuses(self) -> list[dict]:
        r = await self._http.get("/statuses")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def get_priorities(self) -> list[dict]:
        r = await self._http.get("/priorities")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def get_departments(self) -> list[dict]:
        r = await self._http.get("/departments")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def get_finance_categories(self) -> list[dict]:
        r = await self._http.get("/finance/categories")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def get_finance_requests(self) -> list[dict]:
        r = await self._http.get("/finance/requests")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def put_finance_requests(self, requests: list[dict]) -> bool:
        r = await self._http.put("/finance/requests", json=requests)
        return r.status_code == 200

    async def put_tasks(self, tasks: list[dict]) -> bool:
        r = await self._http.put("/tasks", json=tasks)
        return r.status_code == 200

    async def put_deals(self, deals: list[dict]) -> bool:
        r = await self._http.put("/deals", json=deals)
        return r.status_code == 200

    async def put_meetings(self, meetings: list[dict]) -> bool:
        r = await self._http.put("/meetings", json=meetings)
        return r.status_code == 200

    async def get_messages(self, *, folder: str, user_id: str) -> list[dict]:
        r = await self._http.get("/messages", params={"folder": folder, "user_id": user_id})
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def post_message(self, body: dict) -> bool:
        r = await self._http.post("/messages", json=body)
        return r.status_code == 200

    async def patch_message_read(self, message_id: str, read: bool = True) -> bool:
        r = await self._http.patch(f"/messages/{message_id}", json={"read": read})
        return r.status_code == 200

    async def run_notification_deliveries(self, limit: int = 200) -> dict:
        r = await self._http.post("/notifications/deliveries/run", params={"limit": limit})
        if r.status_code != 200:
            return {}
        data = r.json()
        return data if isinstance(data, dict) else {}

    async def get_processes(self) -> list[dict]:
        r = await self._http.get("/bpm/processes")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def put_processes(self, processes: list[dict]) -> bool:
        r = await self._http.put("/bpm/processes", json=processes)
        return r.status_code == 200

    async def get_positions(self) -> list[dict]:
        r = await self._http.get("/bpm/positions")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def put_positions(self, positions: list[dict]) -> bool:
        r = await self._http.put("/bpm/positions", json=positions)
        return r.status_code == 200

    async def get_employees(self) -> list[dict]:
        r = await self._http.get("/employees")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def get_weekly_plans(self, *, user_id: str) -> list[dict]:
        r = await self._http.get("/weekly-plans", params={"user_id": user_id})
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

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

    async def get_meetings(self) -> list[dict]:
        r = await self._http.get("/meetings")
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
