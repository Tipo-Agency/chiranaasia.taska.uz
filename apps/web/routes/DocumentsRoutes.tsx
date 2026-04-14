import React, { lazy, Suspense } from 'react';
import { RouteFallback } from '../components/ui/RouteFallback';
import type { AppRouterProps } from '../components/appRouterTypes';

const DocEditorLazy = lazy(() => import('../components/DocEditor'));

export function DocumentsRoutesView(props: AppRouterProps) {
  const { actions } = props;
  if (!props.activeDoc) {
    return null;
  }
  return (
    <Suspense fallback={<RouteFallback />}>
      <DocEditorLazy
        doc={props.activeDoc}
        onSave={actions.saveDocContent}
        onBack={() => {
          actions.setCurrentView('docs');
        }}
      />
    </Suspense>
  );
}
