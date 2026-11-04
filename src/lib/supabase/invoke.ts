import type { SupabaseClient } from '@supabase/supabase-js';

export async function invokeGeminiObject(client: SupabaseClient, endpoint: string, body: Record<string, unknown>) {
  const { data, error } = await client.functions.invoke(endpoint, { body });
  if (error) {
    let detail = error.message;
    if ('context' in error && error.context instanceof Response) {
      const response = await error.context.text();
      try {
        const value: unknown = JSON.parse(response);
        if (value && typeof value === 'object' && 'error' in value && typeof value.error === 'string') detail = value.error;
      } catch { detail = `${detail}. Resposta do servidor inválida.`; }
    }
    throw new Error(`Gemini indisponível: ${detail}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Resposta Gemini inválida.');
  return data as Record<string, unknown>;
}
