import React, { type ReactNode } from 'react';
import styles from './Status.module.css';
import type { Status, StatusName } from '../api/types';
import { Status as StatusValues } from '../api/types';
import { COPY } from '../copy';

export interface StatusTextProps {
  status: Status | StatusName;
  children?: ReactNode;
  className?: string;
}

/** Plain-text status. Releasable and Claimed are semibold, the rest regular (A2). */
export const StatusText: React.FC<StatusTextProps> = ({ status, children, className = '' }) => {
  const value = typeof status === 'number' ? status : StatusValues[status];
  const strong = value === StatusValues.Releasable || value === StatusValues.Claimed;
  return (
    <span className={`${strong ? styles.strong : styles.plain} ${className}`.trim()}>
      {children ?? COPY.status[value]}
    </span>
  );
};
