"""Асинхронный клиент к FastAPI `/api` (httpx)."""
from __future__ import annotations

from typing import Any, Optional

import httpx

# Имя cookie CSRF совпадает с CSRF_COOKIE_NAME в API (по умолчанию csrf_token).
_CSRF_COOKIE_NAME = "csrf_token"


def _deal_dict_camel_aliases(raw: dict[str, Any]) -> dict[str, Any]:
    """GET /deals отдаёт snake_case (DealRead); код бота ожидает camelCase — дублируем ключи."""
    d = dict(raw)
    for sk, ck in (
        ("is_archived", "isArchived"),
        ("assignee_id", "assigneeId"),
        ("funnel_id", "funnelId"),
        ("updated_at", "updatedAt"),
        ("created_at", "createdAt"),
        ("contact_name", "contactName"),
        ("client_id", "clientId"),
        ("project_id", "projectId"),
        ("source_chat_id", "telegramChatId"),
    ):
        if ck not in d and sk in d:
            d[ck] = d[sk]
    return d


class ApiClient:
    def __init__(self, backend_base: str) -> None:
        base = backend_base.rstrip("/") + "/api"
        self._http = httpx.AsyncClient(base_url=base, timeout=httpx.Timeout(60.0))

    def _mut_headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        """Заголовки для POST/PUT/PATCH (double-submit CSRF после login)."""
        out: dict[str, str] = dict(extra or {})
        v = self._http.cookies.get(_CSRF_COOKIE_NAME)
        if v:
            out["X-CSRF-Token"] = str(v)
        return out

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

    async def put_users(self, users: list[dict], *, bearer: Optional[str] = None) -> bool:
        headers: dict[str, str] = self._mut_headers()
        if bearer and bearer.strip():
            headers["Authorization"] = f"Bearer {bearer.strip()}"
        r = await self._http.put("/auth/users", json=users, headers=headers)
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
        """GET /finance/requests с пагинацией (items/total/limit/offset)."""
        all_rows: list[dict] = []
        offset = 0
        limit = 500
        while True:
            r = await self._http.get("/finance/requests", params={"limit": limit, "offset": offset})
            if r.status_code != 200:
                return all_rows
            data = r.json()
            if not isinstance(data, dict):
                return all_rows
            items = data.get("items")
            if not isinstance(items, list):
                return all_rows
            for x in items:
                if isinstance(x, dict):
                    all_rows.append(x)
            offset += len(items)
            total = int(data.get("total") or 0)
            if len(items) < limit or offset >= total:
                break
        return all_rows

    async def post_finance_request(self, body: dict) -> bool:
        r = await self._http.post("/finance/requests", json=body, headers=self._mut_headers())
        return r.status_code == 201

    async def patch_finance_request(self, request_id: str, body: dict) -> bool:
        rid = str(request_id).strip()
        if not rid:
            return False
        r = await self._http.patch(
            f"/finance/requests/{rid}",
            json=body,
            headers=self._mut_headers(),
        )
        return r.status_code == 200

    async def put_tasks(self, tasks: list[dict]) -> bool:
        r = await self._http.put("/tasks", json=tasks, headers=self._mut_headers())
        return r.status_code == 200

    async def put_deals(self, deals: list[dict]) -> bool:
        r = await self._http.put("/deals", json=deals, headers=self._mut_headers())
        return r.status_code == 200

    async def put_meetings(self, meetings: list[dict]) -> bool:
        r = await self._http.put("/meetings", json=meetings, headers=self._mut_headers())
        return r.status_code == 200

    async def get_messages(
        self,
        *,
        folder: str,
        user_id: str,
        deal_id: str | None = None,
        limit: int = 500,
        offset: int = 0,
        order: str = "desc",
    ) -> list[dict]:
        params: dict = {
            "folder": folder,
            "user_id": user_id,
            "limit": limit,
            "offset": offset,
            "order": order,
        }
        if deal_id:
            params["deal_id"] = deal_id
        r = await self._http.get("/messages", params=params)
        if r.status_code != 200:
            return []
        data = r.json()
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            return data["items"]
        return data if isinstance(data, list) else []

    async def post_message(self, body: dict) -> bool:
        r = await self._http.post("/messages", json=body, headers=self._mut_headers())
        return r.status_code == 200

    async def patch_message_read(self, message_id: str, read: bool = True) -> bool:
        r = await self._http.patch(
            f"/messages/{message_id}",
            json={"read": read},
            headers=self._mut_headers(),
        )
        return r.status_code == 200

    async def run_notification_deliveries(self, limit: int = 200) -> dict:
        r = await self._http.post(
            "/notifications/deliveries/run",
            params={"limit": limit},
            headers=self._mut_headers(),
        )
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
        r = await self._http.put("/bpm/processes", json=processes, headers=self._mut_headers())
        return r.status_code == 200

    async def get_positions(self) -> list[dict]:
        r = await self._http.get("/bpm/positions")
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []

    async def put_positions(self, positions: list[dict]) -> bool:
        r = await self._http.put("/bpm/positions", json=positions, headers=self._mut_headers())
        return r.status_code == 200

    async def get_employees(self) -> list[dict]:
        """GET /employees — пагинация items/total; по умолчанию без архива."""
        all_rows: list[dict] = []
        offset = 0
        limit = 500
        while True:
            r = await self._http.get("/employees", params={"limit": limit, "offset": offset})
            if r.status_code != 200:
                return all_rows
            data = r.json()
            if isinstance(data, dict) and isinstance(data.get("items"), list):
                items = data["items"]
                total = int(data.get("total") or 0)
                all_rows.extend(items)
                offset += len(items)
                if not items or offset >= total:
                    break
                continue
            return data if isinstance(data, list) else []
        return all_rows

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
        """GET /deals с пагинацией (items/total/limit/offset)."""
        all_rows: list[dict] = []
        offset = 0
        limit = 500
        while True:
            r = await self._http.get("/deals", params={"limit": limit, "offset": offset})
            if r.status_code != 200:
                return all_rows
            data = r.json()
            if not isinstance(data, dict):
                return all_rows
            items = data.get("items")
            if not isinstance(items, list):
                return all_rows
            all_rows.extend(_deal_dict_camel_aliases(x) if isinstance(x, dict) else x for x in items)
            offset += len(items)
            total = int(data.get("total") or 0)
            if len(items) < limit or len(all_rows) >= total:
                break
        return all_rows

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
        """GET /clients с пагинацией (ответ { items, total, limit, offset })."""
        out: list[dict] = []
        offset = 0
        limit = 500
        while True:
            r = await self._http.get("/clients", params={"limit": limit, "offset": offset})
            if r.status_code != 200:
                return out
            data = r.json()
            if not isinstance(data, dict):
                return out
            items = data.get("items")
            if not isinstance(items, list):
                return out
            out.extend(x for x in items if isinstance(x, dict))
            offset += len(items)
            total = int(data.get("total") or 0)
            if len(items) < limit or offset >= total:
                break
        return out

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
        r = await self._http.put(
            "/notification-prefs",
            params={"user_id": user_id},
            json=body,
            headers=self._mut_headers(),
        )
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

    async def link_telegram_to_user(
        self,
        crm_user_id: str,
        telegram_user_id: str,
        *,
        access_token: Optional[str] = None,
    ) -> bool:
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
        return await self.put_users(out, bearer=access_token)
