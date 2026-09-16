import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Clock,
  CheckCircle2,
  UtensilsCrossed,
  X,
  Filter,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { FoodLog, MealType } from '../types.ts';

export const FoodLogPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [foodName, setFoodName] = useState('');
  const [serving, setServing] = useState('1 serving');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit State
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getFoodHistory(selectedDate, selectedDate);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName || !calories) return;
    setIsSubmitting(true);

    try {
      if (editingLog) {
        await api.updateFoodLog(editingLog.id, {
          food_name: foodName.trim(),
          serving: serving.trim(),
          calories: Number(calories),
          protein: Number(protein) || 0,
          carbohydrates: Number(carbs) || 0,
          fat: Number(fat) || 0,
          meal_type: mealType,
        });
        setEditingLog(null);
      } else {
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
      }

      // Reset form
      setFoodName('');
      setServing('1 serving');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');

      await fetchLogs();
    } catch (err: any) {
      alert(err.message || 'Failed to save food log.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (log: FoodLog) => {
    setEditingLog(log);
    setFoodName(log.food_name);
    setServing(log.serving);
    setCalories(String(log.calories));
    setProtein(String(log.protein));
    setCarbs(String(log.carbohydrates));
    setFat(String(log.fat));
    setMealType(log.meal_type);
  };

  const handleCancelEdit = () => {
    setEditingLog(null);
    setFoodName('');
    setServing('1 serving');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this food item?')) return;
    try {
      await api.deleteFoodLog(id);
      await fetchLogs();
    } catch (err: any) {
      alert(err.message || 'Failed to delete entry.');
    }
  };

  const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  const totalDayCalories = logs.reduce((sum, item) => sum + item.calories, 0);
  const totalDayProtein = logs.reduce((sum, item) => sum + Number(item.protein), 0);
  const totalDayCarbs = logs.reduce((sum, item) => sum + Number(item.carbohydrates), 0);
  const totalDayFat = logs.reduce((sum, item) => sum + Number(item.fat), 0);

  return (
    <div id="food-log-view" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Daily Food Log
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manual food entry and detailed item breakdown for {selectedDate}.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Daily Macro Summary Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div>
          <span className="text-xs text-slate-500 font-semibold uppercase">Total Calories</span>
          <div className="text-xl font-bold text-slate-900">{totalDayCalories} <span className="text-xs font-normal text-slate-500">kcal</span></div>
        </div>
        <div>
          <span className="text-xs text-slate-500 font-semibold uppercase">Total Protein</span>
          <div className="text-xl font-bold text-blue-700">{Math.round(totalDayProtein * 10) / 10}g</div>
        </div>
        <div>
          <span className="text-xs text-slate-500 font-semibold uppercase">Total Carbs</span>
          <div className="text-xl font-bold text-amber-700">{Math.round(totalDayCarbs * 10) / 10}g</div>
        </div>
        <div>
          <span className="text-xs text-slate-500 font-semibold uppercase">Total Fat</span>
          <div className="text-xl font-bold text-rose-700">{Math.round(totalDayFat * 10) / 10}g</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Food Entry Form */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900">
                {editingLog ? 'Edit Food Entry' : 'Add Food Item'}
              </h2>
              {editingLog && (
                <button
                  onClick={handleCancelEdit}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Food Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Oatmeal with blueberries"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Serving Size
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1 cup, 150g"
                    value={serving}
                    onChange={(e) => setServing(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Meal Type
                  </label>
                  <select
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value as MealType)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
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
                  placeholder="e.g. 350"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
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
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
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
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
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
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs flex items-center justify-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{editingLog ? 'Update Food Entry' : 'Log Food Item'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right: Grouped Meals Listing */}
        <div className="lg:col-span-7 space-y-6">
          {meals.map((mType) => {
            const mealItems = logs.filter((l) => l.meal_type === mType);
            const mealCalories = mealItems.reduce((sum, item) => sum + item.calories, 0);

            return (
              <div
                key={mType}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 capitalize text-base">{mType}</span>
                    <span className="text-xs text-slate-400">({mealItems.length} items)</span>
                  </div>
                  <span className="text-sm font-extrabold text-slate-900">{mealCalories} kcal</span>
                </div>

                {mealItems.length === 0 ? (
                  <div className="py-5 text-center text-xs text-slate-400">
                    No entries logged for {mType}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mealItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100/80 transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{item.food_name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {item.serving} • {item.calories} kcal • {item.protein}g P • {item.carbohydrates}g C • {item.fat}g F
                            {item.source === 'ai_image' && (
                              <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                                AI Photo
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 rounded-lg hover:bg-white transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
