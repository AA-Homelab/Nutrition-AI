import pg from 'pg';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User,
  Profile,
  FoodLog,
  FoodImage,
  WeightLog,
  UserRole,
  AccountStatus,
} from '../types.ts';

const { Pool } = pg;

// Check if PostgreSQL configuration is available
const isPostgresConfigured = Boolean(
  (process.env.SQL_HOST && process.env.SQL_DB_NAME) || process.env.DATABASE_URL
);

let pool: pg.Pool | null = null;

if (isPostgresConfigured) {
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 10000,
    });
  } else {
    pool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER || process.env.SQL_ADMIN_USER,
      password: process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD,
      database: process.env.SQL_DB_NAME,
      port: Number(process.env.SQL_PORT) || 5432,
      max: 10,
      connectionTimeoutMillis: 10000,
    });
  }

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL pool client:', err);
  });
}

// Local persistent store fallback path for local/development environments
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db_store.json');

interface DatabaseStore {
  users: (User & { password_hash?: string })[];
  profiles: Profile[];
  food_logs: FoodLog[];
  food_images: FoodImage[];
  weight_logs: WeightLog[];
  ai_recommendations: any[];
  nextId: {
    users: number;
    profiles: number;
    food_logs: number;
    food_images: number;
    weight_logs: number;
    ai_recommendations: number;
  };
}

let localStore: DatabaseStore = {
  users: [],
  profiles: [],
  food_logs: [],
  food_images: [],
  weight_logs: [],
  ai_recommendations: [],
  nextId: {
    users: 1,
    profiles: 1,
    food_logs: 1,
    food_images: 1,
    weight_logs: 1,
    ai_recommendations: 1,
  },
};

// Load or save local storage
function loadLocalStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      localStore = JSON.parse(data);
    } else {
      bootstrapInitialData();
      saveLocalStore();
    }
  } catch (err) {
    console.warn('Failed to load local DB file, initializing fresh store:', err);
    bootstrapInitialData();
  }
}

function saveLocalStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(localStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist local DB file:', err);
  }
}

function bootstrapInitialData(): void {
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('AdminPass123!', salt);
  const now = new Date().toISOString();

  // Initial Administrator Account
  const defaultAdmin: User & { password_hash: string } = {
    id: 1,
    firebase_uid: 'admin_bootstrap_uid',
    email: 'admin@nutritrack.app',
    display_name: 'System Administrator',
    role: 'ADMIN',
    account_status: 'active',
    profile_completed: true,
    password_hash: adminHash,
    created_at: now,
    updated_at: now,
    last_login: now,
  };

  // Demo user created by administrator
  const userHash = bcrypt.hashSync('UserPass123!', salt);
  const defaultUser: User & { password_hash: string } = {
    id: 2,
    firebase_uid: 'demo_user_uid',
    email: 'alex.fitness@example.com',
    display_name: 'Alex Miller',
    role: 'USER',
    account_status: 'active',
    profile_completed: true,
    password_hash: userHash,
    created_at: now,
    updated_at: now,
    last_login: now,
  };

  const defaultProfile: Profile = {
    id: 1,
    user_id: 2,
    age: 29,
    sex: 'male',
    height_cm: 178,
    weight_kg: 76.5,
    activity_level: 'moderately_active',
    goal: 'build_muscle',
    dietary_preference: 'no_restriction',
    food_preferences: 'Chicken, salmon, sweet potatoes, oats, berries',
    foods_to_avoid: 'Processed sugars, deep fried foods',
    allergies: 'None',
    bmr: 1730,
    tdee: 2682,
    calorie_target: 2500,
    protein_target: 160,
    carb_target: 275,
    fat_target: 78,
    created_at: now,
    updated_at: now,
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const sampleFoodLogs: FoodLog[] = [
    {
      id: 1,
      user_id: 2,
      food_name: 'Oatmeal with Blueberries and Whey',
      serving: '1 bowl (350g)',
      calories: 460,
      protein: 38,
      carbohydrates: 62,
      fat: 8,
      meal_type: 'breakfast',
      source: 'manual',
      logged_at: todayStr,
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      user_id: 2,
      food_name: 'Grilled Herb Chicken with Quinoa & Steamed Broccoli',
      serving: '1 plate (400g)',
      calories: 590,
      protein: 52,
      carbohydrates: 58,
      fat: 14,
      meal_type: 'lunch',
      source: 'ai_image',
      logged_at: todayStr,
      created_at: now,
      updated_at: now,
    },
  ];

  const sampleWeight: WeightLog[] = [
    {
      id: 1,
      user_id: 2,
      weight_kg: 78.0,
      recorded_at: new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0],
      created_at: now,
    },
    {
      id: 2,
      user_id: 2,
      weight_kg: 77.2,
      recorded_at: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
      created_at: now,
    },
    {
      id: 3,
      user_id: 2,
      weight_kg: 76.5,
      recorded_at: todayStr,
      created_at: now,
    },
  ];

  localStore.users = [defaultAdmin, defaultUser];
  localStore.profiles = [defaultProfile];
  localStore.food_logs = sampleFoodLogs;
  localStore.weight_logs = sampleWeight;
  localStore.nextId = {
    users: 3,
    profiles: 2,
    food_logs: 3,
    food_images: 1,
    weight_logs: 4,
    ai_recommendations: 1,
  };
}

// Initialize local database on boot
loadLocalStore();

export const db = {
  isPostgres(): boolean {
    return isPostgresConfigured && pool !== null;
  },

  async initSchema(): Promise<void> {
    if (!this.isPostgres()) return;
    try {
      const schemaSqlPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
      if (fs.existsSync(schemaSqlPath)) {
        const sql = fs.readFileSync(schemaSqlPath, 'utf-8');
        await pool!.query(sql);
        console.log('PostgreSQL schema initialized successfully.');
      }
    } catch (err) {
      console.error('Failed to initialize PostgreSQL schema:', err);
    }
  },

  // ================= USERS =================
  async findUserByUid(uid: string): Promise<User | null> {
    if (this.isPostgres()) {
      const res = await pool!.query('SELECT * FROM users WHERE firebase_uid = $1 LIMIT 1', [uid]);
      return res.rows[0] || null;
    }
    const found = localStore.users.find((u) => u.firebase_uid === uid);
    if (!found) return null;
    const { password_hash, ...rest } = found;
    return rest as User;
  },

  async findUserById(id: number): Promise<User | null> {
    if (this.isPostgres()) {
      const res = await pool!.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
      return res.rows[0] || null;
    }
    const found = localStore.users.find((u) => u.id === id);
    if (!found) return null;
    const { password_hash, ...rest } = found;
    return rest as User;
  },

  async findUserByEmail(email: string): Promise<(User & { password_hash?: string }) | null> {
    if (this.isPostgres()) {
      const res = await pool!.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
      return res.rows[0] || null;
    }
    return localStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  async getAllUsers(): Promise<User[]> {
    if (this.isPostgres()) {
      const res = await pool!.query(
        'SELECT id, firebase_uid, email, display_name, role, account_status, profile_completed, last_login, created_at, updated_at FROM users ORDER BY id DESC'
      );
      return res.rows;
    }
    return localStore.users.map(({ password_hash, ...rest }) => rest as User);
  },

  async createUser(data: {
    firebase_uid: string;
    email: string;
    display_name: string;
    role: UserRole;
    account_status: AccountStatus;
    password_hash?: string;
    profile_completed?: boolean;
  }): Promise<User> {
    const now = new Date().toISOString();
    if (this.isPostgres()) {
      const res = await pool!.query(
        `INSERT INTO users (firebase_uid, email, display_name, role, account_status, profile_completed, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, firebase_uid, email, display_name, role, account_status, profile_completed, created_at, updated_at`,
        [
          data.firebase_uid,
          data.email,
          data.display_name,
          data.role,
          data.account_status,
          data.profile_completed ?? false,
          data.password_hash || null,
          now,
          now,
        ]
      );
      return res.rows[0];
    }

    const newUser: User & { password_hash?: string } = {
      id: localStore.nextId.users++,
      firebase_uid: data.firebase_uid,
      email: data.email,
      display_name: data.display_name,
      role: data.role,
      account_status: data.account_status,
      profile_completed: data.profile_completed ?? false,
      password_hash: data.password_hash,
      created_at: now,
      updated_at: now,
    };

    localStore.users.push(newUser);
    saveLocalStore();
    const { password_hash, ...rest } = newUser;
    return rest as User;
  },

  async updateUser(
    id: number,
    data: Partial<User> & { password_hash?: string }
  ): Promise<User | null> {
    const now = new Date().toISOString();
    if (this.isPostgres()) {
      const fields: string[] = [];
      const values: any[] = [];
      let i = 1;

      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined && key !== 'id') {
          fields.push(`${key} = $${i}`);
          values.push(val);
          i++;
        }
      }
      fields.push(`updated_at = $${i}`);
      values.push(now);
      values.push(id);

      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${i + 1} RETURNING *`;
      const res = await pool!.query(query, values);
      return res.rows[0] || null;
    }

    const index = localStore.users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    localStore.users[index] = {
      ...localStore.users[index],
      ...data,
      updated_at: now,
    };
    saveLocalStore();
    const { password_hash, ...rest } = localStore.users[index];
    return rest as User;
  },

  async deleteUser(id: number): Promise<boolean> {
    if (this.isPostgres()) {
      const res = await pool!.query('DELETE FROM users WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    }
    const initialLen = localStore.users.length;
    localStore.users = localStore.users.filter((u) => u.id !== id);
    localStore.profiles = localStore.profiles.filter((p) => p.user_id !== id);
    localStore.food_logs = localStore.food_logs.filter((f) => f.user_id !== id);
    localStore.food_images = localStore.food_images.filter((img) => img.user_id !== id);
    localStore.weight_logs = localStore.weight_logs.filter((w) => w.user_id !== id);
    saveLocalStore();
    return localStore.users.length < initialLen;
  },

  // ================= PROFILES =================
  async getProfileByUserId(userId: number): Promise<Profile | null> {
    if (this.isPostgres()) {
      const res = await pool!.query('SELECT * FROM profiles WHERE user_id = $1 LIMIT 1', [userId]);
      return res.rows[0] || null;
    }
    return localStore.profiles.find((p) => p.user_id === userId) || null;
  },

  async upsertProfile(userId: number, profileData: Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Profile> {
    const now = new Date().toISOString();
    if (this.isPostgres()) {
      const res = await pool!.query(
        `INSERT INTO profiles (
          user_id, age, sex, height_cm, weight_kg, activity_level, goal,
          dietary_preference, food_preferences, foods_to_avoid, allergies,
          bmr, tdee, calorie_target, protein_target, carb_target, fat_target,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17,
          $18, $19
        )
        ON CONFLICT (user_id) DO UPDATE SET
          age = EXCLUDED.age,
          sex = EXCLUDED.sex,
          height_cm = EXCLUDED.height_cm,
          weight_kg = EXCLUDED.weight_kg,
          activity_level = EXCLUDED.activity_level,
          goal = EXCLUDED.goal,
          dietary_preference = EXCLUDED.dietary_preference,
          food_preferences = EXCLUDED.food_preferences,
          foods_to_avoid = EXCLUDED.foods_to_avoid,
          allergies = EXCLUDED.allergies,
          bmr = EXCLUDED.bmr,
          tdee = EXCLUDED.tdee,
          calorie_target = EXCLUDED.calorie_target,
          protein_target = EXCLUDED.protein_target,
          carb_target = EXCLUDED.carb_target,
          fat_target = EXCLUDED.fat_target,
          updated_at = EXCLUDED.updated_at
        RETURNING *`,
        [
          userId,
          profileData.age,
          profileData.sex,
          profileData.height_cm,
          profileData.weight_kg,
          profileData.activity_level,
          profileData.goal,
          profileData.dietary_preference || 'no_restriction',
          profileData.food_preferences || '',
          profileData.foods_to_avoid || '',
          profileData.allergies || '',
          profileData.bmr,
          profileData.tdee,
          profileData.calorie_target,
          profileData.protein_target,
          profileData.carb_target,
          profileData.fat_target,
          now,
          now,
        ]
      );

      // Also mark profile_completed in user table
      await pool!.query('UPDATE users SET profile_completed = TRUE WHERE id = $1', [userId]);

      return res.rows[0];
    }

    const existingIndex = localStore.profiles.findIndex((p) => p.user_id === userId);
    let profile: Profile;

    if (existingIndex >= 0) {
      profile = {
        ...localStore.profiles[existingIndex],
        ...profileData,
        updated_at: now,
      };
      localStore.profiles[existingIndex] = profile;
    } else {
      profile = {
        id: localStore.nextId.profiles++,
        user_id: userId,
        ...profileData,
        created_at: now,
        updated_at: now,
      };
      localStore.profiles.push(profile);
    }

    // Mark user profile_completed
    const user = localStore.users.find((u) => u.id === userId);
    if (user) {
      user.profile_completed = true;
      user.updated_at = now;
    }

    saveLocalStore();
    return profile;
  },

  // ================= FOOD LOGS =================
  async getFoodLogsByDate(userId: number, dateStr: string): Promise<FoodLog[]> {
    if (this.isPostgres()) {
      const res = await pool!.query(
        'SELECT * FROM food_logs WHERE user_id = $1 AND logged_at = $2 ORDER BY id ASC',
        [userId, dateStr]
      );
      return res.rows;
    }
    return localStore.food_logs.filter((f) => f.user_id === userId && f.logged_at === dateStr);
  },

  async getFoodLogsHistory(userId: number, startDate?: string, endDate?: string): Promise<FoodLog[]> {
    if (this.isPostgres()) {
      let query = 'SELECT * FROM food_logs WHERE user_id = $1';
      const params: any[] = [userId];
      if (startDate) {
        params.push(startDate);
        query += ` AND logged_at >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate);
        query += ` AND logged_at <= $${params.length}`;
      }
      query += ' ORDER BY logged_at DESC, id DESC';
      const res = await pool!.query(query, params);
      return res.rows;
    }

    return localStore.food_logs
      .filter((f) => {
        if (f.user_id !== userId) return false;
        if (startDate && f.logged_at < startDate) return false;
        if (endDate && f.logged_at > endDate) return false;
        return true;
      })
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at) || b.id - a.id);
  },

  async createFoodLog(userId: number, data: Omit<FoodLog, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<FoodLog> {
    const now = new Date().toISOString();
    if (this.isPostgres()) {
      const res = await pool!.query(
        `INSERT INTO food_logs (user_id, food_name, serving, calories, protein, carbohydrates, fat, meal_type, source, image_url, logged_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          userId,
          data.food_name,
          data.serving,
          data.calories,
          data.protein,
          data.carbohydrates,
          data.fat,
          data.meal_type,
          data.source || 'manual',
          data.image_url || null,
          data.logged_at,
          now,
          now,
        ]
      );
      return res.rows[0];
    }

    const newLog: FoodLog = {
      id: localStore.nextId.food_logs++,
      user_id: userId,
      ...data,
      created_at: now,
      updated_at: now,
    };
    localStore.food_logs.push(newLog);
    saveLocalStore();
    return newLog;
  },

  async updateFoodLog(id: number, userId: number, data: Partial<FoodLog>): Promise<FoodLog | null> {
    const now = new Date().toISOString();
    if (this.isPostgres()) {
      const fields: string[] = [];
      const values: any[] = [];
      let i = 1;

      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined && key !== 'id' && key !== 'user_id') {
          fields.push(`${key} = $${i}`);
          values.push(val);
          i++;
        }
      }
      fields.push(`updated_at = $${i}`);
      values.push(now);
      values.push(id);
      values.push(userId);

      const query = `UPDATE food_logs SET ${fields.join(', ')} WHERE id = $${i + 1} AND user_id = $${i + 2} RETURNING *`;
      const res = await pool!.query(query, values);
      return res.rows[0] || null;
    }

    const index = localStore.food_logs.findIndex((f) => f.id === id && f.user_id === userId);
    if (index === -1) return null;

    localStore.food_logs[index] = {
      ...localStore.food_logs[index],
      ...data,
      updated_at: now,
    };
    saveLocalStore();
    return localStore.food_logs[index];
  },

  async deleteFoodLog(id: number, userId: number): Promise<boolean> {
    if (this.isPostgres()) {
      const res = await pool!.query('DELETE FROM food_logs WHERE id = $1 AND user_id = $2', [id, userId]);
      return (res.rowCount ?? 0) > 0;
    }
    const initialLen = localStore.food_logs.length;
    localStore.food_logs = localStore.food_logs.filter((f) => !(f.id === id && f.user_id === userId));
    saveLocalStore();
    return localStore.food_logs.length < initialLen;
  },

  // ================= FOOD IMAGES =================
  async createFoodImage(data: Omit<FoodImage, 'id' | 'created_at'>): Promise<FoodImage> {
    const now = new Date().toISOString();
    if (this.isPostgres()) {
      const res = await pool!.query(
        `INSERT INTO food_images (user_id, food_log_id, storage_path, original_filename, mime_type, file_size, ai_analyzed, ai_analysis_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          data.user_id,
          data.food_log_id || null,
          data.storage_path,
          data.original_filename,
          data.mime_type,
          data.file_size,
          data.ai_analyzed,
          data.ai_analysis_json || null,
          now,
        ]
      );
      return res.rows[0];
    }

    const newImage: FoodImage = {
      id: localStore.nextId.food_images++,
      ...data,
      created_at: now,
    };
    localStore.food_images.push(newImage);
    saveLocalStore();
    return newImage;
  },

  // ================= WEIGHT LOGS =================
  async getWeightLogs(userId: number): Promise<WeightLog[]> {
    if (this.isPostgres()) {
      const res = await pool!.query(
        'SELECT * FROM weight_logs WHERE user_id = $1 ORDER BY recorded_at ASC, id ASC',
        [userId]
      );
      return res.rows;
    }
    return localStore.weight_logs
      .filter((w) => w.user_id === userId)
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at) || a.id - b.id);
  },

  async createWeightLog(userId: number, weight_kg: number, recorded_at: string): Promise<WeightLog> {
    const now = new Date().toISOString();
    if (this.isPostgres()) {
      const res = await pool!.query(
        `INSERT INTO weight_logs (user_id, weight_kg, recorded_at, created_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, weight_kg, recorded_at, now]
      );
      return res.rows[0];
    }

    const newLog: WeightLog = {
      id: localStore.nextId.weight_logs++,
      user_id: userId,
      weight_kg,
      recorded_at,
      created_at: now,
    };
    localStore.weight_logs.push(newLog);
    saveLocalStore();
    return newLog;
  },

  async deleteWeightLog(id: number, userId: number): Promise<boolean> {
    if (this.isPostgres()) {
      const res = await pool!.query('DELETE FROM weight_logs WHERE id = $1 AND user_id = $2', [id, userId]);
      return (res.rowCount ?? 0) > 0;
    }
    const initialLen = localStore.weight_logs.length;
    localStore.weight_logs = localStore.weight_logs.filter((w) => !(w.id === id && w.user_id === userId));
    saveLocalStore();
    return localStore.weight_logs.length < initialLen;
  },

  // ================= AI RECOMMENDATIONS LOG =================
  async logRecommendation(userId: number, requestText: string, contextJson: any, responseJson: any): Promise<void> {
    const now = new Date().toISOString();
    if (this.isPostgres()) {
      await pool!.query(
        `INSERT INTO ai_recommendations (user_id, request_text, context_json, response_json, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, requestText, JSON.stringify(contextJson), JSON.stringify(responseJson), now]
      );
      return;
    }

    localStore.ai_recommendations.push({
      id: localStore.nextId.ai_recommendations++,
      user_id: userId,
      request_text: requestText,
      context_json: contextJson,
      response_json: responseJson,
      created_at: now,
    });
    saveLocalStore();
  },
};
