import { readFileSync, writeFileSync } from "node:fs";
const abi = JSON.parse(readFileSync("packages/abi/HeirloomRegistry.json", "utf8"));
writeFileSync("packages/abi/src/index.ts",
  "export const heirloomRegistryAbi = " + JSON.stringify(abi, null, 2) + " as const;\n");
console.log("functions:", abi.filter(x => x.type === "function").length,
            "events:", abi.filter(x => x.type === "event").length,
            "errors:", abi.filter(x => x.type === "error").length);
