import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { keccak256, encodeAbiParameters } from 'viem';
import {
  Actions,
  Button,
  ErrorNote,
  Field,
  Loading,
  Margin,
  Notice,
  Page,
  ScreenHeader,
  TextareaField,
} from '../ui';
import { api, chainClient, setVaultId } from '../api';
import { describeError, type Described } from '../errors';
import { devCardLines } from '../dev/seed';
import type { Hex32, WireCard } from '../api/types';
import { COPY } from '../copy';

interface ParsedCard {
  lineNum: number;
  card?: WireCard;
  keyId?: Hex32;
  error?: string;
}

function b64uEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}

function makeSampleCard(id: number): string {
  const hex32 = '0x' + id.toString(16).padStart(64, '0');
  const zero32 = '0x' + '0'.repeat(64);
  const encPk = b64uEncode(String.fromCharCode(...new Array(32).fill(id % 255)));
  const obj: WireCard = {
    kind: 0,
    a: hex32 as Hex32,
    b: zero32 as Hex32,
    encPk,
  };
  return b64uEncode(JSON.stringify(obj));
}

const SAMPLE_GUARDIANS = [1, 2, 3, 4, 5].map(makeSampleCard).join('\n');
const SAMPLE_BENEFICIARIES = [makeSampleCard(99)];

function parseLine(line: string, lineNum: number): ParsedCard {
  const trimmed = line.trim();
  if (!trimmed) {
    return { lineNum };
  }

  let obj: unknown;
  try {
    if (trimmed.startsWith('{')) {
      obj = JSON.parse(trimmed);
    } else {
      const decoded = b64uDecode(trimmed);
      obj = JSON.parse(decoded);
    }
  } catch {
    return { lineNum, error: `Line ${lineNum}: ${COPY.createCollection.cardJsonInvalid}` };
  }

  if (typeof obj !== 'object' || obj === null) {
    return { lineNum, error: `Line ${lineNum}: ${COPY.createCollection.cardJsonInvalid}` };
  }

  const rec = obj as Record<string, unknown>;

  if (rec.kind !== 0 && rec.kind !== 1) {
    return { lineNum, error: `Line ${lineNum}: ${COPY.createCollection.cardKindInvalid}` };
  }

  const hexRegex = /^0x[0-9a-fA-F]{64}$/;
  if (typeof rec.a !== 'string' || !hexRegex.test(rec.a)) {
    return { lineNum, error: `Line ${lineNum}: ${COPY.createCollection.cardAInvalid}` };
  }

  if (typeof rec.b !== 'string' || !hexRegex.test(rec.b)) {
    return { lineNum, error: `Line ${lineNum}: ${COPY.createCollection.cardBInvalid}` };
  }

  if (typeof rec.encPk !== 'string' || rec.encPk.length < 10) {
    return { lineNum, error: `Line ${lineNum}: ${COPY.createCollection.cardEncPkInvalid}` };
  }

  const card: WireCard = {
    kind: rec.kind as 0 | 1,
    a: rec.a as Hex32,
    b: rec.b as Hex32,
    encPk: rec.encPk,
  };

  try {
    const keyId = keccak256(
      encodeAbiParameters(
        [{ type: 'uint8' }, { type: 'bytes32' }, { type: 'bytes32' }],
        [card.kind, card.a, card.b]
      )
    );
    return { lineNum, card, keyId };
  } catch {
    return { lineNum, error: `Line ${lineNum}: ${COPY.createCollection.cardAInvalid}` };
  }
}

export const CreateCollectionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [guardiansText, setGuardiansText] = useState<string>('');
  const [beneficiariesText, setBeneficiariesText] = useState<string>('');
  const [tInput, setTInput] = useState<number>(3);
  const [nInput, setNInput] = useState<number>(5);
  const [policyDelay, setPolicyDelay] = useState<number>(604800);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<Described | null>(null);

  const parsedGuardians = useMemo(() => {
    return guardiansText
      .split('\n')
      .map((line, idx) => parseLine(line, idx + 1))
      .filter((p) => p.card || p.error);
  }, [guardiansText]);

  const parsedBeneficiaries = useMemo(() => {
    return beneficiariesText
      .split('\n')
      .map((line, idx) => parseLine(line, idx + 1))
      .filter((p) => p.card || p.error);
  }, [beneficiariesText]);

  const guardianErrors = useMemo(
    () => parsedGuardians.map((p) => p.error).filter((e): e is string => Boolean(e)),
    [parsedGuardians]
  );

  const beneficiaryErrors = useMemo(
    () => parsedBeneficiaries.map((p) => p.error).filter((e): e is string => Boolean(e)),
    [parsedBeneficiaries]
  );

  const validGuardians = useMemo(
    () => parsedGuardians.filter((p) => p.card && !p.error),
    [parsedGuardians]
  );

  const validBeneficiaries = useMemo(
    () => parsedBeneficiaries.filter((p) => p.card && !p.error),
    [parsedBeneficiaries]
  );

  // Check collision: a beneficiary cannot also be a guardian
  const collisionError = useMemo(() => {
    const guardianKeyIds = new Set(validGuardians.map((g) => g.keyId?.toLowerCase()));
    const guardianPks = new Set(validGuardians.map((g) => g.card?.encPk));

    for (const b of validBeneficiaries) {
      if (b.keyId && guardianKeyIds.has(b.keyId.toLowerCase())) {
        return COPY.createCollection.errorBeneficiaryIsGuardian;
      }
      if (b.card && guardianPks.has(b.card.encPk)) {
        return COPY.createCollection.errorBeneficiaryIsGuardian;
      }
    }
    return null;
  }, [validGuardians, validBeneficiaries]);

  // Warning when n < t + 2
  const showSlackWarning = nInput > 0 && tInput > 0 && nInput < tInput + 2;

  const isValid =
    validGuardians.length >= 2 &&
    validBeneficiaries.length >= 1 &&
    guardianErrors.length === 0 &&
    beneficiaryErrors.length === 0 &&
    !collisionError &&
    tInput >= 2 &&
    tInput <= nInput;

  const handleFillSample = async () => {
    // On a local chain the sample cards are the dev accounts' real identities, so the demo can run end to end.
    const dev = chainClient ? await devCardLines(chainClient) : null;
    setGuardiansText(dev ? dev.guardians.join('\n') : SAMPLE_GUARDIANS);
    setBeneficiariesText(dev ? dev.beneficiaries.join('\n') : SAMPLE_BENEFICIARIES.join('\n'));
    setNInput(5);
    setTInput(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const owners = await api.getOwnerKeys();
      const guardianKeyIds = validGuardians.map((g) => g.keyId as Hex32);
      api.rememberCards([...validGuardians, ...validBeneficiaries].map((p) => p.card as WireCard));
      setVaultId(await api.createVault(owners, guardianKeyIds, tInput, policyDelay));
      navigate('/');
    } catch (err) {
      setSubmitError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <Page>
        <ScreenHeader title={COPY.createCollection.pageTitle} />
        <Loading />
      </Page>
    );
  }

  return (
    <Page>
      <ScreenHeader title={COPY.createCollection.pageTitle} />

      <Margin margin={COPY.createCollection.marginLabel}>
        <p>{COPY.createCollection.paragraph}</p>
      </Margin>

      {submitError && (
        <ErrorNote
          message={submitError.message}
          fix={submitError.fix}
          action={
            <Button onClick={handleSubmit}>{COPY.actions.retry}</Button>
          }
        />
      )}

      {collisionError && (
        <Notice warning title={COPY.createCollection.errorBeneficiaryIsGuardian}>
          {COPY.createCollection.errorBeneficiaryIsGuardian}
        </Notice>
      )}

      {showSlackWarning && (
        <Notice warning title={COPY.createCollection.warningSlack}>
          {COPY.createCollection.warningSlack}
        </Notice>
      )}

      <form onSubmit={handleSubmit}>
        <TextareaField
          id="guardians-input"
          label={COPY.createCollection.guardiansLabel}
          hint={COPY.createCollection.guardiansHint}
          value={guardiansText}
          onChange={(e) => {
            setGuardiansText(e.target.value);
            const count = e.target.value.split('\n').filter((l) => l.trim()).length;
            if (count > 0) setNInput(count);
          }}
          errors={guardianErrors}
        />

        <TextareaField
          id="beneficiaries-input"
          label={COPY.createCollection.beneficiariesLabel}
          hint={COPY.createCollection.beneficiariesHint}
          value={beneficiariesText}
          onChange={(e) => setBeneficiariesText(e.target.value)}
          errors={beneficiaryErrors}
        />

        <Field
          id="threshold-t"
          label={COPY.createCollection.tLabel}
          type="number"
          min={2}
          max={nInput}
          value={tInput}
          onChange={(e) => setTInput(Number(e.target.value))}
        />

        <Field
          id="total-n"
          label={COPY.createCollection.nLabel}
          type="number"
          min={2}
          max={12}
          value={nInput}
          onChange={(e) => setNInput(Number(e.target.value))}
        />

        <Field
          id="policy-delay"
          label={COPY.createCollection.policyDelayLabel}
          type="number"
          value={policyDelay}
          onChange={(e) => setPolicyDelay(Number(e.target.value))}
        />

        <Actions>
          <Button
            type="submit"
            variant="primary"
            disabled={!isValid}
          >
            {COPY.createCollection.submitBtn}
          </Button>
          <Button type="button" onClick={handleFillSample}>
            {COPY.createCollection.sampleBtn}
          </Button>
          <Button type="button" onClick={() => navigate('/')}>
            {COPY.actions.back}
          </Button>
        </Actions>
      </form>
    </Page>
  );
};
