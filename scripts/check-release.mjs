import { existsSync } from 'node:fs';

for (const path of ['.env.local', '.env']) {
  if (existsSync(path)) process.loadEnvFile(path);
}

const failures = [];
for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
  if (!process.env[key]?.trim()) failures.push(`Configure ${key} no ambiente do EAS.`);
}
for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_PRIVACY_POLICY_URL']) {
  const value = process.env[key];
  if (key === 'EXPO_PUBLIC_PRIVACY_POLICY_URL' && !value) {
    failures.push('Publique a politica de privacidade e configure EXPO_PUBLIC_PRIVACY_POLICY_URL.');
    continue;
  }
  if (!value) continue;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password ||
        ['localhost', '127.0.0.1', 'example.com'].includes(url.hostname)) {
      throw new Error('URL nao publica');
    }
  } catch {
    failures.push(`${key} deve ser uma URL HTTPS publica valida.`);
  }
}
if (failures.length) {
  console.error(`Build bloqueado:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Configuracoes locais presentes. Verifique tambem backend, SMTP e requisitos das lojas no README.');
}
