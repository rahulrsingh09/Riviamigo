import { spawnSync } from 'node:child_process';
import { syncFork, HARDENED_BRANCH, SYNC_BRANCH, FORK_REPOSITORY } from './fork-sync.mjs';

function gh(args) {
  const result = spawnSync('gh', [...args, '--repo', FORK_REPOSITORY], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`GitHub operation failed: ${result.stderr}`);
  return result.stdout.trim();
}

if (
  process.env.GITHUB_REPOSITORY !== FORK_REPOSITORY ||
  process.env.GITHUB_REF !== `refs/heads/${HARDENED_BRANCH}`
) {
  throw new Error('Run upstream synchronization from the trusted hardened default branch');
}

const result = syncFork({ apply: true });
console.log(JSON.stringify(result, null, 2));
if (result.status === 'review-required') {
  const body = [
    `Integrate upstream commit ${result.upstream} into ${HARDENED_BRANCH}.`,
    '',
    'The main branch mirrors upstream. This PR preserves the fork security changes through a merge.',
    'Review the complete diff, security regressions, migrations and dependency findings before merging.',
    'No deployment is triggered by this workflow.',
    '',
    result.safeToValidate
      ? 'Fork validation has been requested for this candidate.'
      : `Manual workflow review is required before validation: ${result.changedControls.join(', ')}.`,
  ].join('\n');
  const existing = JSON.parse(
    gh([
      'pr',
      'list',
      '--head',
      SYNC_BRANCH,
      '--base',
      HARDENED_BRANCH,
      '--state',
      'open',
      '--json',
      'number',
    ])
  );
  if (existing.length) {
    gh([
      'pr',
      'edit',
      String(existing[0].number),
      '--title',
      'Review upstream updates',
      '--body',
      body,
    ]);
  } else {
    gh([
      'pr',
      'create',
      '--head',
      SYNC_BRANCH,
      '--base',
      HARDENED_BRANCH,
      '--title',
      'Review upstream updates',
      '--body',
      body,
    ]);
  }
  if (result.safeToValidate) {
    gh(['workflow', 'run', 'fork-ci.yml', '--ref', SYNC_BRANCH]);
  }
}
