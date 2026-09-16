import React, { useState, useEffect } from 'react';
import {
  Plus,
  Camera,
  Sparkles,
  Scale,
  Calendar,
  Utensils,
  Trash2,
  Edit2,
  ChevronRight,
  Clock,
  CheckCircle2,
  X,
  RefreshCw,
  Beef,
  Flame,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { DailyNutritionSummary, FoodLog, MealType, MealRecommendation } from '../types.ts';
import { MacroProgress } from '../components/MacroProgress.tsx';

interface DashboardPageProps {
  onNavigateTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateTab }) => {
  const { user, profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showRecommendationsModal, setShowRecommendationsModal] = useState(false);

  // Recommendations state
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<MealRecommendation[]>([]);
  const [recMealType, setRecMealType] = useState<string>('dinner');

  // Quick Add Food Form
  const [foodName, setFoodName] = useState('');
  const [serving, setServing] = useState('1 serving');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [submittingFood, setSubmittingFood] = useState(false);

  // Quick Add Weight Form
  const [newWeight, setNewWeight] = useState('');
  const [submittingWeight, setSubmittingWeight] = useState(false);

  const fetchDashboardData = async (dateStr: string) => {
    setLoading(true);
    try {
      const data = await api.getDashboard(dateStr);
      setSummary(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedDate);
  }, [selectedDate]);

  const handleQuickAddFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName || !calories) return;
    setSubmittingFood(true);

    try {
      await api.createFoodLog({
        food_name: foodName.trim(),
        serving: serving.trim(),
        calories: Number(calories),
        protein: Number(protein) || 0,
        carbohydrates: Number(carbs) || 0,
        fat: Number(fat) || 0,
        meal_type: mealType,
        source: 'manual',
        logged_at: selectedDate,
      });

      // Reset form
      setFoodName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setShowQuickAddModal(false);

      // Refresh dashboard
      await fetchDashboardData(selectedDate);
    } catch (err: any) {
      alert(err.message || 'Failed to add food log');
    } finally {
      setSubmittingFood(false);
    }
  };

  const handleQuickAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeight) return;
    setSubmittingWeight(true);

    try {
      await api.addWeightLog(Number(newWeight), selectedDate);
      setNewWeight('');
      setShowWeightModal(false);
      await fetchDashboardData(selectedDate);
    } catch (err: any) {
      alert(err.message || 'Failed to record weight');
    } finally {
      setSubmittingWeight(false);
    }
  };

  const handleDeleteFood = async (id: number) => {
    if (!confirm('Are you sure you want to delete this food entry?')) return;
    try {
      await api.deleteFoodLog(id);
      await fetchDashboardData(selectedDate);
    } catch (err: any) {
      alert(err.message || 'Failed to delete food entry');
    }
  };

  const handleOpenRecommendations = async (type: string = 'dinner') => {
    setRecMealType(type);
    setShowRecommendationsModal(true);
    setRecommendationsLoading(true);

    try {
      const res = await api.recommendFood(type);
      setRecommendations(res.recommendations || []);
    } catch (err: any) {
      alert(err.message || 'Failed to generate recommendations');
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const handleAddRecommendationToLog = async (rec: MealRecommendation) => {
    try {
      await api.createFoodLog({
        food_name: rec.name,
        serving: rec.serving,
        calories: rec.calories,
        protein: rec.protein_g,
        carbohydrates: rec.carbs_g,
        fat: rec.fat_g,
        meal_type: recMealType as MealType,
        source: 'manual',
        logged_at: selectedDate,
      });

      setShowRecommendationsModal(false);
      await fetchDashboardData(selectedDate);
      alert(`Added "${rec.name}" to your ${recMealType} log!`);
    } catch (err: any) {
      alert(err.message || 'Failed to add recommendation to log');
    }
  };

  return (
    <div id="dashboard-view" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Nutrition Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tracking goal: <span className="font-semibold text-slate-700">{profile?.goal ? profile.goal.replace('_', ' ').toUpperCase() : 'MAINTAIN WEIGHT'}</span>
          </p>
        </div>

        {/* Date Selector & Quick Actions */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <input
              type="date"
              id="dashboard-date-picker"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Primary Action Buttons Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          id="btn-quick-add-food"
          onClick={() => setShowQuickAddModal(true)}
          className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-emerald-500 hover:shadow-sm text-left transition-all group flex flex-col justify-between"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Quick Add Food</h3>
            <p className="text-xs text-slate-500">Log manual item</p>
          </div>
        </button>

        <button
          id="btn-analyze-food-photo"
          onClick={() => onNavigateTab('analyze-food')}
          className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-teal-500 hover:shadow-sm text-left transition-all group flex flex-col justify-between"
        >
          <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Analyze Food Photo</h3>
            <p className="text-xs text-slate-500">AI Plate Scanner</p>
          </div>
        </button>

        <button
          id="btn-ai-recommendations"
          onClick={() => handleOpenRecommendations('dinner')}
          className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-indigo-500 hover:shadow-sm text-left transition-all group flex flex-col justify-between"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">AI Recommendations</h3>
            <p className="text-xs text-slate-500">"What should I eat?"</p>
          </div>
        </button>

        <button
          id="btn-add-weight"
          onClick={() => setShowWeightModal(true)}
          className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-blue-500 hover:shadow-sm text-left transition-all group flex flex-col justify-between"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Add Weight</h3>
            <p className="text-xs text-slate-500">Track progress</p>
          </div>
        </button>
      </div>

      {/* TODAY Macro Target and Consumed Progress Indicators */}
      {summary && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Today's Nutrition Breakdown
            </h2>
            <span className="text-xs text-slate-400">Values are Mifflin-St Jeor estimates</span>
          </div>
          <MacroProgress
            calories={summary.calories}
            protein={summary.protein}
            carbohydrates={summary.carbohydrates}
            fat={summary.fat}
          />
        </section>
      )}

      {/* Weight Summary Banner */}
      {summary && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Weight Status</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-slate-900">
                  {summary.current_weight ? `${summary.current_weight} kg` : 'No weight logged'}
                </span>
                {summary.weight_change !== undefined && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      summary.weight_change <= 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {summary.weight_change > 0 ? `+${summary.weight_change} kg` : `${summary.weight_change} kg`} change
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigateTab('weight')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
            >
              <span>View Weight Trend Chart</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Meal Breakdown Sections (Breakfast, Lunch, Dinner, Snacks) */}
      {summary && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Today's Meals</h2>
            <button
              onClick={() => onNavigateTab('food-log')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
            >
              <span>Detailed Food Log</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((mType) => {
              const items = summary.meals[mType] || [];
              const mealCalories = items.reduce((acc, it) => acc + it.calories, 0);
              const mealProtein = items.reduce((acc, it) => acc + Number(it.protein), 0);

              return (
                <div
                  key={mType}
                  id={`meal-section-${mType}`}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-slate-800 capitalize">{mType}</span>
                      <span className="text-xs font-semibold text-slate-400">({items.length} items)</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-900">{mealCalories} kcal</span>
                      <span className="text-xs text-slate-500 ml-2">({Math.round(mealProtein)}g protein)</span>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No foods logged for {mType} today.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-sm hover:bg-slate-100/70 transition-colors"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-semibold text-slate-800 truncate">{item.food_name}</div>
                            <div className="text-xs text-slate-500">
                              {item.serving} • {item.calories} kcal • {item.protein}g P • {item.carbohydrates}g C • {item.fat}g F
                              {item.source === 'ai_image' && (
                                <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-teal-100 text-teal-800">
                                  AI Image
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteFood(item.id)}
                            title="Delete"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 mt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => {
                        setMealType(mType);
                        setShowQuickAddModal(true);
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to {mType}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Add Food Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Quick Add Food Entry</h3>
              <button
                onClick={() => setShowQuickAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddFood} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Food Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grilled Chicken Salad"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Serving Size
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1 bowl, 200g"
                    value={serving}
                    onChange={(e) => setServing(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Meal Type
                  </label>
                  <select
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value as MealType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Calories (kcal) *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  placeholder="e.g. 450"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Protein (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    placeholder="0"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Carbs (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    placeholder="0"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Fat (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    placeholder="0"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFood}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {submittingFood ? 'Saving...' : 'Add to Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Weight Modal */}
      {showWeightModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Record Today's Weight</h3>
              <button
                onClick={() => setShowWeightModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddWeight} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  min={30}
                  max={350}
                  placeholder="e.g. 75.5"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowWeightModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWeight}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {submittingWeight ? 'Saving...' : 'Save Weight'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Food Recommendations Modal */}
      {showRecommendationsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">AI Food Recommendations</h3>
              </div>
              <button
                onClick={() => setShowRecommendationsModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Remaining budget header */}
            {summary && (
              <div className="bg-indigo-50/60 border border-indigo-100 p-3.5 rounded-xl mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Remaining Budget: </span>
                  <span className="font-bold text-indigo-900">{summary.calories.remaining} kcal</span>
                  <span className="text-slate-400"> | </span>
                  <span className="font-bold text-indigo-900">{summary.protein.remaining}g protein</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-slate-500">Meal:</span>
                  <select
                    value={recMealType}
                    onChange={(e) => handleOpenRecommendations(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
              </div>
            )}

            {recommendationsLoading ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-700">
                  Asking Gemini for optimal meals based on your remaining budget...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-indigo-400 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Option {idx + 1}</span>
                        <h4 className="text-base font-bold text-slate-900">{rec.name}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-slate-900">{rec.calories} kcal</span>
                        <span className="text-xs text-slate-500 ml-1.5">({rec.serving})</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-slate-600 mb-2 font-medium">
                      <span className="text-blue-700 font-bold">{rec.protein_g}g Protein</span>
                      <span>•</span>
                      <span className="text-amber-700">{rec.carbs_g}g Carbs</span>
                      <span>•</span>
                      <span className="text-rose-700">{rec.fat_g}g Fat</span>
                    </div>

                    <p className="text-xs text-slate-600 italic mb-3">{rec.reason}</p>

                    <div className="flex justify-end">
                      <button
                        onClick={() => handleAddRecommendationToLog(rec)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center space-x-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Food Log</span>
                      </button>
                    </div>
                  </div>
                ))}

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                  <strong>Safety Note:</strong> AI recommendations are general suggestions and may contain estimation errors. Review ingredients and nutrition information before eating or logging.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
