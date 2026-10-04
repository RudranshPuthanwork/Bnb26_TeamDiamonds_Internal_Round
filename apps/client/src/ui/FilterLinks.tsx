import React from 'react';
import styles from './FilterLinks.module.css';

export interface FilterLinksProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

/** Text-link group; the active filter has a 2px underline. */
export const FilterLinks: React.FC<FilterLinksProps> = ({ label, options, value, onChange }) => (
  <div className={styles.group} role="group" aria-label={label}>
    <span className={styles.label}>{label}</span>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className={o.value === value ? styles.active : styles.link}
        aria-pressed={o.value === value}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);
