#!/usr/bin/env python3
"""
Скрипт однократной миграции данных из Firebase Firestore в PostgreSQL (Taska API).

Запуск после первой установки нового бэкенда на сервере:
  1. Поднять Postgres + API (docker-compose up -d или как у вас).
  2. Выставить переменные окружения (см. ниже).
  3. Запустить: python scripts/migrate_firestore_to_postgres.py

Переменные:
  BACKEND_URL          — URL API (например https://api.tipa.taska.uz или http://localhost:8000).
  FIREBASE_CREDENTIALS — путь к JSON с ключом сервисного аккаунта Firebase
                         (или GOOGLE_APPLICATION_CREDENTIALS).

Опционально:
  --dry-run            — только читать из Firestore и выводить счётчики, в API не писать.
  --from-json DIR      — не читать Firestore, загружать JSON из папки DIR (файлы: users.json, tasks.json, ...).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Загружаем .env из корня репо или из apps/api
for env_path in [Path(__file__).resolve().parent.parent / ".env", Path(__file__).resolve().parent.parent / "apps" / "api" / ".env"]:
    if env_path.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_path)
        except ImportError:
            pass
        break

BACKEND_URL = os.getenv("BACKEND_URL", "").rstrip("/")
API_BASE = f"{BACKEND_URL}/api" if BACKEND_URL else ""

# Порядок миграции: сначала справочники и настройки, потом пользователи, потом остальное.
# Каждый элемент: (firestore_collection_name, api_path, method: "put_list" | "put_one" | "post_each")
MIGRATION_MAP = [
    ("statuses", "/statuses", "put_list"),
    ("priorities", "/priorities", "put_list"),
    ("tables", "/tables", "put_list"),
    ("projects", "/projects", "put_list"),
    ("departments", "/departments", "put_list"),
    ("financeCategories", "/finance/categories", "put_list"),
    ("salesFunnels", "/funnels", "put_list"),
    ("users", "/auth/users", "put_list"),
    ("clients", "/clients", "put_list"),
    ("deals", "/deals", "put_list"),
    ("employeeInfos", "/employees", "put_list"),
    ("accountsReceivable", "/accounts-receivable", "put_list"),
    ("folders", "/folders", "put_list"),
    ("docs", "/docs", "put_list"),
    ("meetings", "/meetings", "put_list"),
    ("contentPosts", "/content-posts", "put_list"),
    ("tasks", "/tasks", "put_list"),
    ("notificationPrefs", "/notification-prefs", "put_one"),
    ("activity", "/activity", "put_list"),
    ("automationRules", "/automation/rules", "put_list"),
    ("orgPositions", "/bpm/positions", "put_list"),
    ("businessProcesses", "/bpm/processes", "put_list"),
    ("warehouses", "/inventory/warehouses", "put_list"),
    ("inventoryItems", "/inventory/items", "put_list"),
    ("stockMovements", "/inventory/movements", "put_list"),
    ("financePlan", "/finance/plan", "put_one"),
    ("purchaseRequests", "/finance/requests", "post_each"),
    ("financialPlanDocuments", "/finance/financial-plan-documents", "put_list"),
    ("financialPlannings", "/finance/financial-plannings", "put_list"),
    ("funds", "/finance/funds", "put_list"),
]


def serialize_value(v):
    """Конвертирует значения Firestore (Timestamp, etc.) в JSON-сериализуемый вид."""
    if v is None:
        return None
    type_name = type(v).__name__
    if type_name in ("Timestamp", "DatetimeWithNanoseconds"):
        return v.isoformat() if hasattr(v, "isoformat") else str(v)
    if type_name == "datetime":
        return v.isoformat() if hasattr(v, "isoformat") else str(v)
    if isinstance(v, dict):
        return {k: serialize_value(x) for k, x in v.items()}
    if isinstance(v, list):
        return [serialize_value(x) for x in v]
    return v


def doc_to_dict(doc) -> dict:
    """Из документа Firestore делаем dict с id, при необходимости конвертируем Timestamp."""
    data = doc.to_dict() if hasattr(doc, "to_dict") else dict(doc)
    data["id"] = doc.id if hasattr(doc, "id") else data.get("id")
    return {k: serialize_value(v) for k, v in data.items()}


def read_from_firestore(collection_name: str):
    """Читает коллекцию из Firestore. Требует firebase_admin и GOOGLE_APPLICATION_CREDENTIALS."""
    import firebase_admin
    from firebase_admin import firestore

    try:
        firebase_admin.get_app()
    except ValueError:
        cred_path = os.getenv("FIREBASE_CREDENTIALS") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not cred_path or not os.path.isfile(cred_path):
            raise SystemExit(
                "Для чтения из Firestore задайте FIREBASE_CREDENTIALS или GOOGLE_APPLICATION_CREDENTIALS (путь к JSON)."
            )
        cred = firebase_admin.credentials.Certificate(cred_path)
        opts = {}
        if os.getenv("FIREBASE_PROJECT_ID"):
            opts["projectId"] = os.getenv("FIREBASE_PROJECT_ID")
        firebase_admin.initialize_app(cred, options=opts)
    db = firestore.client()
    coll = db.collection(collection_name)
    out = []
    for doc in coll.stream():
        out.append(doc_to_dict(doc))
    return out


def read_from_json_dir(json_dir: Path, collection_name: str) -> list:
    """Читает массив из файла {collection_name}.json в папке json_dir."""
    # В Firestore имена коллекций в camelCase; в файлах можно хранить так же
    file_name = f"{collection_name}.json"
    path = json_dir / file_name
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    return [data]


def put_via_api(api_path: str, payload: list | dict, dry_run: bool) -> bool:
    """Отправляет данные на API (PUT)."""
    if dry_run:
        return True
    if not API_BASE:
        print("  [SKIP] BACKEND_URL не задан.")
        return False
    url = f"{API_BASE}{api_path}"
    try:
        import requests
        r = requests.put(url, json=payload, timeout=60)
        if r.status_code in (200, 201):
            return True
        print(f"  [ERROR] {r.status_code} {r.text[:200]}")
        return False
    except Exception as e:
        print(f"  [ERROR] {e}")
        return False


def post_one_via_api(api_path: str, payload: dict, dry_run: bool) -> bool:
    """Одна запись POST (например заявка на оплату)."""
    if dry_run:
        return True
    if not API_BASE:
        print("  [SKIP] BACKEND_URL не задан.")
        return False
    url = f"{API_BASE}{api_path}"
    try:
        import requests
        r = requests.post(url, json=payload, timeout=60)
        if r.status_code in (200, 201):
            return True
        print(f"  [ERROR] {r.status_code} {r.text[:200]}")
        return False
    except Exception as e:
        print(f"  [ERROR] {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Миграция Firestore → Postgres (Taska API)")
    parser.add_argument("--dry-run", action="store_true", help="Только прочитать данные, в API не писать")
    parser.add_argument("--from-json", type=str, metavar="DIR", help="Читать JSON из папки DIR вместо Firestore")
    args = parser.parse_args()

    use_firestore = not args.from_json
    json_dir = Path(args.from_json).resolve() if args.from_json else None

    if use_firestore:
        try:
            import firebase_admin
        except ImportError:
            print("Установите зависимости: pip install -r scripts/requirements-migrate.txt")
            sys.exit(1)
    else:
        if not json_dir or not json_dir.is_dir():
            print("Папка для --from-json не найдена:", args.from_json)
            sys.exit(1)

    if not args.dry_run and not API_BASE:
        print("Задайте BACKEND_URL в .env или в окружении.")
        sys.exit(1)

    print("Миграция Firestore → Postgres (Taska API)")
    if args.dry_run:
        print("Режим: --dry-run (в API не пишем)")
    if json_dir:
        print("Источник: JSON из", json_dir)
    else:
        print("Источник: Firestore")
    print("API:", API_BASE or "(не задан)")
    print()

    ok = 0
    fail = 0
    for collection_name, api_path, method in MIGRATION_MAP:
        if use_firestore:
            try:
                items = read_from_firestore(collection_name)
            except Exception as e:
                print(f"[{collection_name}] Firestore: {e}")
                fail += 1
                continue
        else:
            items = read_from_json_dir(json_dir, collection_name)

        if method == "put_one":
            if not items:
                print(f"  {collection_name} -> {api_path}: (пусто)")
                ok += 1
                continue
            payload = items[0] if isinstance(items[0], dict) else items[0]
            success = put_via_api(api_path, payload, args.dry_run)
        elif method == "post_each":
            if not items:
                success = True
            else:
                success = True
                rows = items if isinstance(items, list) else [items]
                for row in rows:
                    if not isinstance(row, dict):
                        success = False
                        break
                    if not post_one_via_api(api_path, row, args.dry_run):
                        success = False
                        break
        else:
            payload = items
            success = put_via_api(api_path, payload, args.dry_run) if payload else True

        label = f"  {collection_name} -> {api_path}: {len(items) if isinstance(items, list) else 1} записей"
        if success:
            print(f"{label} OK")
            ok += 1
        else:
            print(f"{label} FAIL")
            fail += 1

    print()
    print(f"Итого: {ok} OK, {fail} ошибок.")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
