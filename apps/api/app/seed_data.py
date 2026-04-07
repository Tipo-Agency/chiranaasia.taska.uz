"""Default seed data."""
DEFAULT_FINANCE_CATEGORIES = [
    {"id": "fc1", "name": "ФОТ (Зарплаты)", "type": "percent", "value": 40, "color": "bg-blue-100 text-blue-700"},
    {"id": "fc2", "name": "Налоги", "type": "percent", "value": 12, "color": "bg-red-100 text-red-700"},
    {"id": "fc3", "name": "Реклама", "type": "percent", "value": 15, "color": "bg-purple-100 text-purple-700"},
    {"id": "fc4", "name": "Аренда офиса", "type": "fixed", "value": 5000000, "color": "bg-orange-100 text-orange-700"},
    {"id": "fc5", "name": "Сервисы / Софт", "type": "fixed", "value": 1000000, "color": "bg-green-100 text-green-700"},
    {"id": "fc6", "name": "Дивиденды", "type": "percent", "value": 10, "color": "bg-yellow-100 text-yellow-700"},
]

DEFAULT_FUNDS = [
    {"id": "fund-1", "name": "Операционный", "order": 1},
    {"id": "fund-2", "name": "Закупки", "order": 2},
    {"id": "fund-3", "name": "Резерв", "order": 3},
]
