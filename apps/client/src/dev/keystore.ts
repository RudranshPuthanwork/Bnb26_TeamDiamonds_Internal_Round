import { generateIdentity, keyIdOf, type Identity, type IdentityCard } from '@heirloom/crypto';
import { bytesToHex, hexToBytes, pad, zeroHash } from 'viem';
import { accountFor } from './devSigner';
import { defaultKv, type Kv } from '../api/localKv';

/**
 * DEV ONLY keystore. Generates an X25519 identity per anvil account on first use and keeps the
 * secret key in localStorage in the clear. Production keys come from passkeys (Phase 6).
 */
export class DevKeystore {
  private cache = new Map<number, Identity>();
  constructor(private kv: Kv = defaultKv()) {}

  async identity(accountIndex: number): Promise<Identity> {
    const hit = this.cache.get(accountIndex);
    if (hit) return hit;
    const key = `heirloom.dev.identity.${accountIndex}`;
    const stored = this.kv.get(key);
    let id: Identity;
    if (stored) {
      const j = JSON.parse(stored) as { sk: string; pk: string };
      id = { encSk: hexToBytes(j.sk as `0x${string}`), encPk: hexToBytes(j.pk as `0x${string}`) };
    } else {
      id = await generateIdentity();
      this.kv.set(key, JSON.stringify({ sk: bytesToHex(id.encSk), pk: bytesToHex(id.encPk) }));
    }
    this.cache.set(accountIndex, id);
    return id;
  }

  /** D1 identity card of an anvil account: EOA key plus its X25519 public key. */
  async card(accountIndex: number): Promise<IdentityCard> {
    const { encPk } = await this.identity(accountIndex);
    const a = pad(accountFor(accountIndex).address, { size: 32 });
    return { kind: 0, a, b: zeroHash, encPk };
  }

  async keyId(accountIndex: number) {
    return keyIdOf(await this.card(accountIndex));
  }
}
