import React from 'react';
import { AppSelect, type AppSelectProps } from '../AppSelect';

export type EntitySearchSelectProps = Omit<AppSelectProps, 'searchable'> & {
  /** По умолчанию включён поиск по `label` и `searchText` опций */
  searchable?: boolean;
};

/**
 * Выпадающий список с поиском для выбора сущностей (сделка, клиент, проект, контент-план, сотрудник и т.д.).
 * Обёртка над {@link AppSelect} с `searchable` по умолчанию.
 */
export const EntitySearchSelect: React.FC<EntitySearchSelectProps> = ({
  searchable = true,
  searchPlaceholder = 'Поиск…',
  ...rest
}) => <AppSelect {...rest} searchable={searchable} searchPlaceholder={searchPlaceholder} />;
