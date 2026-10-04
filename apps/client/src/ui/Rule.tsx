import React from 'react';
import styles from './Rule.module.css';

export interface RuleProps {
  className?: string;
}

export const Rule: React.FC<RuleProps> = ({ className = '' }) => {
  return <hr className={`${styles.single} ${className}`.trim()} />;
};
