import React from 'react';
import styles from './Accession.module.css';

export interface AccessionProps {
  number: string;
  className?: string;
}

export const Accession: React.FC<AccessionProps> = ({ number, className = '' }) => {
  return (
    <span className={`${styles.accession} ${className}`.trim()}>
      {number}
    </span>
  );
};
