import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Actions,
  Button,
  CheckboxGroup,
  ErrorNote,
  Field,
  Loading,
  Margin,
  Notice,
  NumberedList,
  Page,
  ScreenHeader,
  TextareaField,
} from '../ui';
import { zeroHash } from 'viem';
import { api, chainClient, getVaultId } from '../api';
import { describeError, type Described } from '../errors';
import { ACCOUNT } from '../dev/devSigner';
import type { Hex32, Vault } from '../api/types';
import { COPY } from '../copy';

interface StartingPoint {
  id: string;
  number: string;
  title: string;
  description: string;
  itemTitle: string;
  contents: string;
  reasons: { incapacitated: boolean; deceased: boolean; missing: boolean };
  minInactivityDays: number;
  kAttest: number;
  requireEvidence: boolean;
  windowDays: number;
  deadlineDays: number;
}

const STARTING_POINTS: StartingPoint[] = [
  {
    id: 'sp-1',
    number: '1',
    title: COPY.addItem.sp1Title,
    description: COPY.addItem.sp1Desc,
    itemTitle: 'Medical directive and records',
    contents: '3 files, 4.1 MB',
    reasons: { incapacitated: true, deceased: false, missing: false },
    minInactivityDays: 14,
    kAttest: 2,
    requireEvidence: true,
    windowDays: 7,
    deadlineDays: 14,
  },
  {
    id: 'sp-2',
    number: '2',
    title: COPY.addItem.sp2Title,
    description: COPY.addItem.sp2Desc,
    itemTitle: 'Letters and account list',
    contents: '14 files, 38 MB',
    reasons: { incapacitated: false, deceased: true, missing: false },
    minInactivityDays: 30,
    kAttest: 3,
    requireEvidence: false,
    windowDays: 14,
    deadlineDays: 30,
  },
  {
    id: 'sp-3',
    number: '3',
    title: COPY.addItem.sp3Title,
    description: COPY.addItem.sp3Desc,
    itemTitle: 'Seed phrase and bank credentials',
    contents: '1 file, 312 B',
    reasons: { incapacitated: true, deceased: true, missing: false },
    minInactivityDays: 60,
    kAttest: 3,
    requireEvidence: true,
    windowDays: 30,
    deadlineDays: 60,
  },
];

export const AddItemScreen: React.FC = () => {
  const navigate = useNavigate();
  const [vault, setVault] = useState<Vault | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSp, setSelectedSp] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState<string>('Medical directive and records');
  const [accession, setAccession] = useState<string>('HL-0007/09');
  const [contents, setContents] = useState<string>('3 files, 4.1 MB');
  const [incapacitated, setIncapacitated] = useState<boolean>(true);
  const [deceased, setDeceased] = useState<boolean>(false);
  const [missing, setMissing] = useState<boolean>(false);
  const [minInactivityDays, setMinInactivityDays] = useState<number>(14);
  const [kAttest, setKAttest] = useState<number>(2);
  const [requireEvidence, setRequireEvidence] = useState<boolean>(true);
  const [windowDays, setWindowDays] = useState<number>(7);
  const [claimDeadlineDays, setClaimDeadlineDays] = useState<number>(14);
  const [primaryBenef, setPrimaryBenef] = useState<string>(
    '0xaa01928374650192837465019283746501928374650192837465019283746501'
  );
  const [contingentBenef, setContingentBenef] = useState<string>(
    '0xbb01928374650192837465019283746501928374650192837465019283746501'
  );

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<Described | null>(null);
  const [secret, setSecret] = useState<string>('');

  useEffect(() => {
    const id = getVaultId();
    Promise.all([api.getVault(id), api.listAssets(id)])
      .then(([v, items]) => {
        setVault(v);
        const vaultNo = String(Number(BigInt(id)) || 7).padStart(4, '0');
        setAccession(`HL-${vaultNo}/${String(items.length + 1).padStart(2, '0')}`);
      })
      .catch((err) => setSubmitError(describeError(err)))
      .finally(() => setLoading(false));
    // On a local chain the dev accounts are the beneficiaries.
    if (chainClient) {
      void Promise.all([ACCOUNT.beneficiary, ACCOUNT.contingent].map((i) => chainClient!.keystore.keyId(i))).then(([p, c]) => {
        setPrimaryBenef(p);
        setContingentBenef(c);
      });
    }
  }, []);

  const n = vault ? vault.guardians.length : 5;

  const applyStartingPoint = (sp: StartingPoint) => {
    setSelectedSp(sp.id);
    setTitle(sp.itemTitle);
    setContents(sp.contents);
    setIncapacitated(sp.reasons.incapacitated);
    setDeceased(sp.reasons.deceased);
    setMissing(sp.reasons.missing);
    setMinInactivityDays(sp.minInactivityDays);
    setKAttest(sp.kAttest);
    setRequireEvidence(sp.requireEvidence);
    setWindowDays(sp.windowDays);
    setClaimDeadlineDays(sp.deadlineDays);
  };

  // Validation rules:
  // 1. Block kAttest > n - 1 with the reason
  const isKAttestBlocked = kAttest > n - 1;
  // 2. Block window = 0 with the reason
  const isWindowBlocked = windowDays === 0;

  const reasonsMask =
    (incapacitated ? 2 : 0) | (deceased ? 4 : 0) | (missing ? 8 : 0);

  const isFormValid =
    title.trim().length > 0 &&
    secret.length > 0 &&
    /^0x[0-9a-fA-F]{64}$/.test(primaryBenef) &&
    accession.trim().length > 0 &&
    reasonsMask > 0 &&
    !isKAttestBlocked &&
    !isWindowBlocked &&
    kAttest >= 1 &&
    minInactivityDays > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !vault) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const assetId = ('0x' +
        Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
          b.toString(16).padStart(2, '0')
        ).join('')) as Hex32;

      await api.addAsset(vault.vaultId, {
        assetId,
        accessionNumber: accession,
        title,
        contents,
        quorumOf: vault.guardians.length,
        policy: {
          reasonsMask,
          kAttest,
          requireEvidence,
          minInactivity: minInactivityDays * 86400,
          window: windowDays * 86400,
          claimDeadline: claimDeadlineDays * 86400,
          primaryBenef: primaryBenef as Hex32,
          contingentBenef: (contingentBenef.trim() === '' ? zeroHash : contingentBenef) as Hex32,
          bundleCid:
            '0x1220a4b7f8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5' as Hex32,
          version: 1,
          shareCommitments: vault.guardians.map(
            () =>
              ('0x' +
                Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
                  b.toString(16).padStart(2, '0')
                ).join('')) as Hex32
          ),
        },
      }, new TextEncoder().encode(secret));

      navigate('/');
    } catch (err) {
      setSubmitError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || submitting) {
    return (
      <Page>
        <ScreenHeader title={COPY.addItem.pageTitle} />
        <Loading />
      </Page>
    );
  }

  return (
    <Page>
      <ScreenHeader title={COPY.addItem.pageTitle} />

      <Margin margin={COPY.addItem.marginLabel}>
        <p>{COPY.addItem.paragraph}</p>
      </Margin>

      {submitError && (
        <ErrorNote
          message={submitError.message}
          fix={submitError.fix}
          action={<Button onClick={handleSubmit}>{COPY.actions.retry}</Button>}
        />
      )}

      <Margin margin={COPY.addItem.startingPointsTitle}>
        <NumberedList
          items={STARTING_POINTS.map((sp) => ({
            id: sp.id,
            number: sp.number,
            title: sp.title,
            description: sp.description,
            selected: selectedSp === sp.id,
            onClick: () => applyStartingPoint(sp),
          }))}
        />
      </Margin>

      {isKAttestBlocked && (
        <Notice warning title={COPY.addItem.errorKAttest}>
          {COPY.addItem.errorKAttest}
        </Notice>
      )}

      {isWindowBlocked && (
        <Notice warning title={COPY.addItem.errorWindow}>
          {COPY.addItem.errorWindow}
        </Notice>
      )}

      <form onSubmit={handleSubmit}>
        <Field
          id="item-title"
          label={COPY.addItem.titleLabel}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Field
          id="item-accession"
          label={COPY.addItem.accessionLabel}
          value={accession}
          onChange={(e) => setAccession(e.target.value)}
          required
        />

        <TextareaField
          id="item-secret"
          label={COPY.addItem.secretLabel}
          hint={COPY.addItem.secretHint}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />

        <Field
          id="item-contents"
          label={COPY.addItem.contentsLabel}
          value={contents}
          onChange={(e) => setContents(e.target.value)}
          required
        />

        <Field id="reasons-mask" label={COPY.addItem.reasonsLabel}>
          <CheckboxGroup
            options={[
              {
                id: 'reason-incapacitated',
                label: COPY.addItem.reasonIncapacitated,
                checked: incapacitated,
                onChange: setIncapacitated,
              },
              {
                id: 'reason-deceased',
                label: COPY.addItem.reasonDeceased,
                checked: deceased,
                onChange: setDeceased,
              },
              {
                id: 'reason-missing',
                label: COPY.addItem.reasonMissing,
                checked: missing,
                onChange: setMissing,
              },
            ]}
          />
        </Field>

        <Field
          id="min-inactivity"
          label={COPY.addItem.inactivityLabel}
          type="number"
          min={1}
          value={minInactivityDays}
          onChange={(e) => setMinInactivityDays(Number(e.target.value))}
        />

        <Field
          id="k-attest"
          label={COPY.addItem.kAttestLabel}
          type="number"
          min={1}
          value={kAttest}
          error={isKAttestBlocked ? COPY.addItem.errorKAttest : undefined}
          onChange={(e) => setKAttest(Number(e.target.value))}
        />

        <Field id="require-evidence" label={COPY.addItem.evidenceLabel}>
          <CheckboxGroup
            options={[
              {
                id: 'evidence-checkbox',
                label: COPY.addItem.evidenceLabel,
                checked: requireEvidence,
                onChange: setRequireEvidence,
              },
            ]}
          />
        </Field>

        <Field
          id="window-days"
          label={COPY.addItem.windowLabel}
          type="number"
          min={0}
          value={windowDays}
          error={isWindowBlocked ? COPY.addItem.errorWindow : undefined}
          onChange={(e) => setWindowDays(Number(e.target.value))}
        />

        <Field
          id="claim-deadline-days"
          label={COPY.addItem.deadlineLabel}
          type="number"
          min={1}
          value={claimDeadlineDays}
          onChange={(e) => setClaimDeadlineDays(Number(e.target.value))}
        />

        <Field
          id="primary-benef"
          label={COPY.addItem.primaryBenefLabel}
          value={primaryBenef}
          onChange={(e) => setPrimaryBenef(e.target.value)}
        />

        <Field
          id="contingent-benef"
          label={COPY.addItem.contingentBenefLabel}
          value={contingentBenef}
          onChange={(e) => setContingentBenef(e.target.value)}
        />

        <Actions>
          <Button
            type="submit"
            variant="primary"
            disabled={!isFormValid}
          >
            {COPY.addItem.submitBtn}
          </Button>
          <Button type="button" onClick={() => navigate('/')}>
            {COPY.actions.back}
          </Button>
        </Actions>
      </form>
    </Page>
  );
};
