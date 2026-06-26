"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Copy, Save, RefreshCw, CheckCircle2, Loader2, AlertCircle,
} from "lucide-react";
import MetalRow from "@/components/MetalRow";
import CustomMetalModal from "@/components/CustomMetalModal";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { Metal, MetalPrice, MetalEntry, Currency, Unit } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toCm(val: number, unit: Unit): number {
  if (unit === "mm") return val / 10;
  if (unit === "in") return val * 2.54;
  return val;
}

function fmtCurrency(amount: number, currency: string): string {
  const sym: Record<string, string> = { INR: "₹", USD: "$", EUR: "€" };
  const s = sym[currency] ?? currency;
  return `${s}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function newEntry(metalName = "copper"): MetalEntry {
  return {
    id: crypto.randomUUID(),
    metal_name: metalName,
    length: "",
    breadth: "",
    height: "",
    unit: "cm",
  };
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Default metals (used before API loads) ───────────────────────────────────

const HARDCODED_METALS: Metal[] = [
  { name: "copper",         display_name: "Copper",         density: 8.96, is_custom: false, is_live: true  },
  { name: "aluminium",      display_name: "Aluminium",      density: 2.70, is_custom: false, is_live: true  },
  { name: "steel",          display_name: "Steel",          density: 7.85, is_custom: false, is_live: false },
  { name: "stainless_steel",display_name: "Stainless Steel",density: 7.75, is_custom: false, is_live: false },
  { name: "cast_iron",      display_name: "Cast Iron",      density: 7.20, is_custom: false, is_live: false },
  { name: "brass",          display_name: "Brass",          density: 8.73, is_custom: false, is_live: false },
  { name: "nickel",         display_name: "Nickel",         density: 8.91, is_custom: false, is_live: true  },
  { name: "zinc",           display_name: "Zinc",           density: 7.14, is_custom: false, is_live: true  },
];

const HARDCODED_PRICES: MetalPrice[] = [
  { name: "copper",         display_name: "Copper",         price: 800,  currency: "INR", is_live: true,  updated_at: null },
  { name: "aluminium",      display_name: "Aluminium",      price: 220,  currency: "INR", is_live: true,  updated_at: null },
  { name: "steel",          display_name: "Steel",          price: 55,   currency: "INR", is_live: false, updated_at: null },
  { name: "stainless_steel",display_name: "Stainless Steel",price: 85,   currency: "INR", is_live: false, updated_at: null },
  { name: "cast_iron",      display_name: "Cast Iron",      price: 40,   currency: "INR", is_live: false, updated_at: null },
  { name: "brass",          display_name: "Brass",          price: 350,  currency: "INR", is_live: false, updated_at: null },
  { name: "nickel",         display_name: "Nickel",         price: 1200, currency: "INR", is_live: true,  updated_at: null },
  { name: "zinc",           display_name: "Zinc",           price: 250,  currency: "INR", is_live: true,  updated_at: null },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalculatorPage() {
  const [metals,   setMetals]   = useState<Metal[]>(HARDCODED_METALS);
  const [prices,   setPrices]   = useState<MetalPrice[]>(HARDCODED_PRICES);
  const [entries,  setEntries]  = useState<MetalEntry[]>([newEntry()]);
  const [overhead, setOverhead] = useState(10);
  const [currency, setCurrency] = useState<Currency>("INR");

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [loadingPrices,   setLoadingPrices]   = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [copied,          setCopied]          = useState(false);
  const [saveSuccess,     setSaveSuccess]     = useState(false);
  const [apiError,        setApiError]        = useState("");
  const [lastRefresh,     setLastRefresh]     = useState<Date | null>(null);

  // Load settings from Supabase on mount
  useEffect(() => {
    supabase.from("settings").select("*").then(({ data }) => {
      if (!data) return;
      const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]));
      if (map.default_overhead_percent) setOverhead(parseFloat(map.default_overhead_percent));
      if (map.default_currency) setCurrency(map.default_currency as Currency);
    });
  }, []);

  // Load metals + prices from Flask/Supabase
  const loadPrices = useCallback(async () => {
    setLoadingPrices(true);
    setApiError("");
    try {
      const [metalsRes, pricesRes] = await Promise.all([
        api.getMetals(),
        api.getPrices(),
      ]);
      setMetals(metalsRes.metals);
      setPrices(pricesRes.prices);
      setLastRefresh(new Date());
    } catch {
      // Fall back to Supabase direct read (works even without Flask)
      try {
        const { data: priceRows } = await supabase.from("metal_prices").select("*");
        if (priceRows?.length) {
          const mapped: MetalPrice[] = priceRows.map((r: Record<string, unknown>) => ({
            name: r.metal_name as string,
            display_name: (r.metal_name as string).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
            price: r.price as number,
            currency: r.currency as Currency,
            is_live: !!(r.yfinance_symbol),
            updated_at: r.updated_at as string | null,
          }));
          setPrices(mapped);
          setLastRefresh(new Date());
        }
        const { data: customRows } = await supabase.from("custom_metals").select("*");
        if (customRows?.length) {
          setMetals((prev) => {
            const existing = new Set(prev.map((m) => m.name));
            const toAdd: Metal[] = (customRows as Record<string, unknown>[])
              .filter((r) => !existing.has(r.metal_name as string))
              .map((r) => ({
                name: r.metal_name as string,
                display_name: (r.metal_name as string).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
                density: r.density as number,
                is_custom: true,
                is_live: false,
              }));
            return [...prev, ...toAdd];
          });
        }
      } catch (supaErr) {
        setApiError("Could not load live prices. Using defaults.");
        console.error(supaErr);
      }
    } finally {
      setLoadingPrices(false);
    }
  }, []);

  useEffect(() => { loadPrices(); }, [loadPrices]);

  // ─── Entry mutations ────────────────────────────────────────────────────────

  const updateEntry = useCallback((id: string, field: keyof MetalEntry, value: string) => {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.length > 1 ? prev.filter((e) => e.id !== id) : prev);
  }, []);

  const addEntry = () => setEntries((prev) => [...prev, newEntry()]);

  // ─── Live calculation ───────────────────────────────────────────────────────

  const breakdown = useMemo(() => {
    return entries.map((e) => {
      const metal = metals.find((m) => m.name === e.metal_name);
      const priceData = prices.find((p) => p.name === e.metal_name);
      const density = metal?.density ?? 7.85;
      const pricePerKg = priceData?.price ?? 0;

      const l = toCm(parseFloat(e.length) || 0, e.unit);
      const b = toCm(parseFloat(e.breadth) || 0, e.unit);
      const h = toCm(parseFloat(e.height) || 0, e.unit);
      const weightKg = (l * b * h * density) / 1000;
      const totalCost = weightKg * pricePerKg;

      return {
        id: e.id,
        metal_name: e.metal_name,
        display_name: metal?.display_name ?? e.metal_name,
        density,
        weight_kg: weightKg,
        price_per_kg: pricePerKg,
        total_cost: totalCost,
        currency: currency,
        length: e.length,
        breadth: e.breadth,
        height: e.height,
        unit: e.unit,
      };
    }).filter((b) => b.weight_kg > 0);
  }, [entries, metals, prices, currency]);

  const totalMaterial = useMemo(
    () => breakdown.reduce((s, b) => s + b.total_cost, 0),
    [breakdown]
  );
  const overheadAmount = (totalMaterial * overhead) / 100;
  const finalTotal     = totalMaterial + overheadAmount;

  // ─── Actions ────────────────────────────────────────────────────────────────

  const mostRecentUpdate = prices
    .filter((p) => p.updated_at)
    .map((p) => new Date(p.updated_at!).getTime())
    .sort((a, b) => b - a)[0];

  async function handleSave() {
    if (breakdown.length === 0) return;
    setSaving(true);
    setApiError("");
    try {
      await api.calculate({
        metals: entries.map((e) => ({ ...e, name: e.metal_name })),
        overhead_percent: overhead,
        currency,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    const sym: Record<string, string> = { INR: "₹", USD: "$", EUR: "€" };
    const s = sym[currency] ?? currency;
    const lines = [
      "Motor Metal Cost Breakdown",
      "─".repeat(50),
      ...breakdown.map(
        (b) =>
          `${b.display_name.padEnd(18)} ${b.weight_kg.toFixed(3)} kg × ${s}${b.price_per_kg}/kg = ${s}${b.total_cost.toFixed(2)}`
      ),
      "─".repeat(50),
      `Material Total:    ${s}${totalMaterial.toFixed(2)}`,
      `Overhead (${overhead}%):    ${s}${overheadAmount.toFixed(2)}`,
      `FINAL TOTAL:       ${s}${finalTotal.toFixed(2)}`,
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const sym: Record<string, string> = { INR: "₹", USD: "$", EUR: "€" };
  const currSym = sym[currency] ?? currency;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Cost Calculator</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Enter metal dimensions to calculate material costs with overhead.
        </p>
      </div>

      {/* Error banner */}
      {apiError && (
        <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2.5 text-sm">
          <AlertCircle size={15} className="shrink-0" />
          {apiError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: Metal entries ── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Metal Entries</h2>
            <div className="flex items-center gap-2">
              {/* Currency selector */}
              <select
                className="select py-1 text-xs w-20"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="INR">INR ₹</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
              </select>

              {/* Refresh prices */}
              <button
                className="btn-secondary py-1 px-2 text-xs"
                onClick={loadPrices}
                disabled={loadingPrices}
                title="Refresh prices"
              >
                <RefreshCw size={12} className={loadingPrices ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {entries.map((entry) => (
            <MetalRow
              key={entry.id}
              entry={entry}
              metals={metals}
              prices={prices}
              onChange={updateEntry}
              onRemove={removeEntry}
              onAddCustom={() => setShowCustomModal(true)}
              currency={currency}
            />
          ))}

          <button className="btn-secondary w-full text-sm" onClick={addEntry}>
            <Plus size={14} />
            Add Metal
          </button>

          {/* Last updated */}
          {mostRecentUpdate && (
            <p className="text-xs text-slate-400 text-center">
              Last updated: {timeAgo(new Date(mostRecentUpdate).toISOString())}
            </p>
          )}
          {lastRefresh && !mostRecentUpdate && (
            <p className="text-xs text-slate-400 text-center">
              Prices refreshed {timeAgo(lastRefresh.toISOString())}
            </p>
          )}
        </div>

        {/* ── Right: Cost breakdown ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Breakdown table */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Cost Breakdown</h2>
            </div>

            {breakdown.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                Enter dimensions above to see cost breakdown.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-2 text-left font-medium">Metal</th>
                      <th className="px-4 py-2 text-right font-medium">Weight (kg)</th>
                      <th className="px-4 py-2 text-right font-medium">Price/kg</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {breakdown.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{b.display_name}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600 font-mono text-xs">
                          {b.weight_kg.toFixed(4)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600">
                          {fmtCurrency(b.price_per_kg, currency)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                          {fmtCurrency(b.total_cost, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={3} className="px-4 py-2.5 text-sm font-semibold text-slate-700">
                        Material Total
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                        {fmtCurrency(totalMaterial, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Overhead slider */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-slate-700">Overhead</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-brand-600">{overhead}%</span>
                <span className="text-sm text-slate-500">= {fmtCurrency(overheadAmount, currency)}</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="0.5"
              value={overhead}
              onChange={(e) => setOverhead(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Final total */}
          <div className="card p-5 bg-gradient-to-br from-brand-600 to-brand-700 text-white border-brand-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-brand-100 text-sm font-medium mb-0.5">FINAL TOTAL</p>
                <p className="text-4xl font-bold tracking-tight">
                  {fmtCurrency(finalTotal, currency)}
                </p>
                <p className="text-brand-200 text-xs mt-1">
                  Material {fmtCurrency(totalMaterial, currency)} + Overhead {fmtCurrency(overheadAmount, currency)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-brand-200 text-xs">
                  {breakdown.length} metal{breakdown.length !== 1 ? "s" : ""}
                </p>
                <p className="text-brand-200 text-xs">
                  {breakdown.reduce((s, b) => s + b.weight_kg, 0).toFixed(3)} kg total
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              className="btn-secondary flex-1"
              onClick={handleCopy}
              disabled={breakdown.length === 0}
            >
              {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>

            <button
              className="btn-primary flex-1"
              onClick={handleSave}
              disabled={saving || breakdown.length === 0}
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 size={14} />
              ) : (
                <Save size={14} />
              )}
              {saving ? "Saving…" : saveSuccess ? "Saved!" : "Save Calculation"}
            </button>
          </div>
        </div>
      </div>

      {/* Custom metal modal */}
      {showCustomModal && (
        <CustomMetalModal
          currency={currency}
          onClose={() => setShowCustomModal(false)}
          onAdded={() => { setShowCustomModal(false); loadPrices(); }}
        />
      )}
    </div>
  );
}
