import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "cloudflare/src"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => existsSync(file));

const forbidden = [
  [/StoredSubscription/g, "old stored subscription type"],
  [/StoredCollection/g, "old stored collection type"],
  [/getStoredSubscriptions/g, "old stored subscription accessor"],
  [/getStoredCollection/g, "old stored collection accessor"],
  [/allSubs/g, "old aggregate subscription field"],
  [/magicPath/g, "old frontend backend path behavior"],
  [/SUB_STORE_FRONTEND_BACKEND_PATH/g, "old frontend backend path env"],
  [/\/api\/subs\b/g, "old subscriptions API route"],
  [/\/api\/sub\//g, "old single subscription API route"],
];

const findings = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const [pattern, label] of forbidden) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        findings.push(`${file}:${index + 1}: ${label}: ${line.trim()}`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("Worker contract scan passed.");
