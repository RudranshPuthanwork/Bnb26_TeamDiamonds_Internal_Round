import { createTestClient, http } from 'viem';
import type { ChainClient } from '../api/chainApi';

/** DEV ONLY: move anvil's clock forward and mine a block so every countdown sees it. Chain id 31337 only. */
export async function advanceTime(client: ChainClient, seconds: number): Promise<void> {
  if (client.cfg.chainId !== 31337) throw new Error('Advancing time is only possible on the local anvil chain.');
  const test = createTestClient({ mode: 'anvil', chain: client.chain, transport: http(client.cfg.rpcUrl) });
  await test.increaseTime({ seconds });
  await test.mine({ blocks: 1 });
}
