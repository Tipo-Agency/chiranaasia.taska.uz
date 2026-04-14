import React, { useState, useEffect } from 'react';
import PublicContentPlanView from './components/PublicContentPlanView';
import { AppAuthenticatedRoot } from './routes';
import { AppProviders } from './providers/AppProviders';
import { getPublicContentPlanIdFromPath } from './utils/publicRoutes';

export default function App() {
  const [publicContentPlanId, setPublicContentPlanId] = useState<string | null>(() =>
    getPublicContentPlanIdFromPath()
  );

  useEffect(() => {
    const sync = () => setPublicContentPlanId(getPublicContentPlanIdFromPath());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  if (publicContentPlanId) {
    return <PublicContentPlanView tableId={publicContentPlanId} />;
  }

  return (
    <AppProviders>
      <AppAuthenticatedRoot />
    </AppProviders>
  );
}
