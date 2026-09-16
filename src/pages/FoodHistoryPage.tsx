import React, { useState, useEffect } from 'react';
import {
  History,
  Calendar,
  Filter,
  Trash2,
  Edit3,
  Camera,
  Download,
  Utensils,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { FoodLog } from '../types.ts';

export const FoodHistoryPage: React.FC = () => {
  const [filterRange, setFilterRange] = useState<'today' | 'yesterday' | '7days' | '30days' | 'custom'>('7days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate dates based on selected range preset
  useEffect(() => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (filterRange === 'today') {
      const todayStr = formatDate(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (filterRange === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = formatDate(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (filterRange === '7days') {
      const past = new Date(today);
      past.setDate(past.getDate() - 6);
      setStartDate(formatDate(past));
      setEndDate(formatDate(today));
    } else if (filterRange === '30days') {
      const past = new Date(today);
      past.setDate(past.getDate() - 29);
      setStartDate(formatDate(past));
      setEndDate(formatDate(today));
    }
  }, [filterRange]);

  const fetchHistory = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const data = await api.getFoodHistory(startDate, endDate);
      setLogs(data);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchHistory();
    }
  }, [startDate, endDate]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this log entry?')) return;
    try {
      await api.deleteFoodLog(id);
      await fetchHistory();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const totalCalories = logs.reduce((acc, it) => acc + it.calories, 0);
  const totalProtein = Math.round(logs.reduce((acc, it) => acc + Number(it.protein), 0) * 10) / 10;
  const totalCarbs = Math.round(logs.reduce((acc, it) => acc + Number(it.carbohydrates), 0) * 10) / 10;
  const totalFat = Math.round(logs.reduce((acc, it) => acc + Number(it.fat), 0) * 10) / 10;

  return (
    <div id="food-history-view" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Food History & Logs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review your comprehensive consumption log across past meals.
          </p>
        </div>

        {/* Filter Presets */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'custom', label: 'Custom' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setFilterRange(preset.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filterRange === preset.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Picker Range */}
      {filterRange === 'custom' && (
        <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-600 uppercase">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-600 uppercase">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>
      )}

      {/* Aggregated Nutrition Stats for filtered period */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div>
          <span className="text-xs text-slate-500 font-semibold uppercase">Total Filtered Energy</span>
          <div className="text-2xl font-extrabold text-slate-900">{totalCalories.toLocaleString()} <span className="text-xs font-normal text-slate-500">kcal</span></div>
        </div>
        <div>
          <span className="text-xs text-slate-500 font-semibold uppercase">Total Protein</span>
          <div className="text-2xl font-extrabold text-blue-700">{totalProtein}g</div>
        </div>
        <div>
          <span className="text-xs text-slate-500 font-semibold uppercase">Total Carbs</span>
          <div className="text-2xl font-extrabold text-amber-700">{totalCarbs}g</div>
        </div>
        <div>
          <span className="text-xs text-slate-500 font-semibold uppercase">Total Fat</span>
          <div className="text-2xl font-extrabold text-rose-700">{totalFat}g</div>
        </div>
      </div>

      {/* History Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Recorded Entries ({logs.length})
          </h2>
          <span className="text-xs text-slate-500">
            {startDate} to {endDate}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Loading history records...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No food records found for this timeframe.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Meal</th>
                  <th className="px-5 py-3.5">Food Item</th>
                  <th className="px-5 py-3.5">Serving</th>
                  <th className="px-5 py-3.5 text-right">Calories</th>
                  <th className="px-5 py-3.5 text-right">P / C / F (g)</th>
                  <th className="px-5 py-3.5 text-center">Source</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {item.logged_at}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {item.meal_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {item.food_name}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {item.serving}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {item.calories} <span className="text-xs font-normal text-slate-500">kcal</span>
                    </td>
                    <td className="px-5 py-3 text-right text-xs font-medium text-slate-700 whitespace-nowrap">
                      <span className="text-blue-700 font-bold">{item.protein}</span> /{' '}
                      <span className="text-amber-700 font-bold">{item.carbohydrates}</span> /{' '}
                      <span className="text-rose-700 font-bold">{item.fat}</span>
                    </td>
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      {item.source === 'ai_image' ? (
                        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                          <Camera className="w-3 h-3" />
                          <span>AI Photo</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-500 px-2 py-0.5 rounded bg-slate-100">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
