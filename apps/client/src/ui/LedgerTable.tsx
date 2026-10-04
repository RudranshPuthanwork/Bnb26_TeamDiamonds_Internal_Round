import React, { type TableHTMLAttributes } from 'react';
import styles from './LedgerTable.module.css';

export interface LedgerTableProps
  extends TableHTMLAttributes<HTMLTableElement> {
  className?: string;
}

export const LedgerTable: React.FC<LedgerTableProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={styles.tableWrapper}>
      <table className={`${styles.table} ${className}`.trim()} {...props}>
        {children}
      </table>
    </div>
  );
};
