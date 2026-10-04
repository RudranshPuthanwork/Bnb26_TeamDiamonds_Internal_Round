import { COPY } from './copy';

export interface Described {
  message: string;
  fix: string;
}

/** Turn a thrown value into plain words. Reverts are matched by contract error name. */
export function describeError(e: unknown): Described {
  const text = e instanceof Error ? `${e.name} ${e.message} ${(e as { shortMessage?: string }).shortMessage ?? ''}` : String(e);
  for (const name of Object.keys(COPY.errors.reverts)) {
    if (new RegExp(`\\b${name}\\b`).test(text)) {
      const [message, fix] = COPY.errors.reverts[name];
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
