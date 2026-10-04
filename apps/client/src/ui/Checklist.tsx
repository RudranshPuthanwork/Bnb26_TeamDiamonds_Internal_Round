import React, { type ReactNode } from 'react';
import styles from './Checklist.module.css';

export interface ChecklistStep {
  number: number;
  title: string;
  description: ReactNode;
  /** done and todo steps are quieter than the current one. */
  state?: 'done' | 'current' | 'todo';
}

export interface ChecklistProps {
  steps: ChecklistStep[];
  className?: string;
}

export const Checklist: React.FC<ChecklistProps> = ({ steps, className = '' }) => {
  return (
    <ol className={`${styles.list} ${className}`.trim()}>
      {steps.map((step) => (
        <li key={step.number} className={`${styles.item} ${step.state ? styles[step.state] : ''}`.trim()}>
          <span className={styles.number}>{step.number}</span>
          <div className={styles.body}>
            <div className={styles.title}>{step.title}</div>
            <div className={styles.description}>{step.description}</div>
          </div>
        </li>
      ))}
    </ol>
  );
};
