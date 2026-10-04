import React from 'react';
import { Checklist, Notice, Page, ScreenHeader } from '../ui';
import { COPY } from '../copy';

export const GuardianGuideScreen: React.FC = () => (
  <Page>
    <ScreenHeader title={COPY.guide.pageTitle} />
    <p>{COPY.guide.intro}</p>
    <Checklist
      steps={COPY.guide.steps.map(([title, description], i) => ({ number: i + 1, title, description }))}
    />
    <Notice warning>{COPY.guide.warning}</Notice>
  </Page>
);
