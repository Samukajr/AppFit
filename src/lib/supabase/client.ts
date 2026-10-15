import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

export function getSupabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Configure a URL e a chave publicável do Supabase no arquivo .env.');
  }
  client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}
