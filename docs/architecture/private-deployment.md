# Private deployment integration

This fork keeps the dashboard layout and upstream services while isolating deployment
policy. Modularity reduces the code that must be reconciled; it cannot eliminate
review of authentication, persistence or restore changes.

## Stable boundaries

| Module                                                         | Responsibility                                                                          | Integration point                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/api/src/private_deployment/outbound.rs`                  | Fixed Rivian origins, query-only access, bounded responses, optional-provider denial    | `services/outbound_policy.rs` compatibility exports; external provider admission |
| `apps/api/src/private_deployment/keys.rs`                      | External RSA/AGE custody, matching keys, encrypted-data binding                         | Existing `keys` API used by startup, configuration and restore                   |
| `apps/api/src/private_deployment/enrollment.rs`                | Active-account lock, vehicle enrollment serialization, existing owner/manager authority | Enrollment transaction before writes                                             |
| `apps/api/src/private_deployment/history.rs` and `history.sql` | Preserve history with database permissions and disabled expiry                          | Startup before ingestion; owner vehicle-deletion route                           |
| `apps/api/src/private_deployment/history_backup.rs`            | Encrypt and mirror scheduled recovery packages to bounded Cloudflare storage            | After local backup cataloging, before retention cleanup                          |
| `apps/api/src/db/private_catalog.rs`                           | Preserve the deployed migration ledger while admitting upstream SQL                     | Shared `db::migrations::MIGRATOR` for startup, tests, backup and restore         |
| `apps/private-gateway`                                         | Access verification and bounded free map proxy                                          | Cloudflare Worker in front of the origin                                         |
| `compose/nginx/security-headers.conf` and origin-gate renderer | Browser policy and mandatory gateway secret                                             | Shared nginx includes and server gate                                            |

These are compiled boundaries, not dynamically loaded plugins. A configuration
switch cannot bypass vehicle command blocking, key custody or enrollment authority.
Rivian credentials retain Rivian's own permissions: the app's query-only policy is
not an independently issued read-only Rivian token.

Session-family rotation/replay revocation, request quotas, bounded recovery and
DNS-pinned optional clients remain upstream implementations. Remaining fork hooks
include permanent API-key revocation on account disablement, deletion cleanup and
live authorization before every telemetry delivery plus a five-second idle check.
Tests must accompany upstream edits to these hooks. Never use an automatic
"prefer ours" merge driver for security files.

The audit against integrated upstream dev `b38f2a1f` at fork `cf6e1be` found
29 existing backend runtime Rust files still modified, excluding test files.
Those differences include ingestion and bug fixes as well as security hooks.
Moving policy into modules reduces overlap; it does not remove integration
points or prove that the next upstream merge will be conflict-free. Confidence
comes from the tested behavior of a specific commit, not a percentage guarantee
about future updates.

## Immutable migration ledger

The deployed fork has upstream migrations 1–27 and private checkpoint migration 28.
Upstream independently allocated 28 for release-check settings. Renumbering an
already-applied migration or rewriting its checksum would corrupt the upgrade and
backup compatibility contract.

The checkpoint SQL has therefore moved byte-for-byte to `migrations-private` and
keeps ledger version 28, description and checksum. Upstream SQL remains unchanged
under `migrations`. The catalog adapter maps upstream versions 28 and higher to
`1_000_000 + source_version`. The integrated versions are 1000028, 1000029 and 1000030. All earlier ledger identities stay unchanged. Future upstream migration
31 becomes 1000031 and appends normally.

The adapter intentionally accepts exactly the one legacy private migration. New
private schema changes require explicit namespace/order review; do not silently
append a private migration that would break the ordered prefix used by restores.
Upstream source versions outside 1–999999 fail closed. All migration users, including
fixtures and backup manifests, must consume the shared composed catalog.

Run `node scripts/fork-migration-integrity.mjs <previous-fork-SHA>` to compare
ordered identities. The upstream integrity script describes the upstream SQL
sequence; use the fork check when comparing a previously deployed fork. This
catalog targets fork databases, not an arbitrary upstream database that already
applied upstream version 28 under its original number.

## Upgrade and rollback

Use an immutable tested candidate image. Preserve external RSA and AGE keys and
take a pre-upgrade database backup. Test an upgrade of populated synthetic data,
new backup/restore and authentication before changing production.

After this upgrade the previous binary will reject the new ledger. Rollback must
restore the pre-upgrade database with the original keys and prior image; rolling
back the image alone is not a supported rollback. Archive the exact migration
ledger and backup metadata with the deployment record, outside Git if it contains
private information.

The daily process and its activation/promotion controls are documented in
[private fork maintenance](../runbooks/private-fork-maintenance.md). GitHub
prepares eligible stable candidates with trusted Git plumbing, runs genuine
candidate CI without deployment credentials, and advances the protected branch
only after rechecking the merge and its checks. Protected-branch CI then queues
the native Northflank backup/deployment workflow. Sensitive controls, migrations,
conflicts and failed checks stop for review; KiRoom is an optional review tool.
