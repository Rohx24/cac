"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { api } from "@/lib/api";
import type { Currency } from "@/types";

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "INR", label: "INR — Indian Rupee (₹)" },
  { value: "USD", label: "USD — US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
];

export default function SettingsPage() {
  const [overhead,  setOverhead]  = useState(10);
  const [currency,  setCurrency]  = useState<Currency>("INR");
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    api.getSettings()
      .then(({ settings }) => {
        if (settings.default_overhead_percent)
          setOverhead(parseFloat(settings.default_overhead_percent));
        if (settings.default_currency)
          setCurrency(settings.default_currency as Currency);
      })
      .catch((err) => setError(err.message ?? "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.saveSettings({
        default_overhead_percent: overhead,
        default_currency: currency,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-3" />
        Loading settings…
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure defaults that apply to all new calculations.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="card divide-y divide-slate-100">
        {/* Default overhead */}
        <div className="p-5">
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Default Overhead Percentage
          </label>
          <p className="text-xs text-slate-500 mb-4">
            Applied to every new calculation. You can still adjust it per calculation.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="50"
              step="0.5"
              value={overhead}
              onChange={(e) => setOverhead(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
            />
            <div className="w-20">
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={overhead}
                onChange={(e) => setOverhead(Math.min(50, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="input text-center font-bold"
              />
            </div>
            <span className="text-sm font-medium text-slate-600 w-4">%</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1 pr-24">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
          </div>
        </div>

        {/* Default currency */}
        <div className="p-5">
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Default Currency
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Prices are fetched in INR; other currencies use a live exchange rate.
          </p>
          <div className="relative">
            <select
              className="select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {CURRENCIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-5 bg-slate-50 rounded-b-xl">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Price Update Schedule</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Live prices (Copper, Aluminium, Nickel, Zinc) are fetched from Yahoo Finance via the
            Flask backend every <strong>60 minutes</strong>. Static metals (Steel, Stainless Steel,
            Cast Iron, Brass) use manual prices editable in Supabase.
          </p>
        </div>
      </div>

      {/* Save button */}
      <div className="mt-4 flex justify-end">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <CheckCircle2 size={14} />
          ) : (
            <Save size={14} />
          )}
          {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
