import React, { useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';

interface Breadcrumb {
  label: string;
  onClick?: () => void;
}

interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  onBackdropClick?: () => void;
  breadcrumbs?: Breadcrumb[];
}

export const StandardModal: React.FC<StandardModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
  onBackdropClick,
  breadcrumbs
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full mx-2 md:mx-4'
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (onBackdropClick) {
        onBackdropClick();
      } else {
        onClose();
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div 
        className={`
          w-full h-full md:h-auto
          ${sizeClasses[size]} 
          bg-white dark:bg-[#191919] 
          rounded-t-2xl md:rounded-2xl 
          shadow-2xl
          flex flex-col
          md:max-h-[90vh]
          animate-in slide-in-from-bottom md:slide-in-from-bottom-0 md:zoom-in-95
          duration-200
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Breadcrumbs для мобильной версии */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="md:hidden flex items-center gap-1 px-4 pt-3 pb-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-[#333] shrink-0">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight size={12} className="mx-1" />}
                {crumb.onClick ? (
                  <button
                    onClick={crumb.onClick}
                    className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className={index === breadcrumbs.length - 1 ? 'text-gray-900 dark:text-white font-medium' : ''}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-[#333] shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            {icon && (
              <div className="shrink-0 text-gray-600 dark:text-gray-400 hidden md:block">
                {icon}
              </div>
            )}
            <h2 className="font-bold text-gray-900 dark:text-white text-base md:text-lg truncate">
              {title}
            </h2>
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-lg transition-colors shrink-0 ml-2"
              aria-label="Закрыть"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-gray-200 dark:border-[#333] p-4 md:p-6 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

