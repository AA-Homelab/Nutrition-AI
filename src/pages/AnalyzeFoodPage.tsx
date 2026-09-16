import React, { useState, useRef } from 'react';
import {
  Camera,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  X,
  Plus,
  Edit3,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { FoodAnalysisResult, MealType } from '../types.ts';

interface AnalyzeFoodPageProps {
  onFoodLogged: () => void;
}

export const AnalyzeFoodPage: React.FC<AnalyzeFoodPageProps> = ({ onFoodLogged }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable fields on result screen
  const [editableName, setEditableName] = useState('');
  const [editableServing, setEditableServing] = useState('');
  const [editableCalories, setEditableCalories] = useState<number>(0);
  const [editableProtein, setEditableProtein] = useState<number>(0);
  const [editableCarbs, setEditableCarbs] = useState<number>(0);
  const [editableFat, setEditableFat] = useState<number>(0);
  const [editableMealType, setEditableMealType] = useState<MealType>('lunch');

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file must be under 10MB.');
      return;
    }

    setSelectedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setError(null);
    setAnalysisResult(null);
    setSuccessMessage(null);
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setAnalysisResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      if (notes) formData.append('notes', notes);

      const result = await api.analyzeFoodImage(formData);
      setAnalysisResult(result);

      // Extract food name and servings from detected foods list or defaults
      const firstFood = result.foods && result.foods.length > 0 ? result.foods[0] : null;
      const combinedName = result.food_name || (result.foods ? result.foods.map((f) => f.name).join(', ') : 'Detected Meal');
      const totalCal = result.estimated_calories ?? result.total?.calories ?? (firstFood ? firstFood.calories : 0);
      const totalPro = result.estimated_protein ?? result.total?.protein_g ?? (firstFood ? firstFood.protein_g : 0);
      const totalCarb = result.estimated_carbohydrates ?? result.total?.carbs_g ?? (firstFood ? firstFood.carbs_g : 0);
      const totalFat = result.estimated_fat ?? result.total?.fat_g ?? (firstFood ? firstFood.fat_g : 0);
      const combinedServing = result.estimated_serving || (firstFood ? firstFood.serving : '1 plate');

      // Populate editable fields with AI estimates
      setEditableName(combinedName);
      setEditableServing(combinedServing);
      setEditableCalories(totalCal);
      setEditableProtein(totalPro);
      setEditableCarbs(totalCarb);
      setEditableFat(totalFat);
      setEditableMealType('lunch');
    } catch (err: any) {
      setError(err.message || 'The AI service is temporarily unavailable. Please try again later.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!editableName || editableCalories === undefined) return;
    setIsSaving(true);
    setError(null);

    try {
      await api.createFoodLog({
        food_name: editableName.trim(),
        serving: editableServing.trim(),
        calories: Math.max(0, Math.round(Number(editableCalories))),
        protein: Math.max(0, Math.round(Number(editableProtein) * 10) / 10),
        carbohydrates: Math.max(0, Math.round(Number(editableCarbs) * 10) / 10),
        fat: Math.max(0, Math.round(Number(editableFat) * 10) / 10),
        meal_type: editableMealType,
        source: 'ai_image',
        image_url: analysisResult?.image_url || undefined,
        logged_at: new Date().toISOString().split('T')[0],
      });

      setSuccessMessage(`Successfully added "${editableName}" to your food log!`);
      // Notify parent/dashboard
      onFoodLogged();
    } catch (err: any) {
      setError(err.message || 'Failed to save food entry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="analyze-food-view" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-semibold mb-3">
          <Camera className="w-3.5 h-3.5" />
          <span>Gemini Vision AI</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Analyze Food Photo
        </h1>
        <p className="mt-2 text-base text-slate-600 max-w-xl mx-auto">
          Snap a photo or upload an image of your meal. Gemini will identify foods, estimate portion sizes, and calculate calories and macronutrients for your review.
        </p>
      </div>

      {error && (
        <div id="analyze-error-banner" className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
          <div>
            <div className="font-semibold">Analysis Notice</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {successMessage && (
        <div id="analyze-success-banner" className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button
            onClick={handleClearImage}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline"
          >
            Scan Another Meal
          </button>
        </div>
      )}

      {/* Upload / Capture Stage */}
      {!analysisResult && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          {!imagePreviewUrl ? (
            <div>
              {/* Drag and Drop / Select Card */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center hover:border-teal-500 hover:bg-teal-50/20 transition-all cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 mx-auto flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">
                  Upload a photo of your meal
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                  Drag and drop your image here, or click to browse. Supports JPG, PNG, WebP up to 10MB.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                  >
                    Select File
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cameraInputRef.current?.click();
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Take Photo (Camera)</span>
                  </button>
                </div>
              </div>

              {/* Hidden Inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            /* Image Preview & Analyze Action */
            <div className="space-y-6">
              <div className="relative rounded-xl overflow-hidden bg-slate-100 max-h-96 flex items-center justify-center border border-slate-200">
                <img
                  src={imagePreviewUrl}
                  alt="Food Preview"
                  className="max-h-96 w-auto object-contain rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  disabled={isAnalyzing}
                  className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
                  title="Remove Image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Optional Notes for Gemini AI (e.g., "Homemade dressing", "Cooked in olive oil")
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2 fried eggs, sourdough bread, half avocado"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isAnalyzing}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleClearImage}
                  disabled={isAnalyzing}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Change Image
                </button>

                <button
                  type="button"
                  id="btn-run-food-analysis"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-xs flex items-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyzing your food...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Analyze Food with AI</span>
                    </>
                  )}
                </button>
              </div>

              {isAnalyzing && (
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-center space-y-2">
                  <RefreshCw className="w-6 h-6 text-teal-600 animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-teal-900">
                    Gemini Vision is inspecting your meal components...
                  </p>
                  <p className="text-xs text-teal-700">
                    Estimating portion weights, calories, and macronutrient profile.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section 10: Food Analysis Result Screen */}
      {analysisResult && (
        <div id="food-analysis-result-screen" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-600">
                AI Vision Analysis Complete
              </span>
              <h2 className="text-xl font-extrabold text-slate-900">
                Review & Edit Estimated Nutrition
              </h2>
            </div>
            <button
              onClick={handleClearImage}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Try Again / New Photo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Food Image Preview */}
            <div className="md:col-span-4">
              <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200 max-h-64 flex items-center justify-center">
                {imagePreviewUrl && (
                  <img
                    src={imagePreviewUrl}
                    alt="Analyzed meal"
                    className="w-full h-auto object-cover max-h-64"
                  />
                )}
              </div>

              {/* Detected items list with confidence */}
              <div className="mt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Detected Components
                </h4>
                <div className="space-y-1.5">
                  {(analysisResult.foods || analysisResult.detected_foods || []).map((food: any, i: number) => (
                    <div
                      key={i}
                      className="p-2 bg-slate-50 rounded-lg border border-slate-200/70 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">{food.name}</span>
                        {food.serving && (
                          <span className="text-[10px] text-slate-500 ml-1.5">({food.serving})</span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          String(food.confidence).toLowerCase() === 'high'
                            ? 'bg-emerald-100 text-emerald-800'
                            : String(food.confidence).toLowerCase() === 'medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {String(food.confidence || 'Medium')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Editable Fields Form */}
            <div className="md:col-span-8 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Food / Meal Name *
                </label>
                <input
                  type="text"
                  required
                  value={editableName}
                  onChange={(e) => setEditableName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Serving Size / Weight
                  </label>
                  <input
                    type="text"
                    value={editableServing}
                    onChange={(e) => setEditableServing(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Meal Type
                  </label>
                  <select
                    value={editableMealType}
                    onChange={(e) => setEditableMealType(e.target.value as MealType)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white"
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
                  Estimated Calories (kcal) *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editableCalories}
                  onChange={(e) => setEditableCalories(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              {/* Editable Macronutrient Distribution */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Macronutrients (g)
                </label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <span className="block text-xs font-bold text-blue-900 mb-1">Protein (g)</span>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={editableProtein}
                      onChange={(e) => setEditableProtein(Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white border border-blue-200 rounded-lg text-sm font-bold text-blue-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <span className="block text-xs font-bold text-amber-900 mb-1">Carbs (g)</span>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={editableCarbs}
                      onChange={(e) => setEditableCarbs(Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white border border-amber-200 rounded-lg text-sm font-bold text-amber-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                    <span className="block text-xs font-bold text-rose-900 mb-1">Fat (g)</span>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={editableFat}
                      onChange={(e) => setEditableFat(Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white border border-rose-200 rounded-lg text-sm font-bold text-rose-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* Explicit Mandatory Disclaimer */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-xs text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Important Notice:</strong> Nutrition values are estimates. Please review and adjust the serving size or nutrition information before saving.
                </p>
              </div>

              {/* Action Confirmation Buttons (Never auto-logs without confirmation!) */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleClearImage}
                  disabled={isSaving}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel / Try Again
                </button>

                <button
                  type="button"
                  id="btn-confirm-add-food"
                  onClick={handleConfirmAndSave}
                  disabled={isSaving || !editableName}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs flex items-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <span>Adding to Food Log...</span>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Add to Food Log</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
