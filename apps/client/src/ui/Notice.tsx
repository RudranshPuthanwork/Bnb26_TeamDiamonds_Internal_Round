import React, { type ReactNode } from 'react';
import styles from './Notice.module.css';

export interface NoticeProps {
  title?: string;
  children: ReactNode;
  warning?: boolean;
  className?: string;
}

export const Notice: React.FC<NoticeProps> = ({
  title,
  children,
  warning = false,
  className = '',
}) => {
  return (
    <div
      className={`${styles.notice} ${warning ? styles.warning : ''} ${className}`.trim()}
      role={warning ? 'alert' : 'status'}
    >
      {title && <div className={styles.title}>{title}</div>}
      <div className={styles.text}>{children}</div>
    </div>
  );
};
