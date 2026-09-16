export type UserRole = 'ADMIN' | 'USER';
export type AccountStatus = 'active' | 'disabled';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type FoodSource = 'manual' | 'ai_image';
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
export type NutritionGoal = 'maintain_weight' | 'lose_weight' | 'gain_weight' | 'build_muscle';
export type DietaryPreference = 'no_restriction' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'halal' | 'kosher' | 'custom';

export interface User {
  id: number;
  firebase_uid: string;
  email: string;
  display_name: string;
  role: UserRole;
  account_status: AccountStatus;
  profile_completed: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface Profile {
  id: number;
  user_id: number;
  age: number;
  sex: 'male' | 'female';
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: NutritionGoal;
  dietary_preference: DietaryPreference;
  food_preferences?: string;
  foods_to_avoid?: string;
  allergies?: string;
  bmr: number;
  tdee: number;
  calorie_target: number;
  protein_target: number;
  carb_target: number;
  fat_target: number;
  created_at: string;
  updated_at: string;
}

export interface FoodLog {
  id: number;
  user_id: number;
  food_name: string;
  serving: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  meal_type: MealType;
  source: FoodSource;
  image_url?: string;
  logged_at: string;
  created_at: string;
  updated_at: string;
}

export interface FoodImage {
  id: number;
  user_id: number;
  food_log_id?: number | null;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  ai_analyzed: boolean;
  ai_analysis_json?: string;
  created_at: string;
}

export interface WeightLog {
  id: number;
  user_id: number;
  weight_kg: number;
  recorded_at: string;
  created_at: string;
}

export interface DetectedFoodItem {
  name: string;
  serving: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence?: 'High' | 'Medium' | 'Low' | number;
}

export interface FoodAnalysisResult {
  foods: DetectedFoodItem[];
  total: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  notes?: string;
  image_path?: string;
  image_url?: string;
  food_name?: string;
  estimated_serving?: string;
  estimated_calories?: number;
  estimated_protein?: number;
  estimated_carbohydrates?: number;
  estimated_fat?: number;
  detected_foods?: Array<{ name: string; confidence?: string }>;
}

export interface MealRecommendation {
  name: string;
  serving: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  reason: string;
}

export interface RecommendationResponse {
  recommendations: MealRecommendation[];
  summary?: string;
  calorie_budget_remaining?: number;
  protein_budget_remaining?: number;
}

export interface DailyNutritionSummary {
  date: string;
  calories: {
    target: number;
    consumed: number;
    remaining: number;
  };
  protein: {
    target: number;
    consumed: number;
    remaining: number;
  };
  carbohydrates: {
    target: number;
    consumed: number;
    remaining: number;
  };
  fat: {
    target: number;
    consumed: number;
    remaining: number;
  };
  meals: {
    breakfast: FoodLog[];
    lunch: FoodLog[];
    dinner: FoodLog[];
    snack: FoodLog[];
  };
  current_weight?: number;
  weight_change?: number;
}

export interface AdminStats {
  total_users: number;
  active_users: number;
  disabled_users: number;
  profiles_completed: number;
  profiles_pending: number;
}
