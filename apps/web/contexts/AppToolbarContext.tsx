import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type AppToolbarApi = {
  leading: React.ReactNode | null;
  module: React.ReactNode | null;
  setLeading: (node: React.ReactNode | null) => void;
  setModule: (node: React.ReactNode | null) => void;
};

const AppToolbarContext = createContext<AppToolbarApi | null>(null);

export function AppToolbarProvider({ children }: { children: React.ReactNode }) {
  const [leading, setLeadingState] = useState<React.ReactNode | null>(null);
  const [module, setModuleState] = useState<React.ReactNode | null>(null);
  const setLeading = useCallback((n: React.ReactNode | null) => setLeadingState(n), []);
  const setModule = useCallback((n: React.ReactNode | null) => setModuleState(n), []);
  const value = useMemo(
    () => ({ leading, module, setLeading, setModule }),
    [leading, module, setLeading, setModule]
  );
  return <AppToolbarContext.Provider value={value}>{children}</AppToolbarContext.Provider>;
}

export function useAppToolbar(): AppToolbarApi {
  const ctx = useContext(AppToolbarContext);
  if (!ctx) {
    return {
      leading: null,
      module: null,
      setLeading: () => {},
      setModule: () => {},
    };
  }
  return ctx;
}
