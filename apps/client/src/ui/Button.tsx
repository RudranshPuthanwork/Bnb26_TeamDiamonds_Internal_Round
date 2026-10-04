import React, { type ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  children,
  className = '',
  disabled = false,
  type = 'button',
  ...props
}) => {
  const variantClass = styles[variant] ?? styles.secondary;

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${styles.base} ${variantClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
};
