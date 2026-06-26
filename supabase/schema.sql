-- Motor Metal Cost Calculator — Supabase Schema
-- Run this in your Supabase SQL editor

-- 1. metal_prices
CREATE TABLE IF NOT EXISTS metal_prices (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metal_name  TEXT UNIQUE NOT NULL,
  price       DECIMAL(12, 4) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'INR',
  yfinance_symbol TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. custom_metals
CREATE TABLE IF NOT EXISTS custom_metals (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metal_name  TEXT UNIQUE NOT NULL,
  density     DECIMAL(8, 4) NOT NULL,
  price       DECIMAL(12, 4) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'INR',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. calculations
CREATE TABLE IF NOT EXISTS calculations (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metal_breakdown     JSONB NOT NULL,
  total_material_cost DECIMAL(14, 2) NOT NULL,
  overhead_percent    DECIMAL(5, 2) NOT NULL DEFAULT 10,
  overhead_amount     DECIMAL(14, 2) NOT NULL,
  final_cost          DECIMAL(14, 2) NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'INR',
  calculated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 4. settings
CREATE TABLE IF NOT EXISTS settings (
  id    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key   TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL
);

-- RLS: allow anon read, service-role write
ALTER TABLE metal_prices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_metals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read metal_prices"   ON metal_prices   FOR SELECT USING (true);
CREATE POLICY "public read custom_metals"  ON custom_metals  FOR SELECT USING (true);
CREATE POLICY "public read calculations"   ON calculations   FOR SELECT USING (true);
CREATE POLICY "public read settings"       ON settings       FOR SELECT USING (true);

CREATE POLICY "service write metal_prices"  ON metal_prices  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service write custom_metals" ON custom_metals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service write calculations"  ON calculations  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service write settings"      ON settings      FOR ALL USING (auth.role() = 'service_role');

-- Seed default prices (INR/kg)
INSERT INTO metal_prices (metal_name, price, currency, yfinance_symbol) VALUES
  ('copper',          800.00, 'INR', 'HG=F'),
  ('aluminium',       220.00, 'INR', 'ALI=F'),
  ('steel',            55.00, 'INR', NULL),
  ('stainless_steel',  85.00, 'INR', NULL),
  ('cast_iron',        40.00, 'INR', NULL),
  ('brass',           350.00, 'INR', NULL),
  ('nickel',         1200.00, 'INR', 'NI=F'),
  ('zinc',            250.00, 'INR', 'ZNC=F')
ON CONFLICT (metal_name) DO UPDATE SET
  price          = EXCLUDED.price,
  currency       = EXCLUDED.currency,
  yfinance_symbol = EXCLUDED.yfinance_symbol;

-- Seed default settings
INSERT INTO settings (key, value) VALUES
  ('default_overhead_percent', '10'),
  ('default_currency', 'INR')
ON CONFLICT (key) DO NOTHING;

-- Index for fast history queries
CREATE INDEX IF NOT EXISTS idx_calculations_at ON calculations (calculated_at DESC);
