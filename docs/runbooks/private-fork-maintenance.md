# Maintaining the telemetry security fork

Documentation impact: both internal and user-facing documentation update required.

The public fork is `rahulrsingh09/Riviamigo`; upstream is `bballdavis/Riviamigo`.
Keep GitHub credentials, cloud credentials, Rivian tokens, locations and database
exports outside Git.

## Daily operation and branches

- `hardening/private-telemetry` is the protected default and reviewed security base.
- `main` is a fast-forward-only mirror of upstream stable `main`.
- `review/upstream/main/<full-candidate-SHA>` holds each automatically prepared
  stable candidate. Candidate names and commits are immutable; later upstream or
  hardened changes produce another branch. Existing review work is never merged
  into a new candidate.
- Upstream `dev` is inspected for its SHA, ancestry and main/dev commit counts.
  It is never selected by the schedule. A maintainer can explicitly select `dev`
  in a manual run **from the trusted default branch**. Related dev candidates use
  `review/upstream/dev/<full-candidate-SHA>`; dev never becomes the `main` mirror.
- Validation push triggers cover the default, `review/**`, `integrate/**` and
  `automation/**`. A pull request is not required.

Once installed on the default branch, `fork-upstream-sync.yml` checks daily at
08:23 UTC and supports manual runs. GitHub schedules can be delayed, and GitHub
can disable schedules in inactive public repositories. Check the Actions run
summary rather than assuming every day succeeded.

The workflow resolves the hardened base and upstream refs once, merges with Git
plumbing in an isolated bare repository, and constructs a deterministic merge
commit with both exact parents. Its identity, timestamp and message depend only
on those inputs. It never checks out candidate files or invokes a package manager,
application, repository hook, custom merge driver or local action in the write job.
A changed default-branch SHA during startup blocks the run; rerun on the new base.

The deployed `df97d50` baseline shares ancestry with the available upstream `main`,
but the separately integrated upstream `dev` has unrelated history. Daily automation
assumes future stable releases retain ancestry shared with the hardened base and
that `origin/main` remains an ancestor of upstream `main`. A maintainer's unrelated
history integration can establish ancestry with dev; it does not prove that future
main releases will descend from that integration. A rewritten main or missing
common ancestor is a review blocker. Automation never uses
`--allow-unrelated-histories`, resets, force pushes or automatic conflict resolution.

## Review status and failure handling

Every attempted sync writes a small `fork-sync.json` artifact (one-day retention)
and a run summary. A separate, read-only final job reports candidate SHA,
validation result and readiness for maintainer review. There are no messages to
Slack, email, external review services, or AI services.

| Sync status | Meaning and next step |
| --- | --- |
| `current` | Stable upstream is already in the hardened base. No candidate or validation job is needed. |
| `candidate-ready` | The SHA was prepared and published if `applied` is true. Wait for both validation jobs; this status alone does not mean tests passed. |
| `controls-review-required` | Upstream changed workflows, actions, hooks, install/build configuration, scripts, backend/security code, gateway, migrations or auth controls. Review the listed paths. No candidate code executes and no refs are pushed. |
| `conflict` | The artifact lists unresolved files. Resolve in a separate maintainer integration branch, review security/migration implications, then test that exact commit. |
| `unrelated-history` / `mirror-diverged` | Investigate history before a manual integration. Do not overwrite the mirror or weaken protection. |
| `candidate-moved` | A SHA-named branch points elsewhere. Investigate instead of overwriting it. |
| `base-moved` / `source-unavailable` / `error` | Rerun from the current trusted base or fix the reported fetch/configuration failure. |

Control detection examines both upstream changes since the merge base and the
resulting candidate versus the hardened base, including deletions and renames.
All `.github` files and any `action.yml`/`action.yaml` are gated, regardless of name.
Backend and migration changes are deliberately conservative review gates. The
report's `safeToValidate` means only that this path gate passed; it is not a
security guarantee. No claim is made that future integrations will be conflict-free.

For blocked controls, the reported proposed candidate SHA is reproducible but
**not published** (`applied: false`). This also avoids asking a contents-only token
to update workflow files. Review source changes using the reported base/upstream
SHAs, integrate them with maintainer credentials on an `integrate/**` or `review/**`
branch, and validate the new exact commit. Never resolve security or migration
conflicts by blindly choosing one side or by adding a permissive merge driver.

For a local read-only check from a clean checkout (Git 2.38+ and Node 24):

```sh
git remote add upstream https://github.com/bballdavis/Riviamigo.git
node scripts/fork-sync.mjs --json
```

If the remote already exists, verify both fetch and push URLs. The check fetches
into a temporary bare repository; it does not change local refs, the working tree
or remote branches. `--apply` publishes only ungated candidates and fast-forward
mirror updates atomically. It requires `FORK_SYNC_TOKEN` supplied securely to the
process; no credential helper or stored checkout credential is used. Prefer the
installed workflow for writes. The CLI defaults to stable main.

## CI trust and cost boundaries

Enable only `fork-ci.yml` and `fork-upstream-sync.yml` in this fork. Keep inherited
release, documentation, image publishing and other workflows disabled, and leave
automatic deployment on branch pushes disabled. Do not add cloud or Rivian secrets
to Actions. Repository workflow enablement is an activation prerequisite, not
something these scripts silently change.

All jobs use standard GitHub-hosted `ubuntu-24.04` runners and refuse private
repositories. There are no paid runners, paid APIs, third-party AI services, cloud
resources, or Actions caches. Only the bounded metadata artifact is retained;
public-repository runner eligibility and artifact storage limits still apply.

Only the metadata job has `contents: write`. Checkout uses the triggering trusted
SHA and `persist-credentials: false`. Git runs with an allowlisted environment,
no global/system config, no hooks, no tree-provided merge drivers, and no user
credential helper. The write token is removed from the runner environment and is
passed only to the final Git push subprocess as an ephemeral HTTP header. Fetch,
merge, diff and commit subprocesses do not receive it.

GitHub token pushes do not trigger ordinary push workflows. Instead, the daily
workflow calls `./.github/workflows/fork-ci.yml` as a reusable workflow from the
**same trusted workflow commit**. It passes an immutable candidate SHA, not a
branch name, and caps validation at `contents: read`. There is no candidate-ref
workflow dispatch, `workflow_run`, `pull_request_target`, inherited secret, local
action, stored checkout credential or cloud identity in this path. Both validation
jobs check that HEAD equals the requested full SHA before running candidate code.
Changing candidate workflows cannot change the running trusted workflow definition.

Normal maintainer pushes use the workflow definition in the pushed commit, so
review all workflow/action/security drift **before** pushing a manually integrated
candidate. The automated control gate does not replace that maintainer review.
Keep default protection, required checks, force-push prevention and deletion
prevention enabled. Never fabricate statuses or bypass protection to promote.

## Authentication and browser coverage

Fork backend CI now executes the entire `auth_integration` target serially against
its disposable TimescaleDB/Redis services, in addition to the existing library,
authorization, key-custody, crypto and trip-durability regressions. All credentials
are synthetic and services die with the runner. This includes incoming upstream
tests once their code is integrated; it does not claim those cases exist on the
`df97d50` baseline (which has 36 cases in this target).

The integration also tests real HTTP metric responses with and without gzip to
prevent truncated dashboard batches after stream completion.

The incoming cases cover refresh replay and descendant revocation, disabled or
deleted accounts, administrative re-enablement, enrollment authority, live socket
expiry/quota/revocation, and bounded resource/history operations. Running the
whole target avoids losing new cases through a name filter.

The upstream enrollment fixture has been adapted: a production-compiled test
proves runtime gateway overrides are rejected before any credentials are sent.
Successful enrollment, provider-owned metadata, unchanged existing credentials,
concurrent enrollment and owner/manager authorization run in the ignored database
unit suite through a compile-time-only, task-local mock transport. No real Rivian
connection is made. `fork-auth-contract.mjs` detects reintroduction of the old
process-wide fixture; neither production URL restrictions nor assertions are relaxed.

CI also verifies the composed migration catalog against the deployed `df97d50`
ledger. See [private deployment architecture](../architecture/private-deployment.md)
for module boundaries and migration namespace rules.

Frontend CI installs Chromium and runs the existing login smoke plus
`fork-lock.spec.ts`. The new test uses deterministic local HTTP/WebSocket fixtures,
blocks external browser requests and checks locked, unlocked and pending telemetry
at desktop and phone widths. Clicking the lock indicator must not send a mutation.
It exercises the real browser UI without a Rivian connection or live API.

## Activation and promotion without a PR

1. Review this automation commit and its local test results. Push it with maintainer
   credentials to a reviewed `review/**` or `automation/**` branch. Wait for the
   existing frontend/backend required checks on that exact SHA. Do not merge or
   deploy merely because local script tests passed.
2. Fast-forward the protected default to the reviewed, tested commit using the
   repository's existing protection rules. **The daily schedule and reusable trusted
   definition are inactive until these files reach the default branch.** If another
   integration changed the base, combine and revalidate before promotion.
3. Confirm the repository remains public, only the two fork workflows are enabled,
   no cloud/Rivian Actions secrets exist, and the default/protection configuration
   is unchanged. Keep inherited publishing workflows and automatic deployment off.
4. Manually run **Fork upstream review** from `hardening/private-telemetry` with
   source **main**. Inspect the JSON/summary for captured SHAs, dev awareness,
   `applied`, drift/conflict status and both validation results. Then observe the
   next 08:23 UTC scheduled run. Choose dev only for an intentional manual review.
5. For a ready candidate, review the exact commit. To obtain ordinary push checks
   under existing protection rules, push it with maintainer credentials to a new
   review branch. Re-pushing an unchanged existing branch produces no push event:

   ```sh
   git fetch origin review/upstream/main/<full-candidate-SHA>
   git push origin <full-candidate-SHA>:refs/heads/review/promote-<full-candidate-SHA>
   ```

   Wait for the required frontend/backend checks on that SHA. Confirm the current
   hardened tip is its ancestor, then fast-forward the default to that exact SHA.
   If the base moved incompatibly, prepare and test another integration. Reusable
   run summaries are evidence; they do not grant a branch-protection bypass.
6. Only after tests and review, deploy the tested immutable commit/image with the
   backup and rollback plan below. Deployment remains manual until a maintainer
   explicitly installs the local consumer described below. Candidate publication
   does not activate the schedule or change the live deployment.

## Deployment readiness contract

The existing **Fork validation** (`.github/workflows/fork-ci.yml`) push run is the
GitHub signal. No extra action, `workflow_run` workflow, artifact, custom status,
webhook, deployment credential or self-hosted runner is needed. The upstream
workflow's `ready_for_maintainer_review` summary is **not** deployment readiness.
Upstream candidates still need actual security/migration/workflow review, both
exact-SHA checks and protected default-branch promotion first.

`scripts/fork-deploy-readiness.mjs` is a read-only, one-shot GitHub metadata
consumer, not a deployment command or installed trigger. Its default transport
uses the public API without credentials. The installed deployment configuration
uses `--github-cli /absolute/canonical/path/to/gh` to reuse the host's saved GitHub
login for fixed read-only requests and avoid the shared anonymous quota.
The checker never extracts the token or forwards inherited cloud secrets.
Both transports enforce the same readiness evidence; authentication errors stop
the authenticated transport without a public fallback. Its tests run automatically
through the existing `pnpm test:scripts` CI step.

The checker pins repository ID `1406366405`, workflow ID `375880117`, repository
name, workflow path/name and branch. These IDs were verified against the public
API; replacement, rename or policy drift needs explicit review of this contract.
The following must all hold:

| Evidence | Required value |
| --- | --- |
| Repository | Public, active `rahulrsingh09/Riviamigo`; default remains `hardening/private-telemetry` |
| Branch | Protected; both required contexts still enforced for everyone and bound to GitHub Actions app `15368` |
| Workflow | Active `Fork validation`, exact workflow ID/path |
| Run | Latest push run number for the current full default SHA; `completed` and `success` |
| Required jobs | Exactly one each of `Fork frontend and policy` and `Fork backend and security regressions`, both completed successfully on that SHA, run ID and attempt |
| Freshness | Branch SHA/protection and run ID/attempt/success reread after the jobs |
| Deduplication | SHA absent from the local successful-deployment ledger |

The jobs endpoint binds required check names to this workflow run; unrelated
same-name commit statuses are not evidence. PRs, review branches, manual runs,
scheduled/reusable candidate runs, skipped/neutral/cancelled jobs, missing or
truncated results and stale attempts emit no item. A newer pending or failed
push cannot fall back to an older successful push. The attempt-specific jobs
endpoint deliberately requires both checks in one attempt: after a partial rerun,
use **Re-run all jobs** if readiness is withheld for missing jobs.

### Local setup and consumer boundary

Install a reviewed, pinned copy of the checker outside candidate/build checkouts.
Do not fetch and execute a new checker from the candidate before deciding whether
to trust it. Keep its deployment state outside Git, owned by the local deployer:

```json
{"deployedShas":["<full SHA of a successfully verified deployment>"]}
```

Replace the placeholder with a 40-character lowercase commit SHA; the checker
rejects malformed or missing state. An empty array is valid only when intentionally
initializing a deployment history. After an independently authorized deployment,
seed its SHA **after** verification so enabling the trigger cannot redeploy it.

Example invocation after installing the reviewed checker at the chosen local path:

```sh
node /trusted/riviamigo-control/scripts/fork-deploy-readiness.mjs \
  --state /trusted/riviamigo-control/deployed.json
```

Stdout is one JSON object: `schemaVersion: 1`, `ready`, `reason`, and `items`.
Only `ready: true` has an item with `id`, `repository`, `branch`, `sha`,
`workflowId`, `runId`, and `runAttempt`. The stable ID is
`rahulrsingh09/Riviamigo:hardening/private-telemetry:<full-sha>`; a rerun or another
run on that SHA never changes it. Ordinary not-ready results exit zero with
`items: []`. Invalid state/arguments, API failures and rate limiting exit nonzero
with no items. **Exit zero alone never authorizes deployment.** The checker never
updates the ledger, launches a build, downloads Actions artifacts, runs candidate
code, or deploys.

A local KiRoom shell source can poll every 15 minutes (`*/15 * * * *`, UTC).
A ready poll performs seven public GET requests; budget for shared-IP rate limits
and back off on errors. Extract only the ready item's ID from the compact JSON:

```text
"items":\[\{"id":"(?<deployment>rahulrsingh09/Riviamigo:hardening/private-telemetry:[0-9a-f]{40})"
```

Use `{{deployment}}` as the extraction key template and `new_items` detection.
Do not treat the whole JSON response as an item: even a not-ready response is
nonempty. KiRoom deduplicates successful **dispatch**, which is different from
successful deployment. A dispatched action that fails requires a deliberate
retry/recovery; do not assume another poll retries it or reset dedup globally.
The parent/operator creates and enables this trigger separately after installing
and validating the deterministic local deploy command.

The implementation and installation contract are in the
[local Northflank controller runbook](./local-northflank-controller.md).
`scripts/northflank_deploy.py` uses a fixed local control root, exact-SHA review
receipts, the pinned readiness checker, a deployment lock and an atomic success
ledger. Adding this source does not install or activate the consumer.

The local background action must:

1. Accept only the fixed repository/branch and full SHA; invoke a fixed local
   command with structured arguments. Do not use GitHub titles, summaries, logs,
   artifacts or commit messages as commands or agent instructions.
2. Acquire one deployment lock and reread the successful-deployment ledger.
   Run this checker again under the lock, and require the returned SHA to equal
   the queued SHA. Drop stale work when the default changes; never substitute a
   newer SHA into an old action.
3. Verify protected promotion/review evidence and unchanged workflow/security
   policy. Public branch metadata does not prove that a human reviewed code or
   expose every protection setting. The checker cannot replace that review.
4. Enforce the existing free resource/replica limits, preserve credentials and
   keys, take a fresh database backup, retain the previous immutable image and
   build only the approved SHA. Keep cloud-native automatic branch builds off.
   Build/test processes must not inherit production credentials.
5. Revalidate the queued SHA immediately before deployment if a build took time.
   Deploy and verify using the separately authorized local procedure. Only after
   success, atomically append the SHA to the deployment ledger and record
   image/backup/run evidence. On failure, preserve recovery material, stop and
   report; never mark success or retry a migration blindly.

Polling is a snapshot, not an atomic transaction with GitHub or production. The
local lock, revalidation, success ledger and recovery handling remain mandatory.
Before enabling, test not-ready, repeated SHA, stale queued SHA, overlapping
actions, API failure and failed-deployment recovery without production commands.

### Migration and rollback boundary

The `df97d50bbecd99807001da1d9f34cffc7f1fb3bd` to
`de6a85f63de2697023b0670cf33d38a40f0367cd` upgrade preserves private migration
`28` and maps upstream `28+` into `1000028+`. Rollback needs the **pre-upgrade
database backup, original RSA/AGE keys and old immutable image together**.
Starting the old binary against the new forward-only ledger is not rollback.
Follow the existing separate database-administrator recovery procedure; never
give the running application extra privileges or replace the original keys.

## Release and data checks

Before changing the deployed commit:

1. Read the security and key-custody documentation and remaining dependency
   exceptions. Passing checks is not a guarantee of perfect security.
2. Pass the backend, frontend, synthetic authorization, key migration and trip
   durability regressions.
3. Back up the database and separately preserve the external encryption keys.
   Never rotate or delete the AGE identity as part of an ordinary update.
4. Deploy a reviewed immutable commit and record it. Keep automatic deployment on
   branch pushes disabled.
5. Verify schema migration, authentication, readiness, collector state and
   persistence across restart. Roll back application code only after checking
   compatibility with forward-only database migrations.

Vehicle command blocking is an application policy. Rivian's session tokens
themselves still carry the permissions granted by Rivian. Keep existing Rivian credentials and keys unchanged during upgrades; never use
those credentials in candidate tests.
Trip recovery retains observed data; it cannot reconstruct telemetry never received.
