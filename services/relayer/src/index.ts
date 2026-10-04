import { createApp, type Config } from './app.js';

const need = (k: string, alt?: string) => {
  const v = process.env[k] ?? (alt ? process.env[alt] : undefined);
  if (!v) throw new Error(`Set ${k} in the environment.`);
  return v;
};

const cfg: Config = {
  rpcUrl: process.env.RPC_URL ?? 'http://127.0.0.1:8545',
  chainId: Number(process.env.CHAIN_ID ?? 31337),
  registry: need('REGISTRY_ADDRESS') as `0x${string}`,
  relayerKey: need('RELAYER_PRIVATE_KEY', 'RELAYER_KEY') as `0x${string}`,
  pinataJwt: process.env.PINATA_JWT || undefined,
  pinataGateway: process.env.PINATA_GATEWAY ?? 'https://gateway.pinata.cloud',
  minBalanceWei: BigInt(process.env.MIN_BALANCE_WEI ?? '0'),
  ratePerMin: Number(process.env.RATE_LIMIT_PER_MIN ?? 30),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  gasCap: BigInt(process.env.GAS_CAP ?? 3_000_000),
  dataDir: process.env.DATA_DIR ?? '.data',
};

const port = Number(process.env.PORT ?? 8787);
createApp(cfg).listen(port, () => console.log(`relayer on :${port} chain ${cfg.chainId} registry ${cfg.registry}${cfg.pinataJwt ? '' : ' (pins: local files)'}`));
