import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

interface BaseDialogProps {
  open: boolean;
  title: string;
  message: string;
}

interface AlertDialogProps extends BaseDialogProps {
  onClose: () => void;
  closeText?: string;
}

interface ConfirmDialogProps extends BaseDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
  cancelText?: string;
  confirmText?: string;
  danger?: boolean;
}

export const SystemAlertDialog: React.FC<AlertDialogProps> = ({
  open,
  title,
  message,
  onClose,
  closeText = 'Понятно',
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[240] bg-black/35 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252525] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-[#3337AD]" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] text-gray-500">
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{message}</div>
        <div className="px-4 pb-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-white bg-[#3337AD] hover:bg-[#2d3199]"
          >
            {closeText}
          </button>
        </div>
      </div>
    </div>
  );
};

export const SystemConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  cancelText = 'Отмена',
  confirmText = 'Подтвердить',
  danger = false,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[240] bg-black/35 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252525] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333] flex items-center gap-2">
          <AlertTriangle size={16} className={danger ? 'text-red-500' : 'text-[#3337AD]'} />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
        </div>
        <div className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{message}</div>
        <div className="px-4 pb-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#444] text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e2e2e]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-2 rounded-lg text-sm text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#3337AD] hover:bg-[#2d3199]'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
