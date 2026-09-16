import React, { useState, useEffect } from 'react';
import {
  Scale,
  Plus,
  TrendingDown,
  TrendingUp,
  Minus,
  Calendar,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { WeightLog } from '../types.ts';

export const WeightTrackerPage: React.FC = () => {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);

  // New weight input
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchWeightLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getWeightLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeightLogs();
  }, []);

  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weightInput) return;
    setIsSubmitting(true);

    try {
      await api.addWeightLog(Number(weightInput), dateInput);
      setWeightInput('');
      await fetchWeightLogs();
    } catch (err: any) {
      alert(err.message || 'Failed to record weight');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this weight log?')) return;
    try {
      await api.deleteWeightLog(id);
      await fetchWeightLogs();
    } catch (err: any) {
      alert(err.message || 'Failed to delete weight log');
    }
  };

  const currentWeight = logs.length > 0 ? logs[logs.length - 1].weight_kg : profile?.weight_kg || 0;
  const startingWeight = logs.length > 0 ? logs[0].weight_kg : profile?.weight_kg || 0;
  const weightChange = Math.round((currentWeight - startingWeight) * 10) / 10;

  // Render SVG Sparkline / Line Chart
  const renderChart = () => {
    if (logs.length < 2) {
      return (
        <div className="py-16 text-center text-slate-400 text-sm">
          Log at least 2 weight entries to generate your visual progress curve.
        </div>
      );
    }

    const weights = logs.map((l) => l.weight_kg);
    const minW = Math.min(...weights) - 1;
    const maxW = Math.max(...weights) + 1;
    const range = maxW - minW || 1;

    const width = 600;
    const height = 180;
    const padding = 30;

    const points = logs.map((l, i) => {
      const x = padding + (i / (logs.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((l.weight_kg - minW) / range) * (height - 2 * padding);
      return { x, y, weight: l.weight_kg, date: l.recorded_at };
    });

    const pathD = points.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
      ''
    );

    return (
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 stroke-emerald-500 fill-none">
          {/* Subtle Grid Lines */}
          <line
            x1={padding}
            y1={padding}
            x2={width - padding}
            y2={padding}
            stroke="#e2e8f0"
            strokeDasharray="4"
          />
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="#e2e8f0"
            strokeDasharray="4"
          />

          {/* Trend Line */}
          <path d={pathD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="5" className="fill-white stroke-emerald-600 stroke-2" />
              <text
                x={p.x}
                y={p.y - 10}
                textAnchor="middle"
                className="fill-slate-700 text-[10px] font-bold stroke-none"
              >
                {p.weight} kg
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div id="weight-tracker-view" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Weight Progress Tracker
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor body composition trends alongside your daily nutritional intake.
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Weight</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">
            {currentWeight} <span className="text-sm font-normal text-slate-500">kg</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Latest recorded measurement</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Starting Weight</span>
          <div className="text-3xl font-extrabold text-slate-700 mt-1">
            {startingWeight} <span className="text-sm font-normal text-slate-500">kg</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Baseline setup value</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Progress</span>
          <div className="flex items-center space-x-2 mt-1">
            <div className="text-3xl font-extrabold text-slate-900">
              {weightChange > 0 ? `+${weightChange}` : weightChange} kg
            </div>
            {weightChange < 0 ? (
              <TrendingDown className="w-6 h-6 text-emerald-600" />
            ) : weightChange > 0 ? (
              <TrendingUp className="w-6 h-6 text-amber-600" />
            ) : (
              <Minus className="w-6 h-6 text-slate-400" />
            )}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Net delta from baseline</span>
        </div>
      </div>

      {/* Trend Graph Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h2 className="text-base font-bold text-slate-900">Weight Progression Curve</h2>
          <span className="text-xs text-slate-500">Historical trend</span>
        </div>
        {renderChart()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Record New Entry Form */}
        <div className="md:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-4">Record New Weight</h3>
            <form onSubmit={handleAddWeight} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Weight (kg) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={30}
                  max={350}
                  required
                  placeholder="e.g. 74.8"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Date
                </label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs flex items-center justify-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Save Weight Measurement</span>
              </button>
            </form>
          </div>
        </div>

        {/* History Table */}
        <div className="md:col-span-7">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Recorded Weigh-Ins</h3>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading weigh-in history...</div>
            ) : logs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No weigh-ins recorded yet.</div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {[...logs].reverse().map((log) => (
                  <div key={log.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <span className="text-sm font-bold text-slate-900">{log.weight_kg} kg</span>
                      <span className="text-xs text-slate-500 ml-3">{log.recorded_at}</span>
                    </div>

                    <button
                      onClick={() => handleDelete(log.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Delete measurement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
