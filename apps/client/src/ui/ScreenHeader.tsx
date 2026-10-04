import React, { type ReactNode } from 'react';
import styles from './ScreenHeader.module.css';

export interface ScreenHeaderProps {
  title: string;
  children?: ReactNode;
  className?: string;
}

/** Page title only. Navigation lives in AppHeader. */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, children, className = '' }) => {
  return (
    <header className={`${styles.header} ${className}`.trim()}>
      <h1 className={styles.title}>{title}</h1>
      {children && <div className={styles.extraContent}>{children}</div>}
    </header>
  );
};
