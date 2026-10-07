import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { POLICY } from './fork-deploy-readiness.mjs';
import { queueRelease } from './fork-native-release.mjs';
import { renderWorkflow } from './native-release/render.mjs';
import { renderJob } from './native-release/job.mjs';
import { readPrivateCatalog } from './lib/private-migrations.mjs';

const sha = 'a'.repeat(40);
const webhook = `https://webhooks.northflank.com/workflows/${'b'.repeat(64)}`;
function fixture() {
  const repository = { id: POLICY.repositoryId, full_name: POLICY.repository, private: false,
    default_branch: POLICY.branch, archived: false, disabled: false };
  const branch = { name: POLICY.branch, protected: true, commit: { sha },
    protection: { required_status_checks: { enforcement_level: 'everyone',
      contexts: [...POLICY.requiredChecks],
      checks: POLICY.requiredChecks.map(context => ({ context, app_id: POLICY.checkAppId })) } } };
  const workflow = { id: POLICY.workflowId, path: POLICY.workflowPath, name: POLICY.workflowName, state: 'active' };
  const run = { id: 101, run_attempt: 1, run_number: 20, repository, head_repository: repository,
    workflow_id: workflow.id, path: workflow.path, name: workflow.name, event: 'push',
    head_branch: POLICY.branch, head_sha: sha, status: 'completed', conclusion: 'success' };
  const jobs = { total_count: 2, jobs: POLICY.requiredChecks.map((name, index) => ({
    id: 201 + index, name, run_id: 101, run_attempt: 1, head_sha: sha, head_branch: POLICY.branch,
    workflow_name: POLICY.workflowName, status: 'completed', conclusion: 'success',
  })) };
  return { repository, branch, workflow, run, jobs };
}
function transport(snapshot, calls) {
  return async (target, options) => {
    const url = new URL(target);
    calls.push({ url, options });
    if (url.hostname === 'webhooks.northflank.com') return new Response('{}');
    let data;
    if (url.pathname.endsWith('/attempts/1/jobs')) data = snapshot.jobs;
    else if (url.pathname.endsWith('/runs/101')) data = snapshot.run;
    else if (url.pathname.endsWith('/runs')) data = { total_count: 1, workflow_runs: [snapshot.run] };
    else if (url.pathname.includes('/branches/')) data = snapshot.branch;
    else if (url.pathname.includes('/actions/workflows/')) data = snapshot.workflow;
    else data = snapshot.repository;
    return Response.json(data);
  };
}

test('GitHub credentials go only to GitHub; Northflank receives an exact successful SHA', async () => {
  const calls = [];
  const result = await queueRelease({ token: 'synthetic-token', webhook, sha, runId: 101 },
    { fetchImpl: transport(fixture(), calls) });
  assert.equal(result.status, 'queued');
  const request = calls.at(-1);
  assert.equal(request.url.searchParams.get('sha'), sha);
  assert.equal(request.url.searchParams.get('runId'), '101');
  assert.equal(request.options.headers, undefined);
  assert.equal(request.options.redirect, 'error');
  assert(calls.slice(0, -1).every(({ options }) => options.headers.Authorization === 'Bearer synthetic-token'));
});

test('failed CI, stale input, and a foreign webhook cannot queue a deployment', async () => {
  for (const change of ['ci', 'sha', 'webhook']) {
    const data = fixture();
    const args = { token: 'synthetic-token', webhook, sha, runId: 101 };
    if (change === 'ci') data.run.conclusion = 'failure';
    if (change === 'sha') args.sha = 'c'.repeat(40);
    if (change === 'webhook') args.webhook = 'https://attacker.invalid/workflows/' + 'b'.repeat(64);
    const calls = [];
    await assert.rejects(queueRelease(args, { fetchImpl: transport(data, calls) }));
    assert(calls.every(({ options }) => options.method === 'GET'));
  }
});

test('installed migration approval exactly matches the immutable source catalog', () => {
  const approved = JSON.parse(readFileSync(new URL('../config/native-release-catalog.json', import.meta.url)));
  const actual = readPrivateCatalog(new URL('..', import.meta.url).pathname)
    .map(({ identity }) => ({ version: identity.version, checksum: identity.checksum_sha384, success: true }));
  assert.deepEqual(approved, actual);
  assert(approved.every(x => Number.isSafeInteger(x.version) && /^[a-f0-9]{96}$/.test(x.checksum) && x.success));
});

test('native workflow serializes backup, fixed job and verification without resource creation', () => {
  const workflow = renderWorkflow();
  assert.deepEqual(workflow.options, { autorun: false, concurrencyPolicy: 'queue' });
  assert.deepEqual(workflow.spec.spec.steps.map(x => x.kind),
    ['Action', 'Build', 'Action', 'JobRun', 'Condition', 'Action']);
  for (const node of workflow.spec.spec.steps.filter(x => x.kind === 'Action')) {
    assert(node.spec.spec.data.command.includes('${fn.toBase64(args.sha)}'));
    assert(!node.spec.spec.data.command.includes("'${args.sha}'"));
    assert.equal(node.spec.spec.data.options.dispatchOnly, false);
  }
  const job = renderJob();
  assert.equal(job.billing.deploymentPlan, 'nf-compute-20');
  assert.equal(job.settings.backoffLimit, 0);
  assert.equal(job.settings.cron.suspended, true);
  assert.equal(job.runtimeEnvironment, undefined);
  assert(job.deployment.external.imagePath.includes('@sha256:'));
});

test('native deployment adapter rejects unapproved mutations and missing backup evidence', () => {
  const result = spawnSync('python3', ['-B', '-m', 'unittest', 'discover', '-s', 'scripts',
    '-p', 'test_native_deploy.py', '-v'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('native shell guard: real isolated PostgreSQL, synthetic HTTP and credentials', () => {
  const result = spawnSync('python3', ['-B', '-m', 'unittest', 'discover', '-s', 'scripts',
    '-p', 'test_native_guard.py', '-v'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 180_000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
