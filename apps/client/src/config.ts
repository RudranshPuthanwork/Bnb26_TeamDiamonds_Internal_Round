/** Block explorer transaction URL prefix. Not used on the local anvil chain. */
export const EXPLORER_TX: string = import.meta.env.VITE_EXPLORER_TX ?? 'https://sepolia.basescan.org/tx/';
