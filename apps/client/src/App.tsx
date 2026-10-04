import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  CollectionScreen,
  CreateCollectionScreen,
  AddItemScreen,
  ItemDetailScreen,
  GuardiansScreen,
  ChangesScreen,
  RotateScreen,
} from './screens';
import { Page, Loading } from './ui';
import { Layout } from './Layout';

// Dev routes: code-split so production builds exclude them from the primary bundle
const DevStatesPage = React.lazy(() =>
  import('./pages/DevStatesPage').then((m) => ({ default: m.DevStatesPage }))
);
const DevTokensPage = React.lazy(() =>
  import('./pages/DevTokensPage').then((m) => ({ default: m.DevTokensPage }))
);

// Dev routes are active during development or when accessing the dev hash paths
const showDevRoutes =
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && window.location.hash.startsWith('#/dev'));

export function App() {
  return (
    <HashRouter>
      <Suspense
        fallback={
          <Page>
            <Loading />
          </Page>
        }
      >
        <Routes>
          <Route element={<Layout />}>
          <Route path="/" element={<CollectionScreen />} />
          <Route path="/create" element={<CreateCollectionScreen />} />
          <Route path="/item/new" element={<AddItemScreen />} />
          <Route path="/item/:accession/rotate" element={<RotateScreen />} />
          <Route path="/item/:accession" element={<ItemDetailScreen />} />
          <Route path="/guardians" element={<GuardiansScreen />} />
          <Route path="/changes" element={<ChangesScreen />} />

          {showDevRoutes && (
            <>
              <Route path="/dev/states" element={<DevStatesPage />} />
              <Route path="/dev/tokens" element={<DevTokensPage />} />
            </>
          )}

          <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default App;
