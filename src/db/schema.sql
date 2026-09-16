-- ==========================================================
-- NutriTrack AI - PostgreSQL Database Schema
-- Compatible with PostgreSQL 14+ and Google Cloud SQL
-- ==========================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
    account_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'disabled')),
    profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash VARCHAR(255), -- Used for local bootstrap / fallback accounts; never stored in plaintext
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    age INTEGER NOT NULL CHECK (age > 0 AND age < 130),
    sex VARCHAR(10) NOT NULL CHECK (sex IN ('male', 'female')),
    height_cm NUMERIC(6, 2) NOT NULL CHECK (height_cm > 40 AND height_cm < 300),
    weight_kg NUMERIC(6, 2) NOT NULL CHECK (weight_kg > 20 AND weight_kg < 500),
    activity_level VARCHAR(30) NOT NULL CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active')),
    goal VARCHAR(30) NOT NULL CHECK (goal IN ('maintain_weight', 'lose_weight', 'gain_weight', 'build_muscle')),
    dietary_preference VARCHAR(30) NOT NULL DEFAULT 'no_restriction',
    food_preferences TEXT,
    foods_to_avoid TEXT,
    allergies TEXT,
    bmr NUMERIC(8, 2) NOT NULL,
    tdee NUMERIC(8, 2) NOT NULL,
    calorie_target INTEGER NOT NULL CHECK (calorie_target >= 800),
    protein_target INTEGER NOT NULL CHECK (protein_target >= 20),
    carb_target INTEGER NOT NULL CHECK (carb_target >= 20),
    fat_target INTEGER NOT NULL CHECK (fat_target >= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- 3. Food Logs Table
CREATE TABLE IF NOT EXISTS food_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_name VARCHAR(255) NOT NULL,
    serving VARCHAR(100) NOT NULL,
    calories INTEGER NOT NULL CHECK (calories >= 0),
    protein NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (protein >= 0),
    carbohydrates NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (carbohydrates >= 0),
    fat NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (fat >= 0),
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_image')),
    image_url TEXT,
    logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON food_logs(user_id, logged_at);

-- 4. Food Images Table
CREATE TABLE IF NOT EXISTS food_images (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_log_id INTEGER REFERENCES food_logs(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    ai_analyzed BOOLEAN NOT NULL DEFAULT FALSE,
    ai_analysis_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_food_images_user_id ON food_images(user_id);

-- 5. Weight Logs Table
CREATE TABLE IF NOT EXISTS weight_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight_kg NUMERIC(6, 2) NOT NULL CHECK (weight_kg > 20 AND weight_kg < 500),
    recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON weight_logs(user_id, recorded_at);

-- 6. AI Recommendations Table
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_text TEXT,
    context_json JSONB,
    response_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_id ON ai_recommendations(user_id);
