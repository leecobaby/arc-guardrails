import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";

const envPath = ".env.local";
const existing = await readFile(envPath, "utf8");

if (/^AGENT_API_KEY=/m.test(existing)) {
  console.log("AGENT_API_KEY already exists; no changes made.");
  process.exit(0);
}

const suffix = `AGENT_API_KEY=${randomBytes(24).toString("hex")}\nAGENT_NETWORK=testnet\n`;
await writeFile(envPath, `${existing.trimEnd()}\n${suffix}`, {
  encoding: "utf8",
  mode: 0o600,
});
await chmod(envPath, 0o600);
console.log("Added AGENT_API_KEY and AGENT_NETWORK to .env.local.");
