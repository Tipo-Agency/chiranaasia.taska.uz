import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { orgEndpoint } from '../services/apiClient';
import { applyOrgBrandingToDocument, type OrgBrandingDto } from '../utils/applyOrgBranding';

type Ctx = {
  branding: OrgBrandingDto | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setBrandingLocal: (d: OrgBrandingDto) => void;
};

const OrgBrandingContext = createContext<Ctx | null>(null);

export function OrgBrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<OrgBrandingDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const d = await orgEndpoint.getBranding();
      setBranding(d);
      applyOrgBrandingToDocument(d);
    } catch {
      setBranding(null);
      applyOrgBrandingToDocument(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setBrandingLocal = useCallback((d: OrgBrandingDto) => {
    setBranding(d);
    applyOrgBrandingToDocument(d);
  }, []);

  const value = useMemo(
    () => ({ branding, loading, refresh, setBrandingLocal }),
    [branding, loading, refresh, setBrandingLocal]
  );

  return <OrgBrandingContext.Provider value={value}>{children}</OrgBrandingContext.Provider>;
}

export function useOrgBranding(): Ctx {
  const v = useContext(OrgBrandingContext);
  if (!v) {
    throw new Error('useOrgBranding must be used within OrgBrandingProvider');
  }
  return v;
}
