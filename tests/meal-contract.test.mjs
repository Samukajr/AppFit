import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMealAnalysis } from '../supabase/functions/_shared/meal.ts';

const meal = { meal_name: 'Arroz e frango', calories: 520, proteins_g: 38, carbs_g: 60, fats_g: 14 };

test('aceita exatamente o contrato nutricional esperado', () => {
  assert.deepEqual(parseMealAnalysis(meal), meal);
});

test('rejeita JSON sem campos, textos numericos e valores nao finitos', () => {
  for (const invalid of [
    null, [], {}, { ...meal, meal_name: ' ' }, { ...meal, calories: '520' },
    { ...meal, calories: -1 }, { ...meal, proteins_g: Infinity },
    { ...meal, fats_g: NaN }, { ...meal, carbs_g: undefined },
    { ...meal, extra: true },
  ]) {
    assert.throws(() => parseMealAnalysis(invalid));
  }
});
