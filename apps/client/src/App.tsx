import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RegisterPage } from './pages/RegisterPage';
import { Loading } from './ui/Loading';

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
          <div style={{ padding: 'var(--space-8)' }}>
            <Loading />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<RegisterPage />} />
          {showDevRoutes && (
            <>
              <Route path="/dev/states" element={<DevStatesPage />} />
              <Route path="/dev/tokens" element={<DevTokensPage />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default App;
