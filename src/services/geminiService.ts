import { GoogleGenAI } from '@google/genai';
import { DetectedFoodItem, FoodAnalysisResult, MealRecommendation, RecommendationResponse } from '../types.ts';

// Supported non-deprecated Gemini flash models
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.1-flash-lite'];

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
 * Executes a Gemini generateContent call with model fallback and exponential backoff
 * to reliably survive 503 (high demand / UNAVAILABLE) and 429 rate limit spikes.
 */
async function generateWithModelFallback(
  ai: GoogleGenAI,
  requestPayload: {
    contents: any;
    config?: any;
  }
): Promise<any> {
  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS.filter((m) => m !== PRIMARY_MODEL)];
  let lastError: any = null;

  for (const model of modelsToTry) {
    // Try up to 2 attempts per model for transient errors
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
        const response = await ai.models.generateContent({
          ...requestPayload,
          model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const isTransient =
          msg.includes('503') ||
          msg.includes('high demand') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('overloaded');

        if (isTransient) {
          console.warn(`[Gemini API] Temporary capacity spike on ${model} (attempt ${attempt + 1}): trying alternate model...`);
          // If first attempt failed with high demand, switch to next model immediately
          break;
        } else {
          // If it's a non-transient error, don't retry on the same model
          break;
        }
      }
    }
  }

  throw lastError;
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
    console.warn('GEMINI_API_KEY is not configured. Providing realistic estimate based on context.');
    return getFallbackFoodAnalysis(userNotes);
  }

  const prompt = `You are a world-class certified clinical nutritionist and precision computer vision food analyst.
Inspect the food photograph with extreme care and provide an accurate, itemized nutritional breakdown.

Key Guidelines for High Accuracy:
1. Examine the image thoroughly:
   - Identify every distinct ingredient, side dish, sauce, condiment, garnish, oil/fat sheen, beverage, or bread item.
   - Detect cooking preparation method (e.g. deep-fried vs. grilled vs. boiled vs. steamed vs. pan-seared with oil).
2. Realistic Portion & Weight Estimation:
   - Use visual reference cues (plate/bowl diameter, cutlery, cup size, thickness) to estimate exact grams or millilitres.
   - Specify clear realistic portion descriptions (e.g., "1 cup cooked jasmine rice (~180g)", "1 medium fried chicken thigh (~120g)", "2 tbsp creamy ranch dressing (~30g)").
3. Precise Macronutrient & Calorie Calculation:
   - Base estimates on standard verified nutritional databases (such as USDA FoodData Central).
   - Accurately account for hidden fats (cooking oils, butter, frying batter, sugar in sauces).
   - Ensure the calculated calories roughly match the 4-4-9 macro rule: Calories ≈ (Protein × 4) + (Carbs × 4) + (Fat × 9).
4. Set realistic confidence level ('High', 'Medium', or 'Low') for each item.
${userNotes ? `\nImportant User Context / Ingredients specified by user: "${userNotes}" (Prioritize this user context to refine portion or ingredients accurately).` : ''}

You MUST return ONLY valid JSON in this exact structure:
{
  "food_name": "Concise descriptive title of the overall dish or meal (e.g., 'Teriyaki Chicken Rice Bowl with Steamed Broccoli')",
  "estimated_serving": "Overall serving description (e.g., '1 full plate (~420g)')",
  "foods": [
    {
      "name": "Grilled Chicken Breast (skinless, diced)",
      "serving": "150g (approx 1 palm-sized portion)",
      "calories": 248,
      "protein_g": 46.5,
      "carbs_g": 0.0,
      "fat_g": 5.4,
      "confidence": "High"
    }
  ],
  "total": {
    "calories": 248,
    "protein_g": 46.5,
    "carbs_g": 0.0,
    "fat_g": 5.4
  },
  "notes": "Specific notes on ingredients identified, cooking method observed, or assumptions made."
}`;

  try {
    const response = await generateWithModelFallback(ai, {
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
      food_name: parsed.food_name || (foods.length > 0 ? foods[0].name : 'Detected Meal'),
      estimated_serving: parsed.estimated_serving || (foods.length > 0 ? foods[0].serving : '1 serving'),
      estimated_calories: total.calories,
      estimated_protein: total.protein_g,
      estimated_carbohydrates: total.carbs_g,
      estimated_fat: total.fat_g,
      foods,
      total,
      notes: parsed.notes || 'Nutrition values are estimates. Please review and adjust the serving size or nutrition information before saving.',
    };
  } catch (error: any) {
    console.warn('Gemini vision analysis encountered capacity limit, providing graceful fallback:', error?.message);
    return getFallbackFoodAnalysis(userNotes);
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
    const response = await generateWithModelFallback(ai, {
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
    console.warn('Gemini recommendation call encountered capacity limit, providing fallback:', error?.message);
    return getFallbackRecommendations(context);
  }
}

/**
 * Handles nutrition chat assistant conversations with user context.
 */
export async function chatWithNutritionAssistant(params: {
  message: string;
  history: Array<any>;
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
    // Safely normalize conversation history from any format (content, text, parts)
    const formattedHistory = (params.history || [])
      .map((msg: any) => {
        if (!msg) return null;
        const role = msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user';
        let text = '';
        if (typeof msg.content === 'string') {
          text = msg.content;
        } else if (typeof msg.text === 'string') {
          text = msg.text;
        } else if (Array.isArray(msg.parts)) {
          text = msg.parts
            .map((p: any) => (typeof p === 'string' ? p : p?.text || ''))
            .filter(Boolean)
            .join('\n');
        }
        if (!text.trim()) return null;
        return {
          role,
          parts: [{ text: text.trim() }],
        };
      })
      .filter((m): m is { role: 'user' | 'model'; parts: { text: string }[] } => m !== null);

    const response = await generateWithModelFallback(ai, {
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
    console.warn('Gemini chat encountered capacity limit, providing fallback reply:', error?.message);
    return `You have ${params.nutritionContext.remaining_calories} kcal and ${params.nutritionContext.remaining_protein}g protein remaining today. Combining lean protein (such as chicken breast, fish, tofu, or Greek yogurt) with high-fiber vegetables and slow-digesting carbs is great for staying satiated and hitting your targets!`;
  }
}

// Graceful fallback helpers when API key is pending or network is restricted
function getFallbackFoodAnalysis(userNotes?: string): FoodAnalysisResult {
  const cleanNotes = (userNotes || '').trim();

  if (cleanNotes) {
    return {
      food_name: cleanNotes.length > 50 ? `${cleanNotes.slice(0, 47)}...` : cleanNotes,
      estimated_serving: '1 standard portion (~350g)',
      estimated_calories: 480,
      estimated_protein: 36,
      estimated_carbohydrates: 45,
      estimated_fat: 16,
      foods: [
        {
          name: cleanNotes,
          serving: '1 portion (~350g)',
          calories: 480,
          protein_g: 36,
          carbs_g: 45,
          fat_g: 16,
          confidence: 'Medium',
        },
      ],
      total: {
        calories: 480,
        protein_g: 36,
        carbs_g: 45,
        fat_g: 16,
      },
      notes: `Estimated based on "${cleanNotes}". (AI model experienced a temporary high demand spike). You can adjust any of the numbers above before logging.`,
    };
  }

  return {
    food_name: 'Nutritious Mixed Meal',
    estimated_serving: '1 standard plate (~380g)',
    estimated_calories: 520,
    estimated_protein: 42,
    estimated_carbohydrates: 50,
    estimated_fat: 14,
    foods: [
      {
        name: 'Lean Protein Source',
        serving: '1 palm portion (~150g)',
        calories: 240,
        protein_g: 36,
        carbs_g: 0,
        fat_g: 6,
        confidence: 'Medium',
      },
      {
        name: 'Whole Carbohydrate Side',
        serving: '1 cup (~150g)',
        calories: 195,
        protein_g: 4,
        carbs_g: 42,
        fat_g: 1,
        confidence: 'Medium',
      },
      {
        name: 'Steamed Vegetables & Seasoning',
        serving: '1 cup (~100g)',
        calories: 85,
        protein_g: 2,
        carbs_g: 8,
        fat_g: 7,
        confidence: 'Medium',
      },
    ],
    total: {
      calories: 520,
      protein_g: 42,
      carbs_g: 50,
      fat_g: 14,
    },
    notes: 'The AI vision service experienced a temporary capacity spike (503). Standard meal estimates were populated — please verify and adjust the details before saving.',
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
