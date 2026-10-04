import React, { type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Field.module.css';

export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  accession?: string;
  error?: string;
  fix?: string;
  children?: ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  id,
  label,
  accession,
  error,
  fix,
  children,
  className = '',
  ...inputProps
}) => {
  return (
    <div className={`${styles.fieldGroup} ${className}`.trim()}>
      <div className={styles.labelCol}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {accession && <span className={`${styles.accessionRef} mono`}>{accession}</span>}
      </div>
      <div className={styles.inputCol}>
        {children ? (
          children
        ) : (
          <input id={id} className={styles.input} {...inputProps} />
        )}
        {error && (
          <div className={styles.errorBox} role="alert">
            <div className={styles.errorText}>{error}</div>
            {fix && <div className={styles.fixText}>{fix}</div>}
          </div>
        )}
      </div>
    </div>
  );
};
