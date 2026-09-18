import {
  User,
  Profile,
  FoodLog,
  WeightLog,
  DailyNutritionSummary,
  FoodAnalysisResult,
  RecommendationResponse,
  AdminStats,
} from '../types.ts';
import { calculateNutritionTargets } from '../services/nutritionCalculator.ts';

const TOKEN_STORAGE_KEY = 'nutritrack_auth_token';
const API_URL_KEY = 'nutritrack_custom_api_url';
const LOCAL_STORAGE_KEY = 'nutritrack_local_db_v1';

export function getCustomApiUrl(): string {
  return localStorage.getItem(API_URL_KEY) || ((import.meta as any).env?.VITE_API_URL as string) || '';
}

export function setCustomApiUrl(url: string): void {
  if (url) {
    localStorage.setItem(API_URL_KEY, url.replace(/\/+$/, ''));
  } else {
    localStorage.removeItem(API_URL_KEY);
  }
}

export function isStaticEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('github.io') || host.includes('pages.dev');
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string, remember: boolean = true): void {
  if (remember) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

interface LocalStore {
  users: Array<User & { password?: string }>;
  profiles: Profile[];
  foodLogs: FoodLog[];
  weightLogs: WeightLog[];
}

const DEFAULT_STORE: LocalStore = {
  users: [
    {
      id: 1,
      firebase_uid: 'admin-local-uid',
      email: 'admin@nutritrack.app',
      display_name: 'Administrator',
      role: 'ADMIN',
      account_status: 'active',
      profile_completed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      password: 'AdminPass123!',
    },
    {
      id: 2,
      firebase_uid: 'alex-local-uid',
      email: 'alex.fitness@example.com',
      display_name: 'Alex Rivera',
      role: 'USER',
      account_status: 'active',
      profile_completed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      password: 'UserPass123!',
    },
  ],
  profiles: [
    {
      id: 1,
      user_id: 2,
      age: 28,
      sex: 'male',
      height_cm: 178,
      weight_kg: 76.5,
      activity_level: 'moderately_active',
      goal: 'maintain_weight',
      dietary_preference: 'no_restriction',
      food_preferences: 'High protein, oats, chicken, avocados',
      foods_to_avoid: 'Excess sugar',
      allergies: 'None',
      bmr: 1747.5,
      tdee: 2708.6,
      calorie_target: 2709,
      protein_target: 168,
      carb_target: 305,
      fat_target: 90,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  foodLogs: [
    {
      id: 1,
      user_id: 2,
      meal_type: 'breakfast',
      food_name: 'Oatmeal with Blueberries & Whey',
      serving: '1 bowl (80g oats)',
      calories: 420,
      protein: 32,
      carbohydrates: 54,
      fat: 8,
      source: 'manual',
      logged_at: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      user_id: 2,
      meal_type: 'lunch',
      food_name: 'Grilled Chicken Breast & Jasmine Rice',
      serving: '200g chicken + 1 cup rice',
      calories: 580,
      protein: 48,
      carbohydrates: 62,
      fat: 10,
      source: 'ai_image',
      logged_at: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  weightLogs: [
    {
      id: 1,
      user_id: 2,
      weight_kg: 78.0,
      recorded_at: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      user_id: 2,
      weight_kg: 77.2,
      recorded_at: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      user_id: 2,
      weight_kg: 76.5,
      recorded_at: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    },
  ],
};

function getLocalStore(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_STORE));
      return DEFAULT_STORE;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_STORE;
  }
}

function saveLocalStore(store: LocalStore): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

function getCurrentUserId(): number {
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return 2;
  try {
    const decoded = JSON.parse(atob(token));
    return decoded.id || 2;
  } catch {
    return 2;
  }
}

export const mockLocalService = {
  checkBootstrapStatus(): { needsBootstrap: boolean } {
    const store = getLocalStore();
    const hasAdmin = store.users.some((u) => u.role === 'ADMIN');
    return { needsBootstrap: !hasAdmin };
  },

  bootstrapAdmin(data: { email: string; display_name: string; password: string }): { user: User; token: string } {
    const store = getLocalStore();
    const now = new Date().toISOString();
    const newUser: User & { password?: string } = {
      id: Date.now(),
      firebase_uid: `admin-${Date.now()}`,
      email: data.email.toLowerCase(),
      display_name: data.display_name,
      role: 'ADMIN',
      account_status: 'active',
      profile_completed: true,
      created_at: now,
      updated_at: now,
      password: data.password,
    };
    store.users.push(newUser);
    saveLocalStore(store);

    const token = btoa(JSON.stringify({ id: newUser.id, email: newUser.email, role: newUser.role }));
    return { user: newUser, token };
  },

  login(email: string, pass: string): { user: User; token: string; profile_completed: boolean } {
    const store = getLocalStore();
    const user = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (user.password && user.password !== pass) {
      throw new Error('Invalid email or password.');
    }

    if (user.account_status === 'disabled') {
      throw new Error('Your account has been disabled. Please contact the administrator.');
    }

    const token = btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role }));
    return {
      user,
      token,
      profile_completed: Boolean(user.profile_completed),
    };
  },

  getCurrentUser(): { user: User; profile: Profile | null } {
    const userId = getCurrentUserId();
    const store = getLocalStore();
    const user = store.users.find((u) => u.id === userId) || store.users[0];
    const profile = store.profiles.find((p) => p.user_id === user.id) || null;
    return { user, profile };
  },

  getProfile(): Profile | null {
    const userId = getCurrentUserId();
    const store = getLocalStore();
    return store.profiles.find((p) => p.user_id === userId) || null;
  },

  calculateProfilePreview(data: any): any {
    return calculateNutritionTargets({
      age: Number(data.age),
      sex: data.sex,
      height_cm: Number(data.height_cm),
      weight_kg: Number(data.weight_kg),
      activity_level: data.activity_level,
      goal: data.goal,
    });
  },

  saveProfile(data: any): { profile: Profile; message: string } {
    const userId = getCurrentUserId();
    const store = getLocalStore();
    const calc = calculateNutritionTargets({
      age: Number(data.age),
      sex: data.sex,
      height_cm: Number(data.height_cm),
      weight_kg: Number(data.weight_kg),
      activity_level: data.activity_level,
      goal: data.goal,
    });

    const now = new Date().toISOString();
    const newProfile: Profile = {
      id: Date.now(),
      user_id: userId,
      age: Number(data.age),
      sex: data.sex,
      height_cm: Number(data.height_cm),
      weight_kg: Number(data.weight_kg),
      activity_level: data.activity_level,
      goal: data.goal,
      dietary_preference: data.dietary_preference || 'no_restriction',
      food_preferences: data.food_preferences || '',
      foods_to_avoid: data.foods_to_avoid || '',
      allergies: data.allergies || '',
      bmr: calc.bmr,
      tdee: calc.tdee,
      calorie_target: calc.calorie_target,
      protein_target: calc.protein_target,
      carb_target: calc.carb_target,
      fat_target: calc.fat_target,
      created_at: now,
      updated_at: now,
    };

    const idx = store.profiles.findIndex((p) => p.user_id === userId);
    if (idx >= 0) {
      store.profiles[idx] = newProfile;
    } else {
      store.profiles.push(newProfile);
    }

    const u = store.users.find((user) => user.id === userId);
    if (u) u.profile_completed = true;

    saveLocalStore(store);
    return { profile: newProfile, message: 'Profile saved successfully' };
  },

  updateProfile(data: any): { profile: Profile; message: string } {
    return this.saveProfile(data);
  },

  getDashboard(dateStr?: string): DailyNutritionSummary {
    const userId = getCurrentUserId();
    const store = getLocalStore();
    const targetDate = dateStr || new Date().toISOString().split('T')[0];

    const profile = store.profiles.find((p) => p.user_id === userId);
    const dayLogs = store.foodLogs.filter(
      (l) => l.user_id === userId && l.logged_at === targetDate
    );

    const caloriesConsumed = dayLogs.reduce((acc, l) => acc + l.calories, 0);
    const proteinConsumed = Math.round(dayLogs.reduce((acc, l) => acc + Number(l.protein), 0) * 10) / 10;
    const carbsConsumed = Math.round(dayLogs.reduce((acc, l) => acc + Number(l.carbohydrates), 0) * 10) / 10;
    const fatConsumed = Math.round(dayLogs.reduce((acc, l) => acc + Number(l.fat), 0) * 10) / 10;

    const calorieTarget = profile?.calorie_target || 2000;
    const proteinTarget = profile?.protein_target || 150;
    const carbTarget = profile?.carb_target || 200;
    const fatTarget = profile?.fat_target || 65;

    return {
      date: targetDate,
      calories: {
        target: calorieTarget,
        consumed: caloriesConsumed,
        remaining: Math.max(0, calorieTarget - caloriesConsumed),
      },
      protein: {
        target: proteinTarget,
        consumed: proteinConsumed,
        remaining: Math.max(0, Math.round((proteinTarget - proteinConsumed) * 10) / 10),
      },
      carbohydrates: {
        target: carbTarget,
        consumed: carbsConsumed,
        remaining: Math.max(0, Math.round((carbTarget - carbsConsumed) * 10) / 10),
      },
      fat: {
        target: fatTarget,
        consumed: fatConsumed,
        remaining: Math.max(0, Math.round((fatTarget - fatConsumed) * 10) / 10),
      },
      meals: {
        breakfast: dayLogs.filter((l) => l.meal_type === 'breakfast'),
        lunch: dayLogs.filter((l) => l.meal_type === 'lunch'),
        dinner: dayLogs.filter((l) => l.meal_type === 'dinner'),
        snack: dayLogs.filter((l) => l.meal_type === 'snack'),
      },
      current_weight: profile?.weight_kg || 75,
      weight_change: 0,
    };
  },

  getFoodHistory(startDate?: string, endDate?: string): FoodLog[] {
    const userId = getCurrentUserId();
    const store = getLocalStore();
    return store.foodLogs.filter((l) => {
      if (l.user_id !== userId) return false;
      if (startDate && l.logged_at < startDate) return false;
      if (endDate && l.logged_at > endDate) return false;
      return true;
    });
  },

  createFoodLog(data: Partial<FoodLog>): FoodLog {
    const userId = getCurrentUserId();
    const store = getLocalStore();
    const now = new Date().toISOString();
    const newLog: FoodLog = {
      id: Date.now(),
      user_id: userId,
      meal_type: data.meal_type || 'lunch',
      food_name: data.food_name || 'Food Item',
      serving: data.serving || '1 serving',
      calories: Number(data.calories) || 0,
      protein: Number(data.protein) || 0,
      carbohydrates: Number(data.carbohydrates) || 0,
      fat: Number(data.fat) || 0,
      source: data.source || 'manual',
      logged_at: data.logged_at || now.split('T')[0],
      created_at: now,
      updated_at: now,
    };
    store.foodLogs.unshift(newLog);
    saveLocalStore(store);
    return newLog;
  },

  updateFoodLog(id: number, data: Partial<FoodLog>): FoodLog {
    const store = getLocalStore();
    const idx = store.foodLogs.findIndex((l) => l.id === id);
    if (idx >= 0) {
      store.foodLogs[idx] = { ...store.foodLogs[idx], ...data, updated_at: new Date().toISOString() };
      saveLocalStore(store);
      return store.foodLogs[idx];
    }
    throw new Error('Log not found');
  },

  deleteFoodLog(id: number): { success: boolean } {
    const store = getLocalStore();
    store.foodLogs = store.foodLogs.filter((l) => l.id !== id);
    saveLocalStore(store);
    return { success: true };
  },

  getWeightLogs(): WeightLog[] {
    const userId = getCurrentUserId();
    const store = getLocalStore();
    return store.weightLogs.filter((w) => w.user_id === userId);
  },

  addWeightLog(weight_kg: number, recorded_at?: string): WeightLog {
    const userId = getCurrentUserId();
    const store = getLocalStore();
    const newLog: WeightLog = {
      id: Date.now(),
      user_id: userId,
      weight_kg: Number(weight_kg),
      recorded_at: recorded_at || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };
    store.weightLogs.push(newLog);
    saveLocalStore(store);
    return newLog;
  },

  deleteWeightLog(id: number): { success: boolean } {
    const store = getLocalStore();
    store.weightLogs = store.weightLogs.filter((w) => w.id !== id);
    saveLocalStore(store);
    return { success: true };
  },

  analyzeFoodImage(formData: FormData): FoodAnalysisResult {
    const notes = formData.get('notes') as string;
    return {
      foods: [
        {
          name: notes ? `Healthy Meal (${notes})` : 'Nutritious Mixed Plate',
          serving: '1 standard portion (~350g)',
          calories: 460,
          protein_g: 38,
          carbs_g: 42,
          fat_g: 14,
          confidence: 'High',
        },
      ],
      total: {
        calories: 460,
        protein_g: 38,
        carbs_g: 42,
        fat_g: 14,
      },
      notes: 'Estimated macronutrients based on plate composition. You can fine-tune portion weights and macro counts before saving.',
      food_name: notes ? `Meal (${notes})` : 'Nutritious Mixed Plate',
      estimated_serving: '1 standard portion (~350g)',
      estimated_calories: 460,
      estimated_protein: 38,
      estimated_carbohydrates: 42,
      estimated_fat: 14,
      detected_foods: [
        { name: 'Lean Protein Source', confidence: 'High' },
        { name: 'Complex Carbohydrates', confidence: 'High' },
        { name: 'Fibrous Vegetables & Healthy Fats', confidence: 'Medium' },
      ],
    };
  },

  recommendFood(mealType: string = 'dinner'): RecommendationResponse {
    const recommendations = [
      {
        name: 'Seared Salmon with Steamed Asparagus & Quinoa',
        serving: '1 fillet (180g) + 1 cup quinoa',
        calories: 520,
        protein_g: 42,
        carbs_g: 40,
        fat_g: 18,
        reason: 'Rich in anti-inflammatory omega-3 fatty acids and complete plant-based proteins.',
      },
      {
        name: 'Mediterranean Grilled Chicken Salad',
        serving: '1 large bowl with balsamic olive oil vinaigrette',
        calories: 410,
        protein_g: 45,
        carbs_g: 18,
        fat_g: 16,
        reason: 'Lean high-protein density with micronutrient-rich leafy greens to keep you satiated.',
      },
      {
        name: 'Tofu & Edamame Vegetable Stir-Fry with Brown Rice',
        serving: '1 generous bowl with tamari sauce',
        calories: 460,
        protein_g: 28,
        carbs_g: 58,
        fat_g: 12,
        reason: 'Plant-powered fiber and clean complex carbs to replenish glycogen efficiently.',
      },
    ];

    return {
      recommendations,
      summary: `Targeted meal recommendation for ${mealType}`,
      calorie_budget_remaining: 680,
      protein_budget_remaining: 45,
    };
  },

  sendAIChat(message: string): { reply: string; nutritionContext: any } {
    const lower = message.toLowerCase();
    let reply = `Here's a personalized nutritional guideline based on your targets: Prioritize whole food sources of lean protein (chicken breast, Greek yogurt, fish, tofu) alongside high-fiber carbohydrates (quinoa, sweet potatoes, oats). This stabilizes blood sugar and supports lean body mass retention.`;

    if (lower.includes('protein')) {
      reply = `To hit high protein targets without surplus calories, focus on: chicken breast (31g/100g), non-fat Greek yogurt (17g/cup), egg whites, canned tuna, and whey or plant protein isolate. Incorporating 30–40g per meal optimizes muscle protein synthesis.`;
    } else if (lower.includes('snack') || lower.includes('hunger')) {
      reply = `Great snack options under 200 kcal with high satiety: Apple slices with 1 tbsp peanut butter, a cup of low-fat cottage cheese with berries, or roasted edamame for a crunchy, high-protein bite.`;
    } else if (lower.includes('dinner') || lower.includes('lunch')) {
      reply = `A balanced lunch/dinner plate formula: 1/2 plate leafy greens & colored vegetables, 1/4 plate lean protein (palm-sized), and 1/4 plate slow-digesting carbohydrates (fist-sized).`;
    }

    return {
      reply,
      nutritionContext: {
        caloriesRemaining: 680,
        proteinRemaining: 45,
      },
    };
  },

  getAdminStats(): AdminStats {
    const store = getLocalStore();
    return {
      total_users: store.users.length,
      active_users: store.users.filter((u) => u.account_status === 'active').length,
      disabled_users: store.users.filter((u) => u.account_status === 'disabled').length,
      profiles_completed: store.users.filter((u) => u.profile_completed).length,
      profiles_pending: store.users.filter((u) => !u.profile_completed).length,
    };
  },

  getAdminUsers(): User[] {
    const store = getLocalStore();
    return store.users.map(({ password, ...u }) => u);
  },

  createAdminUser(data: {
    display_name: string;
    email: string;
    temporary_password: string;
    role: string;
    account_status: string;
  }): { user: User; message: string } {
    const store = getLocalStore();
    if (store.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('A user with this email already exists.');
    }

    const now = new Date().toISOString();
    const newUser: User & { password?: string } = {
      id: Date.now(),
      firebase_uid: `user-${Date.now()}`,
      display_name: data.display_name,
      email: data.email.toLowerCase(),
      role: data.role as any,
      account_status: data.account_status as any,
      profile_completed: false,
      created_at: now,
      updated_at: now,
      password: data.temporary_password,
    };

    store.users.push(newUser);
    saveLocalStore(store);
    return { user: newUser, message: `Account created for ${newUser.display_name}.` };
  },

  updateAdminUser(id: number, data: Partial<User>): User {
    const store = getLocalStore();
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx < 0) throw new Error('User not found.');
    store.users[idx] = { ...store.users[idx], ...data, updated_at: new Date().toISOString() };
    saveLocalStore(store);
    const { password, ...u } = store.users[idx];
    return u;
  },

  enableUser(id: number): { success: boolean } {
    return this.updateAdminUser(id, { account_status: 'active' } as any) ? { success: true } : { success: false };
  },

  disableUser(id: number): { success: boolean } {
    return this.updateAdminUser(id, { account_status: 'disabled' } as any) ? { success: true } : { success: false };
  },

  resetUserPassword(id: number, newPass: string): { success: boolean } {
    const store = getLocalStore();
    const user = store.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found.');
    user.password = newPass;
    saveLocalStore(store);
    return { success: true };
  },

  deleteUser(id: number): { success: boolean } {
    const store = getLocalStore();
    store.users = store.users.filter((u) => u.id !== id);
    store.profiles = store.profiles.filter((p) => p.user_id !== id);
    store.foodLogs = store.foodLogs.filter((f) => f.user_id !== id);
    store.weightLogs = store.weightLogs.filter((w) => w.user_id !== id);
    saveLocalStore(store);
    return { success: true };
  },
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const customBase = getCustomApiUrl();
  const url = customBase ? `${customBase}${endpoint}` : endpoint;

  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      errorMsg = data.error || data.message || errorMsg;
    } catch {
      // not json
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  async checkBootstrapStatus(): Promise<{ needsBootstrap: boolean }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.checkBootstrapStatus();
    }
    try {
      return await request('/api/auth/bootstrap-status');
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.checkBootstrapStatus();
      }
      throw err;
    }
  },

  async bootstrapAdmin(data: { email: string; display_name: string; password: string }): Promise<{ user: User; token: string }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.bootstrapAdmin(data);
    }
    try {
      return await request('/api/auth/bootstrap', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.bootstrapAdmin(data);
      }
      throw err;
    }
  },

  async login(email: string, password: string): Promise<{ user: User; token: string; profile_completed: boolean }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.login(email, password);
    }
    try {
      return await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.login(email, password);
      }
      throw err;
    }
  },

  async getCurrentUser(): Promise<{ user: User; profile: Profile | null }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.getCurrentUser();
    }
    try {
      return await request('/api/auth/me');
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.getCurrentUser();
      }
      throw err;
    }
  },

  // Profile
  async getProfile(): Promise<Profile | null> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.getProfile();
    }
    try {
      return await request('/api/profile');
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.getProfile();
      }
      throw err;
    }
  },

  async calculateProfilePreview(data: any): Promise<any> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.calculateProfilePreview(data);
    }
    try {
      return await request('/api/profile/calculate-preview', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.calculateProfilePreview(data);
      }
      throw err;
    }
  },

  async saveProfile(data: any): Promise<{ profile: Profile; message: string }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.saveProfile(data);
    }
    try {
      return await request('/api/profile', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.saveProfile(data);
      }
      throw err;
    }
  },

  async updateProfile(data: any): Promise<{ profile: Profile; message: string }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.updateProfile(data);
    }
    try {
      return await request('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.updateProfile(data);
      }
      throw err;
    }
  },

  // Dashboard
  async getDashboard(date?: string): Promise<DailyNutritionSummary> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.getDashboard(date);
    }
    try {
      const query = date ? `?date=${encodeURIComponent(date)}` : '';
      return await request(`/api/dashboard${query}`);
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.getDashboard(date);
      }
      throw err;
    }
  },

  // Food Logging
  async getFoodHistory(startDate?: string, endDate?: string): Promise<FoodLog[]> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.getFoodHistory(startDate, endDate);
    }
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const query = params.toString() ? `?${params.toString()}` : '';
      return await request(`/api/food${query}`);
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.getFoodHistory(startDate, endDate);
      }
      throw err;
    }
  },

  async createFoodLog(data: Partial<FoodLog>): Promise<FoodLog> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.createFoodLog(data);
    }
    try {
      return await request('/api/food', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.createFoodLog(data);
      }
      throw err;
    }
  },

  async updateFoodLog(id: number, data: Partial<FoodLog>): Promise<FoodLog> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.updateFoodLog(id, data);
    }
    try {
      return await request(`/api/food/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.updateFoodLog(id, data);
      }
      throw err;
    }
  },

  async deleteFoodLog(id: number): Promise<{ success: boolean }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.deleteFoodLog(id);
    }
    try {
      return await request(`/api/food/${id}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.deleteFoodLog(id);
      }
      throw err;
    }
  },

  // Weight Logging
  async getWeightLogs(): Promise<WeightLog[]> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.getWeightLogs();
    }
    try {
      return await request('/api/weight');
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.getWeightLogs();
      }
      throw err;
    }
  },

  async addWeightLog(weight_kg: number, recorded_at?: string): Promise<WeightLog> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.addWeightLog(weight_kg, recorded_at);
    }
    try {
      return await request('/api/weight', {
        method: 'POST',
        body: JSON.stringify({ weight_kg, recorded_at }),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.addWeightLog(weight_kg, recorded_at);
      }
      throw err;
    }
  },

  async deleteWeightLog(id: number): Promise<{ success: boolean }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.deleteWeightLog(id);
    }
    try {
      return await request(`/api/weight/${id}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.deleteWeightLog(id);
      }
      throw err;
    }
  },

  // AI Endpoints
  async analyzeFoodImage(formData: FormData): Promise<FoodAnalysisResult> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.analyzeFoodImage(formData);
    }
    try {
      return await request('/api/ai/analyze-food', {
        method: 'POST',
        body: formData,
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.analyzeFoodImage(formData);
      }
      throw err;
    }
  },

  async recommendFood(mealType: string = 'dinner'): Promise<RecommendationResponse> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.recommendFood(mealType);
    }
    try {
      return await request('/api/ai/recommend-food', {
        method: 'POST',
        body: JSON.stringify({ meal_type: mealType }),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.recommendFood(mealType);
      }
      throw err;
    }
  },

  async sendAIChat(message: string, history: any[]): Promise<{ reply: string; nutritionContext: any }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.sendAIChat(message);
    }
    try {
      return await request('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message, history }),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.sendAIChat(message);
      }
      throw err;
    }
  },

  // Admin
  async getAdminStats(): Promise<AdminStats> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.getAdminStats();
    }
    try {
      return await request('/api/admin/stats');
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.getAdminStats();
      }
      throw err;
    }
  },

  async getAdminUsers(): Promise<User[]> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.getAdminUsers();
    }
    try {
      return await request('/api/admin/users');
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.getAdminUsers();
      }
      throw err;
    }
  },

  async createAdminUser(data: {
    display_name: string;
    email: string;
    temporary_password: string;
    role: string;
    account_status: string;
  }): Promise<{ user: User; message: string }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.createAdminUser(data);
    }
    try {
      return await request('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.createAdminUser(data);
      }
      throw err;
    }
  },

  async updateAdminUser(id: number, data: Partial<User>): Promise<User> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.updateAdminUser(id, data);
    }
    try {
      return await request(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.updateAdminUser(id, data);
      }
      throw err;
    }
  },

  async enableUser(id: number): Promise<{ success: boolean }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.enableUser(id);
    }
    try {
      return await request(`/api/admin/users/${id}/enable`, {
        method: 'POST',
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.enableUser(id);
      }
      throw err;
    }
  },

  async disableUser(id: number): Promise<{ success: boolean }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.disableUser(id);
    }
    try {
      return await request(`/api/admin/users/${id}/disable`, {
        method: 'POST',
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.disableUser(id);
      }
      throw err;
    }
  },

  async resetUserPassword(id: number, new_password: string): Promise<{ success: boolean }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.resetUserPassword(id, new_password);
    }
    try {
      return await request(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password }),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.resetUserPassword(id, new_password);
      }
      throw err;
    }
  },

  async deleteUser(id: number): Promise<{ success: boolean }> {
    if (isStaticEnvironment() && !getCustomApiUrl()) {
      return mockLocalService.deleteUser(id);
    }
    try {
      return await request(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return mockLocalService.deleteUser(id);
      }
      throw err;
    }
  },
};
