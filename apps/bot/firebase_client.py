"""
Клиент данных — Python FastAPI backend.
Firebase полностью удалён. Требуется BACKEND_URL в .env
"""
import os

# BACKEND_URL обязателен
BACKEND_URL = os.getenv('BACKEND_URL', '').strip()
if not BACKEND_URL:
    raise ValueError(
        "BACKEND_URL is required. Add to .env: BACKEND_URL=http://localhost:8000"
    )

from backend_client import backend_client

# Алиас для совместимости с существующим кодом
firebase = backend_client
FirebaseClient = type('FirebaseClient', (), {})

__all__ = ['FirebaseClient', 'firebase']
