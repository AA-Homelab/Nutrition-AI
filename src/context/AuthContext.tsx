import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Profile } from '../types.ts';
import { api, getStoredToken, setStoredToken, removeStoredToken } from '../lib/api.ts';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ profileCompleted: boolean; role: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setProfile: (profile: Profile) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.getCurrentUser();
      setUser(data.user);
      setProfile(data.profile);
    } catch (err) {
      console.warn('Session expired or token invalid:', err);
      removeStoredToken();
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await api.login(email, pass);
      setStoredToken(res.token, true);
      setUser(res.user);
      
      // Fetch user profile
      try {
        const prof = await api.getProfile();
        setProfile(prof);
      } catch {
        setProfile(null);
      }

      return {
        profileCompleted: res.profile_completed,
        role: res.user.role,
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    removeStoredToken();
    setUser(null);
    setProfile(null);
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    login,
    logout,
    refreshUser,
    setProfile,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'ADMIN',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
