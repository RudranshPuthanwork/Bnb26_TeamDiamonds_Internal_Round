import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './AuditLedger.module.css';

export interface AuditRow {
  id: string;
  time: ReactNode;
  event: ReactNode;
  actor: ReactNode;
  tx: ReactNode;
  /** Struck through when a later owner action voided it. */
  voided?: boolean;
}

export interface AuditLedgerProps {
  head: [string, string, string, string];
  rows: AuditRow[];
}

/**
 * Dated ledger rows. Rows that arrive after the first render open their height over 150 ms;
 * rows that become voided are struck through over 200 ms. Reduced motion is handled in global.css.
 */
export const AuditLedger: React.FC<AuditLedgerProps> = ({ head, rows }) => {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [struck, setStruck] = useState<Set<string>>(new Set());
  const wasVoided = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ids = new Set(rows.map((r) => r.id));
    if (seen.current) {
      const added = rows.filter((r) => !seen.current!.has(r.id)).map((r) => r.id);
      if (added.length) setFresh((f) => new Set([...f, ...added]));
      const newlyVoided = rows.filter((r) => r.voided && !wasVoided.current.has(r.id) && seen.current!.has(r.id));
      if (newlyVoided.length) setStruck((s) => new Set([...s, ...newlyVoided.map((r) => r.id)]));
    }
    seen.current = ids;
    wasVoided.current = new Set(rows.filter((r) => r.voided).map((r) => r.id));
  }, [rows]);

  return (
    <div className={styles.ledger} role="table">
      <div className={`${styles.line} ${styles.head}`} role="row">
        {head.map((h) => (
          <div key={h} role="columnheader">
            {h}
          </div>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.id} className={fresh.has(r.id) ? styles.open : styles.row} role="presentation">
          <div className={styles.inner}>
            <div
              className={`${styles.line} ${r.voided ? (struck.has(r.id) ? styles.striking : styles.struck) : ''}`.trim()}
              role="row"
            >
              <div role="cell">{r.time}</div>
              <div role="cell" className={styles.event}>
                {r.event}
              </div>
              <div role="cell">{r.actor}</div>
              <div role="cell">{r.tx}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
