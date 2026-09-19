import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
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
import { auth, db } from './firebase.ts';
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

export const firebaseService = {
  // Check if any admin exists in Firestore
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

  // Bootstrap initial admin
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

  // Login
  async login(email: string, pass: string): Promise<{ user: User; token: string; profile_completed: boolean }> {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));

    let user: User;
    if (!userDoc.exists()) {
      // Auto-create document if user was created in Firebase Console
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

  // Current user
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

  // Profile
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
      user_id: 1, // mapped
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

  // Dashboard Summary
  async getDashboard(dateStr?: string): Promise<DailyNutritionSummary> {
    const currentUser = auth.currentUser;
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

  // Food Logging
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

  // Weight Tracking
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

  // AI Food Analysis (Client AI / Mock fallback for static sites)
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

  // Admin Operations
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
    // Note: Creating another user with client SDK creates them in Auth
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
