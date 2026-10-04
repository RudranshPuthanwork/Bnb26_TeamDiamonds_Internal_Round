import React, { type ReactNode } from 'react';
import styles from './Stamp.module.css';
import type { Status, StatusName } from '../api/types';
import { Status as StatusValues, STATUS_NAMES } from '../api/types';
import { COPY } from '../copy';

export interface StampProps {
  status: Status | StatusName;
  children?: ReactNode;
  className?: string;
}

const STATUS_CLASS_MAP: Record<Status, string> = {
  [StatusValues.Sealed]: styles.sealed,
  [StatusValues.Armed]: styles.armed,
  [StatusValues.Silent]: styles.silent,
  [StatusValues.Cooling]: styles.cooling,
  [StatusValues.Disputed]: styles.disputed,
  [StatusValues.Releasable]: styles.releasable,
  [StatusValues.ContingentEligible]: styles.contingentEligible,
  [StatusValues.Claimed]: styles.claimed,
};

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

export const Stamp: React.FC<StampProps> = ({ status, children, className = '' }) => {
  const resolved = resolveStatus(status);
  const statusClass = STATUS_CLASS_MAP[resolved] ?? styles.sealed;
  const label = children ?? COPY.stamps[resolved];

  return (
    <span
      className={`${styles.base} ${statusClass} ${className}`.trim()}
      data-status={STATUS_NAMES[resolved]}
    >
      {label}
    </span>
  );
};
