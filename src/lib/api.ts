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

const TOKEN_STORAGE_KEY = 'nutritrack_auth_token';

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
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
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
    return request('/api/auth/bootstrap-status');
  },

  async bootstrapAdmin(data: { email: string; display_name: string; password: string }): Promise<{ user: User; token: string }> {
    return request('/api/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async login(email: string, password: string): Promise<{ user: User; token: string; profile_completed: boolean }> {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async getCurrentUser(): Promise<{ user: User; profile: Profile | null }> {
    return request('/api/auth/me');
  },

  // Profile
  async getProfile(): Promise<Profile | null> {
    return request('/api/profile');
  },

  async calculateProfilePreview(data: any): Promise<any> {
    return request('/api/profile/calculate-preview', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async saveProfile(data: any): Promise<{ profile: Profile; message: string }> {
    return request('/api/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProfile(data: any): Promise<{ profile: Profile; message: string }> {
    return request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Dashboard
  async getDashboard(date?: string): Promise<DailyNutritionSummary> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return request(`/api/dashboard${query}`);
  },

  // Food Logging
  async getFoodHistory(startDate?: string, endDate?: string): Promise<FoodLog[]> {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/food${query}`);
  },

  async createFoodLog(data: Partial<FoodLog>): Promise<FoodLog> {
    return request('/api/food', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateFoodLog(id: number, data: Partial<FoodLog>): Promise<FoodLog> {
    return request(`/api/food/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteFoodLog(id: number): Promise<{ success: boolean }> {
    return request(`/api/food/${id}`, {
      method: 'DELETE',
    });
  },

  // Weight Logging
  async getWeightLogs(): Promise<WeightLog[]> {
    return request('/api/weight');
  },

  async addWeightLog(weight_kg: number, recorded_at?: string): Promise<WeightLog> {
    return request('/api/weight', {
      method: 'POST',
      body: JSON.stringify({ weight_kg, recorded_at }),
    });
  },

  async deleteWeightLog(id: number): Promise<{ success: boolean }> {
    return request(`/api/weight/${id}`, {
      method: 'DELETE',
    });
  },

  // AI Endpoints
  async analyzeFoodImage(formData: FormData): Promise<FoodAnalysisResult> {
    return request('/api/ai/analyze-food', {
      method: 'POST',
      body: formData,
    });
  },

  async recommendFood(mealType: string = 'dinner'): Promise<RecommendationResponse> {
    return request('/api/ai/recommend-food', {
      method: 'POST',
      body: JSON.stringify({ meal_type: mealType }),
    });
  },

  async sendAIChat(message: string, history: any[]): Promise<{ reply: string; nutritionContext: any }> {
    return request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  },

  // Admin
  async getAdminStats(): Promise<AdminStats> {
    return request('/api/admin/stats');
  },

  async getAdminUsers(): Promise<User[]> {
    return request('/api/admin/users');
  },

  async createAdminUser(data: {
    display_name: string;
    email: string;
    temporary_password: string;
    role: string;
    account_status: string;
  }): Promise<{ user: User; message: string }> {
    return request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAdminUser(id: number, data: Partial<User>): Promise<User> {
    return request(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async enableUser(id: number): Promise<{ success: boolean }> {
    return request(`/api/admin/users/${id}/enable`, {
      method: 'POST',
    });
  },

  async disableUser(id: number): Promise<{ success: boolean }> {
    return request(`/api/admin/users/${id}/disable`, {
      method: 'POST',
    });
  },

  async resetUserPassword(id: number, new_password: string): Promise<{ success: boolean }> {
    return request(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    });
  },

  async deleteUser(id: number): Promise<{ success: boolean }> {
    return request(`/api/admin/users/${id}`, {
      method: 'DELETE',
    });
  },
};
