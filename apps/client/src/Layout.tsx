import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader, Footnote, Page } from './ui';
import { USING_MOCK } from './api';

export const Layout: React.FC = () => (
  <>
    <AppHeader />
    <Outlet />
    {USING_MOCK && (
      <Page>
        <Footnote />
      </Page>
    )}
  </>
);
