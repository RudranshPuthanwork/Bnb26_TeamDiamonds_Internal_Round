import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderEmail } from '../templates/email.js';
import { plain, type Message } from '../templates/messages.js';
import type { Contact } from './contacts.js';

export interface Delivery { type: string; vaultId: string; keyId: string; contact: Contact; msg: Message }

export interface ChannelConfig { dataDir: string; resendKey?: string; resendFrom: string; telegramToken?: string }

/**
 * Real delivery when the credential exists, otherwise the console channel: one JSON line in
 * `.data/outbox.jsonl` carrying the channel the contact asked for. Returns where it went.
 */
export async function deliver(cfg: ChannelConfig, d: Delivery): Promise<'resend' | 'telegram' | 'console'> {
  if (d.contact.channel === 'email' && cfg.resendKey) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: cfg.resendFrom, to: [d.contact.target], subject: d.msg.subject, html: renderEmail(d.msg), text: plain(d.msg) }),
    });
    if (!r.ok) throw new Error(`Resend answered ${r.status}`);
    return 'resend';
  }
  if (d.contact.channel === 'telegram' && cfg.telegramToken) {
    const r = await fetch(`https://api.telegram.org/bot${cfg.telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: d.contact.target, text: plain(d.msg), disable_web_page_preview: true }),
    });
    if (!r.ok) throw new Error(`Telegram answered ${r.status}`);
    return 'telegram';
  }
  await mkdir(cfg.dataDir, { recursive: true });
  const line = { at: new Date().toISOString(), type: d.type, vaultId: d.vaultId, keyId: d.keyId, via: d.contact.channel, to: d.contact.target, subject: d.msg.subject, text: plain(d.msg) };
  await appendFile(join(cfg.dataDir, 'outbox.jsonl'), JSON.stringify(line) + '\n');
  return 'console';
}
