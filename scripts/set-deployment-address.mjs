import { chmod, readFile, writeFile } from "node:fs/promises";

const address = process.argv[2];
const envPath = ".env.local";

if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) {
  throw new Error("Pass a valid EVM address as the first argument.");
}

const current = await readFile(envPath, "utf8");
const next = current.match(/^NEXT_PUBLIC_TESTNET_VAULT_ADDRESS=/m)
  ? current.replace(/^NEXT_PUBLIC_TESTNET_VAULT_ADDRESS=.*$/m, `NEXT_PUBLIC_TESTNET_VAULT_ADDRESS=${address}`)
  : `${current.trimEnd()}\nNEXT_PUBLIC_TESTNET_VAULT_ADDRESS=${address}\n`;

await writeFile(envPath, next, { encoding: "utf8", mode: 0o600 });
await chmod(envPath, 0o600);
console.log("Updated NEXT_PUBLIC_TESTNET_VAULT_ADDRESS in .env.local.");
