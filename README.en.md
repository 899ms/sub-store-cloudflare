# Sub-Store Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/realchendahuang/sub-store-cloudflare)

A small Cloudflare Workers app for subscription aggregation, cloud-side node processing, and routing templates.

Chinese is the primary documentation language for this repository. See [README.md](README.md).

## Fastest Install

### Deploy to Cloudflare

Click the button above. Cloudflare will clone this public repository into your GitHub/GitLab account, provision the Worker and D1 database, and deploy the app.

The deployment flow asks for two secrets:

- `SUB_STORE_ADMIN_TOKEN`: admin UI and `/api/*` token.
- `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN`: `/download/*` subscription token.

Generate tokens with:

```bash
openssl rand -base64 32
```

Open the deployed app with:

```text
https://<your-worker>.<your-subdomain>.workers.dev/?token=<admin-token>
```

Then add sources, collections, filters, and templates in the web UI.

### Agent / CLI Install

For local agent-assisted installs with seeded sources and collections:

```bash
pnpm run install:cloudflare
```

The installer checks Cloudflare login, creates or reuses D1, renders local Wrangler config, sets Worker secrets, migrates D1, deploys the Worker, imports `config/agent-setup.local.json`, verifies HTTP endpoints, and prints ready-to-copy URLs.

If Cloudflare is not available yet:

```bash
pnpm --dir cloudflare exec wrangler login
pnpm run install:cloudflare
```

For Codex, Claude Code, or another local coding agent, copy [agent/install.prompt.md](agent/install.prompt.md).

## What It Does

- Manages remote subscription URLs and local node text.
- Combines multiple sources into one cloud-side collection.
- Filters by region, type, and regex; renames, deletes matched name text, deduplicates, regex-sorts, resolves node hostnames, adds/removes flags, and applies common node options.
- Provides built-in Mihomo routing templates and supports custom JSON/YAML templates.
- Previews original and processed node lists in the admin UI.
- Supports subscription usage info, config backup/restore, User-Agent options, pass-through User-Agent, timeout, and remote fetch concurrency.
- Supports temporary `url`, `content`, and `ua` download parameters for one-off conversion.
- Outputs Mihomo, Stash, Surge, Surge Mac, Surfboard, Loon, Egern, Shadowrocket, Quantumult X, sing-box, v2ray, URI, and JSON.

The deployment model is intentionally small: Workers Static Assets + Worker API + D1 + Worker Secrets.

## Local Development

```bash
pnpm run setup
cp cloudflare/.dev.vars.example cloudflare/.dev.vars
pnpm run build:frontend
pnpm run dev
```

Open:

```text
http://localhost:8787/?token=dev-admin-token
```

## Manual Deploy

```bash
pnpm run setup
pnpm --dir cloudflare exec wrangler login
pnpm --dir cloudflare exec wrangler d1 create sub-store-cloudflare
cp config/agent-setup.example.json config/agent-setup.local.json
pnpm run deploy:config -- config/agent-setup.local.json cloudflare/wrangler.deploy.local.jsonc --database-id <database-id>
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_ADMIN_TOKEN
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_PUBLIC_DOWNLOAD_TOKEN
pnpm run migrate:remote
pnpm run deploy:local
```

See [docs/deployment.md](docs/deployment.md) and [docs/ai-agent-install.md](docs/ai-agent-install.md).

## Acknowledgements

This project is inspired by and pays respect to [sub-store-org/Sub-Store](https://github.com/sub-store-org/Sub-Store). The original project is the full-featured subscription management system; this repository focuses on a smaller Cloudflare-native deployment.

See [LICENSE](LICENSE) and [NOTICE](NOTICE).
