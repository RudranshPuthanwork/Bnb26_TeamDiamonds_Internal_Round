import { sha256, toHex } from 'viem';
import type { Bundle } from '@heirloom/crypto';

/** Where sealed bundles live. The bytes32 id is sha256 of the bundle's canonical JSON (committed on chain as `bundleCid`). */
export interface BundleStore {
  put(bundle: Bundle): Promise<`0x${string}`>;
  get(cid: `0x${string}`): Promise<Bundle>;
}

type Id = `0x${string}`;

/** Key order is fixed by construction in @heirloom/crypto, so JSON.stringify is canonical. */
export const canonical = (b: Bundle) => JSON.stringify(b);
export const idOf = (json: string): Id => sha256(toHex(new TextEncoder().encode(json)));

/** Parse `json` only if it hashes to `id`. Every byte that crosses a trust boundary goes through here. */
export function verified(id: Id, json: string): Bundle {
  if (idOf(json).toLowerCase() !== id.toLowerCase()) throw new Error('The stored bundle does not match its hash.');
  return JSON.parse(json) as Bundle;
}

export interface Remote {
  /** Relayer base URL: used for POST /pin and as the last place fetchBundle looks. */
  relayerUrl?: string;
  /** Base URLs that answer GET `${base}/${id}` with the bundle JSON. Tried in order, before the relayer. */
  gateways?: string[];
  fetch?: typeof fetch;
}

/** Pin through the relayer. The relayer is untrusted: its answer must equal the id computed here. */
export async function pinBundle(relayerUrl: string, bundle: Bundle, f: typeof fetch = fetch): Promise<Id> {
  const res = await f(`${relayerUrl}/pin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bundle }),
  });
  const body = (await res.json().catch(() => ({}))) as { cid?: string; error?: { name?: string } };
  if (!res.ok) throw new Error(`Pinning failed: ${body.error?.name ?? res.status}.`);
  const id = idOf(canonical(bundle));
  if (body.cid?.toLowerCase() !== id) throw new Error('The pinning service returned a different id than the bundle hashes to.');
  return id;
}

/** Try each gateway, then the relayer. Bytes that do not hash to `id` are skipped, so one bad host cannot poison the read. */
export async function fetchBundle(id: Id, { relayerUrl, gateways = [], fetch: f = fetch }: Remote = {}): Promise<Bundle> {
  const bases = [...gateways, ...(relayerUrl ? [`${relayerUrl}/pin`] : [])];
  for (const base of bases) {
    try {
      const res = await f(`${base.replace(/\/$/, '')}/${id}`);
      if (res.ok) return verified(id, await res.text());
    } catch {
      // unreachable or tampered: try the next host
    }
  }
  throw new Error('No gateway returned a bundle that matches its hash.');
}

/** Local copy of the JSON text, keyed by lowercase id. */
interface Cache {
  get(id: string): Promise<string | undefined>;
  set(id: string, json: string): Promise<void>;
}

class MemoryCache implements Cache {
  private m = new Map<string, string>();
  async get(id: string) { return this.m.get(id); }
  async set(id: string, json: string) { this.m.set(id, json); }
}

const DB = 'heirloom-bundles';
const STORE = 'bundles';

function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = fn(open.result.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
}

class IdbCache implements Cache {
  get(id: string) { return idb<string | undefined>('readonly', (s) => s.get(id)); }
  async set(id: string, json: string) { await idb('readwrite', (s) => s.put(json, id)); }
}

/**
 * Cache first, then the network. A cache hit re-pins in the background (best effort), so any client that
 * still holds the bundle keeps it alive when the pinning service loses it.
 */
class CachedStore implements BundleStore {
  constructor(private cache: Cache, private remote: Remote = {}) {}

  async put(bundle: Bundle) {
    const json = canonical(bundle);
    const id = idOf(json);
    await this.cache.set(id, json);
    if (this.remote.relayerUrl) await pinBundle(this.remote.relayerUrl, bundle, this.remote.fetch); // fail loudly: unpinned means one copy
    return id;
  }

  async get(id: Id) {
    const key = id.toLowerCase();
    const json = await this.cache.get(key);
    if (json !== undefined) {
      const bundle = verified(id, json);
      if (this.remote.relayerUrl) pinBundle(this.remote.relayerUrl, bundle, this.remote.fetch).catch(() => {});
      return bundle;
    }
    const bundle = await fetchBundle(id, this.remote).catch(() => {
      throw new Error('The sealed bundle was not found in this store.');
    });
    await this.cache.set(key, canonical(bundle));
    return bundle;
  }
}

export class MemoryBundleStore extends CachedStore {
  constructor(remote?: Remote) { super(new MemoryCache(), remote); }
}

export class IndexedDbBundleStore extends CachedStore {
  constructor(remote?: Remote) { super(new IdbCache(), remote); }
}

/** IndexedDB in the browser, memory in Node. */
export const defaultBundleStore = (remote?: Remote): BundleStore =>
  typeof indexedDB === 'undefined' ? new MemoryBundleStore(remote) : new IndexedDbBundleStore(remote);
