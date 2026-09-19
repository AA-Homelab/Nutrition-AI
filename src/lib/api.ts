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
import { firebaseService } from './firebaseService.ts';


const TOKEN_STORAGE_KEY = 'nutritrack_auth_token';
const API_URL_KEY = 'nutritrack_custom_api_url';
const SYNC_MODE_KEY = 'nutritrack_storage_provider'; // 'firebase' | 'custom_api'

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

// Determines whether to use direct Firebase Cloud Firestore or an Express Server
function shouldUseFirebase(): boolean {
  if (getCustomApiUrl()) return false;
  return isStaticEnvironment();
}

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
