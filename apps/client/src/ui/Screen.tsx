import React, { type ReactNode } from 'react';
import { Page } from './Page';
import { ScreenHeader } from './ScreenHeader';
import { Loading } from './Loading';
import { ErrorNote } from './ErrorNote';
import { Button } from './Button';
import { COPY } from '../copy';
import type { Described } from '../errors';

export interface ScreenProps {
  title: string;
  loading?: boolean;
  error?: Described | null;
  onRetry?: () => void;
  /** Reading-the-chain block shown while loading. */
  block?: number | bigint | string;
  children?: ReactNode;
}

/** Page with title and the shared loading and error states. */
export const Screen: React.FC<ScreenProps> = ({ title, loading, error, onRetry, block, children }) => (
  <Page>
    <ScreenHeader title={title} />
    {loading ? (
      <Loading blockNumber={block} />
    ) : error ? (
      <ErrorNote
        message={error.message}
        fix={error.fix}
        action={onRetry && <Button onClick={onRetry}>{COPY.actions.retry}</Button>}
      />
    ) : (
      children
    )}
  </Page>
);
