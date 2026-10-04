import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader, Footnote } from './ui';
import { USING_MOCK } from './api';

export const Layout: React.FC = () => (
  <>
    <AppHeader />
    <Outlet />
    {USING_MOCK && (
      <div
        style={{
          maxWidth: 'var(--container-max)',
          margin: '0 auto',
          padding: '0 var(--space-8) var(--space-8)',
        }}
      >
        <Footnote />
      </div>
    )}
  </>
);
