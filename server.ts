import express from 'express';
import path from 'path';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';

import { db } from './src/db/index.ts';
import {
  requireAuth,
  requireAdmin,
  optionalAuth,
  generateToken,
  AuthenticatedRequest,
} from './src/middleware/auth.ts';
import {
  calculateNutritionTargets,
  CalculationInput,
} from './src/services/nutritionCalculator.ts';
import {
  analyzeFoodImage,
  recommendFood,
  chatWithNutritionAssistant,
} from './src/services/geminiService.ts';
import {
  saveUserFoodImage,
  resolveUserImagePath,
  deleteUserImage,
} from './src/services/imageStorage.ts';
import {
  UserRole,
  DailyNutritionSummary,
  AdminStats,
} from './src/types.ts';

// Multer memory storage for in-memory buffer processing (Gemini & local disk storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max buffer
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global middleware with full cross-origin support for GitHub Pages and web clients
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Initialize DB schema if in PostgreSQL mode
  await db.initSchema();

  // =========================================================================
  // PUBLIC & INFRASTRUCTURE ROUTES
  // =========================================================================
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      database: db.isPostgres() ? 'PostgreSQL (Cloud SQL)' : 'Embedded Relational Engine',
      gemini_configured: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // =========================================================================
  // AUTHENTICATION & BOOTSTRAP ROUTES (No Public Self-Registration!)
  // =========================================================================

  // Check if system has an admin or needs bootstrap
  app.get('/api/auth/bootstrap-status', async (req, res) => {
    try {
      const users = await db.getAllUsers();
      const hasAdmin = users.some((u) => u.role === 'ADMIN');
      res.json({ needsBootstrap: !hasAdmin });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Initial Admin Bootstrap (only allowed when no admin exists)
  app.post('/api/auth/bootstrap', async (req, res) => {
    try {
      const users = await db.getAllUsers();
      const hasAdmin = users.some((u) => u.role === 'ADMIN');
      if (hasAdmin) {
        res.status(400).json({ error: 'System administrator already exists. Public signup is forbidden.' });
        return;
      }

      const { email, display_name, password } = req.body;
      if (!email || !password || !display_name) {
        res.status(400).json({ error: 'Email, display name, and password are required.' });
        return;
      }

      const salt = bcrypt.genSaltSync(10);
      const password_hash = bcrypt.hashSync(password, salt);

      const newAdmin = await db.createUser({
        firebase_uid: `admin_${Date.now()}`,
        email,
        display_name,
        role: 'ADMIN',
        account_status: 'active',
        password_hash,
        profile_completed: true,
      });

      const token = generateToken(newAdmin);
      res.json({ user: newAdmin, token, message: 'Administrator initialized successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // User Login (Email + Password)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password, firebase_token } = req.body;

      if (!email && !firebase_token) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const user = await db.findUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      if (user.account_status === 'disabled') {
        res.status(403).json({ error: 'Your account has been disabled. Please contact the administrator.' });
        return;
      }

      // Check password if provided
      if (password && user.password_hash) {
        const isMatch = bcrypt.compareSync(password, user.password_hash);
        if (!isMatch) {
          res.status(401).json({ error: 'Invalid email or password.' });
          return;
        }
      }

      // Update last login
      await db.updateUser(user.id, { last_login: new Date().toISOString() });

      const token = generateToken(user);
      const { password_hash, ...safeUser } = user;

      res.json({
        user: safeUser,
        token,
        profile_completed: user.profile_completed,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Failed to process login.' });
    }
  });

  // Current authenticated user session
  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const profile = await db.getProfileByUserId(user.id);
      res.json({ user, profile });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // USER PROFILE & NUTRITION TARGETS
  // =========================================================================
  app.get('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const profile = await db.getProfileByUserId(req.user!.id);
      res.json(profile || null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Calculate and preview targets without saving (useful for setup wizard preview)
  app.post('/api/profile/calculate-preview', (req, res) => {
    try {
      const input: CalculationInput = req.body;
      if (!input.age || !input.height_cm || !input.weight_kg || !input.sex || !input.activity_level || !input.goal) {
        res.status(400).json({ error: 'All calculation fields are required.' });
        return;
      }
      const calculated = calculateNutritionTargets(input);
      res.json(calculated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Save / Complete Profile
  app.post('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const {
        age,
        sex,
        height_cm,
        weight_kg,
        activity_level,
        goal,
        dietary_preference,
        food_preferences,
        foods_to_avoid,
        allergies,
      } = req.body;

      if (!age || !sex || !height_cm || !weight_kg || !activity_level || !goal) {
        res.status(400).json({ error: 'Missing required profile fields.' });
        return;
      }

      // Calculate BMR, TDEE, Calorie Target, Macros via Mifflin-St Jeor backend logic
      const calculated = calculateNutritionTargets({
        age: Number(age),
        sex,
        height_cm: Number(height_cm),
        weight_kg: Number(weight_kg),
        activity_level,
        goal,
      });

      const profile = await db.upsertProfile(userId, {
        age: Number(age),
        sex,
        height_cm: Number(height_cm),
        weight_kg: Number(weight_kg),
        activity_level,
        goal,
        dietary_preference: dietary_preference || 'no_restriction',
        food_preferences: food_preferences || '',
        foods_to_avoid: foods_to_avoid || '',
        allergies: allergies || '',
        bmr: calculated.bmr,
        tdee: calculated.tdee,
        calorie_target: calculated.calorie_target,
        protein_target: calculated.protein_target,
        carb_target: calculated.carb_target,
        fat_target: calculated.fat_target,
      });

      // Record initial weight log
      const todayStr = new Date().toISOString().split('T')[0];
      await db.createWeightLog(userId, Number(weight_kg), todayStr);

      res.json({ profile, message: 'Profile completed successfully.' });
    } catch (err: any) {
      console.error('Profile creation error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const {
        age,
        sex,
        height_cm,
        weight_kg,
        activity_level,
        goal,
        dietary_preference,
        food_preferences,
        foods_to_avoid,
        allergies,
      } = req.body;

      const calculated = calculateNutritionTargets({
        age: Number(age),
        sex,
        height_cm: Number(height_cm),
        weight_kg: Number(weight_kg),
        activity_level,
        goal,
      });

      const profile = await db.upsertProfile(userId, {
        age: Number(age),
        sex,
        height_cm: Number(height_cm),
        weight_kg: Number(weight_kg),
        activity_level,
        goal,
        dietary_preference: dietary_preference || 'no_restriction',
        food_preferences: food_preferences || '',
        foods_to_avoid: foods_to_avoid || '',
        allergies: allergies || '',
        bmr: calculated.bmr,
        tdee: calculated.tdee,
        calorie_target: calculated.calorie_target,
        protein_target: calculated.protein_target,
        carb_target: calculated.carb_target,
        fat_target: calculated.fat_target,
      });

      res.json({ profile, message: 'Profile updated and nutrition targets recalculated.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // DASHBOARD SUMMARY
  // =========================================================================
  app.get('/api/dashboard', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

      // Get profile for targets
      const profile = await db.getProfileByUserId(userId);
      const calorieTarget = profile ? profile.calorie_target : 2000;
      const proteinTarget = profile ? profile.protein_target : 140;
      const carbTarget = profile ? profile.carb_target : 220;
      const fatTarget = profile ? profile.fat_target : 65;

      // Get today's food logs
      const foodLogs = await db.getFoodLogsByDate(userId, dateStr);

      // Compute consumed macros
      let consumedCalories = 0;
      let consumedProtein = 0;
      let consumedCarbs = 0;
      let consumedFat = 0;

      const meals = {
        breakfast: [] as typeof foodLogs,
        lunch: [] as typeof foodLogs,
        dinner: [] as typeof foodLogs,
        snack: [] as typeof foodLogs,
      };

      for (const item of foodLogs) {
        consumedCalories += Number(item.calories) || 0;
        consumedProtein += Number(item.protein) || 0;
        consumedCarbs += Number(item.carbohydrates) || 0;
        consumedFat += Number(item.fat) || 0;

        if (item.meal_type in meals) {
          meals[item.meal_type].push(item);
        } else {
          meals.snack.push(item);
        }
      }

      // Weight stats
      const weightLogs = await db.getWeightLogs(userId);
      const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight_kg : profile?.weight_kg;
      const startingWeight = weightLogs.length > 0 ? weightLogs[0].weight_kg : profile?.weight_kg;
      const weightChange = currentWeight && startingWeight ? Math.round((currentWeight - startingWeight) * 10) / 10 : 0;

      const summary: DailyNutritionSummary = {
        date: dateStr,
        calories: {
          target: calorieTarget,
          consumed: Math.round(consumedCalories),
          remaining: Math.max(0, Math.round(calorieTarget - consumedCalories)),
        },
        protein: {
          target: proteinTarget,
          consumed: Math.round(consumedProtein * 10) / 10,
          remaining: Math.max(0, Math.round((proteinTarget - consumedProtein) * 10) / 10),
        },
        carbohydrates: {
          target: carbTarget,
          consumed: Math.round(consumedCarbs * 10) / 10,
          remaining: Math.max(0, Math.round((carbTarget - consumedCarbs) * 10) / 10),
        },
        fat: {
          target: fatTarget,
          consumed: Math.round(consumedFat * 10) / 10,
          remaining: Math.max(0, Math.round((fatTarget - consumedFat) * 10) / 10),
        },
        meals,
        current_weight: currentWeight,
        weight_change: weightChange,
      };

      res.json(summary);
    } catch (err: any) {
      console.error('Dashboard error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // FOOD LOGGING (MANUAL & HISTORY)
  // =========================================================================
  app.get('/api/food', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { start_date, end_date } = req.query as { start_date?: string; end_date?: string };
      const logs = await db.getFoodLogsHistory(userId, start_date, end_date);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/food', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const {
        food_name,
        serving,
        calories,
        protein,
        carbohydrates,
        fat,
        meal_type,
        source,
        image_url,
        logged_at,
      } = req.body;

      if (!food_name || calories === undefined || !meal_type) {
        res.status(400).json({ error: 'Food name, calories, and meal type are required.' });
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const newLog = await db.createFoodLog(userId, {
        food_name: String(food_name).trim(),
        serving: String(serving || '1 serving').trim(),
        calories: Math.max(0, Math.round(Number(calories))),
        protein: Math.max(0, Math.round((Number(protein) || 0) * 10) / 10),
        carbohydrates: Math.max(0, Math.round((Number(carbohydrates) || 0) * 10) / 10),
        fat: Math.max(0, Math.round((Number(fat) || 0) * 10) / 10),
        meal_type,
        source: source === 'ai_image' ? 'ai_image' : 'manual',
        image_url: image_url || null,
        logged_at: logged_at || today,
      });

      res.status(201).json(newLog);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/food/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = Number(req.params.id);
      const userId = req.user!.id;
      const updated = await db.updateFoodLog(id, userId, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Food log not found or unauthorized.' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/food/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = Number(req.params.id);
      const userId = req.user!.id;
      const success = await db.deleteFoodLog(id, userId);
      if (!success) {
        res.status(404).json({ error: 'Food log not found or unauthorized.' });
        return;
      }
      res.json({ success: true, message: 'Food log deleted.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // WEIGHT LOGGING
  // =========================================================================
  app.get('/api/weight', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const logs = await db.getWeightLogs(req.user!.id);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/weight', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { weight_kg, recorded_at } = req.body;
      if (!weight_kg || Number(weight_kg) <= 0) {
        res.status(400).json({ error: 'Valid weight in kg is required.' });
        return;
      }
      const date = recorded_at || new Date().toISOString().split('T')[0];
      const log = await db.createWeightLog(userId, Number(weight_kg), date);
      res.status(201).json(log);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/weight/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = Number(req.params.id);
      const userId = req.user!.id;
      const success = await db.deleteWeightLog(id, userId);
      if (!success) {
        res.status(404).json({ error: 'Weight log not found or unauthorized.' });
        return;
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // IMAGE UPLOAD & SECURE STORAGE
  // =========================================================================
  app.post(
    '/api/food-images',
    requireAuth,
    upload.single('image'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const file = req.file;
        if (!file) {
          res.status(400).json({ error: 'No image file uploaded.' });
          return;
        }

        const userId = req.user!.id;
        const savedMeta = await saveUserFoodImage(userId, file);

        const record = await db.createFoodImage({
          user_id: userId,
          storage_path: savedMeta.storage_path,
          original_filename: savedMeta.original_filename,
          mime_type: savedMeta.mime_type,
          file_size: savedMeta.file_size,
          ai_analyzed: false,
        });

        res.status(201).json({
          id: record.id,
          storage_path: savedMeta.storage_path,
          url: `/api/food-images/${encodeURIComponent(savedMeta.storage_path)}`,
          original_filename: savedMeta.original_filename,
        });
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    }
  );

  // Authenticated Image Serving - strictly prevents accessing other users' files
  app.get('/api/food-images/:storagePath(*)', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const storagePath = req.params.storagePath;
      const fullPath = resolveUserImagePath(userId, storagePath);
      res.sendFile(fullPath);
    } catch (err: any) {
      res.status(403).json({ error: 'Unauthorized or image not found.' });
    }
  });

  // =========================================================================
  // AI ENDPOINTS (GEMINI API)
  // =========================================================================

  // 1. Analyze Food Image
  app.post(
    '/api/ai/analyze-food',
    optionalAuth,
    upload.single('image'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const file = req.file;
        if (!file) {
          res.status(400).json({ error: 'Please provide a food image to analyze.' });
          return;
        }

        const userId = req.user?.id || 1;
        // 1. Save image safely in user folder if possible
        let savedMeta = {
          storage_path: '',
          original_filename: file.originalname,
          mime_type: file.mimetype,
          file_size: file.size,
        };
        try {
          savedMeta = await saveUserFoodImage(userId, file);
        } catch {
          // Non-blocking if storage directory is restricted
        }

        // 2. Pass buffer directly to Gemini Vision service
        const analysis = await analyzeFoodImage(
          file.buffer,
          file.mimetype,
          req.body.notes
        );

        // 3. Log image record if storage path available
        try {
          if (savedMeta.storage_path) {
            await db.createFoodImage({
              user_id: userId,
              storage_path: savedMeta.storage_path,
              original_filename: savedMeta.original_filename,
              mime_type: savedMeta.mime_type,
              file_size: savedMeta.file_size,
              ai_analyzed: true,
              ai_analysis_json: JSON.stringify(analysis),
            });
          }
        } catch {}

        res.json({
          ...analysis,
          image_path: savedMeta.storage_path || '',
          image_url: savedMeta.storage_path ? `/api/food-images/${encodeURIComponent(savedMeta.storage_path)}` : '',
        });
      } catch (err: any) {
        console.error('AI food analysis error:', err);
        res.status(500).json({
          error: 'The AI service is temporarily unavailable. Please try again later.',
          details: err.message,
        });
      }
    }
  );

  // 2. Recommend Food ("Recommend What I Should Eat")
  app.post('/api/ai/recommend-food', optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || 1;
      let profile = null;
      let todayLogs: any[] = [];
      try {
        profile = await db.getProfileByUserId(userId);
        const today = new Date().toISOString().split('T')[0];
        todayLogs = await db.getFoodLogsByDate(userId, today);
      } catch {}

      const targetCalories = profile ? profile.calorie_target : 2000;
      const targetProtein = profile ? profile.protein_target : 140;
      const targetCarbs = profile ? profile.carb_target : 220;
      const targetFat = profile ? profile.fat_target : 65;

      const consumedCalories = todayLogs.reduce((acc, f) => acc + f.calories, 0);
      const consumedProtein = todayLogs.reduce((acc, f) => acc + Number(f.protein), 0);
      const consumedCarbs = todayLogs.reduce((acc, f) => acc + Number(f.carbohydrates), 0);
      const consumedFat = todayLogs.reduce((acc, f) => acc + Number(f.fat), 0);

      const mealType = (req.body.meal_type || 'dinner').toLowerCase();

      const context = {
        calorie_target: targetCalories,
        calories_consumed: Math.round(consumedCalories),
        remaining_calories: Math.max(0, Math.round(targetCalories - consumedCalories)),
        protein_target: targetProtein,
        remaining_protein: Math.max(0, Math.round((targetProtein - consumedProtein) * 10) / 10),
        carb_target: targetCarbs,
        remaining_carbs: Math.max(0, Math.round((targetCarbs - consumedCarbs) * 10) / 10),
        fat_target: targetFat,
        remaining_fat: Math.max(0, Math.round((targetFat - consumedFat) * 10) / 10),
        goal: profile ? profile.goal : 'maintain_weight',
        meal_type: mealType,
        dietary_preference: profile?.dietary_preference,
        food_preferences: profile?.food_preferences,
        foods_to_avoid: profile?.foods_to_avoid,
        allergies: profile?.allergies,
      };

      const result = await recommendFood(context);

      // Log AI recommendation request
      try {
        await db.logRecommendation(userId, `Recommend for ${mealType}`, context, result);
      } catch {}

      res.json(result);
    } catch (err: any) {
      console.error('AI food recommendation error:', err);
      res.status(500).json({ error: 'Failed to generate recommendations. Please try again later.' });
    }
  });

  // 3. AI Assistant Chat
  app.post('/api/ai/chat', optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || 1;
      const { message, history, nutritionContext: clientContext } = req.body;
      if (!message) {
        res.status(400).json({ error: 'Message is required.' });
        return;
      }

      let nutritionContext = clientContext;
      if (!nutritionContext) {
        let profile = null;
        let todayLogs: any[] = [];
        try {
          profile = await db.getProfileByUserId(userId);
          const today = new Date().toISOString().split('T')[0];
          todayLogs = await db.getFoodLogsByDate(userId, today);
        } catch {}

        const targetCalories = profile ? profile.calorie_target : 2000;
        const targetProtein = profile ? profile.protein_target : 140;
        const targetCarbs = profile ? profile.carb_target : 220;
        const targetFat = profile ? profile.fat_target : 65;

        const consumedCalories = todayLogs.reduce((acc, f) => acc + f.calories, 0);
        const consumedProtein = todayLogs.reduce((acc, f) => acc + Number(f.protein), 0);
        const consumedCarbs = todayLogs.reduce((acc, f) => acc + Number(f.carbohydrates), 0);
        const consumedFat = todayLogs.reduce((acc, f) => acc + Number(f.fat), 0);

        nutritionContext = {
          calorie_target: targetCalories,
          calories_consumed: Math.round(consumedCalories),
          remaining_calories: Math.max(0, Math.round(targetCalories - consumedCalories)),
          protein_target: targetProtein,
          remaining_protein: Math.max(0, Math.round(targetProtein - consumedProtein)),
          carb_target: targetCarbs,
          remaining_carbs: Math.max(0, Math.round(targetCarbs - consumedCarbs)),
          fat_target: targetFat,
          remaining_fat: Math.max(0, Math.round(targetFat - consumedFat)),
          goal: profile ? profile.goal : 'maintain_weight',
          dietary_preference: profile?.dietary_preference,
          allergies: profile?.allergies,
        };
      }

      const reply = await chatWithNutritionAssistant({
        message,
        history: history || [],
        nutritionContext,
      });

      res.json({
        reply,
        nutritionContext,
      });
    } catch (err: any) {
      console.error('AI chat error:', err);
      res.status(500).json({ error: 'Failed to process AI chat message.' });
    }
  });

  // =========================================================================
  // ADMIN DASHBOARD & USER MANAGEMENT (Strictly ADMIN Role Required)
  // =========================================================================
  app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await db.getAllUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await db.getAllUsers();
      const stats: AdminStats = {
        total_users: users.length,
        active_users: users.filter((u) => u.account_status === 'active').length,
        disabled_users: users.filter((u) => u.account_status === 'disabled').length,
        profiles_completed: users.filter((u) => u.profile_completed).length,
        profiles_pending: users.filter((u) => !u.profile_completed).length,
      };
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin creates new user account (Section 3: Only administrator can create accounts)
  app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { display_name, email, temporary_password, role, account_status } = req.body;

      if (!display_name || !email || !temporary_password) {
        res.status(400).json({ error: 'Full name, email, and temporary password are required.' });
        return;
      }

      const existing = await db.findUserByEmail(email);
      if (existing) {
        res.status(400).json({ error: 'A user with this email address already exists.' });
        return;
      }

      const salt = bcrypt.genSaltSync(10);
      const password_hash = bcrypt.hashSync(temporary_password, salt);
      const targetRole: UserRole = role === 'ADMIN' ? 'ADMIN' : 'USER';
      const status = account_status === 'disabled' ? 'disabled' : 'active';

      const newUser = await db.createUser({
        firebase_uid: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        email,
        display_name,
        role: targetRole,
        account_status: status,
        password_hash,
        profile_completed: false,
      });

      res.status(201).json({
        user: newUser,
        message: `Account created for ${display_name}. Provide temporary password to the user.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin edits user
  app.put('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { display_name, email, role, account_status } = req.body;

      const updated = await db.updateUser(id, {
        display_name,
        email,
        role,
        account_status,
      });

      if (!updated) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin enables user
  app.post('/api/admin/users/:id/enable', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const updated = await db.updateUser(id, { account_status: 'active' });
      if (!updated) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      res.json({ success: true, user: updated, message: 'Account enabled.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin disables user
  app.post('/api/admin/users/:id/disable', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const updated = await db.updateUser(id, { account_status: 'disabled' });
      if (!updated) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      res.json({ success: true, user: updated, message: 'Account disabled.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin resets password
  app.post('/api/admin/users/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { new_password } = req.body;
      if (!new_password || new_password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters.' });
        return;
      }

      const salt = bcrypt.genSaltSync(10);
      const password_hash = bcrypt.hashSync(new_password, salt);

      const updated = await db.updateUser(id, { password_hash });
      if (!updated) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      res.json({ success: true, message: 'User password reset successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin deletes user
  app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (req.user!.id === id) {
        res.status(400).json({ error: 'Administrators cannot delete their own active account.' });
        return;
      }

      const success = await db.deleteUser(id);
      if (!success) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      res.json({ success: true, message: 'User deleted permanently.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // VITE DEV MIDDLEWARE & PRODUCTION STATIC HANDLER
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NutriTrack AI backend & frontend server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
