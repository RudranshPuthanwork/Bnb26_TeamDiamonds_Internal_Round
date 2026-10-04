import React, { type ReactNode } from 'react';
import styles from './Section.module.css';
import { Rule } from './Rule';

export interface SectionProps {
  title?: string;
  children?: ReactNode;
  className?: string;
  hideRule?: boolean;
}

export const Section: React.FC<SectionProps> = ({
  title,
  children,
  className = '',
  hideRule = false,
}) => {
  return (
    <section className={`${styles.section} ${className}`.trim()}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {!hideRule && <Rule className={styles.rule} />}
      {children}
    </section>
  );
};
