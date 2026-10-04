import { mnemonicToAccount } from 'viem/accounts';
import type { RoleName } from '../api/types';

/** DEV ONLY. The standard public anvil mnemonic; every key derived from it is public. */
export const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk';

/** Account index per participant: 0 owner, 1 backup owner, 2-6 guardians 1-5, 7 beneficiary, 8 contingent. */
export const ACCOUNT = {
  owner: 0,
  backupOwner: 1,
  guardian: (n: number) => 1 + n, // n is 1-based
  beneficiary: 7,
  contingent: 8,
} as const;

export const accountFor = (index: number) => mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: index });

export function accountIndexForRole(role: RoleName, guardianNumber = 1): number {
  return role === 'owner' ? ACCOUNT.owner : role === 'guardian' ? ACCOUNT.guardian(guardianNumber) : ACCOUNT.beneficiary;
}
