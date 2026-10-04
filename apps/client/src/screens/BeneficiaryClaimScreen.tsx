import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Actions, Button, Checklist, Empty, Notice, Screen, TxNote } from '../ui';
import { api, DEFAULT_VAULT_ID } from '../api';
import type { ClaimProgress } from '../api/types';
import { findByAccession } from '../format';
import { useLoad, useTx } from '../hooks';
import { COPY } from '../copy';

type Plain = { filename: string; bytes: Uint8Array };

export const BeneficiaryClaimScreen: React.FC = () => {
  const { accession } = useParams<{ accession: string }>();
  const c = COPY.claim;
  const { data, loading, error, reload } = useLoad<ClaimProgress | null>(async () => {
    const item = findByAccession(await api.listClaims(DEFAULT_VAULT_ID), accession);
    return item ? api.getClaimProgress(item.vaultId, item.assetId) : null;
  }, [accession], 4000);

  const decrypt = useTx();
  const claim = useTx();
  const [plain, setPlain] = useState<Plain | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  // Once t valid shares are in, decrypt on this device. The plaintext lives only in component state.
  const ready = data?.step === 'ready';
  useEffect(() => {
    if (!ready || plain || decrypting || !data) return;
    setDecrypting(true);
    void decrypt
      .run(() => api.reconstruct(data.vaultId, data.assetId))
      .then((p) => p && setPlain(p))
      .finally(() => setDecrypting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, data?.assetId]);

  const download = async () => {
    if (!data || !plain) return;
    const url = URL.createObjectURL(new Blob([plain.bytes as BlobPart]));
    const a = document.createElement('a');
    a.href = url;
    a.download = plain.filename;
    a.click();
    URL.revokeObjectURL(url);
    await recordClaim();
  };

  const recordClaim = async () => {
    if (!data) return;
    if ((await claim.run(() => api.markClaimed(data.vaultId, data.assetId))) !== undefined) {
      setPlain(null);
      await reload();
    }
  };

  const step = data?.step ?? 'waiting';
  const at = { waiting: 1, collecting: 2, decrypting: 3, ready: 4, claimed: 5 }[decrypting ? 'decrypting' : step];
  const state = (n: number) => (n < at ? 'done' : n === at ? 'current' : 'todo');

  return (
    <Screen title={data?.title ?? COPY.header.itemDetail} loading={loading} error={error} onRetry={reload}>
      {!data ? (
        <Empty message={c.notFound} action={<Link to="/b">{c.back}</Link>} />
      ) : (
        <>
          <Checklist
            steps={[
              { number: 1, title: c.waitingTitle, description: c.waitingBody, state: state(1) },
              {
                number: 2,
                title: c.collectingTitle,
                state: state(2),
                description: (
                  <>
                    <div>{c.collectingBody(data.received, data.t)}</div>
                    {data.rejected.map((r) => (
                      <div key={r.guardianIndex}>{c.rejectedBody(r.guardianIndex, r.reason)}</div>
                    ))}
                  </>
                ),
              },
              { number: 3, title: c.decryptingTitle, description: c.decryptingBody, state: state(3) },
              {
                number: 4,
                title: c.readyTitle,
                state: state(4),
                description: (
                  <>
                    <div>{c.readyBody}</div>
                    {plain && (
                      <Actions>
                        <Button variant="primary" disabled={claim.pending} onClick={download}>
                          {c.download}
                        </Button>
                      </Actions>
                    )}
                  </>
                ),
              },
            ]}
          />
          <TxNote pending={decrypt.pending || claim.pending} error={decrypt.error ?? claim.error} />
          {claim.error && data.step !== 'claimed' && plain && (
            <Actions>
              <Button onClick={recordClaim}>{c.recordClaim}</Button>
            </Actions>
          )}
          {data.step === 'claimed' && (
            <Notice warning title={c.rotateHeading}>
              {c.rotateBody}
            </Notice>
          )}
        </>
      )}
    </Screen>
  );
};
