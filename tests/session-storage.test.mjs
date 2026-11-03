import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChunkedStorage } from '../src/lib/supabase/chunkedStorage.ts';

function fixture() {
  const values = new Map();
  const backend = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
  return { values, backend, storage: createChunkedStorage(backend) };
}

test('sessao longa sobrevive a nova instancia e substituicao remove partes antigas', async () => {
  const { values, backend, storage } = fixture();
  const token = 'token'.repeat(2000);
  await storage.setItem('auth', token);
  assert.equal(await createChunkedStorage(backend).getItem('auth'), token);
  for (const [key, value] of values) if (key !== 'auth.manifest') assert.ok(value.length <= 500);
  await storage.setItem('auth', 'nova-sessao');
  assert.equal(await storage.getItem('auth'), 'nova-sessao');
  assert.equal(values.size, 2);
  await storage.removeItem('auth');
  assert.equal(await storage.getItem('auth'), null);
  assert.equal(values.size, 0);
});

test('sessao parcial ou manifest invalido produz erro explicito', async () => {
  const { values, storage } = fixture();
  await storage.setItem('auth', 'token');
  const manifest = JSON.parse(values.get('auth.manifest'));
  values.delete(`auth.${manifest.revision}.0`);
  await assert.rejects(storage.getItem('auth'), /incompleta/);
  values.set('auth.manifest', JSON.stringify({ revision: 'a', count: -1 }));
  await assert.rejects(storage.getItem('auth'), /inválida/);
});

test('falha ao escrever nova sessao nao substitui o manifest anterior', async () => {
  const { backend, storage } = fixture();
  await storage.setItem('auth', 'anterior');
  const failing = createChunkedStorage({
    ...backend,
    async setItem() { throw new Error('Armazenamento indisponivel'); },
  });
  await assert.rejects(failing.setItem('auth', 'nova'), /indisponivel/);
  assert.equal(await storage.getItem('auth'), 'anterior');
});
