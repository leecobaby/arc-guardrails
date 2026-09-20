import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { privateKeyToAccount } from "viem/accounts";

const envPath = ".env.local";
const current = await readFile(envPath, "utf8");

if (/^MERCHANT_ADDRESS=/m.test(current)) {
  console.log("MERCHANT_ADDRESS already exists; no changes made.");
  process.exit(0);
}

const account = privateKeyToAccount(`0x${randomBytes(32).toString("hex")}`);
await writeFile(
  envPath,
  `${current.trimEnd()}\nMERCHANT_ADDRESS=${account.address}\n`,
  { encoding: "utf8", mode: 0o600 },
);
await chmod(envPath, 0o600);
console.log(`Created merchant recipient: ${account.address}`);
