import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { verifyMessage, type Address, type Hex } from 'viem';
import { eoaKeyId } from '@heirloom/auth';

export type Channel = 'email' | 'telegram' | 'console';
export interface Contact { channel: Channel; target: string }

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'));

/** The exact text a contact owner signs (EIP-191). The keyId is derived from the signing address, never taken on trust. */
export const contactMessage = (keyId: Hex, c: Contact) =>
  `Heirloom watchtower contact\nkey: ${keyId}\nchannel: ${c.channel}\ntarget: ${c.target}`;

const TARGET: Record<Channel, RegExp> = {
  email: /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/,
  telegram: /^-?\d{3,20}$/, // numeric chat id
  console: /^.{1,100}$/,
};

/** AES-256-GCM file (WebCrypto): base64(iv || ciphertext). Contacts never touch disk in the clear. */
export class Contacts {
  constructor(private file: string, private key: CryptoKey) {}

  static async open(file: string, rawKey: Uint8Array) {
    return new Contacts(file, await crypto.subtle.importKey('raw', rawKey as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']));
  }

  private async load(): Promise<Record<string, Contact[]>> {
    const raw = await readFile(this.file, 'utf8').catch(() => undefined);
    if (raw === undefined) return {};
    const buf = unb64(raw);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, this.key, buf.slice(12));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  private async save(db: Record<string, Contact[]>) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, new TextEncoder().encode(JSON.stringify(db))));
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, b64(new Uint8Array([...iv, ...ct])));
  }

  async list(keyId: Hex): Promise<Contact[]> {
    return (await this.load())[keyId.toLowerCase()] ?? [];
  }

  /** Only an EOA key can register (P-256 keys have no EIP-191 signer). Throws on a bad signature or target. */
  async register(address: Address, contact: Contact, signature: Hex): Promise<Hex> {
    if (!TARGET[contact.channel]?.test(contact.target ?? '')) throw new Error('BadContact');
    const keyId = eoaKeyId(address);
    if (!(await verifyMessage({ address, message: contactMessage(keyId, contact), signature }).catch(() => false))) throw new Error('BadSignature');
    const db = await this.load();
    const id = keyId.toLowerCase();
    db[id] = [...(db[id] ?? []).filter((c) => !(c.channel === contact.channel && c.target === contact.target)), contact];
    await this.save(db);
    return keyId;
  }
}
