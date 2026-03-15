import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, Instagram, FileText, Users, Archive, CheckSquare } from 'lucide-react';
import { TableCollection, User, Role } from '../types';
import { DynamicIcon } from './AppIcons';

interface TableGroupsProps {
  tables: TableCollection[];
  activeTableId: string;
  currentView: string;
  currentUser: User;
  onSelectTable: (id: string) => void;
  onEditTable: (table: TableCollection) => void;
  onDeleteTable: (id: string) => void;
  onCreateTable: () => void;
  onNavigateToType?: (type: string) => void;
}

type TableType = 'content-plan' | 'backlog' | 'functionality' | 'other';

interface TableGroup {
  type: TableType;
  label: string;
  icon: React.ReactNode;
  tables: TableCollection[];
}

const getTableTypeIcon = (type: string) => {
  switch(type) {
    case 'functionality': return 'Layers';
    case 'backlog': return 'Archive';
    case 'content-plan': return 'Instagram';
    case 'meetings': return 'Users';
    case 'docs': return 'FileText';
    default: return 'CheckSquare';
  }
};

const getTypeLabel = (type: string): string => {
  switch(type) {
    case 'content-plan': return 'Контент планы';
    case 'meetings': return 'Встречи';
    case 'docs': return 'Документы';
    case 'tasks': return 'Задачи';
    case 'backlog': return 'Бэклог';
    case 'functionality': return 'Функционал';
    default: return 'Другие';
  }
};

const getTypeIcon = (type: string) => {
  switch(type) {
    case 'content-plan': return <Instagram size={14} />;
    case 'meetings': return <Users size={14} />;
    case 'docs': return <FileText size={14} />;
    case 'tasks': return <CheckSquare size={14} />;
    case 'backlog': return <Archive size={14} />;
    default: return <CheckSquare size={14} />;
  }
};

export const TableGroups: React.FC<TableGroupsProps> = ({
  tables,
  activeTableId,
  currentView,
  currentUser,
  onSelectTable,
  onEditTable,
  onDeleteTable,
  onCreateTable,
  onNavigateToType,
}) => {

  const groupedTables = useMemo(() => {
    const groups: Map<TableType, TableCollection[]> = new Map();
    
    // Фильтруем задачи и архивные таблицы - не показываем их в пространствах
    const filteredTables = tables.filter(table => table.type !== 'tasks' && !table.isArchived);
    
    // Оставляем только контент-планы, бэклог и функционал (встречи и документы убраны)
    const allowedTypes = ['content-plan', 'backlog', 'functionality'];
    const filteredByType = filteredTables.filter(table => allowedTypes.includes(table.type));
    
    filteredByType.forEach(table => {
      const type = (allowedTypes.includes(table.type) 
        ? table.type 
        : 'other') as TableType;
      
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(table);
    });

    const result: TableGroup[] = [];
    const typeOrder: TableType[] = ['content-plan', 'backlog', 'functionality', 'other'];
    
    typeOrder.forEach(type => {
      const groupTables = groups.get(type);
      if (groupTables && groupTables.length > 0) {
        result.push({
          type,
          label: getTypeLabel(type),
          icon: getTypeIcon(type),
          tables: groupTables,
        });
      }
    });

    return result;
  }, [tables]);

  // Не показываем группы, если они уже отображаются как статичные элементы в сайдбаре
  // Показываем только конкретные проекты (таблицы) внутри групп

  return (
    <div className="space-y-0.5 pb-4">
      {groupedTables.map(group => {
        return (
          <div key={group.type} className="mb-1">
            {/* Показываем только конкретные проекты (таблицы), не заголовки групп */}
            {group.tables.map(table => (
              <div
                key={table.id}
                onClick={() => onSelectTable(table.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                  activeTableId === table.id && currentView === 'table'
                    ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium'
                    : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'
                }`}
              >
                <DynamicIcon name={getTableTypeIcon(table.type)} className="text-gray-500 dark:text-gray-400" size={14} />
                <span>{table.name}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

