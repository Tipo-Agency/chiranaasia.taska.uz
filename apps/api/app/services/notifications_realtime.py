"""In-memory websocket hub for notification realtime updates."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class NotificationRealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        if user_id in self._connections:
            self._connections[user_id].discard(websocket)
            if not self._connections[user_id]:
                self._connections.pop(user_id, None)

    async def emit(self, user_id: str, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in self._connections.get(user_id, set()):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)


realtime_hub = NotificationRealtimeHub()
