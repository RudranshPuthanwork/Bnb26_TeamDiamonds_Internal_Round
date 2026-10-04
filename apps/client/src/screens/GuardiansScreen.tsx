import React from 'react';
import { DotLeaderList, Empty, Hash, LedgerTable, Margin, Notice, Screen, StatusText, Timestamp } from '../ui';
import { api, getVaultId } from '../api';
import { Status } from '../api/types';
import { fmtDateTime } from '../format';
import { useLoad } from '../hooks';
import { COPY } from '../copy';

export const GuardiansScreen: React.FC = () => {
  const c = COPY.guardians;
  const { data: readiness, loading, error, reload } = useLoad(() => api.getGuardiansReadiness(getVaultId()), []);

  return (
    <Screen title={c.pageTitle} loading={loading} error={error} onRetry={reload}>
      {readiness && (
        <>
          <Margin margin={c.marginLabel}>
            <p>{c.paragraph}</p>
          </Margin>

          <DotLeaderList
            items={[
              { label: c.summaryTotal, value: readiness.n },
              { label: c.summaryThreshold, value: readiness.t },
              { label: c.summaryReady, value: `${readiness.readyCount} of ${readiness.n}` },
              {
                label: c.summarySlack,
                value: `${readiness.slack} (ready ${readiness.readyCount} − threshold ${readiness.t})`,
              },
            ]}
          />

          {readiness.slack < 1 && (
            <Notice warning title={c.slackWarning}>
              {c.slackWarning}
            </Notice>
          )}

          {readiness.guardians.length === 0 ? (
            <Empty message={c.empty} />
          ) : (
            <LedgerTable>
              <thead>
                <tr>
                  <th>{c.colGuardian}</th>
                  <th>Key ID</th>
                  <th>{c.colDrillVer}</th>
                  <th>{c.colDrillDate}</th>
                  <th>{c.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {readiness.guardians.map((g) => (
                  <tr key={g.index}>
                    <td>Guardian {g.index}</td>
                    <td>
                      <Hash value={g.keyId} />
                    </td>
                    <td>{g.lastDrillVersion ? `v${g.lastDrillVersion}` : '—'}</td>
                    <td>{g.lastDrillAt ? <Timestamp value={fmtDateTime(g.lastDrillAt)} /> : c.neverDrilled}</td>
                    <td>
                      <StatusText status={g.ready ? Status.Sealed : Status.Disputed}>
                        {g.ready ? c.ready : c.notReady}
                      </StatusText>
                    </td>
                  </tr>
                ))}
              </tbody>
            </LedgerTable>
          )}
        </>
      )}
    </Screen>
  );
};
