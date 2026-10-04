# Heirloom

Split-knowledge inheritance for digital secrets. Contracts in `contracts/`, shared packages in `packages/`, the client in `apps/client/`.

## Run it locally

Needs Node 20+ and Foundry. Use one terminal per long-running command.

```
npm install
anvil
npm run dev:deploy
npm run dev -w client
npx tsx scripts/walk-scenario1.ts
```

`dev:deploy` deploys with TIME_UNIT=1 and writes `apps/client/.env.local`, which switches the client from mock data to the chain. In the app, open the Dev menu and choose "Seed demo collection", then switch roles and use "Advance time". The walk script runs the whole scenario headless and exits non-zero on any mismatch.
