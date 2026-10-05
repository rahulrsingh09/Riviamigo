import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'riviamigo-compose-check-'));
const environmentFile = path.join(temporaryRoot, '.env');
const dataRoot = path.join(temporaryRoot, 'data').replaceAll('\\', '/');

writeFileSync(
  environmentFile,
  [
    'RIVIAMIGO_IMAGE=riviamigo:test-custody',
    'POSTGRES_PASSWORD=compose-check-database-password',
    'REDIS_PASSWORD=compose-check-redis-password',
    'ALLOWED_ORIGINS=https://riviamigo.example.net',
    'RIVIAMIGO_ENV_FILE=' + environmentFile.replaceAll('\\', '/'),
    'RIVIAMIGO_DATA_DIR=' + dataRoot,
    'RIVIAMIGO_ORIGIN_PORT=18080',
    'ALLOW_INSECURE_LAN_HTTP_AUTH=false',
    'TZ=UTC',
    '',
  ].join('\n'),
  'utf8'
);

try {
  const environment = { ...process.env };
  delete environment.RIVIAMIGO_HOST_BIND_ADDRESS;
  delete environment.RIVIAMIGO_IMAGE;
  const render = (files, overrides = {}) => JSON.parse(execFileSync(
      'docker',
      ['compose', '--env-file', environmentFile, ...files.flatMap((file) => ['-f', file]), 'config', '--format', 'json'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...environment, ...overrides } }
    ));
  const standardFile = 'compose/docker-compose.yml';
  const standard = render([standardFile]);
  assert.equal(standard.services.riviamigo.ports[0].host_ip, '127.0.0.1');
  assert.equal(standard.services.timescaledb.ports, undefined);
  assert.equal(standard.services.redis.ports, undefined);
  assert.throws(() => render([standardFile], { RIVIAMIGO_IMAGE: '' }), /Set RIVIAMIGO_IMAGE/);
  const keyed = render([standardFile, 'compose/docker-compose.keys.yml'], {
    RIVIAMIGO_KEYS_SOURCE: temporaryRoot,
  });
  const mount = keyed.services.riviamigo.volumes.find((entry) => entry.target === '/run/secrets/riviamigo');
  assert.equal(mount.read_only, true);
  assert.equal(mount.bind?.create_host_path ?? false, false);
  assert.equal(keyed.services.riviamigo.environment.JWT_SECRET_FILE, '/run/secrets/riviamigo/jwt_private.pem');
  assert.equal(keyed.services.riviamigo.environment.JWT_PUBLIC_KEY_FILE, '/run/secrets/riviamigo/jwt_public.pem');
  assert.equal(keyed.services.riviamigo.environment.AGE_ENCRYPTION_KEY_FILE, '/run/secrets/riviamigo/age_key.txt');
  assert.throws(() => render([standardFile, 'compose/docker-compose.keys.yml'], { RIVIAMIGO_KEYS_SOURCE: '' }), /Set RIVIAMIGO_KEYS_SOURCE/);
  const built = render([standardFile, 'compose/docker-compose.build.yml'], { RIVIAMIGO_IMAGE: 'riviamigo:local' });
  assert.equal(built.services.riviamigo.image, 'riviamigo:local');
  console.log('compose:render-check passed');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
