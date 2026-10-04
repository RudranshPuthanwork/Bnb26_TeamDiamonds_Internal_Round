import React, { type ReactNode } from 'react';
import styles from './Actions.module.css';

export interface ActionsProps {
  children: ReactNode;
  className?: string;
}

export const Actions: React.FC<ActionsProps> = ({ children, className = '' }) => {
  return <div className={`${styles.actions} ${className}`.trim()}>{children}</div>;
};
