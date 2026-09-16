import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Save,
  Flame,
  Beef,
  Wheat,
  Droplet,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ActivityLevel, NutritionGoal, DietaryPreference } from '../types.ts';
import { calculateNutritionTargets } from '../services/nutritionCalculator.ts';

export const ProfilePage: React.FC = () => {
  const { user, profile, setProfile } = useAuth();

  const [age, setAge] = useState<number>(profile?.age || 28);
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex || 'male');
  const [heightCm, setHeightCm] = useState<number>(profile?.height_cm || 175);
  const [weightKg, setWeightKg] = useState<number>(profile?.weight_kg || 75);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile?.activity_level || 'moderately_active'
  );
  const [goal, setGoal] = useState<NutritionGoal>(profile?.goal || 'maintain_weight');
  const [dietaryPreference, setDietaryPreference] = useState<DietaryPreference>(
    profile?.dietary_preference || 'no_restriction'
  );
  const [foodPreferences, setFoodPreferences] = useState(profile?.food_preferences || '');
  const [foodsToAvoid, setFoodsToAvoid] = useState(profile?.foods_to_avoid || '');
  const [allergies, setAllergies] = useState(profile?.allergies || '');

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live recalculated preview
  const preview = calculateNutritionTargets({
    age,
    sex,
    height_cm: heightCm,
    weight_kg: weightKg,
    activity_level: activityLevel,
    goal,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);

    try {
      const response = await api.updateProfile({
        age,
        sex,
        height_cm: heightCm,
        weight_kg: weightKg,
        activity_level: activityLevel,
        goal,
        dietary_preference: dietaryPreference,
        food_preferences: foodPreferences,
        foods_to_avoid: foodsToAvoid,
        allergies: allergies,
      });

      setProfile(response.profile);
      setSuccessMsg('Profile updated and daily nutrition targets recalculated successfully!');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="profile-view" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Profile & Nutrition Targets
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review your biometric stats, dietary preferences, and target calculations.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Target Blueprint Display */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10 mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Active Nutrition Targets
            </span>
            <h3 className="text-2xl font-black mt-0.5">
              {preview.calorie_target} <span className="text-sm font-normal text-emerald-200">kcal / day</span>
            </h3>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400">Calculated via Mifflin-St Jeor</span>
            <p className="text-xs font-semibold text-slate-200">
              BMR: {preview.bmr} kcal • TDEE: {preview.tdee} kcal
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-white/10 rounded-xl">
            <div className="text-xl font-bold text-blue-300">{preview.protein_target}g</div>
            <span className="text-xs text-slate-300 font-medium">Protein Target</span>
          </div>
          <div className="p-3 bg-white/10 rounded-xl">
            <div className="text-xl font-bold text-amber-300">{preview.carb_target}g</div>
            <span className="text-xs text-slate-300 font-medium">Carb Target</span>
          </div>
          <div className="p-3 bg-white/10 rounded-xl">
            <div className="text-xl font-bold text-rose-300">{preview.fat_target}g</div>
            <span className="text-xs text-slate-300 font-medium">Fat Target</span>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                disabled
                value={user?.display_name || ''}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Managed by administrator</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Age
              </label>
              <input
                type="number"
                min={12}
                max={120}
                required
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Sex
              </label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Height (cm)
              </label>
              <input
                type="number"
                min={80}
                max={250}
                required
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min={30}
                max={300}
                required
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Activity Level
              </label>
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="sedentary">Sedentary (desk job, 1.2x)</option>
                <option value="lightly_active">Lightly Active (1-3 days, 1.375x)</option>
                <option value="moderately_active">Moderately Active (3-5 days, 1.55x)</option>
                <option value="very_active">Very Active (6-7 days, 1.725x)</option>
                <option value="extremely_active">Extremely Active (physical job, 1.9x)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Primary Goal
              </label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as NutritionGoal)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="maintain_weight">Maintain Weight</option>
                <option value="lose_weight">Lose Weight (-500 kcal)</option>
                <option value="gain_weight">Gain Weight (+400 kcal)</option>
                <option value="build_muscle">Build Muscle / Lean Gain</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Dietary Preference
            </label>
            <select
              value={dietaryPreference}
              onChange={(e) => setDietaryPreference(e.target.value as DietaryPreference)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="no_restriction">No Restriction</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="pescatarian">Pescatarian</option>
              <option value="keto">Ketogenic</option>
              <option value="halal">Halal</option>
              <option value="kosher">Kosher</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Allergies
              </label>
              <input
                type="text"
                placeholder="e.g. Peanuts, Shellfish, Gluten"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Foods to Avoid
              </label>
              <input
                type="text"
                placeholder="e.g. Pork, Dairy, Cilantro"
                value={foodsToAvoid}
                onChange={(e) => setFoodsToAvoid(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs flex items-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Recalculating & Saving...' : 'Save & Recalculate Targets'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
