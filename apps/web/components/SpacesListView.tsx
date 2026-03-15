import React from 'react';
import { TableCollection, User, Role } from '../types';
import { DynamicIcon } from './AppIcons';
import { Edit2, Trash2, Plus, ArrowLeft } from 'lucide-react';

interface SpacesListViewProps {
  type: 'content-plan' | 'meetings' | 'docs';
  tables: TableCollection[];
  currentUser: User;
  onSelectTable: (id: string) => void;
  onEditTable: (table: TableCollection) => void;
  onDeleteTable: (id: string) => void;
  onCreateTable: () => void;
  onBack: () => void;
}

const getTypeLabel = (type: string): string => {
  switch(type) {
    case 'content-plan': return 'Контент планы';
    case 'meetings': return 'Встречи';
    case 'docs': return 'Документы';
    default: return '';
  }
};

const getTypeIcon = (type: string) => {
  switch(type) {
    case 'content-plan': return 'Instagram';
    case 'meetings': return 'Users';
    case 'docs': return 'FileText';
    default: return 'CheckSquare';
  }
};

const getTypeColor = (type: string) => {
  switch(type) {
    case 'content-plan': return 'text-pink-500';
    case 'meetings': return 'text-purple-500';
    case 'docs': return 'text-yellow-500';
    default: return 'text-gray-500';
  }
};

export const SpacesListView: React.FC<SpacesListViewProps> = ({
  type,
  tables,
  currentUser,
  onSelectTable,
  onEditTable,
  onDeleteTable,
  onCreateTable,
  onBack,
}) => {
  const spacesOfType = tables.filter(t => t.type === type);

  return (
    <div className="h-full flex flex-col min-h-0 bg-white dark:bg-[#191919]">
      <div className="max-w-7xl mx-auto w-full pt-8 px-6 flex-shrink-0">
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Назад</span>
          </button>
          
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                type === 'content-plan' ? 'bg-pink-100 dark:bg-pink-900/30' :
                type === 'meetings' ? 'bg-purple-100 dark:bg-purple-900/30' :
                'bg-yellow-100 dark:bg-yellow-900/30'
              }`}>
                <DynamicIcon name={getTypeIcon(type)} className={getTypeColor(type)} size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{getTypeLabel(type)}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Все пространства типа "{getTypeLabel(type)}"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <div className="max-w-7xl mx-auto w-full px-6 pb-20">
          {spacesOfType.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <DynamicIcon name={getTypeIcon(type)} className={getTypeColor(type)} size={48} />
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-2">Нет пространств этого типа</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {spacesOfType.map(table => (
                <div
                  key={table.id}
                  onClick={() => onSelectTable(table.id)}
                  className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <DynamicIcon 
                        name={table.icon || getTypeIcon(type)} 
                        className={table.color || getTypeColor(type)} 
                        size={24} 
                      />
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{table.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {getTypeLabel(type)}
                        </p>
                      </div>
                    </div>
                    {currentUser.role === Role.ADMIN && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onEditTable(table); }}
                          className="text-gray-400 hover:text-blue-500 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        >
                          <Edit2 size={14} />
                        </button>
                        {!table.isSystem && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteTable(table.id); }}
                            className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

