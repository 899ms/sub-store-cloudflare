# Cloudflare Access

Cloudflare Access is optional. The default setup already protects the management UI with `SUB_STORE_ADMIN_TOKEN` and generated subscription links with `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN`.

Use Access for the admin hostname when you want an extra Zero Trust login layer. Keep download URLs outside Access unless the subscription client can complete Access authentication.

## Configure Through Agent Setup

Add an `access` block to `config/agent-setup.local.json`:

```json
{
  "access": {
    "enabled": true,
    "scope": "account",
    "accountId": "00000000000000000000000000000000",
    "zoneId": "",
    "adminHostname": "substore.example.com",
    "allowedEmails": ["you@example.com"],
    "allowedEmailDomains": [],
    "sessionDuration": "24h"
  }
}
```

You can also start from:

```bash
cp config/agent-setup.access.example.json config/agent-setup.local.json
```

Render the Cloudflare API payload:

```bash
pnpm run access:render
```

This writes:

```text
cloudflare/access.setup.local.json
```

The file is local-only and should be reviewed before applying.

## Apply

Use an API token with Zero Trust Access application permissions:

```bash
CLOUDFLARE_API_TOKEN=... pnpm run access:apply
```

The script creates a self-hosted Access application for the admin hostname with an allow policy for the configured emails or email domains.

## API Shape

The script uses Cloudflare's Access application endpoint:

```text
POST /{accounts_or_zones}/{account_or_zone_id}/access/apps
```

The allow policy uses Access `include` rules:

```json
[
  { "email": { "email": "you@example.com" } },
  { "email_domain": { "domain": "example.com" } }
]
```

Reference:

- https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/applications/methods/create/
- https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/policies/methods/create/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/
