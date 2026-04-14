"""
Статический каталог планируемых интеграций.

Полный смысл и контракты — docs/INTEGRATIONS.md §12. Здесь только структура для API/UI.
"""

from __future__ import annotations

from app.schemas.integrations_roadmap import (
    IntegrationConnectorKind,
    IntegrationProviderHint,
    IntegrationRoadmapDomain,
    IntegrationRoadmapItem,
    IntegrationsRoadmapResponse,
)


def build_integrations_roadmap() -> IntegrationsRoadmapResponse:
    return IntegrationsRoadmapResponse(
        version="2",
        domains=[
            IntegrationRoadmapDomain(
                id="email_corp",
                title="Корпоративная почта",
                summary="Входящая/исходящая почта домена, привязка к сделкам и задачам, OAuth.",
                items=[
                    IntegrationRoadmapItem(
                        id="google_workspace",
                        title="Google Workspace",
                        description="Gmail API / Pub/Sub push, OAuth 2.0, делегирование домена при необходимости.",
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="gmail_api",
                                title="Gmail API",
                                description="Синхронизация ящиков, метки, вложения через API; квоты и batch.",
                            ),
                            IntegrationConnectorKind(
                                id="imap_smtp",
                                title="IMAP / SMTP",
                                description="Универсальный fallback, если API недоступен по политике заказчика.",
                            ),
                        ],
                        provider_hints=[
                            IntegrationProviderHint(id="google", title="Google Workspace"),
                        ],
                    ),
                    IntegrationRoadmapItem(
                        id="yandex_360",
                        title="Яндекс 360 / Яндекс.Почта для бизнеса",
                        description="OAuth, IMAP/SMTP по документации Яндекса; лимиты и двухфакторная политика.",
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="yandex_oauth_imap",
                                title="OAuth + IMAP",
                            ),
                        ],
                        provider_hints=[
                            IntegrationProviderHint(id="yandex", title="Яндекс"),
                        ],
                    ),
                    IntegrationRoadmapItem(
                        id="microsoft_365",
                        title="Microsoft 365 / Outlook",
                        description="Graph API, OAuth; частый запрос у корпоративных клиентов рядом с Google.",
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="graph_mail",
                                title="Microsoft Graph (почта)",
                            ),
                            IntegrationConnectorKind(
                                id="ews_imap",
                                title="EWS / IMAP (legacy)",
                                description="Только если политика заказчика не допускает Graph.",
                            ),
                        ],
                        provider_hints=[
                            IntegrationProviderHint(id="microsoft", title="Microsoft 365"),
                        ],
                    ),
                ],
            ),
            IntegrationRoadmapDomain(
                id="onec",
                title="1С",
                summary=(
                    "Отдельный раздел продукта: из 1С бывают разные сценарии — номенклатура, контрагенты, "
                    "заказы, банк, зарплата. Несколько информационных баз и несколько коннекторов на организацию."
                ),
                items=[
                    IntegrationRoadmapItem(
                        id="onec_multi_base",
                        title="Несколько баз и сценариев на одну организацию",
                        description=(
                            "ERP, розница, ЗУП, отдельная бухгалтерия — отдельные коннекторы или кластеры; "
                            "общий аудит, идемпотентность по GUID документа 1С."
                        ),
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="per_base_connector",
                                title="Коннектор на информационную базу",
                            ),
                            IntegrationConnectorKind(
                                id="shared_worker_pool",
                                title="Общий пул воркеров с маршрутизацией по base_id",
                            ),
                        ],
                    ),
                    IntegrationRoadmapItem(
                        id="onec_odata",
                        title="Публикация OData (стандарт 1С)",
                        description="Чтение справочников и документов через стандартную OData; версионирование метаданных.",
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="odata_catalog_read",
                                title="Чтение каталога",
                            ),
                            IntegrationConnectorKind(
                                id="odata_documents_poll",
                                title="Опрос документов / регистров",
                            ),
                        ],
                    ),
                    IntegrationRoadmapItem(
                        id="onec_http_service",
                        title="HTTP-сервисы конфигурации",
                        description="Вызов процедур 1С по REST/SOAP, описанным в конфигурации.",
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="http_json_rpc",
                                title="JSON/XML по контракту конфигурации",
                            ),
                        ],
                    ),
                    IntegrationRoadmapItem(
                        id="onec_exchange",
                        title="Обмен через файлы (CommerceML, EnterpriseData, произвольный XML/JSON)",
                        description="Загрузка/выгрузка файлов, парсинг, идемпотентность по GUID документа 1С.",
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="xml_exchange",
                                title="Файловый обмен",
                            ),
                        ],
                    ),
                    IntegrationRoadmapItem(
                        id="onec_direct_db",
                        title="Прямой доступ к БД 1С",
                        description="[Опционально, нежелательно] Только изолированный read-only и явный риск; предпочтительны OData/HTTP.",
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="readonly_sql",
                                title="Read-only SQL / view",
                                description="Только при отсутствии альтернатив и с согласованием безопасности.",
                            ),
                        ],
                    ),
                ],
            ),
            IntegrationRoadmapDomain(
                id="telephony",
                title="IP-телефония",
                summary="События звонков, запись разговоров, click-to-call, привязка к CRM; несколько АТС на организацию.",
                items=[
                    IntegrationRoadmapItem(
                        id="sip_ats_webhook",
                        title="Вебхуки АТС",
                        description="Входящие события: звонок, ответ, завершение, запись; нормализация в единую модель CallEvent.",
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="webhook_generic",
                                title="Унифицированный вебхук",
                                description="Адаптеры под Asterisk AMI/ARI, Mango Office, МТС Exolve, Zadarma и др.",
                            ),
                            IntegrationConnectorKind(
                                id="cti_popup",
                                title="CTI / экранная форма",
                                description="Открытие карточки клиента по номеру при входящем.",
                            ),
                        ],
                        provider_hints=[
                            IntegrationProviderHint(id="asterisk", title="Asterisk / FreePBX"),
                            IntegrationProviderHint(id="mango", title="Mango Office"),
                            IntegrationProviderHint(id="mts_exolve", title="МТС Exolve"),
                            IntegrationProviderHint(id="zadarma", title="Zadarma"),
                        ],
                    ),
                ],
            ),
            IntegrationRoadmapDomain(
                id="edo",
                title="ЭДО",
                summary="Электронный документооборот: УПД, акты, статусы, подписи; обычно через операторов.",
                items=[
                    IntegrationRoadmapItem(
                        id="edo_operator",
                        title="Операторы ЭДО",
                        description="Интеграция через API оператора (Контур, СБИС, Диадок и т.д.) — разные контракты, общий слой доменных сущностей.",
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="document_flow",
                                title="Исходящие/входящие УПД и статусы",
                            ),
                            IntegrationConnectorKind(
                                id="signature_status",
                                title="Статусы подписания и отказов",
                            ),
                        ],
                        provider_hints=[
                            IntegrationProviderHint(id="kontur", title="Контур"),
                            IntegrationProviderHint(id="sbis", title="СБИС"),
                            IntegrationProviderHint(id="diadoc", title="Диадок"),
                        ],
                    ),
                ],
            ),
            IntegrationRoadmapDomain(
                id="banking",
                title="Банки",
                summary="Несколько банков и несколько типов подключений на организацию; единый реестр счетов и коннекторов.",
                items=[
                    IntegrationRoadmapItem(
                        id="banking_registry",
                        title="Реестр банковских подключений",
                        description=(
                            "Несколько активных коннекторов: разные БИК, расчётные счета, договоры API; "
                            "агрегация выписок в финансовом модуле без дублирования движений."
                        ),
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="connector_per_account",
                                title="Один коннектор на счёт / договор",
                            ),
                            IntegrationConnectorKind(
                                id="import_routing_rules",
                                title="Правила маршрутизации импорта",
                                description="Какой поток в какую статью/проект; идемпотентность по bank_tx_id.",
                            ),
                        ],
                    ),
                    IntegrationRoadmapItem(
                        id="bank_statements",
                        title="Выписки и движения",
                        description="Импорт выписок (1С-клиент банка, SFTP, API банка), сверка с платежами в CRM/финансах.",
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="api_open_banking",
                                title="Open Banking / API банка",
                            ),
                            IntegrationConnectorKind(
                                id="file_swift_mt940",
                                title="Файлы MT940 / CAMT / CSV",
                            ),
                            IntegrationConnectorKind(
                                id="onec_bank_exchange",
                                title="Обмен через 1С «Клиент банка»",
                                description="Файлы или шина 1С как посредник — см. домен onec.",
                            ),
                        ],
                    ),
                    IntegrationRoadmapItem(
                        id="bank_payments",
                        title="Исходящие платежи",
                        description="Формирование платёжных поручений, статусы исполнения, лимиты и подпись.",
                        status="planned",
                        connector_kinds=[
                            IntegrationConnectorKind(
                                id="payment_api",
                                title="API банка",
                            ),
                            IntegrationConnectorKind(
                                id="file_elk",
                                title="Файловый обмен (клиент-банк)",
                            ),
                        ],
                    ),
                ],
            ),
        ],
    )
