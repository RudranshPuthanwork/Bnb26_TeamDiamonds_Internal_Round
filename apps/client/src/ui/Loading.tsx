import React from 'react';
import styles from './Loading.module.css';
import { COPY } from '../copy';

export interface LoadingProps {
  blockNumber?: number | bigint | string;
  text?: string;
  lineCount?: number;
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  blockNumber = COPY.states.defaultLoadingBlock,
  text,
  lineCount = 4,
  className = '',
}) => {
  const formattedBlock =
    typeof blockNumber === 'bigint' || typeof blockNumber === 'number'
      ? Number(blockNumber).toLocaleString('en-US')
      : blockNumber;

  const statusText =
    text ?? `${COPY.states.loadingPrefix}${formattedBlock}`;

  const lines = Array.from({ length: lineCount }, (_, i) => i);

  return (
    <div
      className={`${styles.container} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className={styles.ruledLines}>
        {lines.map((i) => (
          <div key={i} className={styles.blankLine} />
        ))}
      </div>
      <div className={styles.statusLine}>{statusText}</div>
    </div>
  );
};
