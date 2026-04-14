import React, { useEffect, useState } from 'react';
import { Link2, ChevronDown, ChevronRight } from 'lucide-react';
import { integrationsRoadmapEndpoint } from '../../services/apiClient';
import type {
  IntegrationRoadmapDomain,
  IntegrationRoadmapItem,
  IntegrationsRoadmapResponse,
} from '../../types/integrationsRoadmap';

const STATUS_LABEL: Record<string, string> = {
  planned: 'В планах',
  design: 'Проектирование',
  alpha: 'Альфа',
  beta: 'Бета',
  stable: 'Стабильно',
};

function ItemCard({ item }: { item: IntegrationRoadmapItem }) {
  const [open, setOpen] = useState(false);
  const status = STATUS_LABEL[item.status] ?? item.status;

  return (
    <div className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden bg-white/80 dark:bg-[#1f1f1f]/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors"
      >
        <span className="mt-0.5 text-gray-500 dark:text-gray-400 shrink-0">
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">{item.title}</span>
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
              {status}
            </span>
          </div>
          {item.description ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.description}</p>
          ) : null}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 pl-12 space-y-3 border-t border-gray-100 dark:border-[#2a2a2a]">
          {item.connector_kinds.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1.5">
                Виды коннекторов
              </div>
              <ul className="space-y-2">
                {item.connector_kinds.map((c) => (
                  <li key={c.id} className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{c.title}</span>
                    {c.description ? <span className="text-gray-500 dark:text-gray-500"> — {c.description}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {item.provider_hints.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1.5">
                Провайдеры / стеки
              </div>
              <div className="flex flex-wrap gap-2">
                {item.provider_hints.map((p) => (
                  <span
                    key={p.id}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300"
                  >
                    {p.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DomainSection({ domain }: { domain: IntegrationRoadmapDomain }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Link2 size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
          {domain.title}
        </h3>
        {domain.summary ? <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{domain.summary}</p> : null}
      </div>
      <div className="space-y-2">
        {domain.items.map((item) => (
          <React.Fragment key={item.id}>
            <ItemCard item={item} />
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

/**
 * Каталог планируемых интеграций (почта, 1С, телефония, ЭДО, банки) — данные с бэкенда, без секретов.
 */
export const IntegrationsRoadmapSettings: React.FC = () => {
  const [data, setData] = useState<IntegrationsRoadmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    integrationsRoadmapEndpoint
      .get()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Не удалось загрузить каталог');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-8 text-center text-gray-500 dark:text-gray-400">
        Загрузка каталога…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white dark:bg-[#252525] border border-red-200 dark:border-red-900/40 rounded-2xl p-6 text-red-700 dark:text-red-300">
        {error ?? 'Нет данных'}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-200/60 dark:border-indigo-500/30 rounded-2xl p-4 md:p-5">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Ниже — дорожная карта интеграций (версия каталога <strong>{data.version}</strong>): корпоративная почта, отдельный
          блок сценариев для <strong>1С</strong>, IP-телефония, <strong>ЭДО</strong>, несколько{' '}
          <strong>банковских</strong> подключений. Реализации появятся поэтапно; детали в репозитории:{' '}
          <code className="text-xs bg-white/60 dark:bg-black/30 px-1.5 py-0.5 rounded">docs/INTEGRATIONS.md</code> §12.
        </p>
      </div>
      {data.domains.map((domain) => (
        <React.Fragment key={domain.id}>
          <DomainSection domain={domain} />
        </React.Fragment>
      ))}
    </div>
  );
};
