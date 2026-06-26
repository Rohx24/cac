import os
import logging
import atexit
from datetime import datetime, timezone
from flask import Flask, jsonify, request
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from supabase import create_client, Client
import yfinance as yf
import requests as http
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins=os.getenv("ALLOWED_ORIGINS", "*").split(","))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ─── Metal catalogue ──────────────────────────────────────────────────────────

DEFAULT_METALS = [
    {
        "name": "copper",
        "display_name": "Copper",
        "density": 8.96,
        "yfinance_symbol": "HG=F",
        "price_unit": "USD/lb",
        "default_price_inr": 800.0,
        "is_live": True,
    },
    {
        "name": "aluminium",
        "display_name": "Aluminium",
        "density": 2.70,
        "yfinance_symbol": "ALI=F",   # COMEX aluminium futures
        "price_unit": "USD/tonne",
        "default_price_inr": 220.0,
        "is_live": True,
    },
    {
        "name": "steel",
        "display_name": "Steel",
        "density": 7.85,
        "yfinance_symbol": None,
        "default_price_inr": 55.0,
        "is_live": False,
    },
    {
        "name": "stainless_steel",
        "display_name": "Stainless Steel",
        "density": 7.75,
        "yfinance_symbol": None,
        "default_price_inr": 85.0,
        "is_live": False,
    },
    {
        "name": "cast_iron",
        "display_name": "Cast Iron",
        "density": 7.20,
        "yfinance_symbol": None,
        "default_price_inr": 40.0,
        "is_live": False,
    },
    {
        "name": "brass",
        "display_name": "Brass",
        "density": 8.73,
        "yfinance_symbol": None,
        "default_price_inr": 350.0,
        "is_live": False,
    },
    {
        "name": "nickel",
        "display_name": "Nickel",
        "density": 8.91,
        "yfinance_symbol": None,      # NI=F has no data on yfinance; set manually
        "default_price_inr": 1200.0,
        "is_live": False,
    },
    {
        "name": "zinc",
        "display_name": "Zinc",
        "density": 7.14,
        "yfinance_symbol": "ZNC=F",   # Zinc futures (ZB=F was Treasury bonds)
        "price_unit": "USD/tonne",
        "default_price_inr": 250.0,
        "is_live": True,
    },
]

METAL_MAP = {m["name"]: m for m in DEFAULT_METALS}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_usd_to_inr() -> float:
    try:
        res = http.get(
            "https://api.frankfurter.app/latest?from=USD&to=INR", timeout=10
        )
        return float(res.json()["rates"]["INR"])
    except Exception as exc:
        logger.warning("USD/INR fetch failed (%s), using fallback 84.0", exc)
        return 84.0


def raw_price_to_inr(price_raw: float, price_unit: str, usd_inr: float) -> float:
    """Convert yfinance raw price to INR/kg."""
    if price_unit == "USD/lb":
        return price_raw * 2.20462 * usd_inr
    if price_unit == "USD/tonne":
        return (price_raw / 1000.0) * usd_inr
    return price_raw * usd_inr


def _yf_last_price(symbol: str) -> float:
    """Fetch latest close price using yf.download (works with yfinance >=0.2.50)."""
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        df = yf.download(symbol, period="5d", progress=False, auto_adjust=True)
    if df.empty:
        raise ValueError(f"no data for {symbol}")
    close = df["Close"].dropna()
    if close.empty:
        raise ValueError(f"no close data for {symbol}")
    val = close.iloc[-1]
    # newer yfinance returns a Series (MultiIndex) even for a single ticker
    return float(val.iloc[0]) if hasattr(val, "iloc") else float(val)


def fetch_and_update_prices():
    """APScheduler job: refresh live metal prices every 60 minutes."""
    logger.info("Price update job started")
    usd_inr = get_usd_to_inr()
    logger.info("USD/INR = %.4f", usd_inr)

    for metal in DEFAULT_METALS:
        symbol = metal.get("yfinance_symbol")
        if not symbol:
            continue
        try:
            price_raw = _yf_last_price(symbol)
            price_inr = raw_price_to_inr(price_raw, metal.get("price_unit", ""), usd_inr)

            supabase.table("metal_prices").upsert(
                {
                    "metal_name": metal["name"],
                    "price": round(price_inr, 2),
                    "currency": "INR",
                    "yfinance_symbol": symbol,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="metal_name",
            ).execute()
            logger.info("Updated %s (%s): raw=%.4f → ₹%.2f/kg", metal["name"], symbol, price_raw, price_inr)
        except Exception as exc:
            logger.error("Price update failed for %s (%s): %s", metal["name"], symbol, exc)

    logger.info("Price update job complete")


def get_cached_price(metal_name: str) -> dict:
    """Fetch price from Supabase; fall back to hardcoded default."""
    try:
        row = (
            supabase.table("metal_prices")
            .select("*")
            .eq("metal_name", metal_name)
            .maybe_single()
            .execute()
        )
        if row.data:
            return row.data
    except Exception as exc:
        logger.warning("Supabase price lookup failed for %s: %s", metal_name, exc)

    default = METAL_MAP.get(metal_name, {})
    # Check custom metals table too
    try:
        cm = (
            supabase.table("custom_metals")
            .select("price, currency")
            .eq("metal_name", metal_name)
            .maybe_single()
            .execute()
        )
        if cm.data:
            return {"metal_name": metal_name, "price": cm.data["price"],
                    "currency": cm.data["currency"], "updated_at": None}
    except Exception:
        pass

    return {
        "metal_name": metal_name,
        "price": default.get("default_price_inr", 0.0),
        "currency": "INR",
        "updated_at": None,
    }


def get_density(metal_name: str) -> float:
    if metal_name in METAL_MAP:
        return METAL_MAP[metal_name]["density"]
    try:
        row = (
            supabase.table("custom_metals")
            .select("density")
            .eq("metal_name", metal_name)
            .maybe_single()
            .execute()
        )
        if row.data:
            return float(row.data["density"])
    except Exception:
        pass
    return 7.85


def inr_to_currency(amount_inr: float, currency: str, usd_inr: float) -> float:
    if currency == "INR":
        return amount_inr
    if currency == "USD":
        return amount_inr / usd_inr
    if currency == "EUR":
        try:
            res = http.get(
                "https://api.frankfurter.app/latest?from=USD&to=EUR", timeout=5
            )
            eur_rate = float(res.json()["rates"]["EUR"])
            return (amount_inr / usd_inr) * eur_rate
        except Exception:
            return (amount_inr / usd_inr) * 0.92
    return amount_inr


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()})


@app.route("/api/prices", methods=["GET"])
def get_prices():
    try:
        rows = supabase.table("metal_prices").select("*").execute()
        price_map = {r["metal_name"]: r for r in (rows.data or [])}

        prices = []
        for m in DEFAULT_METALS:
            cached = price_map.get(m["name"])
            prices.append(
                {
                    "name": m["name"],
                    "display_name": m["display_name"],
                    "price": cached["price"] if cached else m["default_price_inr"],
                    "currency": "INR",
                    "is_live": m["is_live"],
                    "updated_at": cached["updated_at"] if cached else None,
                }
            )

        # Append custom metal prices
        custom_rows = supabase.table("custom_metals").select("*").execute()
        for cm in custom_rows.data or []:
            prices.append(
                {
                    "name": cm["metal_name"],
                    "display_name": cm["metal_name"].replace("_", " ").title(),
                    "price": cm["price"],
                    "currency": cm["currency"],
                    "is_live": False,
                    "updated_at": None,
                }
            )

        return jsonify({"prices": prices, "success": True})
    except Exception as exc:
        logger.error("GET /api/prices error: %s", exc)
        return jsonify({"error": str(exc), "success": False}), 500


@app.route("/api/metals", methods=["GET"])
def get_metals():
    try:
        custom_rows = supabase.table("custom_metals").select("*").execute()
        metals = [
            {
                "name": m["name"],
                "display_name": m["display_name"],
                "density": m["density"],
                "is_custom": False,
                "is_live": m["is_live"],
            }
            for m in DEFAULT_METALS
        ]
        for cm in custom_rows.data or []:
            metals.append(
                {
                    "name": cm["metal_name"],
                    "display_name": cm["metal_name"].replace("_", " ").title(),
                    "density": cm["density"],
                    "is_custom": True,
                    "is_live": False,
                    "price": cm["price"],
                }
            )
        return jsonify({"metals": metals, "success": True})
    except Exception as exc:
        logger.error("GET /api/metals error: %s", exc)
        return jsonify({"error": str(exc), "success": False}), 500


@app.route("/api/calculate", methods=["POST"])
def calculate():
    try:
        data = request.get_json(force=True)
        metals_input = data.get("metals", [])
        overhead_percent = float(data.get("overhead_percent", 10))
        currency = data.get("currency", "INR")

        if not metals_input:
            return jsonify({"error": "No metals provided", "success": False}), 400

        usd_inr = get_usd_to_inr() if currency != "INR" else 84.0
        breakdown = []
        total_material = 0.0

        for item in metals_input:
            name = item["name"]
            unit = item.get("unit", "cm")
            l = float(item["length"])
            b = float(item["breadth"])
            h = float(item["height"])

            # Normalise to cm
            if unit == "mm":
                l, b, h = l / 10, b / 10, h / 10
            elif unit == "in":
                l, b, h = l * 2.54, b * 2.54, h * 2.54

            density = get_density(name)
            volume_cm3 = l * b * h
            weight_kg = (volume_cm3 * density) / 1000.0

            price_data = get_cached_price(name)
            price_inr_per_kg = float(price_data["price"])
            price_per_kg = inr_to_currency(price_inr_per_kg, currency, usd_inr)

            total_cost = weight_kg * price_per_kg
            total_material += total_cost

            breakdown.append(
                {
                    "metal_name": name,
                    "display_name": METAL_MAP.get(name, {}).get(
                        "display_name", name.replace("_", " ").title()
                    ),
                    "length": item["length"],
                    "breadth": item["breadth"],
                    "height": item["height"],
                    "unit": unit,
                    "density": density,
                    "weight_kg": round(weight_kg, 4),
                    "price_per_kg": round(price_per_kg, 2),
                    "total_cost": round(total_cost, 2),
                    "currency": currency,
                }
            )

        overhead_amount = (total_material * overhead_percent) / 100.0
        final_cost = total_material + overhead_amount

        result = {
            "breakdown": breakdown,
            "total_material_cost": round(total_material, 2),
            "overhead_percent": overhead_percent,
            "overhead_amount": round(overhead_amount, 2),
            "final_cost": round(final_cost, 2),
            "currency": currency,
        }

        # Persist to Supabase
        try:
            supabase.table("calculations").insert(
                {
                    **result,
                    "calculated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).execute()
        except Exception as db_exc:
            logger.warning("Failed to save calculation: %s", db_exc)

        return jsonify({**result, "success": True})

    except Exception as exc:
        logger.error("POST /api/calculate error: %s", exc)
        return jsonify({"error": str(exc), "success": False}), 500


@app.route("/api/metals/custom", methods=["POST"])
def add_custom_metal():
    try:
        data = request.get_json(force=True)
        name = data.get("name", "").strip().lower().replace(" ", "_")
        density = float(data.get("density"))
        price = float(data.get("price"))
        currency = data.get("currency", "INR")

        if not name:
            return jsonify({"error": "Metal name required", "success": False}), 400

        now = datetime.now(timezone.utc).isoformat()

        row = supabase.table("custom_metals").upsert(
            {
                "metal_name": name,
                "density": density,
                "price": price,
                "currency": currency,
                "created_at": now,
            },
            on_conflict="metal_name",
        ).execute()

        supabase.table("metal_prices").upsert(
            {
                "metal_name": name,
                "price": price,
                "currency": currency,
                "yfinance_symbol": None,
                "updated_at": now,
            },
            on_conflict="metal_name",
        ).execute()

        return jsonify({"metal": row.data[0] if row.data else {}, "success": True})

    except Exception as exc:
        logger.error("POST /api/metals/custom error: %s", exc)
        return jsonify({"error": str(exc), "success": False}), 500


@app.route("/api/history", methods=["GET"])
def get_history():
    try:
        rows = (
            supabase.table("calculations")
            .select("*")
            .order("calculated_at", desc=True)
            .limit(10)
            .execute()
        )
        return jsonify({"history": rows.data or [], "success": True})
    except Exception as exc:
        logger.error("GET /api/history error: %s", exc)
        return jsonify({"error": str(exc), "success": False}), 500


@app.route("/api/settings", methods=["GET", "POST"])
def app_settings():
    if request.method == "GET":
        try:
            rows = supabase.table("settings").select("*").execute()
            settings_dict = {r["key"]: r["value"] for r in (rows.data or [])}
            return jsonify({"settings": settings_dict, "success": True})
        except Exception as exc:
            return jsonify({"error": str(exc), "success": False}), 500

    try:
        data = request.get_json(force=True)
        for key, value in data.items():
            supabase.table("settings").upsert(
                {"key": key, "value": str(value)}, on_conflict="key"
            ).execute()
        return jsonify({"success": True})
    except Exception as exc:
        logger.error("POST /api/settings error: %s", exc)
        return jsonify({"error": str(exc), "success": False}), 500


# ─── Scheduler bootstrap ──────────────────────────────────────────────────────

scheduler = BackgroundScheduler(daemon=True)
scheduler.add_job(
    fetch_and_update_prices,
    "interval",
    minutes=60,
    id="price_update",
    replace_existing=True,
)
scheduler.start()
atexit.register(lambda: scheduler.shutdown(wait=False))

# Trigger one run on startup (non-blocking)
import threading
threading.Thread(target=fetch_and_update_prices, daemon=True).start()

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        debug=os.getenv("FLASK_ENV") == "development",
        use_reloader=False,  # Prevent double scheduler start in debug mode
    )
