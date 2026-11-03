import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

const user = '11111111-1111-4111-8111-111111111111';
const env = { SUPABASE_URL: 'https://supabase.example.invalid', SUPABASE_ANON_KEY: 'synthetic-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service' };
const originalFetch = globalThis.fetch;
const originalDeno = globalThis.Deno;
const originalError = console.error;
const logs = [];
let handler, storageFailure = false, rpcFailure = null, rpcCalls = 0;
globalThis.Deno = { env: { get: (key) => env[key] }, serve: (callback) => { handler = callback; } };
const hooks = registerHooks({ resolve(specifier, context, next) {
  return next(specifier === 'npm:@supabase/supabase-js@2' ? '@supabase/supabase-js' : specifier, context);
} });
await import('../supabase/functions/delete-account/index.ts');
hooks.deregister();

console.error = (...args) => logs.push(args);
globalThis.fetch = async (input) => {
  const url = String(input);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  if (url.includes('/auth/v1/user')) return json({ id: user });
  if (url.includes('/storage/v1/object/list/')) {
    return storageFailure ? json({ message: 'PRIVATE_STORAGE_CONTENT', statusCode: '500' }, 500) : json([]);
  }
  if (url.includes('/rpc/delete_my_account')) {
    rpcCalls++;
    return rpcFailure ? json({ message: 'PRIVATE_DATABASE_CONTENT', code: rpcFailure }, 400) : json(null);
  }
  throw new Error('Unexpected synthetic deletion request');
};

after(() => {
  globalThis.fetch = originalFetch;
  globalThis.Deno = originalDeno;
  console.error = originalError;
});

const request = (authenticated = true) => new Request('https://edge.example.invalid', {
  method: 'POST', headers: authenticated ? { Authorization: 'Bearer synthetic-token' } : {},
});

test('exclusao exige autenticacao antes de remover arquivos ou registros', async () => {
  assert.equal((await handler(request(false))).status, 401);
  assert.equal(rpcCalls, 0);
});

test('exclusao confirma sucesso somente apos limpeza e RPC autenticada', async () => {
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.equal(rpcCalls, 1);
});

test('erro de armazenamento interrompe exclusao e informa etapa sem conteudo privado', async () => {
  storageFailure = true;
  const response = await handler(request());
  storageFailure = false;
  assert.equal(response.status, 500);
  const body = await response.text();
  assert.match(body, /storage_cleanup/);
  assert.doesNotMatch(body, /PRIVATE_/);
  assert.equal(rpcCalls, 1);
});

test('erro SQL informa somente etapa e SQLSTATE valido', async () => {
  rpcFailure = '42702';
  const response = await handler(request());
  assert.equal(response.status, 500);
  assert.match(await response.text(), /account_deletion:42702/);
  rpcFailure = 'PRIVATE_UNEXPECTED_CODE';
  const invalidCode = await handler(request());
  const body = await invalidCode.text();
  assert.match(body, /account_deletion/);
  assert.doesNotMatch(body, /PRIVATE_|42702/);
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE_/);
});
