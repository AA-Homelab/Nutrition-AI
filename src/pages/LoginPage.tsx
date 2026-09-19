import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Mail, AlertCircle, Sparkles, User, ArrowRight, Globe, Server, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api, isStaticEnvironment, getCustomApiUrl, setCustomApiUrl } from '../lib/api.ts';

interface LoginPageProps {
  onLoginSuccess: (profileCompleted: boolean, role: string) => void;
  onNavigateToBootstrap: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigateToBootstrap,
}) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customUrl, setCustomUrl] = useState(getCustomApiUrl());
  const [urlSaved, setUrlSaved] = useState(false);

  useEffect(() => {
    api.checkBootstrapStatus().then((res) => {
      setNeedsBootstrap(res.needsBootstrap);
    }).catch(() => {});
  }, []);

  const handleSaveCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomApiUrl(customUrl.trim());
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email.trim(), password);
      onLoginSuccess(result.profileCompleted, result.role);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemoAdmin = () => {
    setEmail('admin@nutritrack.app');
    setPassword('AdminPass123!');
    setError(null);
  };

  const handleFillDemoUser = () => {
    setEmail('alex.fitness@example.com');
    setPassword('UserPass123!');
    setError(null);
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-2xl shadow-md mb-4">
          N
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          NutriTrack <span className="text-emerald-600">AI</span>
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Personal Calorie & Nutrition Intelligence
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {error && (
            <div id="login-error-alert" className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-5 h-5" />
                </div>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-5 h-5" />
                </div>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <button
                id="btn-submit-login"
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Explicit Notice: No public registration */}
          <div className="mt-6 pt-5 border-t border-slate-200 text-center">
            <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-500 mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Accounts are provisioned by an administrator.</span>
            </div>

            {/* Demo Quick Fills for Instant Evaluation */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-left">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Quick Test Accounts:
                </p>
                {isStaticEnvironment() && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                    Firebase Cloud Sync
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-fill-admin"
                  onClick={handleFillDemoAdmin}
                  className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/40 text-left flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Admin Login</div>
                    <div className="text-[10px] text-slate-500">Manage users</div>
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-fill-user"
                  onClick={handleFillDemoUser}
                  className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/40 text-left flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">User Login</div>
                    <div className="text-[10px] text-slate-500">Nutrition tracker</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Backend Server Option Toggle */}
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShowServerConfig(!showServerConfig)}
                className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center justify-center mx-auto space-x-1"
              >
                <Server className="w-3 h-3" />
                <span>{showServerConfig ? 'Hide API Server Settings' : 'Configure Custom API Server'}</span>
              </button>

              {showServerConfig && (
                <form onSubmit={handleSaveCustomUrl} className="mt-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2">
                  <label className="block text-[11px] font-medium text-slate-600">
                    AI Backend Server URL (for accurate Gemini Vision & Chat):
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://ais-pre-strdjehwgqwjs6flv4k77t-944961093674.asia-southeast1.run.app"
                      className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center space-x-1"
                    >
                      {urlSaved ? <Check className="w-3.5 h-3.5" /> : null}
                      <span>{urlSaved ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    When hosted on GitHub Pages, food photos and AI chat route to your Google AI Studio backend for real-time Gemini Vision analysis, while your meals save to your Firebase Firestore.
                  </p>
                </form>
              )}
            </div>

            {needsBootstrap && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={onNavigateToBootstrap}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
                >
                  Initialize First Administrator →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
