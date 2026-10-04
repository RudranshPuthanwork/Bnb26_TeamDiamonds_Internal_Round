import React, { type ReactNode } from 'react';
import styles from './CheckboxGroup.module.css';

export interface CheckboxOption {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export interface CheckboxGroupProps {
  options: CheckboxOption[];
  className?: string;
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  options,
  className = '',
}) => {
  return (
    <div className={`${styles.group} ${className}`.trim()}>
      {options.map((opt) => (
        <label key={opt.id} className={styles.item}>
          <input
            id={opt.id}
            type="checkbox"
            checked={opt.checked}
            onChange={(e) => opt.onChange(e.target.checked)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
};
