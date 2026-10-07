import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { POLICY } from '../fork-deploy-readiness.mjs';

const directory = fileURLToPath(new URL('.', import.meta.url));

export function renderWorkflow() {
  const ledger = JSON.parse(readFileSync(resolve(directory, '../../config/native-release-catalog.json'), 'utf8'));
  const script = `EXPECTED_LEDGER='${JSON.stringify(ledger)}'\n${readFileSync(resolve(directory, 'guard.sh'), 'utf8')}`;
  const encoded = Buffer.from(script).toString('base64');
  const action = (phase) => ({
    kind: 'Action', ref: phase,
    spec: { kind: 'Service', spec: { type: 'execute', data: {
      serviceId: 'telemetry-app',
      command: `sh -c "printf %s '${encoded}' | base64 -d | sh -s -- '${phase}' '\${fn.toBase64(args.sha)}' '\${fn.toBase64(args.runId)}'"`,
      options: { dispatchOnly: false },
    } } },
  });
  return {
    name: 'riviamigo-verified-release',
    description: 'Protected GitHub CI, backup, pinned deployment, private access and data checks.',
    apiVersion: 'v1.2',
    arguments: { sha: '', runId: '' },
    options: { autorun: false, concurrencyPolicy: 'queue' },
    spec: { kind: 'Workflow', spec: { type: 'sequential', steps: [
      action('preflight'),
      { kind: 'Build', ref: 'build', condition: 'success', spec: {
        type: 'service', id: 'telemetry-app', branch: POLICY.branch, sha: '${args.sha}',
        reuseExistingBuilds: true, buildRuleFallThroughHandling: 'fail',
        buildOverrides: { buildArguments: { RIVIAMIGO_RELEASE_SHA: '${args.sha}' } },
      } },
      action('backup'),
      { kind: 'JobRun', ref: 'deploy', condition: 'success', spec: {
        jobId: 'verified-release-controller',
        runtimeEnvironment: {
          RELEASE_SHA: '${args.sha}', CI_RUN_ID: '${args.runId}',
          BUILD_ID: '${refs.build.id}', BACKUP_ATTESTATION: '${refs.backup.stdOut}',
        },
      } },
      { kind: 'Condition', ref: 'running', spec: { kind: 'Service', spec: {
        type: 'running', data: { serviceId: 'telemetry-app', timeoutDuration: 600 },
      } } },
      action('verify'),
    ] } },
  };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(renderWorkflow(), null, 2));
}
