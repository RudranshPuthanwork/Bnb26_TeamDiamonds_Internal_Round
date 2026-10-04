import { mockApi, MOCK_VAULT_ID } from './mockApi';
import type { ChainApi, Hex32 } from './types';

/** Stage 3 swaps this for the chain adapter behind the same interface. */
export const api: ChainApi = mockApi;
export const DEFAULT_VAULT_ID: Hex32 = MOCK_VAULT_ID;
export const USING_MOCK = true;
