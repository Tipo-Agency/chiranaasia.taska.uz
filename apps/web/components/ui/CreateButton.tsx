import React from 'react';
import { Plus, X } from 'lucide-react';

export interface CreateOption {
  id: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface CreateButtonProps {
  options: CreateOption[];
  className?: string;
}

export const CreateButton: React.FC<CreateButtonProps> = ({ options, className = '' }) => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm ${className}`}
      >
        <Plus size={18} />
        <span className="hidden sm:inline">Создать</span>
        <span className="sm:hidden">+</span>
      </button>

      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-[80] animate-in fade-in duration-200" 
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#252525] rounded-t-2xl md:rounded-xl shadow-2xl w-full max-w-md max-h-[95vh] md:max-h-[90vh] overflow-hidden border border-gray-200 dark:border-[#333]" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
              <h3 className="font-bold text-gray-800 dark:text-white">Создать</h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    option.onClick();
                    setIsModalOpen(false);
                  }}
                  className="w-full p-4 bg-white dark:bg-[#333] border border-gray-200 dark:border-[#444] rounded-lg text-left hover:bg-gray-50 dark:hover:bg-[#404040] transition-colors flex items-start gap-3"
                >
                  {option.icon && <div className="mt-0.5 text-gray-400 dark:text-gray-500">{option.icon}</div>}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 dark:text-white mb-1">{option.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{option.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

