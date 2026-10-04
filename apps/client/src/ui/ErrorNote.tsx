import React, { type ReactNode } from 'react';
import styles from './ErrorNote.module.css';
import { COPY } from '../copy';

export interface ErrorNoteProps {
  message?: string;
  fix?: string;
  action?: ReactNode;
  className?: string;
}

export const ErrorNote: React.FC<ErrorNoteProps> = ({
  message = COPY.states.error,
  fix = COPY.states.errorFixPrompt,
  action,
  className = '',
}) => {
  return (
    <div
      className={`${styles.errorBox} ${className}`.trim()}
      role="alert"
    >
      <div className={styles.message}>{message}</div>
      {fix && <div className={styles.fix}>{fix}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
};
