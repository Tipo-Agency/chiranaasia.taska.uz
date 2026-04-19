import React, { useCallback, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { orgEndpoint } from '../../services/apiClient';
import { applyOrgBrandingToDocument, type OrgBrandingDto } from '../../utils/applyOrgBranding';
import { Button, Input } from '../ui';

export const BrandingSettings: React.FC = () => {
  const [primaryColor, setPrimaryColor] = useState('#F97316');
  const [logoSvg, setLogoSvg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    orgEndpoint
      .getBranding()
      .then((d: OrgBrandingDto) => {
        if (cancelled) return;
        setPrimaryColor(d.primaryColor || '#F97316');
        setLogoSvg(d.logoSvg || '');
      })
      .catch(() => {
        if (!cancelled) setMessage('Не удалось загрузить настройки');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const previewSvg = useCallback(() => {
    const raw = logoSvg.trim();
    if (!raw) return null;
    return DOMPurify.sanitize(raw, { USE_PROFILES: { svg: true } });
  }, [logoSvg]);

  const save = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const d = await orgEndpoint.patchBranding({
        primaryColor,
        logoSvg: logoSvg.trim() ? logoSvg.trim() : null,
      });
      applyOrgBrandingToDocument(d);
      setMessage('Сохранено');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">Загрузка…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Компания</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Логотип и основной цвет на экране входа и в интерфейсе (кнопки с акцентом).
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">
          Основной цвет (#RRGGBB)
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-14 rounded border border-gray-200 dark:border-[#444] bg-white cursor-pointer"
            aria-label="Выбор цвета"
          />
          <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#F97316" fullWidth />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">
          Логотип (SVG)
        </label>
        <textarea
          value={logoSvg}
          onChange={(e) => setLogoSvg(e.target.value)}
          rows={8}
          placeholder="<svg xmlns=…>…</svg>"
          className="w-full px-3 py-2 text-sm font-mono border border-gray-200 dark:border-[#444] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Пустое поле — стандартная иконка приложения.</p>
        {previewSvg() ? (
          <div className="mt-3 flex justify-center p-4 border border-dashed border-gray-200 dark:border-[#444] rounded-xl bg-gray-50 dark:bg-[#1a1a1a]">
            <div
              className="max-h-28 max-w-[200px] [&_svg]:max-h-28 [&_svg]:w-auto"
              dangerouslySetInnerHTML={{ __html: previewSvg()! }}
            />
          </div>
        ) : null}
      </div>

      {message ? (
        <div
          className={`text-sm rounded-lg px-3 py-2 ${
            message === 'Сохранено'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }`}
        >
          {message}
        </div>
      ) : null}

      <Button type="button" variant="primary" onClick={() => void save()} disabled={saving}>
        {saving ? 'Сохранение…' : 'Сохранить'}
      </Button>
    </div>
  );
};
