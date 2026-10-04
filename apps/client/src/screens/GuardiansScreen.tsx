import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  DevFooter,
  DotLeaderList,
  Empty,
  ErrorNote,
  Hash,
  LedgerTable,
  Loading,
  Margin,
  Notice,
  Page,
  Rule,
  ScreenHeader,
  Stamp,
  Timestamp,
} from '../ui';
import { mockApi, MOCK_VAULT_ID } from '../api/mockApi';
import type { GuardianReadinessInfo } from '../api/types';
import { Status } from '../api/types';
import { COPY } from '../copy';

export const GuardiansScreen: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<GuardianReadinessInfo | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mockApi.getGuardiansReadiness(MOCK_VAULT_ID);
      setReadiness(data);
    } catch {
      setError(COPY.states.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <Page>
        <ScreenHeader title={COPY.guardians.pageTitle} />
        <Loading />
        <DevFooter />
      </Page>
    );
  }

  if (error || !readiness) {
    return (
      <Page>
        <ScreenHeader title={COPY.guardians.pageTitle} />
        <ErrorNote
          message={error ?? COPY.states.error}
          action={<Button onClick={loadData}>{COPY.actions.retry}</Button>}
        />
        <DevFooter />
      </Page>
    );
  }

  const summaryItems = [
    { label: COPY.guardians.summaryTotal, value: readiness.n },
    { label: COPY.guardians.summaryThreshold, value: readiness.t },
    { label: COPY.guardians.summaryReady, value: `${readiness.readyCount} of ${readiness.n}` },
    {
      label: COPY.guardians.summarySlack,
      value: `${readiness.slack} (ready ${readiness.readyCount} − threshold ${readiness.t})`,
    },
  ];

  return (
    <Page>
      <ScreenHeader
        title={COPY.guardians.pageTitle}
        links={
          <>
            <Link to="/">{COPY.nav.register}</Link>
            <Link to="/changes">{COPY.nav.changes}</Link>
          </>
        }
      />

      <Margin margin={COPY.guardians.marginLabel}>
        <p>{COPY.guardians.paragraph}</p>
      </Margin>

      <DotLeaderList items={summaryItems} />

      {readiness.slack < 1 && (
        <Notice warning title={COPY.guardians.slackWarning}>
          {COPY.guardians.slackWarning}
        </Notice>
      )}

      {readiness.guardians.length === 0 ? (
        <Empty message={COPY.guardians.empty} />
      ) : (
        <LedgerTable>
          <thead>
            <tr>
              <th>{COPY.guardians.colGuardian}</th>
              <th>Key ID</th>
              <th>{COPY.guardians.colDrillVer}</th>
              <th>{COPY.guardians.colDrillDate}</th>
              <th>{COPY.guardians.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {readiness.guardians.map((g) => (
              <tr key={g.index}>
                <td>Guardian {g.index}</td>
                <td>
                  <Hash value={g.keyId} />
                </td>
                <td>v{g.lastDrillVersion}</td>
                <td>
                  <Timestamp value="18 Oct 2026, 14:00 UTC" />
                </td>
                <td>
                  <Stamp status={g.ready ? Status.Sealed : Status.Disputed}>
                    {g.ready ? COPY.guardians.ready : COPY.guardians.notReady}
                  </Stamp>
                </td>
              </tr>
            ))}
          </tbody>
        </LedgerTable>
      )}

      <Rule />
      <DevFooter />
    </Page>
  );
};
