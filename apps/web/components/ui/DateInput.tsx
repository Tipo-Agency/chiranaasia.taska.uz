/**
 * DateInput - стилизованный компонент для выбора даты
 * 
 * Зачем отдельно:
 * - Единый стиль календаря по всему приложению
 * - Поддержка темной темы
 * - Скругленные углы
 * - Стилизация нативного календаря через CSS
 */
import React from 'react';
import { Calendar } from 'lucide-react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  required?: boolean;
  min?: string;
  max?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  label,
  className = '',
  required = false,
  min,
  max,
}) => {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative isolate overflow-hidden rounded-lg">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          min={min}
          max={max}
          className="w-full bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#555] rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all date-input-custom"
        />
        <Calendar 
          size={16} 
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none z-10" 
        />
      </div>
      <style>{`
        /* Только справа — иначе невидимая зона перекрывает кнопки под полем (модалка сотрудника и т.д.) */
        .date-input-custom::-webkit-calendar-picker-indicator {
          opacity: 0.01;
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 22px;
          height: 22px;
          cursor: pointer;
          padding: 0;
        }
        .date-input-custom::-webkit-datetime-edit-text {
          color: rgb(107 114 128);
        }
        .dark .date-input-custom::-webkit-datetime-edit-text {
          color: rgb(156 163 175);
        }
        .date-input-custom::-webkit-datetime-edit-month-field,
        .date-input-custom::-webkit-datetime-edit-day-field,
        .date-input-custom::-webkit-datetime-edit-year-field {
          color: rgb(17 24 39);
        }
        .dark .date-input-custom::-webkit-datetime-edit-month-field,
        .dark .date-input-custom::-webkit-datetime-edit-day-field,
        .dark .date-input-custom::-webkit-datetime-edit-year-field {
          color: rgb(229 231 235);
        }
      `}</style>
    </div>
  );
};
