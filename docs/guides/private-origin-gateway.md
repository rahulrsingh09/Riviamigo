# Protecting the private origin

The fork can require an additional credential between an authenticated reverse proxy and nginx. This prevents direct requests to the origin from bypassing the outer access policy. It does not replace the application's login or vehicle authorization.

Set both variables on the application container:

| Variable | Value |
| --- | --- |
| `RIVIAMIGO_REQUIRE_GATEWAY` | `true` |
| `RIVIAMIGO_GATEWAY_TOKEN` | A randomly generated secret containing 43–128 ASCII letters, digits, underscores or hyphens |

Generate at least 32 random bytes and encode them with base64url. Store the value in the hosting provider's runtime secrets and in the trusted proxy's secrets. Never include it in Git, a browser bundle, a URL, or a build argument.

The trusted proxy must authenticate the visitor, replace any incoming `X-Riviamigo-Edge` header with the configured secret, and forward the application's `Authorization` header unchanged. Use HTTPS between the proxy and a remote origin.

The container validates the settings before starting nginx or the API. A required but missing or malformed token stops startup. Valid configuration is written with mode `0600` under `/tmp`. Requests without the exact, case-sensitive header receive HTTP 403, including static assets and recovery routes. nginx removes the gateway header before forwarding requests to the application. The existing `/health` endpoint remains available for platform probes and does not expose account or vehicle data.

Leaving both variables unset preserves deployments where private networking already restricts origin access. Do not expose that configuration directly on the Internet. For a remote origin that relies on this gate, keep `RIVIAMIGO_REQUIRE_GATEWAY=true` so removing a secret cannot silently disable protection.

After deployment, verify that requests with a missing, incorrect, or case-altered header fail, while a valid header permits the normal application login. Confirm that the public proxy authenticates visitors before adding the header. Rotate the secret in both services if it is disclosed.

## Cloudflare Worker

The optional `apps/private-gateway` Worker authenticates Cloudflare Access JWTs
before forwarding HTTP requests or WebSocket upgrades to the origin. It checks
the signature, expiration, issuer, application audience, and explicit email
allowlist. It does not replace the Riviamigo owner login.

Configure a Cloudflare Access self-hosted application for the Worker's exact
production hostname, with an allow policy limited to your own email. A free
`workers.dev` hostname can be used. Disable preview URLs. Confirm that Workers
and Access are on their free plans before deployment; this repository does not
activate or upgrade a subscription.

Copy `apps/private-gateway/wrangler.example.json` to a private deployment
configuration and fill in its five variables. `PUBLIC_ORIGIN` is the address
you will open, `UPSTREAM_ORIGIN` is the Northflank HTTPS origin,
`ACCESS_ISSUER` is your Cloudflare Access team URL, `ACCESS_AUDIENCE` is the
Access application's audience tag, and `ALLOWED_EMAILS` is a comma-separated
list of exact email addresses. Wildcards are not accepted.

Set the Worker's `GATEWAY_TOKEN` secret to the same value as the origin's
`RIVIAMIGO_GATEWAY_TOKEN`. Keep secrets out of configuration files and Git.
Run `pnpm --filter @riviamigo/private-gateway test` and
`pnpm --filter @riviamigo/private-gateway build` before deployment. The Worker
returns an error when setup is incomplete; keep the origin private until the
Access policy, Worker configuration, and secrets are ready.

Fork CI also runs `apps/private-gateway/runtime-check.mjs` in the Workers
runtime with synthetic data. This verifies signed JWT authentication, forwarded
HTTP bodies and cookies, and a real WebSocket upgrade and message exchange.
To reproduce it, install `miniflare@5.20261001.0-alpha` in a separate temporary
directory and set `RIVIAMIGO_MINIFLARE_MODULE` to that directory's
`node_modules/miniflare` path. The runtime needs a supported operating system;
on an older Linux host, run the check inside an Ubuntu 24.04 container.

Add the Worker's public origin to the app's `ALLOWED_ORIGINS` runtime setting.
When a remote Worker needs to reach Northflank, its HTTP port must be reachable,
but the verified nginx gateway credential must remain required. Check both
layers: direct origin requests without the credential must fail, and Worker
requests without a valid allowed identity must fail. Recheck browser login,
cookie renewal, trip details, and live WebSocket updates through the public
Worker address before connecting a real Rivian account.

Access credentials, including the CLI `Cf-Access-Token` header, are stripped
before proxying. App authorization, refresh
cookies, request bodies, and WebSocket protocols are preserved. The proxy uses
a fixed origin, never follows origin redirects, rejects alternate hostnames,
and disables response caching. Worker request logging is disabled in the
example configuration. Cloudflare processes the proxied traffic, including
login requests; it is part of the hosting trust boundary.

Workers Free currently allows 100,000 requests per day and 10 milliseconds of
CPU per request. Confirm current allowances and existing account usage in
Cloudflare before enabling the proxy. Reaching a free quota can interrupt
access; it is not a reason to upgrade automatically. Telemetry collection
runs on Northflank and does not depend on an open browser or this proxy.
