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
  console.log(`Review and test ${SYNC_BRANCH} at ${result.candidate} before promoting it.`);
  if (result.safeToValidate) {
    gh(['workflow', 'run', 'fork-ci.yml', '--ref', SYNC_BRANCH]);
  } else {
    console.log(`Review changed workflow controls first: ${result.changedControls.join(', ')}`);
  }
}
