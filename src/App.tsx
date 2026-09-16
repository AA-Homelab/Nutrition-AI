import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { BootstrapAdminPage } from './pages/BootstrapAdminPage.tsx';
import { ProfileSetupPage } from './pages/ProfileSetupPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { FoodLogPage } from './pages/FoodLogPage.tsx';
import { AnalyzeFoodPage } from './pages/AnalyzeFoodPage.tsx';
import { AIAssistantPage } from './pages/AIAssistantPage.tsx';
import { WeightTrackerPage } from './pages/WeightTrackerPage.tsx';
import { FoodHistoryPage } from './pages/FoodHistoryPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [authMode, setAuthMode] = useState<'login' | 'bootstrap'>('login');

  // Update default tab based on user role when authenticated
  useEffect(() => {
    if (user) {
      if (isAdmin) {
        setCurrentTab('admin-dashboard');
      } else {
        setCurrentTab('dashboard');
      }
    }
  }, [user, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white mx-auto flex items-center justify-center font-bold text-xl shadow-md">
            N
          </div>
          <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Loading NutriTrack AI...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    if (authMode === 'bootstrap') {
      return (
        <BootstrapAdminPage
          onSuccess={() => setAuthMode('login')}
          onBackToLogin={() => setAuthMode('login')}
        />
      );
    }
    return (
      <LoginPage
        onLoginSuccess={(profileCompleted, role) => {
          if (role === 'ADMIN') {
            setCurrentTab('admin-dashboard');
          } else {
            setCurrentTab('dashboard');
          }
        }}
        onNavigateToBootstrap={() => setAuthMode('bootstrap')}
      />
    );
  }

  // First Login: Profile incomplete (regular users must complete profile first)
  if (!isAdmin && !user.profile_completed) {
    return (
      <ProfileSetupPage
        onCompleted={() => {
          setCurrentTab('dashboard');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentTab={currentTab} onSelectTab={setCurrentTab} />

      <main className="flex-1 pb-16">
        {isAdmin ? (
          /* Admin View */
          <>
            {(currentTab === 'admin-dashboard' || currentTab === 'admin-users') && (
              <AdminDashboardPage />
            )}
          </>
        ) : (
          /* Regular User Views */
          <>
            {currentTab === 'dashboard' && (
              <DashboardPage onNavigateTab={setCurrentTab} />
            )}
            {currentTab === 'food-log' && <FoodLogPage />}
            {currentTab === 'analyze-food' && (
              <AnalyzeFoodPage onFoodLogged={() => setCurrentTab('dashboard')} />
            )}
            {currentTab === 'ai-assistant' && <AIAssistantPage />}
            {currentTab === 'weight' && <WeightTrackerPage />}
            {currentTab === 'history' && <FoodHistoryPage />}
            {currentTab === 'profile' && <ProfilePage />}
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>NutriTrack AI © {new Date().getFullYear()} • Personal Calorie & Nutrition Tracker</span>
          <span className="text-[11px] text-slate-400">Powered by Google Gemini & Mifflin-St Jeor Energy Science</span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
