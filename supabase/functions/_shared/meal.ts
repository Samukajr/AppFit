export type MealAnalysis = {
  meal_name: string;
  calories: number;
  proteins_g: number;
  carbs_g: number;
  fats_g: number;
};

export const mealSchema = {
  type: 'object',
  properties: {
    meal_name: { type: 'string' },
    calories: { type: 'number', minimum: 0 },
    proteins_g: { type: 'number', minimum: 0 },
    carbs_g: { type: 'number', minimum: 0 },
    fats_g: { type: 'number', minimum: 0 },
  },
  required: ['meal_name', 'calories', 'proteins_g', 'carbs_g', 'fats_g'],
  additionalProperties: false,
};

export function parseMealAnalysis(value: unknown): MealAnalysis {
  if (typeof value !== 'object' || value === null) throw new Error('Resposta nutricional inválida.');
  const record = value as Record<string, unknown>;
  const { meal_name, calories, proteins_g, carbs_g, fats_g } = record;
  const isNutrient = (input: unknown): input is number =>
    typeof input === 'number' && Number.isFinite(input) && input >= 0;
  if (typeof meal_name !== 'string' || !meal_name.trim() || meal_name.length > 200 ||
      !isNutrient(calories) || !isNutrient(proteins_g) || !isNutrient(carbs_g) || !isNutrient(fats_g) ||
      Object.keys(record).length !== 5) {
    throw new Error('A IA não retornou os campos nutricionais esperados.');
  }
  return {
    meal_name,
    calories,
    proteins_g,
    carbs_g,
    fats_g,
  };
}
