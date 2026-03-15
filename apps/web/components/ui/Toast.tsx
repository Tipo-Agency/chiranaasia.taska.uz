/**
 * Toast - компонент для уведомлений
 */
import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-500',
    textColor: 'text-white',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-500',
    textColor: 'text-white',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-500',
    textColor: 'text-white',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-500',
    textColor: 'text-white',
  },
};

const positionClasses = {
  'top-right': 'top-4 right-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-left': 'bottom-4 left-4',
};

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  position = 'top-right',
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={`
        fixed ${positionClasses[position]} z-50
        ${config.bgColor} ${config.textColor}
        px-4 py-3 rounded-lg shadow-lg
        flex items-center gap-3
        min-w-[280px] max-w-[90vw]
        animate-in slide-in-from-top fade-in duration-200
      `}
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
    >
      <Icon size={20} className="shrink-0" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={onClose}
        className="shrink-0 hover:opacity-80 transition-opacity"
        aria-label="Закрыть"
      >
        <X size={18} />
      </button>
    </div>
  );
};
