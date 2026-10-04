import { COPY } from './copy';

export interface Described {
  message: string;
  fix: string;
}

/** Turn a thrown value into plain words. Reverts are matched by contract error name. */
export function describeError(e: unknown): Described {
  const text = e instanceof Error ? `${e.name} ${e.message} ${(e as { shortMessage?: string }).shortMessage ?? ''}` : String(e);
  const known: Record<string, readonly [string, string]> = { ...COPY.errors.relayer, ...COPY.errors.reverts };
  for (const name of Object.keys(known)) {
    if (new RegExp(`\\b${name}\\b`).test(text)) {
      const [message, fix] = known[name];
      return { message, fix };
    }
  }
  if (/user rejected|denied|declined/i.test(text)) return COPY.errors.rejectedByUser;
  if (e instanceof Error && e.message.startsWith('The chain did not answer')) return COPY.errors.generic;
  if (e instanceof Error && /^[A-Z].*\.$/.test(e.message) && e.message.length < 140) {
    return { message: e.message, fix: COPY.errors.generic.fix };
  }
  return COPY.errors.generic;
}
