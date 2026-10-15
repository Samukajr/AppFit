import { getSupabaseClient } from '../lib/supabase/client';
import { parseMealAnalysis, type MealAnalysis } from '../../supabase/functions/_shared/meal';

export type { MealAnalysis };

export async function analyzeMeal(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
): Promise<MealAnalysis> {
  if (!imageBase64 || imageBase64.length > 7_000_000 || imageBase64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
    throw new Error('Envie uma imagem base64 válida, sem prefixo data:, de até aproximadamente 5 MB.');
  }
  const supabase = getSupabaseClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error('Entre na sua conta para analisar refeições.');
  const { data, error } = await supabase.functions.invoke('analyze-meal', {
    body: { image_base64: imageBase64, mime_type: mimeType },
  });
  if (error) throw new Error(`Não foi possível analisar a refeição: ${error.message}`);
  return parseMealAnalysis(data);
}
