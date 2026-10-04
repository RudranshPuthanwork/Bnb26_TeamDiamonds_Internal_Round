import React, { type SelectHTMLAttributes } from 'react';
import styles from './SelectField.module.css';

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label: string;
  options: { value: string | number; label: string }[];
}

export const SelectField: React.FC<SelectFieldProps> = ({ id, label, options, className = '', ...rest }) => (
  <div className={`${styles.group} ${className}`.trim()}>
    <label htmlFor={id} className={styles.label}>
      {label}
    </label>
    <select id={id} className={styles.select} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);
