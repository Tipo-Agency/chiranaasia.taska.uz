"""Realtime in-app уведомления: WebSocket по ``user_id`` + Redis Pub/Sub между воркерами API."""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

from app.core.config import get_settings
from app.core.redis import (
    get_redis_client,
    notifications_user_pubsub_channel,
    notifications_user_pubsub_pattern,
    notifications_user_pubsub_prefix,
)

log = logging.getLogger("uvicorn.error")


class NotificationRealtimeHub:
    """Локальные WebSocket по пользователю; доставка через Redis PUBLISH → PSUBSCRIBE на каждом процессе."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._subscriber_task: asyncio.Task | None = None

    @staticmethod
    def normalize_user_id(user_id: str) -> str:
        return (user_id or "").strip()

    async def connect(self, user_id: str, websocket: WebSocket) -> bool:
        uid = self.normalize_user_id(user_id)
        mx = int(get_settings().WEBSOCKET_MAX_CONNECTIONS_PER_USER or 0)
        if mx > 0:
            cur = len(self._connections.get(uid, ()))
            if cur >= mx:
                await websocket.close(code=1008, reason="max websocket tabs per user")
                return False
        await websocket.accept()
        self._connections[uid].add(websocket)
        return True

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        uid = self.normalize_user_id(user_id)
        if uid in self._connections:
            self._connections[uid].discard(websocket)
            if not self._connections[uid]:
                self._connections.pop(uid, None)

    async def _deliver_local(self, user_id: str, payload: dict[str, Any]) -> None:
        uid = self.normalize_user_id(user_id)
        dead: list[WebSocket] = []
        for ws in list(self._connections.get(uid, ())):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(uid, ws)

    async def emit(self, user_id: str, payload: dict[str, Any]) -> None:
        """
        Сообщить подписчикам ``user_id``: PUBLISH в Redis (все инстансы/воркеры),
        при сбое Redis — только локальные сокеты этого процесса.
        """
        uid = self.normalize_user_id(user_id)
        if not uid:
            return
        redis = await get_redis_client()
        if redis:
            try:
                await redis.publish(notifications_user_pubsub_channel(uid), json.dumps(payload, default=str))
            except Exception as exc:
                log.warning("notifications realtime: publish failed user_id=%s: %s", uid, exc)
                await self._deliver_local(uid, payload)
        else:
            await self._deliver_local(uid, payload)

    async def redis_subscriber_loop(self) -> None:
        """Фоновый цикл PSUBSCRIBE (один на процесс uvicorn/gunicorn worker)."""
        pattern = notifications_user_pubsub_pattern()
        prefix = notifications_user_pubsub_prefix()
        while True:
            try:
                redis = await get_redis_client()
                if not redis:
                    await asyncio.sleep(5)
                    continue
                pubsub = redis.pubsub()
                try:
                    await pubsub.psubscribe(pattern)
                    log.info("notifications realtime: PSUBSCRIBE %s", pattern)
                    while True:
                        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30.0)
                        if msg is None:
                            continue
                        if msg.get("type") != "pmessage":
                            continue
                        ch = msg.get("channel")
                        if isinstance(ch, bytes):
                            ch = ch.decode()
                        raw = msg.get("data")
                        if isinstance(raw, bytes):
                            raw = raw.decode()
                        if not isinstance(ch, str) or not ch.startswith(prefix) or not raw:
                            continue
                        target_uid = ch[len(prefix) :]
                        if not target_uid:
                            continue
                        try:
                            payload = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        if not isinstance(payload, dict):
                            continue
                        await self._deliver_local(target_uid, payload)
                finally:
                    try:
                        await pubsub.punsubscribe(pattern)
                    except Exception:
                        pass
                    try:
                        await pubsub.aclose()
                    except Exception:
                        pass
            except asyncio.CancelledError:
                log.info("notifications realtime: subscriber cancelled")
                break
            except Exception as exc:
                log.warning("notifications realtime: pubsub loop error: %s", exc)
                await asyncio.sleep(2)

    def start_redis_subscriber(self) -> None:
        if self._subscriber_task and not self._subscriber_task.done():
            return
        self._subscriber_task = asyncio.create_task(self.redis_subscriber_loop())

    async def stop_redis_subscriber(self) -> None:
        t = self._subscriber_task
        self._subscriber_task = None
        if t and not t.done():
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass


realtime_hub = NotificationRealtimeHub()
