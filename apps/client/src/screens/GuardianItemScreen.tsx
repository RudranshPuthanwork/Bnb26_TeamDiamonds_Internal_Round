import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Actions,
  Button,
  DotLeaderList,
  Empty,
  Field,
  Notice,
  RestrictionLine,
  Screen,
  Section,
  SelectField,
  StatusText,
  TxNote,
} from '../ui';
import { api, getVaultId } from '../api';
import { Reason, REASON_NAMES, Status } from '../api/types';
import type { Hex32 } from '../api/types';
import { findByAccession, formatSpan } from '../format';
import { useLoad, useTx } from '../hooks';
import { COPY } from '../copy';

type Action = 'attest' | 'dispute' | 'release' | 'drill';

export const GuardianItemScreen: React.FC = () => {
  const { accession } = useParams<{ accession: string }>();
  const c = COPY.guardianItem;
  const { data, loading, error, reload } = useLoad(async () => {
    const items = await api.listAssets(getVaultId());
    const item = findByAccession(items, accession);
    return item ? api.getGuardianNotice(item.vaultId, item.assetId) : null;
  }, [accession]);

  const tx = useTx();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState<number>(Reason.DECEASED);
  const [evidence, setEvidence] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const evidenceOk = evidence === '' || /^0x[0-9a-fA-F]{64}$/.test(evidence);

  const confirm = async () => {
    if (!data || !action) return;
    const runs: Record<Action, () => Promise<unknown>> = {
      attest: () => api.attest(data.vaultId, reason as Reason, evidence ? (evidence as Hex32) : undefined),
      dispute: () => api.dispute(data.vaultId),
      release: () => api.submitShare(data.vaultId, data.assetId),
      drill: () => api.drill(data.vaultId, data.assetId),
    };
    const result = await tx.run(runs[action]);
    if (result === undefined) return;
    setDone(
      action === 'drill'
        ? result === true
          ? c.drillPassed
          : c.drillFailed
        : { attest: c.doneAttest, dispute: c.doneDispute, release: c.doneRelease }[action]
    );
    setAction(null);
    await reload();
  };

  const signText = (a: Action) =>
    ({
      attest: c.signAttest(REASON_NAMES[reason as Reason].toLowerCase()),
      dispute: c.signDispute,
      release: c.signRelease,
      drill: c.signDrill,
    })[a];

  return (
    <Screen title={data?.title ?? COPY.header.itemDetail} loading={loading} error={error} onRetry={reload}>
      {!data ? (
        <Empty message={c.notFound} action={<Link to="/g">{c.back}</Link>} />
      ) : (
        <>
          <RestrictionLine
            status={data.status}
            {...(data.status === Status.Cooling ? { value: formatSpan(data.opensIn) } : {})}
            {...(data.status === Status.Armed ? { note: COPY.restriction.armed(data.filed, data.kAttest) } : {})}
          />

          <Section title={c.countsHeading}>
            <DotLeaderList
              items={[
                { label: COPY.table.status, value: <StatusText status={data.status} /> },
                { label: c.filedLabel, value: COPY.guardianNotices.filed(data.filed, data.kAttest) },
                { label: c.sharesLabel, value: c.sharesValue(data.sharesFiled, data.t) },
                {
                  label: c.yourMark,
                  value: data.myReason === Reason.NONE ? c.none : REASON_NAMES[data.myReason].toLowerCase(),
                },
                { label: c.yourDispute, value: data.iDisputed ? c.disputed : c.none },
              ]}
            />
          </Section>

          {done && <Notice title={done}>{COPY.tx.mined}</Notice>}

          {!action && (
            <Section title={c.actionsHeading}>
              <Actions>
                <Button variant="primary" onClick={() => setAction('attest')}>
                  {c.attestBtn}
                </Button>
                <Button onClick={() => setAction('dispute')}>{c.disputeBtn}</Button>
                {data.releasable && !data.iSubmitted && (
                  <Button onClick={() => setAction('release')}>{c.releaseBtn}</Button>
                )}
                <Button variant="tertiary" onClick={() => setAction('drill')}>
                  {c.drillBtn}
                </Button>
              </Actions>
            </Section>
          )}

          {action && (
            <Section title={c.confirmHeading}>
              {action === 'attest' && (
                <>
                  <SelectField
                    id="reason"
                    label={c.reasonLabel}
                    value={reason}
                    onChange={(e) => setReason(Number(e.target.value))}
                    options={[
                      { value: Reason.INCAPACITATED, label: c.reasonIncapacitated },
                      { value: Reason.DECEASED, label: c.reasonDeceased },
                      { value: Reason.MISSING, label: c.reasonMissing },
                    ]}
                  />
                  <Field
                    id="evidence"
                    label={c.evidenceLabel}
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value.trim())}
                    error={evidenceOk ? undefined : c.evidenceInvalid}
                  />
                </>
              )}
              {action === 'dispute' && <p>{c.disputeExplain}</p>}
              {action === 'drill' && <p>{c.drillExplain}</p>}
              <Notice title={signText(action)}>{signText(action)}</Notice>
              <TxNote pending={tx.pending} error={tx.error} />
              <Actions>
                <Button
                  variant="primary"
                  disabled={tx.pending || (action === 'attest' && !evidenceOk)}
                  onClick={confirm}
                >
                  {c.confirm}
                </Button>
                <Button
                  disabled={tx.pending}
                  onClick={() => {
                    setAction(null);
                    tx.clear();
                  }}
                >
                  {c.cancel}
                </Button>
              </Actions>
            </Section>
          )}
        </>
      )}
    </Screen>
  );
};
