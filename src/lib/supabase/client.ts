import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sessionStorage } from './sessionStorage';

let client: SupabaseClient | undefined;

export function getSupabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Configure a URL e a chave publicável do Supabase no arquivo .env.');
  }
  client ??= createClient(url, key, {
    auth: {
      storage: sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
  });
  return client;
}
