import React, { type ReactNode } from 'react';
import styles from './Margin.module.css';

export interface MarginProps {
  margin?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'header';
}

export const Margin: React.FC<MarginProps> = ({
  margin,
  children,
  className = '',
  as: Component = 'div',
}) => {
  return (
    <Component className={`${styles.container} ${className}`.trim()}>
      <div className={styles.marginCol}>{margin}</div>
      <div className={styles.contentCol}>{children}</div>
    </Component>
  );
};
