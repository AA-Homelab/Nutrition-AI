import { ActivityLevel, NutritionGoal } from '../types.ts';

export interface CalculationInput {
  age: number;
  sex: 'male' | 'female';
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: NutritionGoal;
}

export interface CalculationOutput {
  bmr: number;
  tdee: number;
  calorie_target: number;
  protein_target: number;
  carb_target: number;
  fat_target: number;
  disclaimer: string;
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

/**
 * Calculates BMR, TDEE, Calorie Target, and Macro distributions using Mifflin-St Jeor equation.
 */
export function calculateNutritionTargets(input: CalculationInput): CalculationOutput {
  const { age, sex, height_cm, weight_kg, activity_level, goal } = input;

  // 1. Mifflin-St Jeor BMR calculation
  // Male: 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
  // Female: 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
  let bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  if (sex === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }
  bmr = Math.round(bmr * 10) / 10;

  // 2. TDEE calculation
  const multiplier = ACTIVITY_MULTIPLIERS[activity_level] || 1.2;
  const tdee = Math.round(bmr * multiplier * 10) / 10;

  // 3. Calorie Target Adjustment based on goal
  let calorie_target = tdee;
  const minimumCalorieFloor = sex === 'male' ? 1500 : 1200;

  switch (goal) {
    case 'lose_weight':
      calorie_target = Math.max(minimumCalorieFloor, Math.round(tdee - 500));
      break;
    case 'gain_weight':
      calorie_target = Math.round(tdee + 400);
      break;
    case 'build_muscle':
      calorie_target = Math.round(tdee + 250);
      break;
    case 'maintain_weight':
    default:
      calorie_target = Math.round(tdee);
      break;
  }

  // 4. Macronutrient Targets
  // Protein (g):
  // Build muscle / lose weight requires higher protein preservation (2.0g/kg)
  // Maintain / Gain: 1.8g/kg
  let proteinPerKg = 1.8;
  if (goal === 'build_muscle' || goal === 'lose_weight') {
    proteinPerKg = 2.0;
  }
  let protein_target = Math.round(weight_kg * proteinPerKg);
  // Ensure protein calories do not exceed 40% of total calories
  if (protein_target * 4 > calorie_target * 0.40) {
    protein_target = Math.round((calorie_target * 0.30) / 4);
  }

  // Fat (g): 28% of total calorie budget
  const fatCalories = calorie_target * 0.28;
  const fat_target = Math.round(fatCalories / 9);

  // Carbohydrate (g): Remaining calories
  const remainingCalories = Math.max(0, calorie_target - (protein_target * 4 + fat_target * 9));
  const carb_target = Math.round(remainingCalories / 4);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorie_target,
    protein_target,
    carb_target,
    fat_target,
    disclaimer: 'Nutrition values and daily targets are estimates based on the Mifflin-St Jeor equation. Adjust according to personal progress and comfort.',
  };
}
