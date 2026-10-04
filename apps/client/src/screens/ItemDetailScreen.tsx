import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Actions,
  Button,
  DotLeaderList,
  Empty,
  Field,
  Hash,
  LedgerTable,
  Notice,
  RestrictionLine,
  Screen,
  Section,
  StatusText,
  Timestamp,
  TxNote,
} from '../ui';
import { api, getVaultId } from '../api';
import { Reason, Status } from '../api/types';
import { findByAccession, fmtDate, fmtDateTime, formatSpan } from '../format';
import { useLoad, useTx } from '../hooks';
import { COPY } from '../copy';

const DAY = 86400;
const when = (ts: bigint | number) => (Number(ts) > 0 ? <Timestamp value={fmtDateTime(Number(ts))} /> : '—');
const MARKS: Record<number, string> = {
  [Reason.INCAPACITATED]: COPY.itemDetail.attestationIncapacitated,
  [Reason.DECEASED]: COPY.itemDetail.attestationDeceased,
  [Reason.MISSING]: COPY.itemDetail.attestationMissing,
};

export const ItemDetailScreen: React.FC = () => {
  const { accession } = useParams<{ accession: string }>();
  const navigate = useNavigate();
  const c = COPY.itemDetail;
  const tx = useTx();
  const [showAbsence, setShowAbsence] = useState(false);
  const [absenceDays, setAbsenceDays] = useState(30);
  const [success, setSuccess] = useState<string | null>(null);

  const { data, loading, error, reload } = useLoad(async () => {
    const [items, vault, info, attestations] = await Promise.all([
      api.listAssets(getVaultId()),
      api.getVault(getVaultId()),
      api.getChainInfo(),
      api.getAttestations(getVaultId()),
    ]);
    const item = findByAccession(items, accession);
    const timeline = item ? await api.timeline(item.vaultId, item.assetId) : null;
    return { item, vault, info, attestations, timeline };
  }, [accession]);

  const cancel = async () => {
    if (!data?.item) return;
    const wasReleased = data.item.released || data.item.status === Status.Claimed;
    if ((await tx.run(() => api.cancel(data.vault.vaultId))) === undefined) return;
    if (wasReleased) navigate(`/item/${encodeURIComponent(data.item.accessionNumber)}/rotate`);
    else await reload();
  };

  const setAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    const until = data.info.now + absenceDays * DAY;
    if ((await tx.run(() => api.setAbsence(data.vault.vaultId, until))) === undefined) return;
    setSuccess(c.absenceSetSuccess);
    setShowAbsence(false);
    await reload();
  };

  const item = data?.item;

  return (
    <Screen title={item?.title ?? COPY.header.itemDetail} loading={loading} error={error} onRetry={reload}>
      {!data || !item || !data.timeline ? (
        <Empty message={c.notFound} action={<Link to="/">{c.returnLink}</Link>} />
      ) : (
        <ItemBody
          data={{ ...data, item, timeline: data.timeline }}
          tx={tx}
          success={success}
          showAbsence={showAbsence}
          setShowAbsence={setShowAbsence}
          absenceDays={absenceDays}
          setAbsenceDays={setAbsenceDays}
          cancel={cancel}
          setAbsence={setAbsence}
        />
      )}
    </Screen>
  );
};

interface BodyProps {
  data: {
    item: import('../api/types').AssetItem;
    vault: import('../api/types').Vault;
    info: import('../api/types').ChainInfo;
    attestations: import('../api/types').Attestation[];
    timeline: import('../api/types').Timeline;
  };
  tx: ReturnType<typeof useTx>;
  success: string | null;
  showAbsence: boolean;
  setShowAbsence: (v: boolean) => void;
  absenceDays: number;
  setAbsenceDays: (n: number) => void;
  cancel: () => void;
  setAbsence: (e: React.FormEvent) => void;
}

const ItemBody: React.FC<BodyProps> = ({
  data,
  tx,
  success,
  showAbsence,
  setShowAbsence,
  absenceDays,
  setAbsenceDays,
  cancel,
  setAbsence,
}) => {
  const { item, vault, info, attestations, timeline } = data;
  const c = COPY.itemDetail;
  const released = item.released || item.status === Status.Claimed;
  const silentNow = BigInt(info.now) >= timeline.tSilence;
  const quorum = timeline.attestationsFiled >= timeline.kAttest;

  // Restriction Line text is computed from chain data; only Cooling has a countdown.
  const note: Partial<Record<Status, string>> = {
    [Status.Sealed]: COPY.restriction.sealed(fmtDate(vault.lastHeartbeat)),
    [Status.Armed]: COPY.restriction.armed(timeline.attestationsFiled, timeline.kAttest),
    [Status.Silent]: COPY.restriction.silent(fmtDate(Number(timeline.tSilence))),
  };
  const opensIn = Math.max(0, Number(timeline.opensAt) - info.now);
  const rl =
    item.status === Status.Cooling
      ? { value: formatSpan(opensIn), note: COPY.restrictionLine[Status.Cooling].note }
      : item.status === Status.Claimed
        ? { value: COPY.restriction.claimed }
        : { note: note[item.status] };

  const summary = [
    { label: COPY.fields.accessionLabel, value: <span className="mono">{item.accessionNumber}</span> },
    { label: c.summaryAssetId, value: <Hash value={item.assetId} /> },
    { label: c.summaryPrimaryBenef, value: <Hash value={item.policy.primaryBenef} /> },
    { label: c.summaryContingentBenef, value: <Hash value={item.policy.contingentBenef} /> },
    { label: c.summaryQuorum, value: `${item.policy.kAttest} of ${item.quorumOf}` },
    { label: c.summaryWindow, value: formatSpan(item.policy.window) },
    { label: c.summaryBundleCid, value: <Hash value={item.policy.bundleCid} /> },
    { label: COPY.summary.epoch, value: vault.epoch },
  ];

  const windowStatus =
    item.status === Status.Cooling
      ? c.windowRunning
      : item.released || item.status === Status.ContingentEligible || item.status === Status.Claimed
        ? c.windowElapsed
        : c.windowClosed;

  return (
    <>
      <RestrictionLine status={item.status} {...rl} />

      {released && (
        <Notice warning title={c.rotatePrompt}>
          <Link to={`/item/${encodeURIComponent(item.accessionNumber)}/rotate`}>{c.rotateLink}</Link>
        </Notice>
      )}
      {success && <Notice title={success}>{COPY.tx.mined}</Notice>}

      <Actions>
        <Button variant="primary" disabled={tx.pending} onClick={cancel}>
          {c.cancelBtn}
        </Button>
        <Button disabled={tx.pending} onClick={() => setShowAbsence(!showAbsence)}>
          {c.absenceBtn}
        </Button>
      </Actions>
      <TxNote pending={tx.pending} error={tx.error} />

      {showAbsence && (
        <form onSubmit={setAbsence}>
          <Field
            id="absence-days"
            label={c.absenceDaysLabel}
            type="number"
            min={1}
            max={365}
            value={absenceDays}
            onChange={(e) => setAbsenceDays(Number(e.target.value))}
          />
          <Actions>
            <Button type="submit" disabled={tx.pending}>
              {COPY.actions.submit}
            </Button>
          </Actions>
        </form>
      )}

      <Section title={c.conditionsHeading}>
        <LedgerTable>
          <thead>
            <tr>
              <th>{c.tableHeaderCondition}</th>
              <th>{c.tableHeaderRequirement}</th>
              <th>{c.tableHeaderStatus}</th>
              <th>{c.tableHeaderTimestamp}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{c.silenceLabel}</td>
              <td>Inactivity &gt; {formatSpan(item.policy.minInactivity)}</td>
              <td>
                <StatusText status={silentNow ? Status.Silent : Status.Sealed}>
                  {silentNow ? c.silenceSilent : c.silenceActive}
                </StatusText>
              </td>
              <td>{when(timeline.tSilence)}</td>
            </tr>
            <tr>
              <td>{c.quorumLabel}</td>
              <td>
                {timeline.attestationsFiled} of {item.quorumOf} filed (threshold {item.policy.kAttest})
              </td>
              <td>
                <StatusText status={quorum ? Status.Cooling : Status.Armed}>
                  {quorum ? c.quorumReached : c.quorumPending}
                </StatusText>
              </td>
              <td>{quorum ? when(timeline.tQuorum) : c.conditionPending}</td>
            </tr>
            <tr>
              <td>{c.windowLabel}</td>
              <td>Window = {formatSpan(item.policy.window)}</td>
              <td>
                <StatusText status={item.status}>{windowStatus}</StatusText>
              </td>
              <td>{quorum ? when(timeline.opensAt) : c.conditionPending}</td>
            </tr>
          </tbody>
        </LedgerTable>
      </Section>

      <Section title={c.attestationsHeading}>
        <LedgerTable>
          <thead>
            <tr>
              <th>{c.guardianCol}</th>
              <th>{c.tableHeaderKeyId}</th>
              <th>{c.attestationMarkCol}</th>
              <th>{c.attestationDateCol}</th>
            </tr>
          </thead>
          <tbody>
            {attestations.map((a) => (
              <tr key={a.index}>
                <td>
                  {c.guardianLabelPrefix} {a.index}
                </td>
                <td>
                  <Hash value={vault.guardians[a.index - 1]} />
                </td>
                <td>
                  {vault.disputer === a.index && vault.disputeEpoch === vault.epoch
                    ? c.attestationDispute
                    : (MARKS[a.reason] ?? c.notFiled)}
                </td>
                <td>{when(a.at)}</td>
              </tr>
            ))}
          </tbody>
        </LedgerTable>
      </Section>

      <Section title={c.summaryHeading}>
        <DotLeaderList items={summary} />
      </Section>
    </>
  );
};
