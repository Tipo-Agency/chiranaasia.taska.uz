import React, { useEffect, useMemo, useState } from 'react';
import { FinanceCategory } from '../../types';
import { Button, Input, StandardModal } from '../ui';
import { Edit2, Trash2 } from 'lucide-react';
import { EntitySearchSelect } from '../ui/EntitySearchSelect';
import { SystemConfirmDialog } from '../ui/SystemDialogs';
import { financeEndpoint } from '../../services/apiClient';
import {
  DEFAULT_ENABLED_STATEMENT_BANKS,
  STATEMENT_BANK_IDS,
  STATEMENT_BANK_LABELS,
  isStatementBankId,
  type StatementBankId,
} from '../../constants/statementBanks';

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
  const [catOrder, setCatOrder] = useState(0);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [enabledStatementBanks, setEnabledStatementBanks] =
    useState<StatementBankId[]>(DEFAULT_ENABLED_STATEMENT_BANKS);
  const [statementBanksLoading, setStatementBanksLoading] = useState(true);

  useEffect(() => {
    void financeEndpoint
      .getStatementBankSettings()
      .then((s) => {
        const list = (s.enabledBanks || []).filter(isStatementBankId);
        setEnabledStatementBanks(list.length ? list : DEFAULT_ENABLED_STATEMENT_BANKS);
      })
      .catch(() => setEnabledStatementBanks(DEFAULT_ENABLED_STATEMENT_BANKS))
      .finally(() => setStatementBanksLoading(false));
  }, []);

  const toggleStatementBank = (id: StatementBankId) => {
    if (statementBanksLoading) return;
    setEnabledStatementBanks((prev) => {
      const has = prev.includes(id);
      let next: StatementBankId[];
      if (has) {
        const filtered = prev.filter((x) => x !== id);
        if (filtered.length === 0) return prev;
        next = filtered;
      } else {
        next = [...prev, id].sort((a, b) => a.localeCompare(b));
      }
      void financeEndpoint.putStatementBankSettings({ enabledBanks: next }).catch(() => {});
      return next;
    });
  };

  React.useEffect(() => {
    if (createKind !== 'category') return;
    setEditingCategory(null);
    setCatName('');
    setCatType('fixed');
    setCatOrder(sortedActive.length + 1 || 1);
    setCatModalOpen(true);
    onConsumedCreateKind?.();
  }, [createKind, onConsumedCreateKind, sortedActive.length]);

  const saveCategory = () => {
    const name = catName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const payload: FinanceCategory = {
      id: editingCategory?.id || `fc-${Date.now()}`,
      name,
      type: catType,
      order: catOrder,
      updatedAt: now,
      isArchived: editingCategory?.isArchived || false,
    };
    if (editingCategory?.color != null && editingCategory.color !== '') {
      payload.color = editingCategory.color;
    }
    onSaveCategory(payload);
    setCatModalOpen(false);
  };

  return (
    <div className="space-y-8 w-full">
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 md:p-5">
        <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">Выписки: подключённые банки</div>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
          Отметьте банки, с которыми вы работаете. При загрузке выписки в модуле «Финансы» вы сможете выбрать только эти
          варианты, чтобы не перепутать формат файла (например, Капиталбанк / АПП и TENGE bank).
        </p>
        <div className="flex flex-col gap-3">
          {STATEMENT_BANK_IDS.map((id) => (
            <label
              key={id}
              className="flex items-start gap-2.5 cursor-pointer text-sm text-gray-800 dark:text-gray-200"
            >
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 dark:border-[#444] text-indigo-600 focus:ring-indigo-500/30"
                checked={enabledStatementBanks.includes(id)}
                disabled={statementBanksLoading}
                onChange={() => toggleStatementBank(id)}
              />
              <span>{STATEMENT_BANK_LABELS[id]}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3">
          <div className="text-sm font-bold text-gray-900 dark:text-white">Фонды</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 space-y-1">
            <p>
              Справочник фондов: название, порядок и тип строки в плане (фикс / процент). Сами суммы и доли задаются в{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-300">финансовом плане</span> по строкам расхода.
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
                  <th className="text-left font-bold px-4 py-3">Тип в плане</th>
                  <th className="text-right font-bold px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                {sortedActive.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
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
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(c);
                              setCatName(c.name);
                              setCatType(c.type);
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
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Тип в плане</div>
            <EntitySearchSelect
              value={catType}
              onChange={(v) => setCatType(v as 'fixed' | 'percent')}
              options={[
                { value: 'fixed', label: 'Фиксированная сумма (в плане)', searchText: 'фиксированная сумма fixed' },
                { value: 'percent', label: 'Процент от дохода документа плана', searchText: 'процент доход percent' },
              ]}
              searchPlaceholder="Тип…"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Числа по фондам считаются из выручки и строк расхода в <span className="font-semibold">финансовом плане</span>, не
            в этом справочнике.
          </p>
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
