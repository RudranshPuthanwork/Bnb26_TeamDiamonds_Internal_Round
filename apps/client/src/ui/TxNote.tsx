import React from 'react';
import { Loading } from './Loading';
import { ErrorNote } from './ErrorNote';
import { COPY } from '../copy';
import type { Described } from '../errors';

export interface TxNoteProps {
  pending: boolean;
  error: Described | null;
}

/** Transaction state: pending, or failed with the reason in plain words. */
export const TxNote: React.FC<TxNoteProps> = ({ pending, error }) => {
  if (pending) return <Loading lineCount={1} text={COPY.tx.pending} />;
  if (error) return <ErrorNote message={`${COPY.tx.failedPrefix}${error.message}`} fix={error.fix} />;
  return null;
};
