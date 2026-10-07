# Maintaining the telemetry security fork

Documentation impact: both internal and user-facing documentation update required.

GitHub owns routine upstream synchronization, candidate validation and promotion.
Northflank owns building, the fresh release backup, deployment and verification.
Cloudflare owns private access and the independent encrypted backup receiver.
KiRoom can help investigate a stopped update; none of these workflows requires
KiRoom to be running.

The public fork is `rahulrsingh09/Riviamigo`; upstream is
`bballdavis/Riviamigo`. Never put cloud credentials, Rivian tokens, vehicle
locations, database exports or recovery keys in Git.

## Branches and daily operation

- `hardening/private-telemetry` is the protected default and deployment branch.
- `main` is a fast-forward-only mirror of upstream stable main.
- `review/upstream/main/<full-candidate-SHA>` contains an immutable proposed merge.
- Upstream dev is observed but never automatically promoted. A manual sync can
  prepare an eligible dev candidate for a separate review; it does not replace
  the stable mirror or enter automatic promotion.

`fork-upstream-sync.yml` runs daily at **08:23 UTC** and supports a manual run
from the trusted default branch. Schedules may be delayed or disabled by GitHub
for inactivity; inspect the Actions run history rather than assuming a daily run.

The preparation job resolves the current hardened base and upstream refs once,
merges with Git plumbing in a temporary bare repository, and constructs a
repeatable candidate with both exact parents. No candidate files are checked
out or executed by the job holding the write token. Hooks, global Git config,
credential helpers and tree-supplied merge drivers are disabled.

## Automatic update path

1. Prepare a stable-main candidate. Stop for changed controls, conflicts,
   rewritten ancestry or a moved default branch.
2. Publish the candidate under its full SHA. Recompute the merge using the
   trusted workflow code and verify that the published branch matches.
3. Explicitly dispatch the existing **Fork validation** workflow on that immutable
   candidate branch. The candidate workflow file is unchanged from the trusted
   base because all workflow, script and build-control changes are review-gated.
   The validation jobs have read-only GitHub permissions, synthetic database
   fixtures, no cloud credentials and no promotion token.
4. Wait at most 55 minutes for CI. Require both genuine GitHub Actions jobs on
   the exact candidate, run ID and attempt. Failed, neutral, skipped, incomplete,
   foreign or ambiguous checks do not qualify. A newer failure cannot fall back
   to an older success.
5. Recompute the upstream merge and controls again; recheck the candidate ref,
   CI attempt, protected branch and base. Advance the protected branch with
   `force: false`. GitHub still enforces its required checks; no status is
   fabricated and no protection bypass is configured.
6. Explicitly dispatch the same CI workflow on the new protected branch.
   GitHub's repository token does not create ordinary push-triggered runs for
   bot updates, so this dispatch is required. No personal access token or
   additional GitHub App secret is needed.
7. Successful protected-branch CI queues **riviamigo-verified-release** in
   Northflank. Northflank verifies CI again, builds the exact commit, takes a
   fresh backup, preserves original keys, deploys and verifies history and
   collector health. A queued GitHub release is not a completed deployment.

The promoter executes only code from the triggering trusted default commit.
Candidate validation runs on separate GitHub-hosted runners. The promoter's
repository token is used only against fixed GitHub endpoints: read metadata,
dispatch the one approved CI workflow, and fast-forward the one protected branch.
It cannot deploy to Northflank or read Rivian credentials. Git subprocesses never
inherit that token. Network errors are redacted and stop the operation.

## What stops for review

| Result                                  | Required action                                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `current`                               | No upstream merge is needed. Existing protected CI is left alone. If a prior promotion completed but CI dispatch was interrupted, missing protected CI can be resumed.                     |
| `candidate-ready`                       | GitHub automatically validates and attempts promotion for stable main only. Read the automation job for the actual outcome.                                                                |
| `controls-review-required`              | Review changed security, authentication, backend, gateway, migration, workflow, script, dependency, build-control files or existing fork patches. No candidate code executes in this path. |
| `conflict`                              | Resolve in an isolated integration branch, preserving both upstream behavior and fork protections. Never blindly choose one side.                                                          |
| `unrelated-history` / `mirror-diverged` | Review ancestry. Do not force-push, reset the mirror, or automatically merge unrelated histories.                                                                                          |
| `candidate-moved` / `base-moved`        | Re-evaluate the changed refs before retrying. SHA-named candidates must never be overwritten.                                                                                              |
| CI or API failure                       | Inspect the fixed reason code, CI and branch state. A write may have succeeded before its response was lost.                                                                               |

The path gate examines both upstream changes since the merge base and changes in
the resulting candidate, including deletions and renames. All backend code,
private gateway code, hook packages, workflows, actions, scripts, build settings,
dependencies and recognizable authentication/security paths require review.
Existing fork-modified paths also require review when upstream touches them,
even if Git can merge the text without conflicts. This is conservative: many
application updates will stop for review even if Git
can merge them. It is not an AI security review and passing the gate is not a
claim that arbitrary future code is safe.

Modules reduce overlap, but integration hooks remain in upstream files. The
[private deployment architecture](../architecture/private-deployment.md) records
the boundaries and remaining merge risks. Automatic conflict resolution and
"prefer ours" merge drivers are prohibited for these controls.

A stopped update leaves the existing app running. Review may be performed with
KiRoom, another development tool or directly in GitHub. The retired 15-minute
KiRoom deployment trigger must remain disabled. If the daily KiRoom upstream
trigger is retained during rollout verification, it is not a release requirement;
disable it once the native replacement is verified to avoid competing promotions.

## CI identity and cost boundaries

Only genuine **Fork validation** push or explicit workflow-dispatch runs on the
current protected SHA may queue production. The repository ID, workflow ID/path,
head repository, branch, run attempt, both job names and GitHub Actions app ID
are verified. PR, schedule, reusable-candidate and workflow-run events do not
qualify as production CI. The latest failed or pending run blocks older successes.
The native guard independently checks the same contract.

Candidate dispatch runs can qualify for protected-branch promotion after the
promoter's merge/control checks; they never directly qualify for deployment.
Protected-branch dispatch runs repeat the full checks before the release stage.

The public repository uses standard `ubuntu-24.04` GitHub-hosted runners. Jobs
refuse private repositories. There are no paid AI review services, personal
access tokens, paid runners or new cloud services. Only bounded sync metadata
is retained for one day. Hosting and Actions eligibility/storage limits still
apply; do not claim unlimited free capacity or guaranteed schedule availability.

Keep these fork workflows enabled: `fork-ci.yml`, `fork-upstream-sync.yml` and
`fork-cd.yml`. Keep inherited publishing workflows disabled. The Northflank
service's generic automatic-CI switch stays off because the dedicated verified
release workflow owns builds and deployment. The workflow-specific Northflank
webhook stays in the restricted production environment; it is not available to
candidate tests or the upstream promoter.

## Reviewing exceptional updates

Use a clean isolated checkout and read the actual diff before running candidate
code. Do not mount home directories, cloud credentials, real backups or the
Docker socket in a candidate test container. Real Rivian credentials are never
test fixtures.

For authentication, ingestion, schema or recovery changes, validate populated
synthetic upgrades, key custody, restart/trip durability and recovery. Preserve
all deployed migration versions and checksums using the shared composed catalog.
New migration identities or controller-policy changes require a separately
validated change to the installed native guard; do not update its approval
catalog merely to unblock a release.

Push the reviewed candidate to a new `review/**`, `integrate/**` or `automation/**`
branch, wait for its exact-SHA checks and then fast-forward the protected branch.
Never force-push or fabricate checks. Native CI/CD handles the resulting release.
An image-only rollback after a schema change is unsafe: preserve the matching
pre-upgrade database backup, original keys and previous image.

See [native Northflank releases](native-northflank-release.md) for deployment,
[history protection and backups](private-history-backups.md) for recovery copies,
and [key custody](key-custody.md) for original-key requirements.
