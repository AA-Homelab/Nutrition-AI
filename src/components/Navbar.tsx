import React, { useState } from 'react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Camera,
  BotMessageSquare,
  Scale,
  History,
  UserCheck,
  LogOut,
  Users,
  Shield,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'food-log', label: 'Food Log', icon: UtensilsCrossed },
    { id: 'analyze-food', label: 'Analyze Food', icon: Camera },
    { id: 'ai-assistant', label: 'AI Assistant', icon: BotMessageSquare },
    { id: 'weight', label: 'Weight', icon: Scale },
    { id: 'history', label: 'History', icon: History },
    { id: 'profile', label: 'Profile', icon: UserCheck },
  ];

  const adminNavItems = [
    { id: 'admin-dashboard', label: 'Admin Dashboard', icon: Shield },
    { id: 'admin-users', label: 'User Management', icon: Users },
  ];

  const navItems = isAdmin ? adminNavItems : userNavItems;

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header id="main-header" className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab(isAdmin ? 'admin-dashboard' : 'dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-xl shadow-xs">
              N
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">NutriTrack</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">Intelligent Nutrition Engine</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-btn-${item.id}`}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Profile & Logout */}
          <div className="hidden md:flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-800 leading-tight">
                {user?.display_name || 'User'}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  isAdmin
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {user?.role}
              </span>
            </div>

            <button
              id="btn-logout"
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div id="mobile-drawer" className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-1">
          <div className="pb-3 mb-2 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">{user?.display_name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <span
              className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {user?.role}
            </span>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            onClick={logout}
            className="w-full flex items-center space-x-3 px-3 py-2.5 mt-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </header>
  );
};
