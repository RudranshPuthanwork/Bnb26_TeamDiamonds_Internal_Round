import React, { useState, type ReactNode } from 'react';
import styles from './ErrorNote.module.css';
import { COPY } from '../copy';
import { chainClient } from '../api';
import { Button } from './Button';

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
  const [chosen, setChosen] = useState(false);
  // Never silent: after a relayer outage the user decides whether to submit directly.
  const offerDirect = !!chainClient?.relayerFailed || chosen;
  return (
    <div
      className={`${styles.errorBox} ${className}`.trim()}
      role="alert"
    >
      <div className={styles.message}>{message}</div>
      {fix && <div className={styles.fix}>{fix}</div>}
      {offerDirect && (
        <div className={styles.action}>
          {chosen ? (
            COPY.errors.submitDirectChosen
          ) : (
            <Button
              onClick={() => {
                chainClient?.chooseDirect();
                setChosen(true);
              }}
            >
              {COPY.errors.submitDirect}
            </Button>
          )}
        </div>
      )}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
};
