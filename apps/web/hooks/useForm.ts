import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Хук для управления формой с отслеживанием изменений
 * @param initialValues - начальные значения формы
 * @param onSubmit - функция обработки отправки формы
 * @returns объект с состоянием формы и методами управления
 */
export function useForm<T extends Record<string, any>>(
  initialValues: T,
  onSubmit?: (values: T) => void | Promise<void>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [isDirty, setIsDirty] = useState(false);
  const initialValuesRef = useRef<T>(initialValues);

  // Обновляем начальные значения при изменении
  useEffect(() => {
    initialValuesRef.current = initialValues;
    setValues(initialValues);
    setIsDirty(false);
  }, [initialValues]);

  // Проверяем, были ли изменения
  useEffect(() => {
    const hasChanges = JSON.stringify(values) !== JSON.stringify(initialValuesRef.current);
    setIsDirty(hasChanges);
  }, [values]);

  const handleChange = useCallback((name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleChangeMultiple = useCallback((updates: Partial<T>) => {
    setValues(prev => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialValuesRef.current);
    setIsDirty(false);
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (onSubmit) {
      await onSubmit(values);
    }
  }, [values, onSubmit]);

  return {
    values,
    isDirty,
    handleChange,
    handleChangeMultiple,
    reset,
    setValues,
    handleSubmit
  };
}

