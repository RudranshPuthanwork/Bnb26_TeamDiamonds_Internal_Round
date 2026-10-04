import React from 'react';
import styles from './Duration.module.css';

export interface DurationProps {
  /** Count of TIME_UNIT */
  units: number;
  /** Unit scale: 'days' in production, 'minutes' in demo */
  unit?: 'days' | 'minutes';
  className?: string;
}

export function formatDuration(units: number, unit: 'days' | 'minutes' = 'days'): string {
  if (unit === 'minutes') {
    const totalMinutes = Math.max(0, Math.round(units));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} h ${String(minutes).padStart(2, '0')} m`;
  }

  // default 'days'
  const totalHours = Math.max(0, Math.round(units * 24));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days} d ${String(hours).padStart(2, '0')} h`;
}

export const Duration: React.FC<DurationProps> = ({
  units,
  unit = 'days',
  className = '',
}) => {
  return (
    <span className={`${styles.duration} ${className}`.trim()}>
      {formatDuration(units, unit)}
    </span>
  );
};
