import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AuditLedger, Empty, FilterLinks, Hash, Screen, type AuditRow } from '../ui';
import { api } from '../api';
import type { AuditEvent, Hex32 } from '../api/types';
import { EXPLORER_TX } from '../config';
import { fmtDateTime } from '../format';
import { useLoad } from '../hooks';
import { useRole } from '../role';
import { COPY } from '../copy';

const GROUPS: Record<string, string[] | null> = {
  all: null,
  owner: ['VaultCreated', 'AssetAdded', 'Heartbeat', 'Cancelled', 'AbsenceSet', 'ChangeQueued', 'ChangeApplied', 'ChangeRevoked', 'Rekeyed'],
  guardian: ['Attested', 'Disputed', 'DisputeOverridden', 'DrillPassed'],
  release: ['ShareSubmitted', 'Claimed'],
};
const GUARDIAN_EVENTS = new Set(['Attested', 'Disputed', 'ShareSubmitted', 'DrillPassed']);
const VOIDERS = new Set(['Cancelled', 'Heartbeat']);

export const AuditScreen: React.FC = () => {
  const { collection } = useParams<{ collection: string }>();
  const { role } = useRole();
  const [filter, setFilter] = useState('all');
  const c = COPY.audit;
  const { data, loading, error, reload } = useLoad(
    async () => ({ events: await api.listAuditEvents(collection as Hex32), info: await api.getChainInfo() }),
    [collection],
    5000
  );

  const rows: AuditRow[] = useMemo(() => {
    if (!data) return [];
    const { events, info } = data;
    const names = GROUPS[filter];
    // An attestation or dispute is void once a later owner heartbeat or cancel has bumped the epoch.
    const lastReset = Math.max(0, ...events.filter((e) => VOIDERS.has(e.eventName)).map((e) => e.timestamp));
    const hidesIdentity = (e: AuditEvent) => role === 'guardian' && GUARDIAN_EVENTS.has(e.eventName);
    return events
      .filter((e) => !names || names.includes(e.eventName))
      .map((e) => ({
        id: e.id,
        time: <span className="timestamp">{fmtDateTime(e.timestamp)}</span>,
        event: hidesIdentity(e)
          ? c.anonymousEvent[e.eventName]
          : (c.event[e.eventName] ?? (() => c.unknownEvent(e.eventName)))(e.data),
        actor: hidesIdentity(e) ? c.anonymousGuardian : e.actor ? <Hash value={e.actor} /> : c.systemActor,
        tx:
          info.chainId === 31337 || hidesIdentity(e) ? (
            <Hash value={e.txHash} />
          ) : (
            <a href={`${EXPLORER_TX}${e.txHash}`} target="_blank" rel="noreferrer" title={c.viewTx}>
              <Hash value={e.txHash} />
            </a>
          ),
        voided: (e.eventName === 'Attested' || e.eventName === 'Disputed') && e.timestamp < lastReset,
      }));
  }, [data, filter, role, c]);

  return (
    <Screen title={c.pageTitle} loading={loading} error={error} onRetry={reload}>
      <FilterLinks
        label={c.filterLabel}
        value={filter}
        onChange={setFilter}
        options={Object.entries(c.filters).map(([value, label]) => ({ value, label }))}
      />
      {rows.length === 0 ? (
        <Empty message={c.empty} />
      ) : (
        <AuditLedger head={[c.colTime, c.colEvent, c.colActor, c.colTx]} rows={rows} />
      )}
    </Screen>
  );
};
