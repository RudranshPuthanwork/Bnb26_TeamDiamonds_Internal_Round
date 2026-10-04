import { mockApi, MOCK_VAULT_ID } from './mockApi';
import { ChainClient } from './chainApi';
import { defaultKv } from './localKv';
import type { ChainApi, Hex32 } from './types';

const env = import.meta.env;
/** VITE_API=mock|chain; chain by default once `npm run dev:deploy` has written .env.local. */
const mode = env.VITE_API ?? (env.VITE_REGISTRY_ADDRESS ? 'chain' : 'mock');

export const USING_MOCK = mode !== 'chain';

export const chainClient: ChainClient | null = USING_MOCK
  ? null
  : new ChainClient({
      rpcUrl: env.VITE_RPC_URL ?? 'http://127.0.0.1:8545',
      registry: env.VITE_REGISTRY_ADDRESS as `0x${string}`,
      deployBlock: BigInt(env.VITE_DEPLOY_BLOCK ?? 0),
      chainId: Number(env.VITE_CHAIN_ID ?? 31337),
      relayerUrl: env.VITE_RELAYER_URL || undefined,
    });

export const api: ChainApi = chainClient ?? mockApi;

const VAULT_KEY = 'heirloom.vault';
const FIRST_VAULT: Hex32 = `0x${'1'.padStart(64, '0')}`;
const kv = defaultKv();

/** The collection the app is looking at. Created or seeded collections replace it. */
export const getVaultId = (): Hex32 => (kv.get(VAULT_KEY) as Hex32 | null) ?? (USING_MOCK ? MOCK_VAULT_ID : FIRST_VAULT);
export const setVaultId = (id: Hex32) => kv.set(VAULT_KEY, id);
