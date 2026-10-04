import React from 'react';
import styles from './Rule.module.css';

export interface RuleProps {
  double?: boolean;
  className?: string;
}

export const Rule: React.FC<RuleProps> = ({ double = false, className = '' }) => {
  return (
    <hr
      className={`${double ? styles.double : styles.single} ${className}`.trim()}
    />
  );
};
