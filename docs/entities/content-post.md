# Пост контент-плана (`ContentPost`)

## Назначение

Единица контента (пост, рилс, сторис и т.д.) с датой публикации, темой, статусом, исполнителем в рамках **таблицы** контент-плана.

## Бизнес-правила

- Привязка к **`table_id`** (`TableCollection` типа контент-план).
- Поле **формата** (тип контента) используется в фильтрах и подписях в календаре.
- Архивация через `is_archived` — пост скрывается из выдачи.

## Хранение в БД

**Таблица:** `content_posts`  
**Модель:** `ContentPost` — `apps/api/app/models/content.py`.

## API

`apps/api/app/routers/content_posts.py`; публичные данные агрегируются через `tables.public`.

## UI

`ContentPlanView`, публично — `PublicContentPlanView` (`/content-plan/:tableId`).
