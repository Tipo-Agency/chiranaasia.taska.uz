import React, { useState, useEffect, useRef } from 'react';
import { TableCollection, User } from '../types';
import { hasPermission } from '../utils/permissions';
import { DynamicIcon } from './AppIcons';
import { Instagram, Archive, Layers, Edit2, Trash2 } from 'lucide-react';
import { ModulePageShell, ModulePageHeader, ModuleSegmentedControl, MODULE_PAGE_GUTTER, ModuleCreateIconButton } from './ui';

type SpaceType = 'content-plan' | 'backlog' | 'functionality';

interface SpacesTabsViewProps {
  tables: TableCollection[];
  currentUser: User;
  activeTableId: string;
  currentView: string;
  initialTab?: SpaceType;
  /** Синхронизация с URL / глобальным состоянием при смене типа */
  onActiveSpaceTypeChange?: (type: SpaceType) => void;
  onSelectTable: (id: string) => void;
  onEditTable: (table: TableCollection) => void;
  onDeleteTable: (id: string) => void;
  onCreateTable: (type: SpaceType) => void;
}
type ViewMode = 'grid' | 'list';

const getTypeLabel = (type: SpaceType): string => {
  switch(type) {
    case 'content-plan': return 'Контент планы';
    case 'backlog': return 'Бэклог';
    case 'functionality': return 'Функционал';
  }
};

const getTypeIcon = (type: SpaceType) => {
  switch(type) {
    case 'content-plan': return <Instagram size={16} />;
    case 'backlog': return <Archive size={16} />;
    case 'functionality': return <Layers size={16} />;
  }
};

export const SpacesTabsView: React.FC<SpacesTabsViewProps> = ({
  tables,
  currentUser,
  activeTableId,
  currentView,
  initialTab,
  onActiveSpaceTypeChange,
  onSelectTable,
  onEditTable,
  onDeleteTable,
  onCreateTable,
}) => {
  const [activeTab, setActiveTab] = useState<SpaceType>(initialTab || 'content-plan');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Синхронизируем activeTab с initialTab при изменении
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const spaceTypeCbRef = useRef(onActiveSpaceTypeChange);
  spaceTypeCbRef.current = onActiveSpaceTypeChange;
  useEffect(() => {
    spaceTypeCbRef.current?.(activeTab);
  }, [activeTab]);

  // Фильтруем пространства по типу, исключаем архивные
  const currentSpaces = tables.filter(t => t.type === activeTab && !t.isArchived);

  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 pb-4 border-b border-gray-200 dark:border-[#333] shrink-0`}>
        <ModulePageHeader
          accent="indigo"
          icon={React.cloneElement(getTypeIcon(activeTab) as React.ReactElement, { size: 24, strokeWidth: 2 })}
          title={getTypeLabel(activeTab)}
          description={`${currentSpaces.length} ${currentSpaces.length === 1 ? 'пространство' : 'пространств'}`}
          tabs={
            <ModuleSegmentedControl
              variant="neutral"
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              options={[
                { value: 'grid', label: 'Плитка' },
                { value: 'list', label: 'Список' },
              ]}
            />
          }
          controls={
            <>
              {hasPermission(currentUser, 'settings.general') && (
                <ModuleCreateIconButton
                  accent="indigo"
                  label="Создать пространство"
                  onClick={() => onCreateTable(activeTab)}
                />
              )}
            </>
          }
          actions={undefined}
          className="w-full"
        />
      </div>

      <div className={`${MODULE_PAGE_GUTTER} pb-4 shrink-0`}>
        <ModuleSegmentedControl
          variant="neutral"
          value={activeTab}
          onChange={(v) => setActiveTab(v as SpaceType)}
          options={[
            { value: 'content-plan', label: 'Контент-планы', icon: <Instagram size={14} /> },
            { value: 'backlog', label: 'Бэклог', icon: <Archive size={14} /> },
            { value: 'functionality', label: 'Функционал', icon: <Layers size={14} /> },
          ]}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0">
        <div className={`${MODULE_PAGE_GUTTER} py-6 pb-24 md:pb-32`}>
          {currentSpaces.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-400 dark:text-gray-500 mb-4 inline-block">
                {getTypeIcon(activeTab)}
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-2 text-lg">Нет пространств</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                Создайте первое пространство типа "{getTypeLabel(activeTab)}"
              </p>
              {hasPermission(currentUser, 'settings.general') && (
                <ModuleCreateIconButton
                  accent="indigo"
                  label="Создать пространство"
                  onClick={() => onCreateTable(activeTab)}
                  className="mx-auto"
                />
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentSpaces.map(table => (
                <div
                  key={table.id}
                  onClick={() => onSelectTable(table.id)}
                  className={`bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer group ${
                    activeTableId === table.id && currentView === 'table'
                      ? 'ring-2 ring-blue-500 border-blue-500'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <DynamicIcon 
                        name={table.icon || (activeTab === 'content-plan' ? 'Instagram' : activeTab === 'backlog' ? 'Archive' : 'Layers')} 
                        className={table.color || 'text-gray-500'} 
                        size={24} 
                      />
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{table.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {getTypeLabel(activeTab)}
                        </p>
                      </div>
                    </div>
                    {hasPermission(currentUser, 'settings.general') && (
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
          ) : (
            <div className="space-y-2">
              {currentSpaces.map(table => (
                <div
                  key={table.id}
                  onClick={() => onSelectTable(table.id)}
                  className={`bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg p-4 hover:shadow-md transition-all cursor-pointer group ${
                    activeTableId === table.id && currentView === 'table'
                      ? 'ring-2 ring-blue-500 border-blue-500'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DynamicIcon 
                        name={table.icon || (activeTab === 'content-plan' ? 'Instagram' : activeTab === 'backlog' ? 'Archive' : 'Layers')} 
                        className={table.color || 'text-gray-500'} 
                        size={20} 
                      />
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{table.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {getTypeLabel(activeTab)}
                        </p>
                      </div>
                    </div>
                    {hasPermission(currentUser, 'settings.general') && (
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
    </ModulePageShell>
  );
};
