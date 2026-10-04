import React from 'react';
import styles from './RestrictionLine.module.css';
import type { Status, StatusName } from '../api/types';
import { Status as StatusValues } from '../api/types';
import { COPY } from '../copy';

export interface RestrictionLineProps {
  status: Status | StatusName;
  label?: string;
  value?: string;
  note?: string;
  className?: string;
}

function resolveStatus(s: Status | StatusName): Status {
  if (typeof s === 'number') {
    return s;
  }
  switch (s) {
    case 'Sealed':
      return StatusValues.Sealed;
    case 'Armed':
      return StatusValues.Armed;
    case 'Silent':
      return StatusValues.Silent;
    case 'Cooling':
      return StatusValues.Cooling;
    case 'Disputed':
      return StatusValues.Disputed;
    case 'Releasable':
      return StatusValues.Releasable;
    case 'ContingentEligible':
      return StatusValues.ContingentEligible;
    case 'Claimed':
      return StatusValues.Claimed;
    default:
      return StatusValues.Sealed;
  }
}

export const RestrictionLine: React.FC<RestrictionLineProps> = ({
  status,
  label,
  value,
  note,
  className = '',
}) => {
  const resolved = resolveStatus(status);
  const preset: { label?: string; value: string; note: string } = COPY.restrictionLine[resolved];
  const displayLabel = label ?? preset.label;

  return (
    <div className={`${styles.container} ${className}`.trim()}>
      {displayLabel && <div className={styles.label}>{displayLabel}</div>}
      <div className={styles.value}>{value ?? preset.value}</div>
      <div className={styles.note}>{note ?? preset.note}</div>
    </div>
  );
};
