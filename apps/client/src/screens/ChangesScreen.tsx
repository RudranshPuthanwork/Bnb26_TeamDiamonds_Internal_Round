import React from 'react';
import { Button, Empty, LedgerTable, Margin, Screen, Timestamp, TxNote } from '../ui';
import { api, getVaultId } from '../api';
import { fmtDateTime, formatSpan } from '../format';
import { useLoad, useTx } from '../hooks';
import { COPY } from '../copy';

export const ChangesScreen: React.FC = () => {
  const c = COPY.changes;
  const tx = useTx();
  const { data, loading, error, reload } = useLoad(async () => {
    const [changes, info] = await Promise.all([api.listQueuedChanges(getVaultId()), api.getChainInfo()]);
    return { changes, now: info.now };
  }, []);

  const revoke = async (changeId: `0x${string}`) => {
    if ((await tx.run(() => api.revokeChange(getVaultId(), changeId))) !== undefined) await reload();
  };

  return (
    <Screen title={c.pageTitle} loading={loading} error={error} onRetry={reload}>
      <Margin margin={c.marginLabel}>
        <p>{c.paragraph}</p>
      </Margin>
      <TxNote pending={tx.pending} error={tx.error} />
      {!data || data.changes.length === 0 ? (
        <Empty message={c.empty} />
      ) : (
        <LedgerTable>
          <thead>
            <tr>
              <th>{c.colChange}</th>
              <th>{c.colTimeLeft}</th>
              <th>{c.colApplyAfter}</th>
              <th>{c.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {data.changes.map((ch) => (
              <tr key={ch.changeId}>
                <td>
                  <strong>{ch.kind}:</strong> {ch.description}
                </td>
                <td>{ch.applyAfter <= data.now ? c.ready : formatSpan(ch.applyAfter - data.now)}</td>
                <td>
                  <Timestamp value={fmtDateTime(ch.applyAfter)} />
                </td>
                <td>
                  <Button disabled={tx.pending} onClick={() => revoke(ch.changeId)}>
                    {c.revokeBtn}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </LedgerTable>
      )}
    </Screen>
  );
};
