import { zeroHash } from 'viem';
import type { ChainClient } from '../api/chainApi';
import type { Hex32 } from '../api/types';
import { ACCOUNT } from './devSigner';

const DAY = 86400;

/** DEV ONLY: a vault with 5 guardians (anvil accounts 2-6), t=3, owner 0, backup owner 1. */
export async function createDemoVault(client: ChainClient): Promise<Hex32> {
  const ks = client.keystore;
  const guardians = await Promise.all([1, 2, 3, 4, 5].map((n) => ks.keyId(ACCOUNT.guardian(n))));
  const owners = [await ks.keyId(ACCOUNT.owner), await ks.keyId(ACCOUNT.backupOwner)] as const;
  // Cards are remembered so the owner can seal to each holder (D1).
  for (const i of [2, 3, 4, 5, 6, ACCOUNT.beneficiary, ACCOUNT.contingent]) client.rememberCard(await ks.card(i));
  const was = client.actingAccount;
  client.useAccount(ACCOUNT.owner);
  try {
    return await client.createVault(owners, guardians, 3, 7 * DAY);
  } finally {
    client.useAccount(was);
  }
}

/** DEV ONLY: seal `secret` and catalogue it. Primary beneficiary is account 7, contingent account 8. */
export async function addDemoAsset(client: ChainClient, vaultId: Hex32, secret: Uint8Array, number = 1): Promise<Hex32> {
  const ks = client.keystore;
  const assetId = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')}` as Hex32;
  const was = client.actingAccount;
  client.useAccount(ACCOUNT.owner);
  try {
    await client.addAsset(
      vaultId,
      {
        assetId,
        accessionNumber: `HL-${String(Number(BigInt(vaultId))).padStart(4, '0')}/${String(number).padStart(2, '0')}`,
        title: 'Wallet seed phrase',
        contents: `1 file, ${secret.length} B`,
        quorumOf: 5,
        policy: {
          reasonsMask: 6,
          kAttest: 3,
          requireEvidence: false,
          minInactivity: 30 * DAY,
          window: 7 * DAY,
          claimDeadline: 14 * DAY,
          primaryBenef: await ks.keyId(ACCOUNT.beneficiary),
          contingentBenef: await ks.keyId(ACCOUNT.contingent),
          bundleCid: zeroHash,
          version: 1,
          shareCommitments: [],
        },
      },
      secret
    );
  } finally {
    client.useAccount(was);
  }
  return assetId;
}

/** Dev-menu action: a collection with 5 guardians, t=3 and one sealed 312-byte asset. */
export async function seedDemoCollection(client: ChainClient): Promise<Hex32> {
  const vaultId = await createDemoVault(client);
  await addDemoAsset(client, vaultId, crypto.getRandomValues(new Uint8Array(312)));
  return vaultId;
}

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** DEV ONLY: identity-card lines for anvil guardians 1-5 and the beneficiary, ready to paste (D1). */
export async function devCardLines(client: ChainClient) {
  const line = async (i: number) => {
    const c = await client.keystore.card(i);
    return b64u(new TextEncoder().encode(JSON.stringify({ kind: c.kind, a: c.a, b: c.b, encPk: b64u(c.encPk) })));
  };
  return {
    guardians: await Promise.all([1, 2, 3, 4, 5].map((n) => line(ACCOUNT.guardian(n)))),
    beneficiaries: [await line(ACCOUNT.beneficiary)],
  };
}
