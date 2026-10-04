import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startWatchtower } from './watchtower.js';

const dataDir = process.env.DATA_DIR ?? '.data';
const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Set ${k} in the environment.`);
  return v;
};

/** WATCHTOWER_KEY: 64 hex chars. Dev mode: no key set, so one is created under the data dir. */
async function contactsKey(): Promise<Uint8Array> {
  let hex = process.env.WATCHTOWER_KEY;
  if (!hex) {
    const f = join(dataDir, 'dev-contacts.key');
    hex = await readFile(f, 'utf8').catch(async () => {
      const k = randomBytes(32).toString('hex');
      await mkdir(dataDir, { recursive: true });
      await writeFile(f, k);
      return k;
    });
  }
  if (!/^[0-9a-f]{64}$/i.test(hex.trim())) throw new Error('WATCHTOWER_KEY must be 64 hex characters (32 bytes).');
  return new Uint8Array(Buffer.from(hex.trim(), 'hex'));
}

const wt = await startWatchtower({
  rpcUrl: process.env.RPC_URL ?? 'http://127.0.0.1:8545',
  chainId: Number(process.env.CHAIN_ID ?? 31337),
  registry: need('REGISTRY_ADDRESS') as `0x${string}`,
  fromBlock: BigInt(process.env.FROM_BLOCK ?? 0),
  clientUrl: (process.env.CLIENT_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  contactsKey: await contactsKey(),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  port: Number(process.env.PORT ?? 8788),
  leadSeconds: Number(process.env.REMINDER_LEAD_SECONDS ?? 5 * 86400),
  drillGraceSeconds: Number(process.env.DRILL_GRACE_SECONDS ?? 14 * 86400),
  tickMs: Number(process.env.TICK_MS ?? 60_000),
  pollMs: Number(process.env.POLL_MS ?? 4000),
  dataDir,
  resendKey: process.env.RESEND_API_KEY || undefined,
  resendFrom: process.env.RESEND_FROM ?? 'Heirloom <onboarding@resend.dev>',
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
});
console.log(`watchtower on :${wt.port}; email ${process.env.RESEND_API_KEY ? 'resend' : 'console'}, telegram ${process.env.TELEGRAM_BOT_TOKEN ? 'bot' : 'console'}`);
