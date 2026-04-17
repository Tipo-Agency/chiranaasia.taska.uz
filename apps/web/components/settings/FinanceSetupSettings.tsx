import React, { useMemo, useState } from 'react';
import { FinanceCategory } from '../../types';
import { Button, Input, StandardModal } from '../ui';
import { Edit2, Trash2 } from 'lucide-react';
import { EntitySearchSelect } from '../ui/EntitySearchSelect';
import { SystemConfirmDialog } from '../ui/SystemDialogs';

export const FinanceSetupSettings: React.FC<{
  categories: FinanceCategory[];
  onSaveCategory: (cat: FinanceCategory) => void;
  onDeleteCategory: (id: string) => void;
  createKind?: 'category' | null;
  onConsumedCreateKind?: () => void;
}> = ({ categories, onSaveCategory, onDeleteCategory, createKind, onConsumedCreateKind }) => {
  const sortedActive = useMemo(
    () =>
      categories
        .filter((c) => !c.isArchived)
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [categories]
  );

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinanceCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'fixed' | 'percent'>('fixed');
  const [catValue, setCatValue] = useState('');
  const [catOrder, setCatOrder] = useState(0);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  React.useEffect(() => {
    if (createKind !== 'category') return;
    setEditingCategory(null);
    setCatName('');
    setCatType('fixed');
    setCatValue('');
    setCatOrder(sortedActive.length + 1 || 1);
    setCatModalOpen(true);
    onConsumedCreateKind?.();
  }, [createKind, onConsumedCreateKind, sortedActive.length]);

  const saveCategory = () => {
    const name = catName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const rawVal = catValue.replace(/\s/g, '').replace(/,/g, '.').trim();
    const vNum = rawVal === '' ? undefined : Number(rawVal);
    onSaveCategory({
      id: editingCategory?.id || `fc-${Date.now()}`,
      name,
      type: catType,
      value: vNum !== undefined && Number.isFinite(vNum) ? vNum : undefined,
      order: catOrder,
      updatedAt: now,
      isArchived: editingCategory?.isArchived || false,
      color: editingCategory?.color,
    });
    setCatModalOpen(false);
  };

  return (
    <div className="space-y-8 w-full">
      <div>
        <div className="mb-3">
          <div className="text-sm font-bold text-gray-900 dark:text-white">Фонды</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 space-y-1">
            <p>
              Единый справочник лимитов бюджета, статей в планах и категорий в заявках — одна запись, один id.
            </p>
            <p className="text-gray-400 dark:text-gray-500">Создание — через «+» в шапке.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-[#333]">
                <tr className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="text-left font-bold px-4 py-3">Порядок</th>
                  <th className="text-left font-bold px-4 py-3">Название</th>
                  <th className="text-left font-bold px-4 py-3">Тип</th>
                  <th className="text-left font-bold px-4 py-3">Значение</th>
                  <th className="text-right font-bold px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                {sortedActive.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                      Нет фондов. Добавьте первый.
                    </td>
                  </tr>
                ) : (
                  sortedActive.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-[#303030]">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.order ?? 0}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                            c.type === 'fixed'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}
                        >
                          {c.type === 'fixed' ? 'Фикс' : 'Процент'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 tabular-nums">
                        {c.value !== undefined && c.value !== null ? String(c.value) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(c);
                              setCatName(c.name);
                              setCatType(c.type);
                              setCatValue(
                                c.value !== undefined && c.value !== null ? String(c.value) : ''
                              );
                              setCatOrder(c.order ?? 0);
                              setCatModalOpen(true);
                            }}
                            className="p-2 rounded-xl text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-[#303030]"
                            title="Редактировать"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteCategoryId(c.id)}
                            className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="В архив"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <StandardModal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={editingCategory ? 'Редактировать фонд' : 'Новый фонд'}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setCatModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveCategory} disabled={!catName.trim()}>
              Сохранить
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input label="Название" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <Input
            label="Порядок"
            type="number"
            value={String(catOrder)}
            onChange={(e) => setCatOrder(parseInt(e.target.value, 10) || 0)}
          />
          <div>
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Тип</div>
            <EntitySearchSelect
              value={catType}
              onChange={(v) => setCatType(v as 'fixed' | 'percent')}
              options={[
                { value: 'fixed', label: 'Фиксированная сумма', searchText: 'фиксированная сумма fixed' },
                { value: 'percent', label: 'Процент от дохода', searchText: 'процент доход percent' },
              ]}
              searchPlaceholder="Тип…"
            />
          </div>
          <Input
            label={catType === 'percent' ? 'Процент' : 'Сумма (UZS)'}
            value={catValue}
            onChange={(e) => setCatValue(e.target.value)}
            placeholder={catType === 'percent' ? '12' : '5000000'}
          />
        </div>
      </StandardModal>

      <SystemConfirmDialog
        open={Boolean(deleteCategoryId)}
        title="Архивировать фонд"
        message="Убрать фонд в архив?"
        danger
        confirmText="В архив"
        cancelText="Отмена"
        onCancel={() => setDeleteCategoryId(null)}
        onConfirm={() => {
          if (deleteCategoryId) onDeleteCategory(deleteCategoryId);
          setDeleteCategoryId(null);
        }}
      />
    </div>
  );
};
