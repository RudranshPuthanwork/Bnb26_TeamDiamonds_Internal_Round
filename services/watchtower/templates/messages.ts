// Alert copy. Specific facts, one action per message, plain words. Banned words: docs/DESIGN.md.

export type AlertType =
  | 'pre-lapse' | 'first-attestation' | 'dispute' | 'release' | 'drill-overdue' | 'drill-slack' | 'change-queued';
export type Audience = 'owner' | 'guardian' | 'beneficiary';

export interface Facts {
  /** HL-0007 */
  collection: string;
  /** Short key hash of the participant who acted. Never given to guardians (they must not learn each other). */
  actor?: string;
  /** Unix seconds of the event. */
  at: number;
  reason?: string;
  lapseAt?: number; lastSigned?: number; remaining?: number; // pre-lapse
  item?: string; // release
  lastDrill?: number; ready?: number; t?: number; n?: number; // drill
  change?: string; applyAfter?: number; // change-queued
}

export interface Message { subject: string; lines: string[]; action: { label: string; link: string } }

export const utc = (s: number) =>
  new Date(s * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC';

export function span(s: number): string {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d} d ${String(h).padStart(2, '0')} h`;
  if (h) return `${h} h ${String(m).padStart(2, '0')} m`;
  return m ? `${m} m ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}

export const shortHash = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

/** `link(kind)` builds a client URL for the one action. The client opens the matching screen; nothing is signed here. */
export function compose(type: AlertType, who: Audience, f: Facts, link: (kind: string) => string): Message {
  const c = f.collection;
  const by = f.actor ? `Guardian ${f.actor}` : 'A guardian';
  switch (type) {
    case 'pre-lapse':
      return {
        subject: `${c}: heartbeat due in ${span(f.remaining ?? 0)}`,
        lines: [
          `Collection ${c} counts you as silent at ${utc(f.lapseAt ?? 0)}, in ${span(f.remaining ?? 0)}.`,
          `Your last signature was ${utc(f.lastSigned ?? 0)}. Any owner action resets the clock.`,
        ],
        action: { label: 'Send a heartbeat', link: link('heartbeat') },
      };
    case 'first-attestation':
      return who === 'owner'
        ? {
            subject: `${c}: a guardian attested at ${utc(f.at)}`,
            lines: [
              `${by} filed the first attestation (${f.reason}) on collection ${c} at ${utc(f.at)}.`,
              'Nothing is released yet: more attestations, your silence and a waiting window must all follow.',
              'If you are well, cancel now. One tap voids every attestation.',
            ],
            action: { label: 'Cancel the attestations', link: link('cancel') },
          }
        : {
            subject: `${c}: first attestation filed at ${utc(f.at)}`,
            lines: [
              `A guardian filed the first attestation (${f.reason}) on collection ${c} at ${utc(f.at)}.`,
              'If you know the owner is alive, file a dispute. Otherwise nothing is needed yet.',
            ],
            action: { label: 'Open the collection', link: link('review') },
          };
    case 'dispute':
      return who === 'owner'
        ? {
            subject: `${c}: a guardian reported you alive`,
            lines: [
              `${by} filed a dispute on collection ${c} at ${utc(f.at)}. Release is frozen for this round.`,
              'To clear every attestation and reset the clock, cancel.',
            ],
            action: { label: 'Cancel the attestations', link: link('cancel') },
          }
        : {
            subject: `${c}: dispute filed at ${utc(f.at)}`,
            lines: [
              `A guardian reported the owner alive on collection ${c} at ${utc(f.at)}.`,
              'Release is frozen until enough new attestations arrive.',
            ],
            action: { label: 'Open the collection', link: link('review') },
          };
    case 'release':
      if (who === 'guardian')
        return {
          subject: `${c}: item ${f.item} is open, submit your share`,
          lines: [`Quorum and window are met for item ${f.item} in collection ${c}. It opened at ${utc(f.at)}.`, 'The claimant needs your share.'],
          action: { label: 'Submit your share', link: link('submit-share') },
        };
      if (who === 'beneficiary')
        return {
          subject: `${c}: item ${f.item} is open to claim`,
          lines: [`Item ${f.item} in collection ${c} opened at ${utc(f.at)}.`, 'Guardians are handing over their shares now.'],
          action: { label: 'Open your claim', link: link('claim') },
        };
      return {
        subject: `${c}: item ${f.item} was released`,
        lines: [`Item ${f.item} in collection ${c} opened at ${utc(f.at)}. A release cannot be undone.`, 'Rotate the secret it protects.'],
        action: { label: 'Open the rotate checklist', link: link('rotate') },
      };
    case 'drill-overdue':
      return {
        subject: `${c}: your readiness drill is overdue`,
        lines: [
          `Your last passed drill on collection ${c} was ${f.lastDrill ? utc(f.lastDrill) : 'never'}.`,
          'An untested share may fail when it is needed.',
        ],
        action: { label: 'Run the drill', link: link('drill') },
      };
    case 'drill-slack':
      return {
        subject: `${c}: ${f.ready} of ${f.n} guardians are drill-ready, ${f.t} needed`,
        lines: [
          `Collection ${c} has ${f.ready} of ${f.n} guardians with a current drill. Release needs ${f.t}.`,
          `Slack is ${(f.ready ?? 0) - (f.t ?? 0)}. Checked at ${utc(f.at)}.`,
        ],
        action: { label: 'Open the guardian list', link: link('guardians') },
      };
    case 'change-queued':
      return {
        subject: `${c}: change ${f.change} queued`,
        lines: [
          `A change to collection ${c} was queued at ${utc(f.at)} and applies at ${utc(f.applyAfter ?? 0)}.`,
          'If you did not queue it, revoke it before then.',
        ],
        action: { label: 'Review the change', link: link('changes') },
      };
  }
}

export const plain = (m: Message) => [m.subject, '', ...m.lines, '', `${m.action.label}: ${m.action.link}`].join('\n');
