CREATE TABLE IF NOT EXISTS farmers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  phone TEXT,
  farm_size NUMERIC,
  primary_crops TEXT[],
  language_preference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soil_analyses (
  id SERIAL PRIMARY KEY,
  farmer_id INTEGER REFERENCES farmers(id) ON DELETE SET NULL,
  image_url TEXT,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disease_detections (
  id SERIAL PRIMARY KEY,
  farmer_id INTEGER REFERENCES farmers(id) ON DELETE SET NULL,
  image_url TEXT,
  crop_type TEXT,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id SERIAL PRIMARY KEY,
  farmer_id INTEGER REFERENCES farmers(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  messages_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

