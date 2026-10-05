import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const FORK_REPOSITORY = 'rahulrsingh09/Riviamigo';
export const HARDENED_BRANCH = 'hardening/private-telemetry';
export const SYNC_BRANCH = 'sync/upstream';

function git(cwd, args, allowFailure = false) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_MERGE_AUTOEDIT: 'no' },
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args[0]} failed: ${result.stderr.trim()}`);
  }
  return { ok: result.status === 0, text: result.stdout.trim() };
}

function ancestor(cwd, older, newer) {
  return git(cwd, ['merge-base', '--is-ancestor', older, newer], true).ok;
}

function merge(cwd, ref) {
  if (ancestor(cwd, ref, 'HEAD')) return;
  const result = git(cwd, ['merge', '--no-ff', '--no-edit', ref], true);
  if (!result.ok) {
    const conflicts = git(cwd, ['diff', '--name-only', '--diff-filter=U']).text;
    git(cwd, ['merge', '--abort'], true);
    throw new Error(`Upstream integration needs conflict review: ${conflicts || 'merge failed'}`);
  }
}

export function syncFork({ cwd = process.cwd(), apply = false } = {}) {
  if (git(cwd, ['status', '--porcelain']).text) {
    throw new Error('Use a clean checkout for upstream synchronization');
  }
  git(cwd, ['fetch', '--no-tags', 'origin']);
  git(cwd, ['fetch', '--no-tags', 'upstream', 'main']);
  const base = git(cwd, ['rev-parse', `origin/${HARDENED_BRANCH}`]).text;
  const upstream = git(cwd, ['rev-parse', 'upstream/main']).text;
  const mirror = git(cwd, ['rev-parse', 'origin/main']).text;
  if (!ancestor(cwd, mirror, upstream)) {
    throw new Error('The upstream mirror diverged; refusing to overwrite its history');
  }
  const result = { base, upstream, mirror, branch: SYNC_BRANCH, applied: apply };
  if (!apply) {
    return { ...result, status: ancestor(cwd, upstream, base) ? 'current' : 'updates-available' };
  }
  if (mirror !== upstream) git(cwd, ['push', 'origin', `${upstream}:refs/heads/main`]);
  if (ancestor(cwd, upstream, base)) return { ...result, status: 'current' };

  const originalBranch = git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'], true).text;
  const originalHead = git(cwd, ['rev-parse', 'HEAD']).text;
  const topic = git(cwd, ['rev-parse', '--verify', `origin/${SYNC_BRANCH}`], true);
  try {
    git(cwd, ['checkout', '--detach', topic.ok ? topic.text : base]);
    merge(cwd, base);
    merge(cwd, upstream);
    const candidate = git(cwd, ['rev-parse', 'HEAD']).text;
    const changedControls = git(cwd, [
      'diff',
      '--name-only',
      base,
      candidate,
      '--',
      '.github/workflows/fork-*.yml',
      'scripts/fork-*.mjs',
    ])
      .text.split('\n')
      .filter(Boolean);
    git(cwd, ['push', 'origin', `HEAD:refs/heads/${SYNC_BRANCH}`]);
    return {
      ...result,
      status: 'review-required',
      candidate,
      safeToValidate: changedControls.length === 0,
      changedControls,
    };
  } finally {
    git(cwd, ['merge', '--abort'], true);
    git(cwd, ['checkout', originalBranch || originalHead]);
  }
}

function validateRemotes(cwd) {
  const expected = {
    origin: FORK_REPOSITORY,
    upstream: 'bballdavis/Riviamigo',
  };
  for (const [remote, repository] of Object.entries(expected)) {
    const url = git(cwd, ['remote', 'get-url', remote]).text;
    const accepted = [`https://github.com/${repository}`, `git@github.com:${repository}`];
    if (!accepted.some((prefix) => url === prefix || url === `${prefix}.git`)) {
      throw new Error(`Unexpected ${remote} repository`);
    }
  }
  if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY !== FORK_REPOSITORY) {
    throw new Error('This synchronization workflow belongs to the security fork');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => !['--apply', '--json'].includes(arg))) {
      throw new Error('Usage: node scripts/fork-sync.mjs [--apply] [--json]');
    }
    validateRemotes(process.cwd());
    console.log(JSON.stringify(syncFork({ apply: args.includes('--apply') }), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
