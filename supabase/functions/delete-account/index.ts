import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  const url = Deno.env.get('SUPABASE_URL');
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publicKey || !serviceKey) return reply(503, { error: 'Exclusão de conta não configurada.' });
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'Autenticação necessária.' });
  const client = createClient(url, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(authorization.slice(7));
  if (error || !data.user) return reply(401, { error: 'Sessão inválida.' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let stage = 'storage_cleanup';
  try {
    async function removeFolder(bucket: string, prefix: string) {
      const storage = admin.storage.from(bucket);
      // Always read page zero: deleting each batch shifts remaining entries forward.
      while (true) {
        const { data: entries, error } = await storage.list(prefix, { limit: 100 });
        if (error) throw error;
        if (!entries.length) return;
        const files: string[] = [];
        for (const entry of entries) {
          const path = `${prefix}/${entry.name}`;
          if (entry.id) files.push(path);
          else await removeFolder(bucket, path);
        }
        if (files.length) {
          const { error } = await storage.remove(files);
          if (error) throw error;
        }
      }
    }
    for (const bucket of ['meal-images', 'health-reports']) await removeFolder(bucket, data.user.id);
    stage = 'account_deletion';
    const { error } = await client.rpc('delete_my_account');
    if (error) throw error;
    return reply(200, { deleted: true });
  } catch (cause) {
    const code = cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string' && /^[A-Z0-9]{5}$/.test(cause.code) ? cause.code : null;
    console.error('Account deletion failed', { stage, code, errorType: cause instanceof Error ? cause.name : 'UnknownError' });
    return reply(500, { error: `Não foi possível concluir a exclusão (${stage}${code ? `:${code}` : ''}). Alguns arquivos podem ter sido removidos. Tente novamente.` });
  }
});
