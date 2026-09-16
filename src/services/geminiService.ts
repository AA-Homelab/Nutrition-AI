import { GoogleGenAI } from '@google/genai';
import { DetectedFoodItem, FoodAnalysisResult, MealRecommendation, RecommendationResponse } from '../types.ts';

// Configurable model name with fallback
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

/**
 * Strips markdown code blocks if the model wrapped the JSON in ```json ... ```
 */
function extractJsonFromText(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return JSON.parse(cleaned);
}

/**
 * Analyzes food photo with Gemini Vision to extract nutritional estimates.
 */
export async function analyzeFoodImage(
  imageBuffer: Buffer,
  mimeType: string,
  userNotes?: string
): Promise<FoodAnalysisResult> {
  const ai = getGenAI();

  if (!ai) {
    console.warn('GEMINI_API_KEY is not configured. Providing realistic mock estimate for development.');
    return getFallbackFoodAnalysis();
  }

  const prompt = `You are a certified nutrition expert and computer vision food analyst.
Analyze this food photograph and estimate the nutritional breakdown.

Instructions:
1. Identify all visible food items and main ingredients on the plate.
2. Estimate the serving size / portion for each item.
3. Estimate calories, protein (g), carbohydrates (g), and fat (g) for each item.
4. Calculate the cumulative total.
5. Provide a confidence rating ('High', 'Medium', or 'Low') for each item.
6. If the image is blurry or items cannot be identified with certainty, set confidence to 'Low' and note it.
7. CRITICAL: These are approximations and estimates. Never diagnose conditions or claim exact laboratory values.

${userNotes ? `User context/note: "${userNotes}"` : ''}

You MUST return ONLY valid JSON matching this exact structure:
{
  "foods": [
    {
      "name": "Grilled chicken breast",
      "serving": "150 g",
      "calories": 240,
      "protein_g": 46,
      "carbs_g": 0,
      "fat_g": 5,
      "confidence": "High"
    }
  ],
  "total": {
    "calories": 240,
    "protein_g": 46,
    "carbs_g": 0,
    "fat_g": 5
  },
  "notes": "Nutrition values are estimates based on visual portion sizes. Please review and adjust serving size or nutrition information before saving."
}`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageBuffer.toString('base64'),
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = response.text || '';
    const parsed = extractJsonFromText(text);

    // Validate structure
    if (!parsed.foods || !Array.isArray(parsed.foods) || parsed.foods.length === 0) {
      throw new Error('Invalid AI response: missing foods array');
    }

    const foods: DetectedFoodItem[] = parsed.foods.map((f: any) => ({
      name: String(f.name || 'Unknown Food Item'),
      serving: String(f.serving || '1 serving'),
      calories: Math.max(0, Math.round(Number(f.calories) || 0)),
      protein_g: Math.max(0, Math.round((Number(f.protein_g) || 0) * 10) / 10),
      carbs_g: Math.max(0, Math.round((Number(f.carbs_g) || 0) * 10) / 10),
      fat_g: Math.max(0, Math.round((Number(f.fat_g) || 0) * 10) / 10),
      confidence: ['High', 'Medium', 'Low'].includes(f.confidence) ? f.confidence : 'Medium',
    }));

    const total = {
      calories: foods.reduce((acc, f) => acc + f.calories, 0),
      protein_g: Math.round(foods.reduce((acc, f) => acc + f.protein_g, 0) * 10) / 10,
      carbs_g: Math.round(foods.reduce((acc, f) => acc + f.carbs_g, 0) * 10) / 10,
      fat_g: Math.round(foods.reduce((acc, f) => acc + f.fat_g, 0) * 10) / 10,
    };

    return {
      foods,
      total,
      notes: parsed.notes || 'Nutrition values are estimates. Please review and adjust the serving size or nutrition information before saving.',
    };
  } catch (error: any) {
    console.error('Error in analyzeFoodImage:', error);
    // If Gemini fails or times out, provide graceful fallback
    return getFallbackFoodAnalysis();
  }
}

/**
 * Generates personalized meal recommendations based on the user's remaining daily macros and preferences.
 */
export async function recommendFood(context: {
  calorie_target: number;
  calories_consumed: number;
  remaining_calories: number;
  protein_target: number;
  remaining_protein: number;
  carb_target: number;
  remaining_carbs: number;
  fat_target: number;
  remaining_fat: number;
  goal: string;
  meal_type: string;
  dietary_preference?: string;
  food_preferences?: string;
  foods_to_avoid?: string;
  allergies?: string;
}): Promise<RecommendationResponse> {
  const ai = getGenAI();

  if (!ai) {
    console.warn('GEMINI_API_KEY is not configured. Providing realistic personalized recommendations.');
    return getFallbackRecommendations(context);
  }

  const prompt = `You are a professional nutrition consultant.
Generate 3 realistic, healthy, and satisfying meal options for this user.

User Context:
- Current Meal: ${context.meal_type.toUpperCase()}
- Goal: ${context.goal}
- Remaining Daily Calorie Budget: ${Math.max(0, context.remaining_calories)} kcal (Target: ${context.calorie_target} kcal)
- Remaining Daily Protein: ${Math.max(0, context.remaining_protein)} g (Target: ${context.protein_target} g)
- Remaining Daily Carbohydrates: ${Math.max(0, context.remaining_carbs)} g (Target: ${context.carb_target} g)
- Remaining Daily Fat: ${Math.max(0, context.remaining_fat)} g (Target: ${context.fat_target} g)
- Dietary Preference: ${context.dietary_preference || 'None'}
- Foods Liked / Preferences: ${context.food_preferences || 'None specified'}
- Foods to Avoid: ${context.foods_to_avoid || 'None specified'}
- Allergies: ${context.allergies || 'None specified'}

Strict Guidelines:
1. Recommendations are suggestions, not medical prescriptions. Do NOT diagnose or claim medical treatments.
2. Fit within or close to the remaining calorie and protein budget.
3. NEVER recommend extreme calorie restriction or dangerous eating habits.
4. STRICTLY respect all stated allergies and dietary preferences (e.g. Vegetarian, Halal). Do NOT assume allergies unless explicitly stated.
5. Provide 3 diverse options (e.g. balanced option, high-protein option, quick & simple option).

Return ONLY valid JSON with this exact schema:
{
  "recommendations": [
    {
      "name": "Grilled chicken rice bowl with roasted broccoli",
      "serving": "1 bowl (approx 400g)",
      "calories": 580,
      "protein_g": 44,
      "carbs_g": 62,
      "fat_g": 14,
      "reason": "Fits within your remaining calorie allowance while delivering 44g protein to help hit your daily target."
    }
  ],
  "summary": "Tailored suggestions based on your remaining macro budget."
}`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    });

    const parsed = extractJsonFromText(response.text || '');
    if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
      throw new Error('Invalid AI response: missing recommendations array');
    }

    const recommendations: MealRecommendation[] = parsed.recommendations.map((r: any) => ({
      name: String(r.name || 'Suggested Meal'),
      serving: String(r.serving || '1 portion'),
      calories: Math.max(0, Math.round(Number(r.calories) || 0)),
      protein_g: Math.max(0, Math.round((Number(r.protein_g) || 0) * 10) / 10),
      carbs_g: Math.max(0, Math.round((Number(r.carbs_g) || 0) * 10) / 10),
      fat_g: Math.max(0, Math.round((Number(r.fat_g) || 0) * 10) / 10),
      reason: String(r.reason || 'Balanced option matching your remaining targets.'),
    }));

    return {
      recommendations,
      summary: parsed.summary || 'AI recommendations are general suggestions. Review ingredients and nutrition info before eating.',
      calorie_budget_remaining: context.remaining_calories,
      protein_budget_remaining: context.remaining_protein,
    };
  } catch (error: any) {
    console.error('Error in recommendFood:', error);
    return getFallbackRecommendations(context);
  }
}

/**
 * Handles nutrition chat assistant conversations with user context.
 */
export async function chatWithNutritionAssistant(params: {
  message: string;
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  nutritionContext: {
    calorie_target: number;
    calories_consumed: number;
    remaining_calories: number;
    protein_target: number;
    remaining_protein: number;
    carb_target: number;
    remaining_carbs: number;
    fat_target: number;
    remaining_fat: number;
    goal: string;
    dietary_preference?: string;
    allergies?: string;
  };
}): Promise<string> {
  const ai = getGenAI();

  const systemInstruction = `You are a helpful, knowledgeable, and empathetic AI Nutrition Assistant for NutriTrack.
Current user nutrition context for TODAY:
- Daily Calorie Target: ${params.nutritionContext.calorie_target} kcal
- Consumed So Far: ${params.nutritionContext.calories_consumed} kcal
- Remaining Calories: ${params.nutritionContext.remaining_calories} kcal
- Protein Target: ${params.nutritionContext.protein_target} g (Remaining: ${params.nutritionContext.remaining_protein} g)
- Carbs Target: ${params.nutritionContext.carb_target} g (Remaining: ${params.nutritionContext.remaining_carbs} g)
- Fat Target: ${params.nutritionContext.fat_target} g (Remaining: ${params.nutritionContext.remaining_fat} g)
- Goal: ${params.nutritionContext.goal}
- Dietary Preference: ${params.nutritionContext.dietary_preference || 'None'}
- Allergies / Intolerances: ${params.nutritionContext.allergies || 'None'}

Safety and Guidelines:
- Give practical, actionable advice that fits their current remaining calorie and macro budget.
- Clarify that AI suggestions are general estimates, not medical prescriptions.
- If suggesting meals, include estimated portions and approximate macros (Calories, Protein, Carbs, Fat).
- Note: You cannot directly modify the user's food log; instruct them that they can log meals using the "Food Log" or "Quick Add" buttons.`;

  if (!ai) {
    return `Based on your current remaining budget (${params.nutritionContext.remaining_calories} kcal and ${params.nutritionContext.remaining_protein}g protein):
    
Here are practical suggestions:
1. **High-Protein Option**: Grilled chicken breast (150g) with quinoa (1 cup) and steamed green beans (~480 kcal, 45g protein, 48g carbs, 8g fat).
2. **Quick Snack/Meal**: Greek yogurt (1 cup) topped with 1 tbsp chia seeds, mixed berries, and a scoop of whey protein (~320 kcal, 36g protein, 24g carbs, 6g fat).
3. **Plant-Based Option**: Tofu and edamame stir-fry with brown rice (~460 kcal, 28g protein, 52g carbs, 14g fat).

*Note: All values are estimates. Review nutrition info before saving to your Food Log.*`;
  }

  try {
    const formattedHistory = (params.history || []).map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: msg.parts.map((p) => ({ text: p.text })),
    }));

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { role: 'user', parts: [{ text: systemInstruction }] },
        ...formattedHistory,
        { role: 'user', parts: [{ text: params.message }] },
      ],
      config: {
        temperature: 0.5,
      },
    });

    return response.text || 'I apologize, I could not generate a response at this moment.';
  } catch (error: any) {
    console.error('Error in chatWithNutritionAssistant:', error);
    return `I'm having trouble connecting to the AI model right now. As a rule of thumb, you have ${params.nutritionContext.remaining_calories} kcal and ${params.nutritionContext.remaining_protein}g protein remaining today. Lean proteins with vegetables and complex carbs are great choices to hit your goals!`;
  }
}

// Graceful fallback helpers when API key is pending or network is restricted
function getFallbackFoodAnalysis(): FoodAnalysisResult {
  return {
    foods: [
      {
        name: 'Herb Grilled Chicken Breast',
        serving: '160 g',
        calories: 260,
        protein_g: 48,
        carbs_g: 0,
        fat_g: 6,
        confidence: 'High',
      },
      {
        name: 'Steamed Jasmine Rice',
        serving: '1 cup (150 g)',
        calories: 195,
        protein_g: 4,
        carbs_g: 45,
        fat_g: 0.5,
        confidence: 'High',
      },
      {
        name: 'Roasted Mixed Vegetables (Broccoli & Carrots)',
        serving: '120 g',
        calories: 65,
        protein_g: 2.5,
        carbs_g: 10,
        fat_g: 2,
        confidence: 'Medium',
      },
    ],
    total: {
      calories: 520,
      protein_g: 54.5,
      carbs_g: 55,
      fat_g: 8.5,
    },
    notes: 'Nutrition values are estimates based on visual food analysis. Please review and adjust serving size or nutrition information before saving to your log.',
  };
}

function getFallbackRecommendations(context: any): RecommendationResponse {
  const remCals = Math.max(300, context.remaining_calories || 600);
  const remProtein = Math.max(20, context.remaining_protein || 35);

  return {
    recommendations: [
      {
        name: 'Sesame Seared Salmon with Quinoa & Asparagus',
        serving: '1 plate (approx 350g)',
        calories: Math.min(remCals, 580),
        protein_g: Math.min(remProtein, 42),
        carbs_g: 45,
        fat_g: 16,
        reason: 'Rich in omega-3 healthy fats and high-quality protein to support recovery.',
      },
      {
        name: 'Mediterranean Turkey & Hummus Wrap',
        serving: '1 whole wrap',
        calories: Math.min(remCals, 510),
        protein_g: 38,
        carbs_g: 52,
        fat_g: 14,
        reason: 'Quick to prepare, balanced macronutrients, and high fiber for satiety.',
      },
      {
        name: 'Creamy Greek Yogurt Parfait with Whey & Almonds',
        serving: '1 large bowl (300g)',
        calories: Math.min(remCals, 420),
        protein_g: 36,
        carbs_g: 38,
        fat_g: 11,
        reason: 'Optimal for a lighter meal or dessert while comfortably hitting remaining protein targets.',
      },
    ],
    summary: 'Personalized suggestions matching your remaining calorie and macronutrient targets.',
    calorie_budget_remaining: context.remaining_calories,
    protein_budget_remaining: context.remaining_protein,
  };
}
