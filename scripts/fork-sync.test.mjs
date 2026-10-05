import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { HARDENED_BRANCH, syncFork } from './fork-sync.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'riviamigo-fork-sync-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = (cwd, ...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const origin = join(root, 'origin.git');
  const upstream = join(root, 'upstream.git');
  const cwd = join(root, 'work');
  run(root, 'init', '--bare', origin);
  run(root, 'init', '--bare', upstream);
  mkdirSync(cwd);
  run(cwd, 'init', '-b', 'main');
  run(cwd, 'config', 'user.name', 'Fork sync test');
  run(cwd, 'config', 'user.email', 'test@example.invalid');
  const commit = (name, content) => {
    const file = join(cwd, name);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, content);
    run(cwd, 'add', name);
    run(cwd, 'commit', '-m', `Update ${name}`);
    return run(cwd, 'rev-parse', 'HEAD');
  };
  commit('README.md', 'upstream\n');
  run(cwd, 'remote', 'add', 'origin', origin);
  run(cwd, 'remote', 'add', 'upstream', upstream);
  run(cwd, 'push', 'origin', 'main');
  run(cwd, 'push', 'upstream', 'main');
  run(cwd, 'checkout', '-b', HARDENED_BRANCH);
  commit('SECURITY-FORK.txt', 'preserve this security patch\n');
  run(cwd, 'push', 'origin', HARDENED_BRANCH);
  const hardened = run(cwd, 'rev-parse', 'HEAD');
  const advance = (name = 'upstream-fix.txt', content = 'bug fix\n') => {
    run(cwd, 'checkout', 'main');
    const sha = commit(name, content);
    run(cwd, 'push', 'upstream', 'main');
    run(cwd, 'checkout', HARDENED_BRANCH);
    return sha;
  };
  return { root, cwd, run, origin, upstream, commit, advance, hardened };
}

test('dry run leaves remote branches unchanged', (t) => {
  const f = fixture(t);
  const before = f.run(f.cwd, 'ls-remote', 'origin');
  f.advance();
  assert.equal(syncFork({ cwd: f.cwd }).status, 'updates-available');
  assert.equal(f.run(f.cwd, 'ls-remote', 'origin'), before);
});

test('sync preserves hardened history and publishes an unmerged review branch', (t) => {
  const f = fixture(t);
  const upstream = f.advance();
  const result = syncFork({ cwd: f.cwd, apply: true });
  assert.equal(result.status, 'review-required');
  assert.equal(result.safeToValidate, true);
  assert.equal(f.run(f.cwd, 'rev-parse', `origin/${HARDENED_BRANCH}`), f.hardened);
  assert.equal(f.run(f.cwd, 'rev-parse', 'origin/main'), upstream);
  assert.equal(
    f.run(f.cwd, 'show', `${result.candidate}:SECURITY-FORK.txt`),
    'preserve this security patch'
  );
  assert.equal(f.run(f.cwd, 'symbolic-ref', '--short', 'HEAD'), HARDENED_BRANCH);
  assert.equal(syncFork({ cwd: f.cwd, apply: true }).candidate, result.candidate);
});

test('upstream changes to fork workflow controls require manual review', (t) => {
  const f = fixture(t);
  f.advance('.github/workflows/fork-ci.yml', 'unreviewed workflow\n');
  const result = syncFork({ cwd: f.cwd, apply: true });
  assert.equal(result.safeToValidate, false);
  assert.deepEqual(result.changedControls, ['.github/workflows/fork-ci.yml']);
});

test('merge conflicts keep the hardened branch intact and leave no partial merge', (t) => {
  const f = fixture(t);
  f.commit('README.md', 'security-specific change\n');
  f.run(f.cwd, 'push', 'origin', HARDENED_BRANCH);
  const before = f.run(f.cwd, 'rev-parse', 'HEAD');
  f.advance('README.md', 'conflicting upstream change\n');
  assert.throws(() => syncFork({ cwd: f.cwd, apply: true }), /conflict review/);
  assert.equal(f.run(f.cwd, 'rev-parse', 'HEAD'), before);
  assert.equal(f.run(f.cwd, 'status', '--porcelain'), '');
  assert.equal(f.run(f.cwd, 'ls-remote', '--heads', 'origin', 'sync/upstream'), '');
});

test('a divergent mirror is never force pushed', (t) => {
  const f = fixture(t);
  f.run(f.cwd, 'checkout', 'main');
  f.commit('fork-only-main.txt', 'unexpected mirror modification\n');
  f.run(f.cwd, 'push', 'origin', 'main');
  f.run(f.cwd, 'checkout', HARDENED_BRANCH);
  assert.throws(() => syncFork({ cwd: f.cwd, apply: true }), /mirror diverged/);
});
