"""Generic CRUD helpers."""
from typing import TypeVar, Type, List, Optional, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base

ModelT = TypeVar("ModelT", bound=Base)


def model_to_dict(model: Base, mapping: dict) -> dict:
    """Convert ORM model to dict using column->key mapping."""
    if model is None:
        return None
    result = {}
    for col_name, out_key in mapping.items():
        val = getattr(model, col_name, None)
        if val is not None and hasattr(val, "isoformat"):
            val = val.isoformat()
        result[out_key] = val
    return result


def dict_to_model(model_class: Type[ModelT], data: dict, mapping: dict) -> ModelT:
    """Create or update model from dict using mapping."""
    instance = model_class()
    for col_name, in_key in mapping.items():
        if in_key in data:
            val = data[in_key]
            setattr(instance, col_name, val)
    return instance
