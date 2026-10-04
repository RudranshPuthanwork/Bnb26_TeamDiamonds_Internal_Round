import { sha256, toHex } from 'viem';
import type { Bundle } from '@heirloom/crypto';

/**
 * Where sealed bundles live. The bytes32 id is sha256 of the bundle's JSON, a stand-in
 * until Phase 5 swaps in IPFS (the CID goes on chain as `bundleCid`).
 */
export interface BundleStore {
  put(bundle: Bundle): Promise<`0x${string}`>;
  get(cid: `0x${string}`): Promise<Bundle>;
}

/** Key order is fixed by construction in @heirloom/crypto, so JSON.stringify is canonical. */
const canonical = (b: Bundle) => JSON.stringify(b);
const hashOf = (json: string) => sha256(toHex(new TextEncoder().encode(json)));

function verified(cid: `0x${string}`, json: string): Bundle {
  if (hashOf(json).toLowerCase() !== cid.toLowerCase()) throw new Error('The stored bundle does not match its hash.');
  return JSON.parse(json) as Bundle;
}

export class MemoryBundleStore implements BundleStore {
  private map = new Map<string, string>();

  async put(bundle: Bundle) {
    const json = canonical(bundle);
    const cid = hashOf(json);
    this.map.set(cid.toLowerCase(), json);
    return cid;
  }

  async get(cid: `0x${string}`) {
    const json = this.map.get(cid.toLowerCase());
    if (json === undefined) throw new Error('The sealed bundle was not found in this store.');
    return verified(cid, json);
  }
}

const DB = 'heirloom-bundles';
const STORE = 'bundles';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export class IndexedDbBundleStore implements BundleStore {
  async put(bundle: Bundle) {
    const json = canonical(bundle);
    const cid = hashOf(json);
    await tx('readwrite', (s) => s.put(json, cid.toLowerCase()));
    return cid;
  }

  async get(cid: `0x${string}`) {
    const json = await tx<string | undefined>('readonly', (s) => s.get(cid.toLowerCase()));
    if (json === undefined) throw new Error('The sealed bundle was not found in this store.');
    return verified(cid, json);
  }
}

/** IndexedDB in the browser, memory in Node. */
export const defaultBundleStore = (): BundleStore =>
  typeof indexedDB === 'undefined' ? new MemoryBundleStore() : new IndexedDbBundleStore();
