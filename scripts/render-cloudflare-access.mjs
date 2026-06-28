import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const apply = args.includes("--apply");
const dryRun = args.includes("--dry-run") || !apply;
const positional = args.filter((arg) => !arg.startsWith("--"));
const [inputArg = "config/agent-setup.local.json", outputArg = "cloudflare/access.setup.local.json"] = positional;

const config = JSON.parse(readFileSync(resolve(inputArg), "utf8"));
const access = config.access && typeof config.access === "object" ? config.access : {};

if (access.enabled !== true) {
  const summary = { enabled: false, message: "Cloudflare Access is disabled in this setup file." };
  writeJson(outputArg, summary);
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const scope = access.scope === "zone" ? "zone" : "account";
const resourceId = scope === "zone" ? required(access.zoneId, "access.zoneId") : required(access.accountId, "access.accountId");
const hostname = required(access.adminHostname || config.deployment?.adminHostname, "access.adminHostname");
const include = [
  ...array(access.allowedEmails).map((email) => ({ email: { email: String(email).trim() } })),
  ...array(access.allowedEmailDomains).map((domain) => ({ email_domain: { domain: String(domain).replace(/^@/, "").trim() } })),
].filter((rule) => Object.values(rule)[0] && Object.values(Object.values(rule)[0])[0]);

if (include.length === 0) throw new Error("access.allowedEmails or access.allowedEmailDomains is required");

const endpointPath = `/${scope === "zone" ? "zones" : "accounts"}/${resourceId}/access/apps`;
const applicationBody = {
  name: access.name || `Sub-Store Cloudflare - ${hostname}`,
  type: "self_hosted",
  domain: hostname,
  destinations: [{ type: "public", uri: hostname }],
  app_launcher_visible: false,
  session_duration: access.sessionDuration || "24h",
  policies: [
    {
      name: access.policyName || "Allow selected users",
      decision: "allow",
      include,
      precedence: 1,
    },
  ],
};

const payload = {
  enabled: true,
  dryRun,
  endpoint: `POST https://api.cloudflare.com/client/v4${endpointPath}`,
  body: applicationBody,
};

writeJson(outputArg, payload);

if (!apply) {
  console.log(JSON.stringify({ output: outputArg, endpoint: payload.endpoint, rules: include.length, dryRun: true }, null, 2));
  process.exit(0);
}

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required when using --apply");

const response = await fetch(`https://api.cloudflare.com/client/v4${endpointPath}`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(applicationBody),
});

const result = await response.json();
if (!response.ok || result.success === false) {
  console.error(JSON.stringify({ status: response.status, errors: result.errors || result }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ created: true, id: result.result?.id, domain: result.result?.domain || hostname }, null, 2));

function writeJson(path, value) {
  const outputPath = resolve(path);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
}

function required(value, label) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}
