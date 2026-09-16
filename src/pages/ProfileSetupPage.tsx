import React, { useState, useEffect } from 'react';
import { ActivityLevel, NutritionGoal, DietaryPreference } from '../types.ts';
import { api } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { calculateNutritionTargets } from '../services/nutritionCalculator.ts';
import { Flame, Beef, Wheat, Droplet, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

interface ProfileSetupPageProps {
  onCompleted: () => void;
}

export const ProfileSetupPage: React.FC<ProfileSetupPageProps> = ({ onCompleted }) => {
  const { user, refreshUser, setProfile } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [age, setAge] = useState<number>(28);
  const [sex, setSex] = useState<'male' | 'female'>('male');
  
  // Height & Unit
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft_in'>('cm');
  const [heightCm, setHeightCm] = useState<number>(175);
  const [heightFeet, setHeightFeet] = useState<number>(5);
  const [heightInches, setHeightInches] = useState<number>(9);

  // Weight & Unit
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [weightKg, setWeightKg] = useState<number>(75);
  const [weightLbs, setWeightLbs] = useState<number>(165);

  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderately_active');
  const [goal, setGoal] = useState<NutritionGoal>('maintain_weight');
  const [dietaryPreference, setDietaryPreference] = useState<DietaryPreference>('no_restriction');
  const [foodPreferences, setFoodPreferences] = useState('');
  const [foodsToAvoid, setFoodsToAvoid] = useState('');
  const [allergies, setAllergies] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to compute normalized metric values
  const effectiveHeightCm = heightUnit === 'cm' 
    ? heightCm 
    : Math.round(((heightFeet * 12) + heightInches) * 2.54);

  const effectiveWeightKg = weightUnit === 'kg' 
    ? weightKg 
    : Math.round((weightLbs / 2.20462) * 10) / 10;

  // Live calculation preview
  const preview = calculateNutritionTargets({
    age,
    sex,
    height_cm: effectiveHeightCm,
    weight_kg: effectiveWeightKg,
    activity_level: activityLevel,
    goal,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.saveProfile({
        display_name: displayName,
        age,
        sex,
        height_cm: effectiveHeightCm,
        weight_kg: effectiveWeightKg,
        activity_level: activityLevel,
        goal,
        dietary_preference: dietaryPreference,
        food_preferences: foodPreferences,
        foods_to_avoid: foodsToAvoid,
        allergies: allergies,
      });

      setProfile(response.profile);
      await refreshUser();
      onCompleted();
    } catch (err: any) {
      setError(err.message || 'Failed to save profile. Please check the fields and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="profile-setup-container" className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Personalized Setup</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome! Let's set up your profile.
          </h1>
          <p className="mt-2 text-base text-slate-600 max-w-xl mx-auto">
            We use the Mifflin-St Jeor equation to calculate your Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE) to customize your daily nutrition targets.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Age & Sex */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Age (years)</label>
                  <input
                    type="number"
                    min={12}
                    max={120}
                    required
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Biological Sex</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSex('male')}
                      className={`py-2 px-3 text-sm font-semibold rounded-xl border text-center transition-colors ${
                        sex === 'male'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Male
                    </button>
                    <button
                      type="button"
                      onClick={() => setSex('female')}
                      className={`py-2 px-3 text-sm font-semibold rounded-xl border text-center transition-colors ${
                        sex === 'female'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Female
                    </button>
                  </div>
                </div>
              </div>

              {/* Height */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-slate-700">Height</label>
                  <div className="flex space-x-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setHeightUnit('cm')}
                      className={`font-semibold ${heightUnit === 'cm' ? 'text-emerald-700 underline' : 'text-slate-500'}`}
                    >
                      cm
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setHeightUnit('ft_in')}
                      className={`font-semibold ${heightUnit === 'ft_in' ? 'text-emerald-700 underline' : 'text-slate-500'}`}
                    >
                      ft / in
                    </button>
                  </div>
                </div>

                {heightUnit === 'cm' ? (
                  <input
                    type="number"
                    min={80}
                    max={250}
                    required
                    value={heightCm}
                    onChange={(e) => setHeightCm(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min={3}
                        max={7}
                        value={heightFeet}
                        onChange={(e) => setHeightFeet(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-500">ft</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min={0}
                        max={11}
                        value={heightInches}
                        onChange={(e) => setHeightInches(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-500">in</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Weight */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-slate-700">Weight</label>
                  <div className="flex space-x-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setWeightUnit('kg')}
                      className={`font-semibold ${weightUnit === 'kg' ? 'text-emerald-700 underline' : 'text-slate-500'}`}
                    >
                      kg
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setWeightUnit('lbs')}
                      className={`font-semibold ${weightUnit === 'lbs' ? 'text-emerald-700 underline' : 'text-slate-500'}`}
                    >
                      lbs
                    </button>
                  </div>
                </div>

                {weightUnit === 'kg' ? (
                  <input
                    type="number"
                    step="0.1"
                    min={30}
                    max={300}
                    required
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                ) : (
                  <input
                    type="number"
                    step="0.5"
                    min={66}
                    max={660}
                    required
                    value={weightLbs}
                    onChange={(e) => setWeightLbs(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                )}
              </div>

              {/* Activity Level */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Activity Level</label>
                <select
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                >
                  <option value="sedentary">Sedentary (Little or no exercise, desk job - 1.2x)</option>
                  <option value="lightly_active">Lightly Active (Light exercise 1-3 days/week - 1.375x)</option>
                  <option value="moderately_active">Moderately Active (Moderate exercise 3-5 days/week - 1.55x)</option>
                  <option value="very_active">Very Active (Hard exercise 6-7 days/week - 1.725x)</option>
                  <option value="extremely_active">Extremely Active (Very hard exercise, physical job - 1.9x)</option>
                </select>
              </div>

              {/* Primary Goal */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Primary Goal</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {[
                    { id: 'maintain_weight', label: 'Maintain Weight' },
                    { id: 'lose_weight', label: 'Lose Weight (-500 kcal)' },
                    { id: 'gain_weight', label: 'Gain Weight (+400 kcal)' },
                    { id: 'build_muscle', label: 'Build Muscle / Lean Gain' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setGoal(item.id as NutritionGoal)}
                      className={`p-3 text-xs sm:text-sm font-semibold rounded-xl border text-center transition-all ${
                        goal === item.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dietary Preferences */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Dietary Preference</label>
                <select
                  value={dietaryPreference}
                  onChange={(e) => setDietaryPreference(e.target.value as DietaryPreference)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
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

              {/* Optional Allergies and Avoidances */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Allergies (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Peanuts, Shellfish, Dairy"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Foods to Avoid (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Mushrooms, Olives, Cilantro"
                    value={foodsToAvoid}
                    onChange={(e) => setFoodsToAvoid(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-xs flex items-center justify-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span>Saving Profile...</span>
                ) : (
                  <>
                    <span>Complete Setup & Go to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Live Nutrition Target Preview Panel */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center space-x-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900">Your Calculated Blueprint</h2>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-500 uppercase font-semibold">Basal Metabolic Rate</span>
                    <p className="text-sm font-medium text-slate-700">Mifflin-St Jeor BMR</p>
                  </div>
                  <span className="text-xl font-extrabold text-slate-900">{preview.bmr} <span className="text-xs font-normal text-slate-500">kcal</span></span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-500 uppercase font-semibold">Daily Energy Expenditure</span>
                    <p className="text-sm font-medium text-slate-700">Maintenance TDEE</p>
                  </div>
                  <span className="text-xl font-extrabold text-slate-900">{preview.tdee} <span className="text-xs font-normal text-slate-500">kcal</span></span>
                </div>

                {/* Target Highlight */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 rounded-xl shadow-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs uppercase font-bold tracking-wider text-emerald-100">Daily Calorie Target</span>
                    <Flame className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div className="text-3xl font-black">{preview.calorie_target} <span className="text-base font-normal opacity-80">kcal / day</span></div>
                  <p className="text-xs text-emerald-100 mt-2">
                    Adjusted for your goal: <span className="font-semibold">{goal.replace('_', ' ').toUpperCase()}</span>
                  </p>
                </div>

                {/* Macro Distribution */}
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Daily Macronutrient Targets</h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <Beef className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                      <div className="text-lg font-bold text-blue-900">{preview.protein_target}g</div>
                      <span className="text-[11px] text-blue-700 font-medium">Protein</span>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <Wheat className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                      <div className="text-lg font-bold text-amber-900">{preview.carb_target}g</div>
                      <span className="text-[11px] text-amber-700 font-medium">Carbs</span>
                    </div>

                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                      <Droplet className="w-4 h-4 text-rose-600 mx-auto mb-1" />
                      <div className="text-lg font-bold text-rose-900">{preview.fat_target}g</div>
                      <span className="text-[11px] text-rose-700 font-medium">Fat</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[11px] text-slate-500 italic leading-relaxed">
                    * {preview.disclaimer}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
