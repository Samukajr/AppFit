import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/check-release.mjs', import.meta.url));
const keys = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_PRIVACY_POLICY_URL'];

function check(localEnv, overrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'marombafit-release-'));
  try {
    const env = { ...process.env };
    for (const key of keys) delete env[key];
    Object.assign(env, overrides);
    if (localEnv) writeFileSync(join(cwd, '.env.local'), localEnv);
    return spawnSync(process.execPath, [script], { cwd, env, encoding: 'utf8' });
  } finally {
    rmSync(cwd, { recursive: true });
  }
}

const valid = [
  'EXPO_PUBLIC_SUPABASE_URL=https://project.supabase.co',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=public-test-key',
  'EXPO_PUBLIC_PRIVACY_POLICY_URL=https://samukajr.github.io/marombafit-privacy/privacy.html',
].join('\n');

test('checagem carrega configuracao local e aceita urls publicas', () => {
  const result = check(valid);
  assert.equal(result.status, 0, result.stderr);
});

test('variaveis EAS tem prioridade e urls locais bloqueiam o build', () => {
  const result = check(valid, { EXPO_PUBLIC_SUPABASE_URL: 'http://localhost:54321' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /HTTPS/);
});

test('configuracao ausente bloqueia publicacao explicitamente', () => {
  const result = check();
  assert.equal(result.status, 1);
  for (const key of keys) assert.ok(result.stderr.includes(key));
});

test('web exporta SPA para suportar acesso direto ao login e retorno de autenticacao', () => {
  const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  assert.equal(config.expo.web.output, 'single');
  assert.equal(config.expo.extra.eas.projectId, 'bc8610ec-2662-4644-a4cc-5659d5c93b69');
});
