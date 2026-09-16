import React from 'react';
import { Flame, Beef, Wheat, Droplet } from 'lucide-react';

interface MacroProgressProps {
  calories: { target: number; consumed: number; remaining: number };
  protein: { target: number; consumed: number; remaining: number };
  carbohydrates: { target: number; consumed: number; remaining: number };
  fat: { target: number; consumed: number; remaining: number };
}

export const MacroProgress: React.FC<MacroProgressProps> = ({
  calories,
  protein,
  carbohydrates,
  fat,
}) => {
  const calPercent = Math.min(100, Math.round((calories.consumed / (calories.target || 2000)) * 100));
  const proPercent = Math.min(100, Math.round((protein.consumed / (protein.target || 140)) * 100));
  const carbPercent = Math.min(100, Math.round((carbohydrates.consumed / (carbohydrates.target || 200)) * 100));
  const fatPercent = Math.min(100, Math.round((fat.consumed / (fat.target || 65)) * 100));

  return (
    <div id="macro-progress-container" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Calories Card */}
      <div id="card-macro-calories" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Calories</span>
              <h3 className="text-xl font-bold text-slate-800">{calories.consumed} <span className="text-sm font-normal text-slate-500">/ {calories.target} kcal</span></h3>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">
            {calPercent}%
          </span>
        </div>

        <div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-2">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${calPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{calories.consumed} kcal eaten</span>
            <span className="font-medium text-emerald-700">{calories.remaining} kcal left</span>
          </div>
        </div>
      </div>

      {/* Protein Card */}
      <div id="card-macro-protein" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Beef className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Protein</span>
              <h3 className="text-xl font-bold text-slate-800">{protein.consumed} <span className="text-sm font-normal text-slate-500">/ {protein.target} g</span></h3>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-800">
            {proPercent}%
          </span>
        </div>

        <div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-2">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${proPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{protein.consumed}g eaten</span>
            <span className="font-medium text-blue-700">{protein.remaining}g left</span>
          </div>
        </div>
      </div>

      {/* Carbs Card */}
      <div id="card-macro-carbs" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wheat className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Carbohydrates</span>
              <h3 className="text-xl font-bold text-slate-800">{carbohydrates.consumed} <span className="text-sm font-normal text-slate-500">/ {carbohydrates.target} g</span></h3>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
            {carbPercent}%
          </span>
        </div>

        <div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-2">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${carbPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{carbohydrates.consumed}g eaten</span>
            <span className="font-medium text-amber-700">{carbohydrates.remaining}g left</span>
          </div>
        </div>
      </div>

      {/* Fat Card */}
      <div id="card-macro-fat" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Droplet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fat</span>
              <h3 className="text-xl font-bold text-slate-800">{fat.consumed} <span className="text-sm font-normal text-slate-500">/ {fat.target} g</span></h3>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-rose-100 text-rose-800">
            {fatPercent}%
          </span>
        </div>

        <div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-2">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${fatPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{fat.consumed}g eaten</span>
            <span className="font-medium text-rose-700">{fat.remaining}g left</span>
          </div>
        </div>
      </div>
    </div>
  );
};
