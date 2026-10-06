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
