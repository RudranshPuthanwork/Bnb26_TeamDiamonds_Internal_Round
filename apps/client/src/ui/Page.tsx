import React, { type ReactNode } from 'react';
import styles from './Page.module.css';

export interface PageProps {
  children: ReactNode;
  className?: string;
}

export const Page: React.FC<PageProps> = ({ children, className = '' }) => {
  return <div className={`${styles.page} ${className}`.trim()}>{children}</div>;
};
