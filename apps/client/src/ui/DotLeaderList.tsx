import React, { type ReactNode } from 'react';
import styles from './DotLeaderList.module.css';

export interface DotLeaderItem {
  label: ReactNode;
  value: ReactNode;
}

export interface DotLeaderListProps {
  items: DotLeaderItem[];
  className?: string;
}

export const DotLeaderList: React.FC<DotLeaderListProps> = ({ items, className = '' }) => {
  return (
    <dl className={`${styles.summary} ${className}`.trim()}>
      {items.map((item, index) => (
        <div key={index} className={styles.row}>
          <dt className={styles.label}>{item.label}</dt>
          <span className={styles.leader} aria-hidden="true" />
          <dd className={styles.value}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
};
