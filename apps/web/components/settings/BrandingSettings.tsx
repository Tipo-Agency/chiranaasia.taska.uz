import React, { useCallback, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { useOrgBranding } from '../../contexts/OrgBrandingContext';
import { orgEndpoint } from '../../services/apiClient';
import {
  applyOrgBrandingToDocument,
  normalizePrimaryColorHex,
  tryNormalizePrimaryColorHex,
  type OrgBrandingDto,
} from '../../utils/applyOrgBranding';
import { Button, Input } from '../ui';

function sanitizeSvg(raw: string): string {
  return DOMPurify.sanitize(raw.trim(), { USE_PROFILES: { svg: true } });
}

export const BrandingSettings: React.FC = () => {
  const { setBrandingLocal } = useOrgBranding();
  const [primaryColor, setPrimaryColor] = useState('#F97316');
  const [logoSvgLight, setLogoSvgLight] = useState('');
  const [logoSvgDark, setLogoSvgDark] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    orgEndpoint
      .getBranding()
      .then((d: OrgBrandingDto) => {
        if (cancelled) return;
        setPrimaryColor(normalizePrimaryColorHex(d.primaryColor, '#F97316'));
        setLogoSvgLight(d.logoSvgLight || '');
        setLogoSvgDark(d.logoSvgDark || '');
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

  const previewLight = useCallback(() => {
    const raw = logoSvgLight.trim();
    if (!raw) return null;
    return sanitizeSvg(raw);
  }, [logoSvgLight]);

  const previewDark = useCallback(() => {
    const raw = (logoSvgDark.trim() || logoSvgLight.trim());
    if (!raw) return null;
    return sanitizeSvg(raw);
  }, [logoSvgDark, logoSvgLight]);

  const save = async () => {
    setMessage(null);
    const c = tryNormalizePrimaryColorHex(primaryColor);
    if (!c) {
      setMessage('Укажите основной цвет в формате #RRGGBB или RRGGBB');
      return;
    }
    setSaving(true);
    try {
      const d = await orgEndpoint.patchBranding({
        primaryColor: c,
        logoSvgLight: logoSvgLight.trim() ? logoSvgLight.trim() : null,
        logoSvgDark: logoSvgDark.trim() ? logoSvgDark.trim() : null,
      });
      applyOrgBrandingToDocument(d);
      setBrandingLocal(d);
      setPrimaryColor(normalizePrimaryColorHex(d.primaryColor, '#F97316'));
      setLogoSvgLight(d.logoSvgLight || '');
      setLogoSvgDark(d.logoSvgDark || '');
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

  const colorPickerValue = tryNormalizePrimaryColorHex(primaryColor) ?? '#3337AD';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Компания</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Логотипы для светлой и тёмной темы, основной цвет — на экране входа и для кнопок с акцентом в интерфейсе.
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">
          Основной цвет (#RRGGBB)
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="color"
            value={colorPickerValue}
            onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
            className="h-10 w-14 rounded border border-gray-200 dark:border-[#444] bg-white cursor-pointer"
            aria-label="Выбор цвета"
          />
          <Input
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            placeholder="#3337AD или 3337AD"
            fullWidth
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">
          Логотип для светлой темы (SVG)
        </label>
        <textarea
          value={logoSvgLight}
          onChange={(e) => setLogoSvgLight(e.target.value)}
          rows={6}
          placeholder="<svg xmlns=…>…</svg>"
          className="w-full px-3 py-2 text-sm font-mono border border-gray-200 dark:border-[#444] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Пустое поле — стандартная иконка. Для тёмной темы задайте отдельный вариант ниже (иначе будет использоваться этот же файл).
        </p>
        {previewLight() ? (
          <div className="mt-3 flex justify-center rounded-xl border border-dashed border-gray-200 bg-white p-4">
            <div
              className="flex max-h-32 w-full max-w-[280px] items-center justify-center [&_svg]:max-h-32 [&_svg]:w-auto [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: previewLight()! }}
            />
          </div>
        ) : null}
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">
          Логотип для тёмной темы (SVG)
        </label>
        <textarea
          value={logoSvgDark}
          onChange={(e) => setLogoSvgDark(e.target.value)}
          rows={6}
          placeholder="<svg …> — светлые линии/текст для тёмного фона"
          className="w-full px-3 py-2 text-sm font-mono border border-gray-200 dark:border-[#444] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Если пусто — на тёмном фоне подставится логотип для светлой темы.</p>
        {previewDark() ? (
          <div className="mt-3 flex justify-center rounded-xl border border-dashed border-[#444] bg-[#191919] p-4">
            <div
              className="flex max-h-32 w-full max-w-[280px] items-center justify-center [&_svg]:max-h-32 [&_svg]:w-auto [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: previewDark()! }}
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
