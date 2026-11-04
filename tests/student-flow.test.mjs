import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOnboardingRepository } from '../src/features/onboarding/repository.ts';
import { youtubeExerciseSearch } from '../src/features/workouts/video.ts';

test('busca de vídeo usa host fixo e codifica somente o nome do exercício', () => {
  const url = new URL(youtubeExerciseSearch('Supino & barra / ação?'));
  assert.equal(url.origin, 'https://www.youtube.com');
  assert.equal(url.pathname, '/results');
  assert.equal(url.searchParams.get('search_query'), 'Supino & barra / ação? execução correta exercício');
  assert.equal([...url.searchParams].length, 1);
  assert.throws(() => youtubeExerciseSearch('  '));
});

test('apresentação consulta apenas o aluno atual e confirma o estado persistido', async () => {
  let state = null;
  const client = {
    auth: { async getUser() { return { data: { user: { id: 'synthetic-student' } }, error: null }; } },
    from(table) {
      assert.equal(table, 'student_onboarding');
      return { select() { return { eq(column, value) {
        assert.equal(column, 'user_id'); assert.equal(value, 'synthetic-student');
        return { async maybeSingle() { return { data: state, error: null }; } };
      } }; } };
    },
    async rpc(name, args) {
      assert.equal(name, 'finish_student_onboarding');
      state = { status: args.p_status };
      return { data: args.p_status, error: null };
    },
  };
  const repo = createOnboardingRepository(client);
  assert.equal(await repo.load(), null);
  await repo.finish('skipped');
  assert.equal(await repo.load(), 'skipped');
  await repo.finish('completed');
  assert.equal(await repo.load(), 'completed');
  state = { status: 'invalid' };
  await assert.rejects(repo.load(), /inválido/);
});

test('falhas de leitura ou conclusão nunca são tratadas como sucesso', async () => {
  const repo = createOnboardingRepository({
    auth: { async getUser() { return { data: { user: { id: 'synthetic' } }, error: null }; } },
    from() { return { select() { return { eq() { return { async maybeSingle() {
      return { data: null, error: { message: 'missing migration' } };
    } }; } }; } }; },
    async rpc() { return { data: null, error: { message: 'network' } }; },
  });
  await assert.rejects(repo.load(), /migração/);
  await assert.rejects(repo.finish('completed'), /não foi confirmada/);
});
