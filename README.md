# Motor Metal Cost Calculator

A full-stack web app for calculating material costs for motor manufacturing. Supports 8 metals with live pricing (via Yahoo Finance) and manual prices, dimensions in cm/mm/inches, overhead percentage, and calculation history.

---

## Architecture

```
frontend/   Next.js 14 + Tailwind CSS + Supabase JS
backend/    Python Flask + APScheduler + yfinance
supabase/   PostgreSQL via Supabase (schema.sql to bootstrap)
```

**Deployment:** Frontend → Vercel · Backend → Railway/Render

---

## Quick Start

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste & run `supabase/schema.sql`
3. Copy **Project URL**, **anon key**, and **service role key** from Settings → API

### 2. Backend (Flask)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, ALLOWED_ORIGINS

python app.py
# → http://localhost:5000
# → Price update job runs immediately and every 60 minutes
```

### 3. Frontend (Next.js)

```bash
cd frontend
npm install

cp .env.example .env.local
# Fill in:
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# FLASK_API_URL=http://localhost:5000

npm run dev
# → http://localhost:3000
```

---

## Deployment

### Backend → Railway

1. Push `backend/` to a GitHub repo
2. Create new Railway project → Deploy from repo
3. Set env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ALLOWED_ORIGINS`
4. Railway auto-detects `Procfile` and runs Gunicorn
5. Copy the Railway public URL

### Frontend → Vercel

1. Push `frontend/` to a GitHub repo (or the whole monorepo)
2. Import to [vercel.com](https://vercel.com)
3. Set env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `FLASK_API_URL` = your Railway URL

---

## Features

| Feature | Detail |
|---|---|
| Metal selector | 8 defaults + custom metals |
| Dimensions | L × B × H with cm / mm / inch toggle |
| Live prices | Copper, Aluminium, Nickel, Zinc via yfinance every 60 min |
| Manual prices | Steel ₹55/kg · Stainless ₹85/kg · Cast Iron ₹40/kg · Brass ₹350/kg |
| Weight formula | `(L_cm × B_cm × H_cm × density) / 1000` kg |
| Overhead slider | 0–50%, default 10% |
| Final total | Material cost + overhead in large bold display |
| Copy to clipboard | Formatted cost breakdown text |
| Calculation history | Last 10 saved calculations with expandable detail |
| Settings page | Default overhead % and currency (INR/USD/EUR) |
| Currency conversion | Live USD→INR via frankfurter.app |
| Last updated stamp | Shows when prices were last fetched |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/prices` | All metal prices (INR/kg) |
| GET | `/api/metals` | All metals incl. custom |
| POST | `/api/calculate` | Calculate + save breakdown |
| POST | `/api/metals/custom` | Add custom metal |
| GET | `/api/history` | Last 10 calculations |
| GET/POST | `/api/settings` | Read/write default settings |

## Metal Reference

| Metal | Density (g/cm³) | Price Source |
|---|---|---|
| Copper | 8.96 | yfinance HG=F (USD/lb → INR/kg) |
| Aluminium | 2.70 | yfinance ALU=F (USD/tonne → INR/kg) |
| Steel | 7.85 | Manual default ₹55/kg |
| Stainless Steel | 7.75 | Manual default ₹85/kg |
| Cast Iron | 7.20 | Manual default ₹40/kg |
| Brass | 8.73 | Manual default ₹350/kg |
| Nickel | 8.91 | yfinance NI=F (USD/tonne → INR/kg) |
| Zinc | 7.14 | yfinance ZB=F (USD/tonne → INR/kg) |
