import React, { useEffect, useState } from 'react';
import {
  Button,
  Empty,
  ErrorNote,
  LedgerTable,
  Loading,
  Margin,
  Page,
  Rule,
  ScreenHeader,
  Timestamp,
} from '../ui';
import { api, DEFAULT_VAULT_ID } from '../api';
import type { QueuedChange } from '../api/types';
import { COPY } from '../copy';

export const ChangesScreen: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<QueuedChange[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listQueuedChanges(DEFAULT_VAULT_ID);
      setChanges(data);
    } catch {
      setError(COPY.states.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRevoke = async (changeId: `0x${string}`) => {
    setActionLoading(true);
    setError(null);
    try {
      await api.revokeChange(DEFAULT_VAULT_ID, changeId);
      const updated = await api.listQueuedChanges(DEFAULT_VAULT_ID);
      setChanges(updated);
    } catch {
      setError(COPY.states.error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || actionLoading) {
    return (
      <Page>
        <ScreenHeader title={COPY.changes.pageTitle} />
        <Loading />
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <ScreenHeader title={COPY.changes.pageTitle} />
        <ErrorNote
          message={error}
          action={<Button onClick={loadData}>{COPY.actions.retry}</Button>}
        />
      </Page>
    );
  }

  const formatRemaining = (applyAfter: number) => {
    const diff = applyAfter - Math.floor(Date.now() / 1000);
    if (diff <= 0) return 'Ready to apply';
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    return `${days} d ${hours} h`;
  };

  return (
    <Page>
      <ScreenHeader
        title={COPY.changes.pageTitle}
      />

      <Margin margin={COPY.changes.marginLabel}>
        <p>{COPY.changes.paragraph}</p>
      </Margin>

      {changes.length === 0 ? (
        <Empty message={COPY.changes.empty} />
      ) : (
        <LedgerTable>
          <thead>
            <tr>
              <th>{COPY.changes.colChange}</th>
              <th>{COPY.changes.colTimeLeft}</th>
              <th>{COPY.changes.colApplyAfter}</th>
              <th>{COPY.changes.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.changeId}>
                <td>
                  <strong>{c.kind}:</strong> {c.description}
                </td>
                <td>{formatRemaining(c.applyAfter)}</td>
                <td>
                  <Timestamp value="28 Oct 2026, 12:00 UTC" />
                </td>
                <td>
                  <Button
                    type="button"
                    onClick={() => handleRevoke(c.changeId)}
                  >
                    {COPY.changes.revokeBtn}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </LedgerTable>
      )}

      <Rule />
    </Page>
  );
};
