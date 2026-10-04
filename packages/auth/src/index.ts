import { encodeAbiParameters, keccak256, zeroAddress, zeroHash, type Address, type Hex, type PublicClient } from 'viem';
import { heirloomRegistryAbi as abi } from '@heirloom/abi';

/** Member order is the on-chain value (HeirloomRegistry.Action). */
export enum Action {
  CreateVault, AddAsset, Heartbeat, Cancel, SetAbsence, QueueChange, ApplyChange, RevokeChange,
  Attest, Dispute, SubmitShare, MarkClaimed, Drill, Rekey, ClaimContingent,
}
export const EOA_SIG = 1; // AuthKind.EOA_SIG

export interface Auth { kind: number; signer: Address; nonce: bigint; deadline: bigint; sig: Hex }
export interface Domain { name: string; version: string; chainId: bigint; verifyingContract: Address }

/** Must equal HeirloomRegistry.ACTION_TYPEHASH's string. */
const ACTION_TYPES = {
  Action: [
    { name: 'vaultId', type: 'bytes32' },
    { name: 'action', type: 'uint8' },
    { name: 'paramsHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

/** Domain exactly as the contract reports it (OZ EIP712: eip712Domain()). */
export async function fetchDomain(client: PublicClient, registry: Address): Promise<Domain> {
  const [, name, version, chainId, verifyingContract] = (await client.readContract({
    address: registry, abi, functionName: 'eip712Domain',
  })) as unknown as readonly [Hex, string, string, bigint, Address];
  return { name, version, chainId, verifyingContract };
}

export function buildTypedData(domain: Domain, action: Action, vaultId: Hex, paramsHash: Hex, nonce: bigint, deadline: bigint) {
  return {
    domain,
    types: ACTION_TYPES,
    primaryType: 'Action' as const,
    message: { vaultId, action, paramsHash, nonce, deadline },
  };
}

const policyType = (abi.find((x) => x.type === 'function' && x.name === 'addAsset') as unknown as { inputs: object[] }).inputs[2];

/**
 * keccak256(abi.encode(...)) as built in HeirloomRegistry for each action. Heartbeat, Cancel and
 * Dispute sign 0. Phase 7 actions revert NotImplemented on chain, so there is no hash to match yet.
 */
export function paramsHashFor(action: Action, p: Record<string, unknown> = {}): Hex {
  const h = (types: readonly object[], values: readonly unknown[]) =>
    keccak256(encodeAbiParameters(types as never, values as never));
  switch (action) {
    case Action.CreateVault:
      return h(
        [{ type: 'bytes32[2]' }, { type: 'bytes32[]' }, { type: 'uint8' }, { type: 'uint32' }],
        [p.owners, p.guardians, p.t, p.policyDelay]
      );
    case Action.AddAsset:
      return h([{ type: 'bytes32' }, policyType], [p.assetId, p.policy]);
    case Action.Heartbeat:
    case Action.Cancel:
    case Action.Dispute:
      return zeroHash;
    case Action.SetAbsence:
      return h([{ type: 'uint40' }], [p.until]);
    case Action.Attest:
      return h([{ type: 'uint8' }, { type: 'bytes32' }], [p.reason, p.evidenceHash]);
    case Action.SubmitShare:
      return h([{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes' }], [p.assetId, p.claimantKeyId, p.encShare]);
    case Action.MarkClaimed:
      return h([{ type: 'bytes32' }], [p.assetId]);
    default:
      throw new Error(`NotImplemented: ${Action[action]} is not implemented on chain yet`);
  }
}

/** D1: keccak256(abi.encode(EOA, address as bytes32, 0)). */
export const eoaKeyId = (a: Address): Hex =>
  keccak256(encodeAbiParameters([{ type: 'uint8' }, { type: 'bytes32' }, { type: 'bytes32' }], [0, `0x${a.slice(2).padStart(64, '0')}`, zeroHash]));

export const fetchNonce = (client: PublicClient, registry: Address, keyId: Hex) =>
  client.readContract({ address: registry, abi, functionName: 'nonces', args: [keyId] }) as Promise<bigint>;

/** Sign one action as `account` (a viem LocalAccount, or a wallet account with signTypedData). */
export async function signAction(
  account: { address: Address; signTypedData: (a: never) => Promise<Hex> },
  domain: Domain, action: Action, vaultId: Hex, params: Record<string, unknown>, nonce: bigint, deadline: bigint
): Promise<Auth> {
  const td = buildTypedData(domain, action, vaultId, paramsHashFor(action, params), nonce, deadline);
  return { kind: EOA_SIG, signer: account.address, nonce, deadline, sig: await account.signTypedData(td as never) };
}

export const DIRECT_AUTH: Auth = { kind: 0, signer: zeroAddress, nonce: 0n, deadline: 0n, sig: '0x' };
