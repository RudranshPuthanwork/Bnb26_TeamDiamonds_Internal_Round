import React from 'react';
import {
  Accession,
  Empty,
  ErrorNote,
  Loading,
  Margin,
  RestrictionLine,
  Rule,
  ScreenHeader,
  StatusText,
} from '../ui';
import { Status, STATUS_NAMES } from '../api/types';
import { COPY } from '../copy';

const ALL_STATUSES = [
  Status.Sealed,
  Status.Armed,
  Status.Silent,
  Status.Cooling,
  Status.Disputed,
  Status.Releasable,
  Status.ContingentEligible,
  Status.Claimed,
];

export const DevStatesPage: React.FC = () => {
  return (
    <div style={{ padding: 'var(--space-6) var(--space-8)' }}>
      <ScreenHeader
        title={COPY.nav.devStates}
      />

      {/* Section 1: All eight statuses */}
      <Margin
        margin={
          <div>
            <Accession number="DEV-01/STAMPS" />
            <div style={{ marginTop: 'var(--space-1)' }}>Eight statuses</div>
          </div>
        }
      >
        <h2>Status text</h2>
        <p style={{ color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-4)' }}>
          Status is plain text. Releasable and Claimed are semibold.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}
        >
          {ALL_STATUSES.map((status) => (
            <div
              key={status}
              style={{
                border: '1px solid var(--color-rule)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius)',
              }}
            >
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <StatusText status={status} />
              </div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-secondary)',
                }}
              >
                Status: {STATUS_NAMES[status]}
              </div>
            </div>
          ))}
        </div>
      </Margin>

      <Rule />

      {/* Section 2: All eight Restriction Line states */}
      <Margin
        margin={
          <div>
            <Accession number="DEV-02/LOUD" />
            <div style={{ marginTop: 'var(--space-1)' }}>Loud Elements</div>
          </div>
        }
      >
        <h2>Restriction Lines</h2>
        <p style={{ color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-4)' }}>
          The item restriction line is set in Gloock at loud scale. Nothing else on any screen exceeds 3.8rem.
        </p>

        {ALL_STATUSES.map((status) => (
          <div key={status} style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ marginBottom: 'var(--space-1)' }}>
              <StatusText status={status} />
            </div>
            <RestrictionLine status={status} />
            <Rule />
          </div>
        ))}
      </Margin>

      {/* Section 3: Data Screen States */}
      <Margin
        margin={
          <div>
            <Accession number="DEV-03/DATA" />
            <div style={{ marginTop: 'var(--space-1)' }}>Required States</div>
          </div>
        }
      >
        <h2>Required Data States</h2>
        <p style={{ color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-4)' }}>
          Empty, loading, and error states present on every data surface.
        </p>

        <h3>Empty State</h3>
        <Empty />

        <Rule />

        <h3>Loading State</h3>
        <Loading blockNumber={14203118n} />

        <Rule />

        <h3>Error State</h3>
        <ErrorNote />
      </Margin>
    </div>
  );
};
