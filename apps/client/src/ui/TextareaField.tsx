import React, { type TextareaHTMLAttributes } from 'react';
import styles from './TextareaField.module.css';

export interface TextareaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id: string;
  label: string;
  hint?: string;
  errors?: string[];
}

export const TextareaField: React.FC<TextareaFieldProps> = ({
  id,
  label,
  hint,
  errors,
  className = '',
  ...textareaProps
}) => {
  return (
    <div className={`${styles.fieldGroup} ${className}`.trim()}>
      <div className={styles.labelCol}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      </div>
      <div className={styles.inputCol}>
        <textarea
          id={id}
          className={`${styles.textarea} mono`}
          {...textareaProps}
        />
        {hint && <div className={styles.hint}>{hint}</div>}
        {errors && errors.length > 0 && (
          <div className={styles.errorList} role="alert">
            {errors.map((err, i) => (
              <div key={i} className={styles.errorItem}>
                {err}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
