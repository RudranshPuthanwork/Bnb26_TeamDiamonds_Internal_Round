import React, { type ReactNode } from 'react';
import styles from './Empty.module.css';
import { COPY } from '../copy';

export interface EmptyProps {
  message?: string;
  action?: ReactNode;
  className?: string;
}

export const Empty: React.FC<EmptyProps> = ({
  message = COPY.states.empty,
  action,
  className = '',
}) => {
  return (
    <div className={`${styles.emptyBox} ${className}`.trim()} role="status">
      <p className={styles.text}>{message}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
};
