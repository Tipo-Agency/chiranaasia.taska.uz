import React, { useRef } from 'react';
import { Plus, Trash2, FileIcon, X } from 'lucide-react';
import type { NomenclatureAttachment, NomenclatureAttribute } from '../../types/inventory';
import { uploadInventoryItemAttachment } from '../../services/localStorageService';
import { isImageFile } from '../../utils/fileUtils';

export interface NomenclatureExtendedFieldsProps {
  uploadKey: string;
  barcode: string;
  setBarcode: (v: string) => void;
  manufacturer: string;
  setManufacturer: (v: string) => void;
  consumptionHint: string;
  setConsumptionHint: (v: string) => void;
  attributes: NomenclatureAttribute[];
  setAttributes: React.Dispatch<React.SetStateAction<NomenclatureAttribute[]>>;
  attachments: NomenclatureAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<NomenclatureAttachment[]>>;
  setAlertMessage?: (msg: string | null) => void;
}

export function NomenclatureExtendedFields({
  uploadKey,
  barcode,
  setBarcode,
  manufacturer,
  setManufacturer,
  consumptionHint,
  setConsumptionHint,
  attributes,
  setAttributes,
  attachments,
  setAttachments,
  setAlertMessage,
}: NomenclatureExtendedFieldsProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const addAttribute = () => {
    setAttributes((prev) => [
      ...prev,
      { id: `a-${Date.now()}`, label: '', unit: '', value: '', kind: 'text', options: [] },
    ]);
  };

  const updateAttr = (id: string, patch: Partial<NomenclatureAttribute>) => {
    setAttributes((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeAttr = (id: string) => setAttributes((prev) => prev.filter((a) => a.id !== id));

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const r = await uploadInventoryItemAttachment(file, uploadKey);
        setAttachments((prev) => [
          ...prev,
          {
            id: `ia-${Date.now()}-${i}`,
            name: file.name,
            url: r.url,
            type: file.type || 'application/octet-stream',
            uploadedAt: new Date().toISOString(),
            storagePath: r.path,
          },
        ]);
      } catch {
        setAlertMessage?.('Не удалось загрузить файл');
      }
    }
    e.target.value = '';
  };

  const removeAtt = (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id));

  return (
    <div className="md:col-span-2 space-y-4 border-t border-gray-100 dark:border-[#333] pt-4 mt-1">
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Карточка номенклатуры</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Штрихкод / EAN</span>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Опционально"
            className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Производитель / бренд</span>
          <input
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="Опционально"
            className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]"
          />
        </label>
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Норма расхода / упаковка</span>
          <input
            value={consumptionHint}
            onChange={(e) => setConsumptionHint(e.target.value)}
            placeholder="Например: 0,12 л/м²; канистра 20 л"
            className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]"
          />
          <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">
            Справочное поле для сметы и производства. Фактический расход по конкретному заказу удобно фиксировать в движении склада (списание) или в комментарии к производственному заказу — отдельного поля «расход» в заказе сейчас нет.
          </span>
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Характеристики</span>
          <button
            type="button"
            onClick={addAttribute}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <Plus size={14} />
            Добавить
          </button>
        </div>
        <div className="space-y-2">
          {attributes.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">Например: вес (кг), объём (л), диагональ (см).</p>
          )}
          {attributes.map((attr) => (
            <div
              key={attr.id}
              className="flex flex-wrap gap-2 items-end p-2 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50/80 dark:bg-[#1e1e1e]"
            >
              <label className="flex flex-col gap-1 min-w-[100px] flex-1">
                <span className="text-[10px] text-gray-500">Название</span>
                <input
                  value={attr.label}
                  onChange={(e) => updateAttr(attr.id, { label: e.target.value })}
                  placeholder="Вес"
                  className="rounded-lg border border-gray-200 dark:border-[#444] px-2 py-1.5 text-xs bg-white dark:bg-[#252525]"
                />
              </label>
              <label className="flex flex-col gap-1 w-20">
                <span className="text-[10px] text-gray-500">Ед.</span>
                <input
                  value={attr.unit || ''}
                  onChange={(e) => updateAttr(attr.id, { unit: e.target.value })}
                  placeholder="кг"
                  className="rounded-lg border border-gray-200 dark:border-[#444] px-2 py-1.5 text-xs bg-white dark:bg-[#252525]"
                />
              </label>
              <label className="flex flex-col gap-1 w-28">
                <span className="text-[10px] text-gray-500">Тип</span>
                <select
                  value={attr.kind || 'text'}
                  onChange={(e) =>
                    updateAttr(attr.id, { kind: e.target.value as NomenclatureAttribute['kind'] })
                  }
                  className="rounded-lg border border-gray-200 dark:border-[#444] px-2 py-1.5 text-xs bg-white dark:bg-[#252525]"
                >
                  <option value="text">Текст</option>
                  <option value="number">Число</option>
                  <option value="select">Список</option>
                </select>
              </label>
              {attr.kind === 'select' ? (
                <>
                  <label className="flex flex-col gap-1 min-w-[140px] flex-1">
                    <span className="text-[10px] text-gray-500">Варианты (через запятую)</span>
                    <input
                      value={(attr.options || []).join(', ')}
                      onChange={(e) =>
                        updateAttr(attr.id, {
                          options: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="S, M, L, XL"
                      className="rounded-lg border border-gray-200 dark:border-[#444] px-2 py-1.5 text-xs bg-white dark:bg-[#252525]"
                    />
                  </label>
                  <label className="flex flex-col gap-1 min-w-[80px] flex-1">
                    <span className="text-[10px] text-gray-500">Значение</span>
                    <input
                      value={attr.value}
                      onChange={(e) => updateAttr(attr.id, { value: e.target.value })}
                      className="rounded-lg border border-gray-200 dark:border-[#444] px-2 py-1.5 text-xs bg-white dark:bg-[#252525]"
                    />
                  </label>
                </>
              ) : (
                <label className="flex flex-col gap-1 min-w-[100px] flex-1">
                  <span className="text-[10px] text-gray-500">Значение</span>
                  <input
                    value={attr.value}
                    onChange={(e) => updateAttr(attr.id, { value: e.target.value })}
                    type={attr.kind === 'number' ? 'text' : 'text'}
                    inputMode={attr.kind === 'number' ? 'decimal' : undefined}
                    placeholder={attr.kind === 'number' ? '0,5' : ''}
                    className="rounded-lg border border-gray-200 dark:border-[#444] px-2 py-1.5 text-xs bg-white dark:bg-[#252525]"
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() => removeAttr(attr.id)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Удалить характеристику"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Фото и файлы</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Загрузить
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx"
          className="hidden"
          onChange={onFiles}
        />
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="relative group w-20 h-20 rounded-lg border border-gray-200 dark:border-[#333] overflow-hidden bg-gray-100 dark:bg-[#1a1a1a]"
            >
              {isImageFile(att.url, att.type) ? (
                <img src={att.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileIcon size={28} className="text-gray-400" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAtt(att.id)}
                className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Убрать файл"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
