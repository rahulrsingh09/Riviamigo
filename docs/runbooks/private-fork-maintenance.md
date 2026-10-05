# Maintaining the telemetry security fork

Documentation impact: both internal and user-facing documentation update required.

The fork is `rahulrsingh09/Riviamigo`. Its upstream is `bballdavis/Riviamigo`.
Keep GitHub credentials, cloud credentials, Rivian tokens, locations and database
exports outside Git. The repository is public.

## Branches and updates

- `main` is an unmodified, fast-forward-only mirror of upstream `main`.
- `hardening/private-telemetry` holds the reviewed security changes and is the
  fork's default branch.
- `sync/upstream` combines incoming upstream commits with the hardened branch.
  Changes enter the hardened branch through a reviewed pull request.

The fork upstream workflow checks daily and can be run manually. It does not
automatically merge a PR or deploy an image. A failed run or merge conflict needs
maintainer attention; a schedule is not a guarantee that the fork is current.
GitHub can disable scheduled workflows in inactive public repositories.

Use merge commits for upstream integrations. Do not reset the hardened branch to
upstream, force-push the mirror, or squash away upstream ancestry. Disable force
pushes and deletions on the hardened branch, require fork validation checks, and
review security-sensitive changes before merging.

For a local check:

```sh
git remote add upstream https://github.com/bballdavis/Riviamigo.git
node scripts/fork-sync.mjs
```

If the remote already exists, verify it with `git remote get-url upstream`.
The check fetches references but does not push. `--apply` updates the upstream
mirror and publishes a candidate review branch; run it only from a clean checkout.
Conflicts fail without changing the hardened branch. The five regression cases
in `scripts/fork-sync.test.mjs` exercise preservation, conflicts and workflow changes.

## CI trust and cost boundaries

Enable only `fork-ci.yml` and `fork-upstream-sync.yml` in this fork. Leave the
inherited release, documentation publishing and image publishing workflows
disabled. Do not add cloud or Rivian secrets to GitHub Actions.

Fork validation uses standard GitHub-hosted Ubuntu runners for this public
repository. It does not upload artifacts, enable Actions caches or use larger
runners. A private repository needs a fresh cost review; both workflows refuse to
run when the repository is private.

The synchronization job needs repository write permission to publish its branch
and open a PR. It executes only the trusted sync script and Git operations.
Candidate application code runs in the separate validation workflow with read-only
repository permission and no stored checkout credentials.

PRs created with GitHub's workflow token do not automatically start ordinary PR
workflows. The sync job explicitly dispatches validation only when the candidate
has not changed any `fork-*.yml` workflow or `fork-*.mjs` control script. Otherwise
the PR remains available for manual workflow review. No upstream code executes
inside the job holding write permission.

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
themselves still carry the permissions granted by Rivian. Account connection must
wait until the isolated deployment is tested and the remaining risks are reviewed.
Trip recovery retains observed data; it cannot reconstruct telemetry never received.
