import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAuthCallback } from '../src/features/auth/callback.ts';

test('aceita retorno web e mobile somente no destino esperado', () => {
  for (const redirect of ['http://localhost:8097/auth/callback', 'marombafit://auth/callback',
    'https://marombafit-samukajr82.expo.app/auth/callback']) {
    assert.deepEqual(parseAuthCallback(`${redirect}#access_token=access&refresh_token=refresh&type=magiclink`, redirect),
      { access_token: 'access', refresh_token: 'refresh', type: 'magiclink' });
  }
});

test('aceita callback de recuperacao sem expor os tokens', () => {
  const redirect = 'https://marombafit-samukajr82.expo.app/auth/callback';
  const result = parseAuthCallback(`${redirect}#access_token=access&refresh_token=refresh&type=recovery`, redirect);
  assert.equal(result.type, 'recovery');
  assert.equal(result.access_token, 'access');
  assert.equal(result.refresh_token, 'refresh');
});

test('retorno publicado rejeita outra origem, caminho e protocolo', () => {
  const redirect = 'https://marombafit-samukajr82.expo.app/auth/callback';
  for (const origin of ['https://other.expo.app/auth/callback',
    'http://marombafit-samukajr82.expo.app/auth/callback',
    'https://marombafit-samukajr82.expo.app/login']) {
    assert.throws(() => parseAuthCallback(`${origin}#access_token=secret&refresh_token=secret&type=magiclink`, redirect));
  }
});

test('rejeita links expirados, incompletos ou de outro destino sem expor tokens', () => {
  const redirect = 'http://localhost:8097/auth/callback';
  for (const url of [
    `${redirect}#error=access_denied&error_description=secret`,
    `${redirect}#access_token=secret`,
    'https://other.example/auth/callback#access_token=secret&refresh_token=secret',
    'http://localhost:8097/login#access_token=secret&refresh_token=secret',
  ]) assert.throws(() => parseAuthCallback(url, redirect), error => !error.message.includes('secret'));
});
