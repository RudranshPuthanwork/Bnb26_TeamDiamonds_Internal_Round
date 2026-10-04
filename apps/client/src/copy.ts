/**
 * Heirloom user-facing strings. Every line states a fact the user needs.
 * Sourced from docs/DESIGN.md.
 */

import { Status } from './api/types';

export const COPY = {
  brand: {
    name: 'Heirloom',
    sampleNotice: 'Figures on this page are sample data.',
  },
  header: {
    defaultCollection: 'Collection HL-0007',
    defaultRole: 'Owner',
    divider: ' · ',
  },
  nav: {
    register: 'Collection',
    devStates: 'States',
    devTokens: 'Tokens',
  },
  restrictionLine: {
    [Status.Sealed]: {
      value: 'Closed',
      note: 'Last owner signature 02 Oct. Nothing pending.',
    },
    [Status.Armed]: {
      value: 'Closed',
      note: '2 of 3 attestations filed. The owner has been told.',
    },
    [Status.Silent]: {
      value: 'Closed',
      note: 'Owner silent since 19 Aug. No attestations yet.',
    },
    [Status.Cooling]: {
      label: 'Opens in',
      value: '1 d 04 h',
      note: 'The owner may cancel until then.',
    },
    [Status.Disputed]: {
      value: 'Frozen',
      note: 'One guardian reported the owner alive.',
    },
    [Status.Releasable]: {
      value: 'Open',
      note: 'Guardians may now hand over their shares.',
    },
    [Status.ContingentEligible]: {
      label: 'Primary claim period lapsed',
      value: 'Open',
      note: 'The contingent beneficiary may claim.',
    },
    [Status.Claimed]: {
      value: 'Claimed 12 Nov',
      note: 'Rotate the secrets in this item.',
    },
  },
  states: {
    empty: 'No items are catalogued in this collection yet. Add the first one to set its restriction.',
    loadingPrefix: 'Reading the chain, block ',
    defaultLoadingBlock: '14,203,118',
    error: 'The chain did not answer. Nothing was changed. Retry, or submit directly from a wallet.',
    errorFixPrompt: 'Check the network connection, or submit directly from a wallet.',
  },
  stamps: {
    [Status.Sealed]: 'SEALED',
    [Status.Armed]: 'ARMED',
    [Status.Silent]: 'SILENT',
    [Status.Cooling]: 'COOLING',
    [Status.Disputed]: 'DISPUTED',
    [Status.Releasable]: 'RELEASABLE',
    [Status.ContingentEligible]: 'CONTINGENT',
    [Status.Claimed]: 'CLAIMED',
  },
  table: {
    accession: 'Accession',
    item: 'Item',
    contents: 'Contents',
    quorum: 'Quorum',
    window: 'Window',
    status: 'Status',
  },
  summary: {
    owner: 'Owner',
    custodians: 'Custodians',
    items: 'Items',
    lastSigned: 'Last signed',
    epoch: 'Epoch',
    chain: 'Chain',
  },
  actions: {
    catalogueItem: 'Catalogue an item',
    submitShare: 'Submit share',
    claimAsset: 'Claim item',
    cancelProtocol: 'Cancel release',
    retry: 'Retry',
  },
  fields: {
    accessionLabel: 'Accession number',
    titleLabel: 'Item title',
    beneficiaryLabel: 'Beneficiary',
    quorumLabel: 'Attestations required',
    inactivityLabel: 'Silence window',
  },
} as const;
