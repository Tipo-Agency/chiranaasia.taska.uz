import React, { useMemo, useState } from 'react';
import { FinanceCategory, Fund } from '../../types';
import { Button, Input, StandardModal } from '../ui';
import { Edit2, Trash2 } from 'lucide-react';
import { TaskSelect } from '../TaskSelect';
import { SystemConfirmDialog } from '../ui/SystemDialogs';

type CreateKind = 'category' | 'fund';

export const FinanceSetupSettings: React.FC<{
  categories: FinanceCategory[];
  funds: Fund[];
  onSaveCategory: (cat: FinanceCategory) => void;
  onDeleteCategory: (id: string) => void;
  onSaveFund: (fund: Fund) => void;
  onDeleteFund: (id: string) => void;
  createKind?: CreateKind | null;
  onConsumedCreateKind?: () => void;
}> = ({
  categories,
  funds,
  onSaveCategory,
  onDeleteCategory,
  onSaveFund,
  onDeleteFund,
  createKind,
  onConsumedCreateKind,
}) => {
  const activeCategories = useMemo(() => categories.filter((c) => !c.isArchived), [categories]);
  const activeFunds = useMemo(() => funds.filter((f) => !f.isArchived), [funds]);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinanceCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'fixed' | 'percent'>('fixed');
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [fundName, setFundName] = useState('');
  const [fundOrder, setFundOrder] = useState(1);
  const [deleteFundId, setDeleteFundId] = useState<string | null>(null);

  const openCreate = (kind: CreateKind) => {
    if (kind === 'category') {
      setEditingCategory(null);
      setCatName('');
      setCatType('fixed');
      setCatModalOpen(true);
    }
    if (kind === 'fund') {
      setEditingFund(null);
      setFundName('');
      setFundOrder(activeFunds.length + 1 || 1);
      setFundModalOpen(true);
    }
  };

  React.useEffect(() => {
    if (!createKind) return;
    openCreate(createKind);
    onConsumedCreateKind?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createKind]);

  const saveCategory = () => {
    const name = catName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    onSaveCategory({
      id: editingCategory?.id || `fc-${Date.now()}`,
      name,
      type: catType,
      updatedAt: now,
      isArchived: editingCategory?.isArchived || false,
    });
    setCatModalOpen(false);
  };

  const saveFund = () => {
    const name = fundName.trim();
    if (!name) return;
    onSaveFund({
      id: editingFund?.id || `fund-${Date.now()}`,
      name,
      order: fundOrder,
      isArchived: editingFund?.isArchived || false,
    });
    setFundModalOpen(false);
  };

  return (
    <div className="space-y-8 w-full">
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">Статьи расходов</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Используются в финпланировании и заявках.</div>
          </div>
          <Button variant="secondary" onClick={() => openCreate('category')}>
            Добавить статью
          </Button>
        </div>

        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-[#333]">
                <tr className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="text-left font-bold px-4 py-3">Название</th>
                  <th className="text-left font-bold px-4 py-3">Тип</th>
                  <th className="text-right font-bold px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                {activeCategories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                      Нет статей расходов. Добавьте первую.
                    </td>
                  </tr>
                ) : (
                  activeCategories.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-[#303030]">
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
                            title="Удалить"
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

      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">Фонды</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Распределение дохода по целям.</div>
          </div>
          <Button variant="secondary" onClick={() => openCreate('fund')}>
            Добавить фонд
          </Button>
        </div>

        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-[#333]">
                <tr className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="text-left font-bold px-4 py-3">Порядок</th>
                  <th className="text-left font-bold px-4 py-3">Название</th>
                  <th className="text-right font-bold px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                {activeFunds.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                      Нет фондов. Добавьте первый.
                    </td>
                  </tr>
                ) : (
                  activeFunds
                    .slice()
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((f) => (
                      <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-[#303030]">
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{f.order ?? 0}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{f.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFund(f);
                                setFundName(f.name);
                                setFundOrder(f.order ?? 0);
                                setFundModalOpen(true);
                              }}
                              className="p-2 rounded-xl text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-[#303030]"
                              title="Редактировать"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteFundId(f.id)}
                              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Удалить"
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
        title={editingCategory ? 'Редактировать статью' : 'Новая статья расходов'}
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
          <div>
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Тип</div>
            <TaskSelect
              value={catType}
              onChange={(v) => setCatType(v as any)}
              options={[
                { value: 'fixed', label: 'Фиксированная сумма' },
                { value: 'percent', label: 'Процент от дохода' },
              ]}
            />
          </div>
        </div>
      </StandardModal>

      <StandardModal
        isOpen={fundModalOpen}
        onClose={() => setFundModalOpen(false)}
        title={editingFund ? 'Редактировать фонд' : 'Новый фонд'}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setFundModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveFund} disabled={!fundName.trim()}>
              Сохранить
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input label="Название" value={fundName} onChange={(e) => setFundName(e.target.value)} />
          <Input
            label="Порядок"
            type="number"
            value={String(fundOrder)}
            onChange={(e) => setFundOrder(parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </StandardModal>

      <SystemConfirmDialog
        open={Boolean(deleteCategoryId)}
        title="Удалить статью"
        message="Удалить статью расходов?"
        danger
        confirmText="Удалить"
        cancelText="Отмена"
        onCancel={() => setDeleteCategoryId(null)}
        onConfirm={() => {
          if (deleteCategoryId) onDeleteCategory(deleteCategoryId);
          setDeleteCategoryId(null);
        }}
      />
      <SystemConfirmDialog
        open={Boolean(deleteFundId)}
        title="Удалить фонд"
        message="Удалить фонд?"
        danger
        confirmText="Удалить"
        cancelText="Отмена"
        onCancel={() => setDeleteFundId(null)}
        onConfirm={() => {
          if (deleteFundId) onDeleteFund(deleteFundId);
          setDeleteFundId(null);
        }}
      />
    </div>
  );
};

