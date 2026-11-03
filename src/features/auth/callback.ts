export function parseAuthCallback(url: string, expectedRedirect: string) {
  const incoming = new URL(url);
  const expected = new URL(expectedRedirect);
  if (incoming.protocol !== expected.protocol || incoming.host !== expected.host ||
      incoming.pathname !== expected.pathname) {
    throw new Error('O link recebido não corresponde ao endereço de acesso do app.');
  }
  const fragment = new URLSearchParams(incoming.hash.slice(1));
  if (fragment.has('error') || fragment.has('error_code') || incoming.searchParams.has('error')) {
    throw new Error('O link de acesso expirou ou não é válido. Solicite um novo link.');
  }
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (!accessToken || !refreshToken) {
    throw new Error('O link não contém uma sessão válida. Solicite um novo link e tente novamente.');
  }
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    type: fragment.get('type'),
  };
}
