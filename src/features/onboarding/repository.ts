import type { SupabaseClient } from '@supabase/supabase-js';

export type OnboardingStatus = 'completed' | 'skipped';

export function parseOnboardingStatus(value: unknown): OnboardingStatus {
  if (value !== 'completed' && value !== 'skipped') throw new Error('Estado de apresentação inválido.');
  return value;
}

export function createOnboardingRepository(client: SupabaseClient) {
  return {
    async load(): Promise<OnboardingStatus | null> {
      const { data: identity, error: identityError } = await client.auth.getUser();
      if (identityError || !identity.user) throw new Error('Entre novamente para consultar sua apresentação.');
      const { data, error } = await client.from('student_onboarding').select('status')
        .eq('user_id', identity.user.id).maybeSingle();
      if (error) throw new Error(`Não foi possível consultar a apresentação. Verifique a migração do aluno: ${error.message}`);
      if (data === null) return null;
      return parseOnboardingStatus(data.status);
    },
    async finish(status: OnboardingStatus) {
      const expected = parseOnboardingStatus(status);
      const { data, error } = await client.rpc('finish_student_onboarding', { p_status: expected });
      if (error) throw new Error('A conclusão não foi confirmada. Atualize o estado antes de tentar novamente.');
      if (parseOnboardingStatus(data) !== expected) throw new Error('O servidor não confirmou a conclusão solicitada.');
    },
  };
}
