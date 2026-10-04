import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Actions,
  Button,
  DotLeaderList,
  Empty,
  ErrorNote,
  Field,
  Hash,
  LedgerTable,
  Loading,
  Notice,
  Page,
  RestrictionLine,
  Rule,
  ScreenHeader,
  Section,
  StatusText,
  Timestamp,
} from '../ui';
import { mockApi, MOCK_VAULT_ID } from '../api/mockApi';
import type { AssetItem, Timeline, Vault } from '../api/types';
import { Status } from '../api/types';
import { COPY } from '../copy';

export const ItemDetailScreen: React.FC = () => {
  const { accession: rawAccession } = useParams<{ accession: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [item, setItem] = useState<AssetItem | null>(null);
  const [vault, setVault] = useState<Vault | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  // Absence form state
  const [showAbsenceForm, setShowAbsenceForm] = useState<boolean>(false);
  const [absenceDays, setAbsenceDays] = useState<number>(30);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const loadItem = async () => {
    setLoading(true);
    setError(null);
    try {
      const decoded = decodeURIComponent(rawAccession ?? '');
      const [assets, v] = await Promise.all([
        mockApi.listAssets(MOCK_VAULT_ID),
        mockApi.getVault(MOCK_VAULT_ID),
      ]);
      setVault(v);

      const found = assets.find((a) => {
        const normDecoded = decoded.toLowerCase().trim();
        const normAcc = a.accessionNumber.toLowerCase().trim();
        return (
          normAcc === normDecoded ||
          normAcc.endsWith('/' + normDecoded) ||
          normAcc.replace(/^hl-\d+\//i, '') === normDecoded.replace(/^hl-\d+\//i, '') ||
          a.assetId.toLowerCase() === normDecoded
        );
      });

      if (!found) {
        setItem(null);
      } else {
        setItem(found);
        const tl = await mockApi.timeline(found.vaultId, found.assetId);
        setTimeline(tl);
      }
    } catch {
      setError(COPY.states.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItem();
  }, [rawAccession]);

  const handleCancel = async () => {
    if (!item || !vault) return;
    setActionLoading(true);
    setError(null);
    try {
      await mockApi.cancel(vault.vaultId);
      // Reload state after cancel
      await loadItem();
      // If item was already released or claimed, point to rotate secrets
      if (item.released || item.status === Status.Claimed) {
        navigate(`/item/${encodeURIComponent(item.accessionNumber)}/rotate`);
      }
    } catch {
      setError(COPY.states.error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vault) return;
    setActionLoading(true);
    setError(null);
    try {
      const until = Math.floor(Date.now() / 1000) + absenceDays * 86400;
      await mockApi.setAbsence(vault.vaultId, until);
      setActionSuccess(COPY.itemDetail.absenceSetSuccess);
      setShowAbsenceForm(false);
      await loadItem();
    } catch {
      setError(COPY.states.error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || actionLoading) {
    return (
      <Page>
        <ScreenHeader title={item?.title ?? COPY.header.itemDetail} />
        <Loading />
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <ScreenHeader title={item?.title ?? COPY.header.itemDetail} />
        <ErrorNote
          message={error}
          action={<Button onClick={loadItem}>{COPY.actions.retry}</Button>}
        />
      </Page>
    );
  }

  if (!item || !vault || !timeline) {
    return (
      <Page>
        <ScreenHeader title={COPY.header.itemDetail} />
        <Empty
          message={COPY.itemDetail.notFound}
          action={
            <Button onClick={() => navigate('/')}>
              {COPY.itemDetail.returnLink}
            </Button>
          }
        />
      </Page>
    );
  }

  // Conditions derivation
  const isSilent = item.status !== Status.Sealed && item.status !== Status.Armed;
  const isQuorumReached =
    item.status === Status.Cooling ||
    item.status === Status.Disputed ||
    item.status === Status.Releasable ||
    item.status === Status.ContingentEligible ||
    item.status === Status.Claimed;

  const windowStatus =
    item.status === Status.Cooling
      ? COPY.itemDetail.windowRunning
      : item.status === Status.Releasable ||
        item.status === Status.ContingentEligible ||
        item.status === Status.Claimed
      ? COPY.itemDetail.windowElapsed
      : COPY.itemDetail.windowClosed;

  // Guardian attestations list for owner view
  const guardianAttestations = vault.guardians.map((keyId, idx) => {
    const isAttested =
      item.status === Status.Armed
        ? idx < 2
        : item.status === Status.Sealed || item.status === Status.Silent
        ? false
        : idx < item.policy.kAttest;

    const isDisputer = item.status === Status.Disputed && idx === 3;

    let mark: string = COPY.itemDetail.notFiled;
    let filedAt: React.ReactNode = '—';

    if (isDisputer) {
      mark = COPY.itemDetail.attestationDispute;
      filedAt = <Timestamp value="21 Oct 2026, 11:20 UTC" />;
    } else if (isAttested) {
      mark = idx % 2 === 0 ? COPY.itemDetail.attestationIncapacitated : COPY.itemDetail.attestationDeceased;
      filedAt = (
        <Timestamp
          value={`19 Oct 2026, 0${9 + idx}:${15 + idx * 10} UTC`}
        />
      );
    }

    return {
      index: idx + 1,
      keyId,
      mark,
      filedAt,
    };
  });

  const summaryItems = [
    {
      label: COPY.fields.accessionLabel,
      value: <span className="mono">{item.accessionNumber}</span>,
    },
    {
      label: COPY.itemDetail.summaryAssetId,
      value: <Hash value={item.assetId} />,
    },
    {
      label: COPY.itemDetail.summaryPrimaryBenef,
      value: <Hash value={item.policy.primaryBenef} />,
    },
    {
      label: COPY.itemDetail.summaryContingentBenef,
      value: <Hash value={item.policy.contingentBenef} />,
    },
    {
      label: COPY.itemDetail.summaryQuorum,
      value: `${item.policy.kAttest} of ${item.quorumOf}`,
    },
    {
      label: COPY.itemDetail.summaryWindow,
      value: `${Math.round(item.policy.window / 86400)} d`,
    },
    {
      label: COPY.itemDetail.summaryBundleCid,
      value: <Hash value={item.policy.bundleCid} />,
    },
    { label: COPY.summary.epoch, value: vault.epoch },
  ];

  return (
    <Page>
      <ScreenHeader
        title={item.title}
      />

      {/* Restriction Line per Amendment A1: value loud Gloock, label body-size */}
      <RestrictionLine status={item.status} />

      {/* Prompt for released items */}
      {(item.released || item.status === Status.Claimed) && (
        <Notice warning title={COPY.itemDetail.rotatePrompt}>
          <Link to={`/item/${encodeURIComponent(item.accessionNumber)}/rotate`}>
            {COPY.itemDetail.rotateLink}
          </Link>
        </Notice>
      )}

      {actionSuccess && (
        <Notice title={actionSuccess}>{actionSuccess}</Notice>
      )}

      {/* Primary and secondary owner actions */}
      <Actions>
        <Button variant="primary" onClick={handleCancel}>
          {COPY.itemDetail.cancelBtn}
        </Button>
        <Button
          type="button"
          onClick={() => setShowAbsenceForm(!showAbsenceForm)}
        >
          {COPY.itemDetail.absenceBtn}
        </Button>
      </Actions>

      {showAbsenceForm && (
        <form onSubmit={handleSetAbsence}>
          <Field
            id="absence-days"
            label={COPY.itemDetail.absenceDaysLabel}
            type="number"
            min={1}
            max={365}
            value={absenceDays}
            onChange={(e) => setAbsenceDays(Number(e.target.value))}
          />
          <Actions>
            <Button type="submit" variant="secondary">
              {COPY.actions.submit}
            </Button>
          </Actions>
        </form>
      )}

      {/* Ledger of the three conditions: silence, quorum, window */}
      <Section title={COPY.itemDetail.conditionsHeading}>
        <LedgerTable>
          <thead>
            <tr>
              <th>Condition</th>
              <th>Requirement</th>
              <th>Status</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{COPY.itemDetail.silenceLabel}</td>
              <td>Inactivity &gt; {Math.round(item.policy.minInactivity / 86400)} d</td>
              <td>
                <StatusText status={isSilent ? Status.Silent : Status.Sealed}>
                  {isSilent ? COPY.itemDetail.silenceSilent : COPY.itemDetail.silenceActive}
                </StatusText>
              </td>
              <td>
                <Timestamp value="02 Oct 2026, 14:07 UTC" />
              </td>
            </tr>
            <tr>
              <td>{COPY.itemDetail.quorumLabel}</td>
              <td>
                {timeline.attestationsFiled} of {item.quorumOf} filed (threshold {item.policy.kAttest})
              </td>
              <td>
                <StatusText status={isQuorumReached ? Status.Cooling : Status.Armed}>
                  {isQuorumReached ? COPY.itemDetail.quorumReached : COPY.itemDetail.quorumPending}
                </StatusText>
              </td>
              <td>
                {isQuorumReached ? (
                  <Timestamp value="19 Oct 2026, 09:30 UTC" />
                ) : (
                  'Pending'
                )}
              </td>
            </tr>
            <tr>
              <td>{COPY.itemDetail.windowLabel}</td>
              <td>Window = {Math.round(item.policy.window / 86400)} d</td>
              <td>
                <StatusText status={item.status}>
                  {windowStatus}
                </StatusText>
              </td>
              <td>
                {item.status === Status.Cooling ? (
                  <Timestamp value="24 Oct 2026, 18:00 UTC" />
                ) : item.status === Status.Releasable ||
                  item.status === Status.ContingentEligible ||
                  item.status === Status.Claimed ? (
                  <Timestamp value="22 Oct 2026, 14:00 UTC" />
                ) : (
                  'Awaiting quorum'
                )}
              </td>
            </tr>
          </tbody>
        </LedgerTable>
      </Section>

      {/* Attestation marks per guardian by index (owner view only) */}
      <Section title={COPY.itemDetail.attestationsHeading}>
        <LedgerTable>
          <thead>
            <tr>
              <th>{COPY.itemDetail.guardianCol}</th>
              <th>Key ID</th>
              <th>{COPY.itemDetail.attestationMarkCol}</th>
              <th>{COPY.itemDetail.attestationDateCol}</th>
            </tr>
          </thead>
          <tbody>
            {guardianAttestations.map((g) => (
              <tr key={g.index}>
                <td>Guardian {g.index}</td>
                <td>
                  <Hash value={g.keyId} />
                </td>
                <td>{g.mark}</td>
                <td>{g.filedAt}</td>
              </tr>
            ))}
          </tbody>
        </LedgerTable>
      </Section>

      {/* Accession record summary info as a dot-leader list */}
      <Section title={COPY.itemDetail.summaryHeading}>
        <DotLeaderList items={summaryItems} />
      </Section>

      <Rule />
    </Page>
  );
};
