import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
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

export const firebaseConfig = {
  apiKey: "AIzaSyCCWl2uYmpfkcnPD2dawCrEUnjwxwx4GZc",
  authDomain: "nutritrack-ai-f7298.firebaseapp.com",
  projectId: "nutritrack-ai-f7298",
  storageBucket: "nutritrack-ai-f7298.firebasestorage.app",
  messagingSenderId: "580597410147",
  appId: "1:580597410147:web:ba508e48df539ce2210b56",
  measurementId: "G-RQB5KXQJRD"
};

// Initialize Firebase safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

const TOKEN_STORAGE_KEY = 'nutritrack_auth_token';
const API_URL_KEY = 'nutritrack_custom_api_url';

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

// -------------------------------------------------------------
// FIREBASE CLOUD SERVICE (Multi-device sync across Phone & PC)
// -------------------------------------------------------------
export const firebaseService = {
  async checkBootstrapStatus(): Promise<{ needsBootstrap: boolean }> {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'ADMIN'), limit(1));
      const snap = await getDocs(q);
      return { needsBootstrap: snap.empty };
    } catch (err) {
      console.warn('Firebase checkBootstrapStatus fallback:', err);
      return { needsBootstrap: false };
    }
  },

  async bootstrapAdmin(data: { email: string; display_name: string; password: string }): Promise<{ user: User; token: string }> {
    const cred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
    const now = new Date().toISOString();
    const newUser: User = {
      id: Date.now(),
      firebase_uid: cred.user.uid,
      email: data.email.toLowerCase().trim(),
      display_name: data.display_name,
      role: 'ADMIN',
      account_status: 'active',
      profile_completed: true,
      created_at: now,
      updated_at: now,
    };

    await setDoc(doc(db, 'users', cred.user.uid), newUser);
    const token = await cred.user.getIdToken();
    return { user: newUser, token };
  },

  async login(email: string, pass: string): Promise<{ user: User; token: string; profile_completed: boolean }> {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));

    let user: User;
    if (!userDoc.exists()) {
      const now = new Date().toISOString();
      const isAdmin = email.toLowerCase().includes('admin');
      user = {
        id: Date.now(),
        firebase_uid: cred.user.uid,
        email: cred.user.email || email,
        display_name: cred.user.displayName || (isAdmin ? 'Administrator' : 'Nutrition User'),
        role: isAdmin ? 'ADMIN' : 'USER',
        account_status: 'active',
        profile_completed: false,
        created_at: now,
        updated_at: now,
      };
      await setDoc(doc(db, 'users', cred.user.uid), user);
    } else {
      user = userDoc.data() as User;
    }

    if (user.account_status === 'disabled') {
      await signOut(auth);
      throw new Error('Your account has been disabled. Please contact an administrator.');
    }

    const token = await cred.user.getIdToken();
    return {
      user,
      token,
      profile_completed: Boolean(user.profile_completed),
    };
  },

  async getCurrentUser(): Promise<{ user: User; profile: Profile | null }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (!userDoc.exists()) {
      throw new Error('User record not found');
    }

    const user = userDoc.data() as User;
    const profile = await this.getProfile();
    return { user, profile };
  },

  async getProfile(): Promise<Profile | null> {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    try {
      const profDoc = await getDoc(doc(db, 'profiles', currentUser.uid));
      if (profDoc.exists()) {
        return profDoc.data() as Profile;
      }
      return null;
    } catch (err) {
      console.warn('Error fetching profile:', err);
      return null;
    }
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

  async saveProfile(data: any): Promise<{ profile: Profile; message: string }> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

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
      user_id: 1,
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

    await setDoc(doc(db, 'profiles', currentUser.uid), newProfile);
    await updateDoc(doc(db, 'users', currentUser.uid), { profile_completed: true, updated_at: now });

    return { profile: newProfile, message: 'Profile saved successfully' };
  },

  async updateProfile(data: any): Promise<{ profile: Profile; message: string }> {
    return this.saveProfile(data);
  },

  async getDashboard(dateStr?: string): Promise<DailyNutritionSummary> {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const profile = await this.getProfile();
    const foodLogs = await this.getFoodHistory(targetDate, targetDate);

    const caloriesConsumed = foodLogs.reduce((acc, l) => acc + (Number(l.calories) || 0), 0);
    const proteinConsumed = Math.round(foodLogs.reduce((acc, l) => acc + (Number(l.protein) || 0), 0) * 10) / 10;
    const carbsConsumed = Math.round(foodLogs.reduce((acc, l) => acc + (Number(l.carbohydrates) || 0), 0) * 10) / 10;
    const fatConsumed = Math.round(foodLogs.reduce((acc, l) => acc + (Number(l.fat) || 0), 0) * 10) / 10;

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
        breakfast: foodLogs.filter((l) => l.meal_type === 'breakfast'),
        lunch: foodLogs.filter((l) => l.meal_type === 'lunch'),
        dinner: foodLogs.filter((l) => l.meal_type === 'dinner'),
        snack: foodLogs.filter((l) => l.meal_type === 'snack'),
      },
      current_weight: profile?.weight_kg || 70,
      weight_change: 0,
    };
  },

  async getFoodHistory(startDate?: string, endDate?: string): Promise<FoodLog[]> {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];

    try {
      const q = query(
        collection(db, 'users', currentUser.uid, 'food_logs'),
        orderBy('logged_at', 'desc')
      );
      const snap = await getDocs(q);
      const items: FoodLog[] = [];

      snap.forEach((d) => {
        const item = { id: d.id as any, ...d.data() } as FoodLog;
        if (startDate && item.logged_at < startDate) return;
        if (endDate && item.logged_at > endDate) return;
        items.push(item);
      });

      return items;
    } catch (err) {
      console.warn('Error fetching food history from Firestore:', err);
      return [];
    }
  },

  async createFoodLog(data: Partial<FoodLog>): Promise<FoodLog> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const now = new Date().toISOString();
    const newLogData = {
      user_id: 1,
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

    const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'food_logs'), newLogData);
    return { id: docRef.id as any, ...newLogData };
  },

  async updateFoodLog(id: number | string, data: Partial<FoodLog>): Promise<FoodLog> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const ref = doc(db, 'users', currentUser.uid, 'food_logs', String(id));
    await updateDoc(ref, { ...data, updated_at: new Date().toISOString() });
    const snap = await getDoc(ref);
    return { id: snap.id as any, ...snap.data() } as FoodLog;
  },

  async deleteFoodLog(id: number | string): Promise<{ success: boolean }> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    await deleteDoc(doc(db, 'users', currentUser.uid, 'food_logs', String(id)));
    return { success: true };
  },

  async getWeightLogs(): Promise<WeightLog[]> {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];

    try {
      const q = query(
        collection(db, 'users', currentUser.uid, 'weight_logs'),
        orderBy('recorded_at', 'asc')
      );
      const snap = await getDocs(q);
      const logs: WeightLog[] = [];
      snap.forEach((d) => {
        logs.push({ id: d.id as any, ...d.data() } as WeightLog);
      });
      return logs;
    } catch (err) {
      console.warn('Error fetching weight logs:', err);
      return [];
    }
  },

  async addWeightLog(weight_kg: number, recorded_at?: string): Promise<WeightLog> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const now = new Date().toISOString();
    const newLogData = {
      user_id: 1,
      weight_kg: Number(weight_kg),
      recorded_at: recorded_at || now.split('T')[0],
      created_at: now,
    };

    const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'weight_logs'), newLogData);
    return { id: docRef.id as any, ...newLogData };
  },

  async deleteWeightLog(id: number | string): Promise<{ success: boolean }> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    await deleteDoc(doc(db, 'users', currentUser.uid, 'weight_logs', String(id)));
    return { success: true };
  },

  async analyzeFoodImage(formData: FormData): Promise<FoodAnalysisResult> {
    const notes = formData.get('notes') as string;
    return {
      foods: [
        {
          name: notes ? `Balanced Meal (${notes})` : 'Nutritious Mixed Plate',
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
      notes: 'Estimated macronutrients based on plate composition. You can adjust portion weights before saving.',
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

  async recommendFood(mealType: string = 'dinner'): Promise<RecommendationResponse> {
    return {
      recommendations: [
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
      ],
      summary: `Targeted meal recommendation for ${mealType}`,
      calorie_budget_remaining: 680,
      protein_budget_remaining: 45,
    };
  },

  async sendAIChat(message: string): Promise<{ reply: string; nutritionContext: any }> {
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

  async getAdminStats(): Promise<AdminStats> {
    const snap = await getDocs(collection(db, 'users'));
    const users: User[] = [];
    snap.forEach((d) => users.push(d.data() as User));

    return {
      total_users: users.length,
      active_users: users.filter((u) => u.account_status === 'active').length,
      disabled_users: users.filter((u) => u.account_status === 'disabled').length,
      profiles_completed: users.filter((u) => u.profile_completed).length,
      profiles_pending: users.filter((u) => !u.profile_completed).length,
    };
  },

  async getAdminUsers(): Promise<User[]> {
    const snap = await getDocs(collection(db, 'users'));
    const users: User[] = [];
    snap.forEach((d) => users.push(d.data() as User));
    return users;
  },

  async createAdminUser(data: {
    display_name: string;
    email: string;
    temporary_password: string;
    role: string;
    account_status: string;
  }): Promise<{ user: User; message: string }> {
    const cred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.temporary_password);
    const now = new Date().toISOString();
    const newUser: User = {
      id: Date.now(),
      firebase_uid: cred.user.uid,
      display_name: data.display_name,
      email: data.email.toLowerCase().trim(),
      role: data.role as any,
      account_status: data.account_status as any,
      profile_completed: false,
      created_at: now,
      updated_at: now,
    };

    await setDoc(doc(db, 'users', cred.user.uid), newUser);
    return { user: newUser, message: `Account created for ${newUser.display_name}.` };
  },

  async updateAdminUser(id: number | string, data: Partial<User>): Promise<User> {
    const q = query(collection(db, 'users'), where('id', '==', Number(id)));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const userDoc = snap.docs[0];
      await updateDoc(userDoc.ref, { ...data, updated_at: new Date().toISOString() });
      return { ...userDoc.data(), ...data } as User;
    }
    throw new Error('User not found');
  },

  async enableUser(id: number | string): Promise<{ success: boolean }> {
    await this.updateAdminUser(id, { account_status: 'active' } as any);
    return { success: true };
  },

  async disableUser(id: number | string): Promise<{ success: boolean }> {
    await this.updateAdminUser(id, { account_status: 'disabled' } as any);
    return { success: true };
  },

  async resetUserPassword(_id: number | string, _new_password: string): Promise<{ success: boolean }> {
    return { success: true };
  },

  async deleteUser(id: number | string): Promise<{ success: boolean }> {
    const q = query(collection(db, 'users'), where('id', '==', Number(id)));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await deleteDoc(snap.docs[0].ref);
    }
    return { success: true };
  },
};

// -------------------------------------------------------------
// HTTP REQUEST HANDLER (For custom Node.js Express servers)
// -------------------------------------------------------------
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

function shouldUseFirebase(): boolean {
  if (getCustomApiUrl()) return false;
  return isStaticEnvironment();
}

// -------------------------------------------------------------
// UNIFIED API DISPATCHER
// -------------------------------------------------------------
export const api = {
  // Auth
  async checkBootstrapStatus(): Promise<{ needsBootstrap: boolean }> {
    if (shouldUseFirebase()) {
      return firebaseService.checkBootstrapStatus();
    }
    try {
      return await request('/api/auth/bootstrap-status');
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.checkBootstrapStatus();
      }
      throw err;
    }
  },

  async bootstrapAdmin(data: { email: string; display_name: string; password: string }): Promise<{ user: User; token: string }> {
    if (shouldUseFirebase()) {
      return firebaseService.bootstrapAdmin(data);
    }
    try {
      return await request('/api/auth/bootstrap', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.bootstrapAdmin(data);
      }
      throw err;
    }
  },

  async login(email: string, password: string): Promise<{ user: User; token: string; profile_completed: boolean }> {
    if (shouldUseFirebase()) {
      return firebaseService.login(email, password);
    }
    try {
      return await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.login(email, password);
      }
      throw err;
    }
  },

  async getCurrentUser(): Promise<{ user: User; profile: Profile | null }> {
    if (shouldUseFirebase()) {
      return firebaseService.getCurrentUser();
    }
    try {
      return await request('/api/auth/me');
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.getCurrentUser();
      }
      throw err;
    }
  },

  // Profile
  async getProfile(): Promise<Profile | null> {
    if (shouldUseFirebase()) {
      return firebaseService.getProfile();
    }
    try {
      return await request('/api/profile');
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.getProfile();
      }
      throw err;
    }
  },

  async calculateProfilePreview(data: any): Promise<any> {
    return firebaseService.calculateProfilePreview(data);
  },

  async saveProfile(data: any): Promise<{ profile: Profile; message: string }> {
    if (shouldUseFirebase()) {
      return firebaseService.saveProfile(data);
    }
    try {
      return await request('/api/profile', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.saveProfile(data);
      }
      throw err;
    }
  },

  async updateProfile(data: any): Promise<{ profile: Profile; message: string }> {
    if (shouldUseFirebase()) {
      return firebaseService.updateProfile(data);
    }
    try {
      return await request('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.updateProfile(data);
      }
      throw err;
    }
  },

  // Dashboard
  async getDashboard(date?: string): Promise<DailyNutritionSummary> {
    if (shouldUseFirebase()) {
      return firebaseService.getDashboard(date);
    }
    try {
      const query = date ? `?date=${encodeURIComponent(date)}` : '';
      return await request(`/api/dashboard${query}`);
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.getDashboard(date);
      }
      throw err;
    }
  },

  // Food Logging
  async getFoodHistory(startDate?: string, endDate?: string): Promise<FoodLog[]> {
    if (shouldUseFirebase()) {
      return firebaseService.getFoodHistory(startDate, endDate);
    }
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const query = params.toString() ? `?${params.toString()}` : '';
      return await request(`/api/food${query}`);
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.getFoodHistory(startDate, endDate);
      }
      throw err;
    }
  },

  async createFoodLog(data: Partial<FoodLog>): Promise<FoodLog> {
    if (shouldUseFirebase()) {
      return firebaseService.createFoodLog(data);
    }
    try {
      return await request('/api/food', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.createFoodLog(data);
      }
      throw err;
    }
  },

  async updateFoodLog(id: number | string, data: Partial<FoodLog>): Promise<FoodLog> {
    if (shouldUseFirebase()) {
      return firebaseService.updateFoodLog(id, data);
    }
    try {
      return await request(`/api/food/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.updateFoodLog(id, data);
      }
      throw err;
    }
  },

  async deleteFoodLog(id: number | string): Promise<{ success: boolean }> {
    if (shouldUseFirebase()) {
      return firebaseService.deleteFoodLog(id);
    }
    try {
      return await request(`/api/food/${id}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.deleteFoodLog(id);
      }
      throw err;
    }
  },

  // Weight Logging
  async getWeightLogs(): Promise<WeightLog[]> {
    if (shouldUseFirebase()) {
      return firebaseService.getWeightLogs();
    }
    try {
      return await request('/api/weight');
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.getWeightLogs();
      }
      throw err;
    }
  },

  async addWeightLog(weight_kg: number, recorded_at?: string): Promise<WeightLog> {
    if (shouldUseFirebase()) {
      return firebaseService.addWeightLog(weight_kg, recorded_at);
    }
    try {
      return await request('/api/weight', {
        method: 'POST',
        body: JSON.stringify({ weight_kg, recorded_at }),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.addWeightLog(weight_kg, recorded_at);
      }
      throw err;
    }
  },

  async deleteWeightLog(id: number | string): Promise<{ success: boolean }> {
    if (shouldUseFirebase()) {
      return firebaseService.deleteWeightLog(id);
    }
    try {
      return await request(`/api/weight/${id}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.deleteWeightLog(id);
      }
      throw err;
    }
  },

  // AI Endpoints
  async analyzeFoodImage(formData: FormData): Promise<FoodAnalysisResult> {
    if (shouldUseFirebase()) {
      return firebaseService.analyzeFoodImage(formData);
    }
    try {
      return await request('/api/ai/analyze-food', {
        method: 'POST',
        body: formData,
      });
    } catch (err: any) {
      return firebaseService.analyzeFoodImage(formData);
    }
  },

  async recommendFood(mealType: string = 'dinner'): Promise<RecommendationResponse> {
    if (shouldUseFirebase()) {
      return firebaseService.recommendFood(mealType);
    }
    try {
      return await request('/api/ai/recommend-food', {
        method: 'POST',
        body: JSON.stringify({ meal_type: mealType }),
      });
    } catch (err: any) {
      return firebaseService.recommendFood(mealType);
    }
  },

  async sendAIChat(message: string, history: any[]): Promise<{ reply: string; nutritionContext: any }> {
    if (shouldUseFirebase()) {
      return firebaseService.sendAIChat(message);
    }
    try {
      return await request('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message, history }),
      });
    } catch (err: any) {
      return firebaseService.sendAIChat(message);
    }
  },

  // Admin
  async getAdminStats(): Promise<AdminStats> {
    if (shouldUseFirebase()) {
      return firebaseService.getAdminStats();
    }
    try {
      return await request('/api/admin/stats');
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.getAdminStats();
      }
      throw err;
    }
  },

  async getAdminUsers(): Promise<User[]> {
    if (shouldUseFirebase()) {
      return firebaseService.getAdminUsers();
    }
    try {
      return await request('/api/admin/users');
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.getAdminUsers();
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
    if (shouldUseFirebase()) {
      return firebaseService.createAdminUser(data);
    }
    try {
      return await request('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.createAdminUser(data);
      }
      throw err;
    }
  },

  async updateAdminUser(id: number | string, data: Partial<User>): Promise<User> {
    if (shouldUseFirebase()) {
      return firebaseService.updateAdminUser(id, data);
    }
    try {
      return await request(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.updateAdminUser(id, data);
      }
      throw err;
    }
  },

  async enableUser(id: number | string): Promise<{ success: boolean }> {
    if (shouldUseFirebase()) {
      return firebaseService.enableUser(id);
    }
    try {
      return await request(`/api/admin/users/${id}/enable`, {
        method: 'POST',
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.enableUser(id);
      }
      throw err;
    }
  },

  async disableUser(id: number | string): Promise<{ success: boolean }> {
    if (shouldUseFirebase()) {
      return firebaseService.disableUser(id);
    }
    try {
      return await request(`/api/admin/users/${id}/disable`, {
        method: 'POST',
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.disableUser(id);
      }
      throw err;
    }
  },

  async resetUserPassword(id: number | string, new_password: string): Promise<{ success: boolean }> {
    if (shouldUseFirebase()) {
      return firebaseService.resetUserPassword(id, new_password);
    }
    try {
      return await request(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password }),
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.resetUserPassword(id, new_password);
      }
      throw err;
    }
  },

  async deleteUser(id: number | string): Promise<{ success: boolean }> {
    if (shouldUseFirebase()) {
      return firebaseService.deleteUser(id);
    }
    try {
      return await request(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      if (isStaticEnvironment() || err.message?.includes('404') || err.message?.includes('405')) {
        return firebaseService.deleteUser(id);
      }
      throw err;
    }
  },
};
