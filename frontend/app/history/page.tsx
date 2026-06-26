"use client";

import { useState, useEffect } from "react";
import { Clock, ChevronDown, ChevronUp, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { CalculationResult } from "@/types";

const CURRENCY_SYM: Record<string, string> = { INR: "₹", USD: "$", EUR: "€" };

function fmt(amount: number, currency: string) {
  const s = CURRENCY_SYM[currency] ?? currency;
  return `${s}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [history, setHistory] = useState<CalculationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.getHistory()
      .then((res) => setHistory(res.history))
      .catch((err) => setError(err.message ?? "Failed to load history"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-3" />
        Loading history…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Calculation History</h1>
        <p className="text-sm text-slate-500 mt-0.5">Last 10 saved calculations.</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {history.length === 0 && !error && (
        <div className="card px-6 py-16 text-center text-slate-400">
          <Clock size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No saved calculations yet.</p>
          <p className="text-sm mt-1">Go to the Calculator and click <strong>Save Calculation</strong>.</p>
        </div>
      )}

      <div className="space-y-3">
        {history.map((calc, idx) => {
          const id = calc.id ?? String(idx);
          const isOpen = expanded === id;
          const sym = CURRENCY_SYM[calc.currency] ?? calc.currency;
          const items = calc.metal_breakdown ?? calc.breakdown ?? [];

          return (
            <div key={id} className="card overflow-hidden">
              {/* Summary row */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-brand-600">{history.length - idx}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {fmt(calc.final_cost, calc.currency)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {items.length} metal{items.length !== 1 ? "s" : ""}
                      {" · "}Overhead {calc.overhead_percent}%
                      {calc.calculated_at && ` · ${formatDate(calc.calculated_at)}`}
                    </p>
                  </div>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase tracking-wider">
                        <th className="pb-2 text-left font-medium">Metal</th>
                        <th className="pb-2 text-right font-medium">Weight (kg)</th>
                        <th className="pb-2 text-right font-medium">Price/kg</th>
                        <th className="pb-2 text-right font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((b, i) => (
                        <tr key={i}>
                          <td className="py-1.5 font-medium text-slate-800">
                            {b.display_name ?? b.metal_name}
                          </td>
                          <td className="py-1.5 text-right text-slate-600 font-mono text-xs">
                            {Number(b.weight_kg).toFixed(4)}
                          </td>
                          <td className="py-1.5 text-right text-slate-600">
                            {sym}{Number(b.price_per_kg).toFixed(2)}
                          </td>
                          <td className="py-1.5 text-right font-semibold text-slate-800">
                            {fmt(b.total_cost, calc.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Material Total</span>
                      <span>{fmt(calc.total_material_cost, calc.currency)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Overhead ({calc.overhead_percent}%)</span>
                      <span>{fmt(calc.overhead_amount, calc.currency)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                      <span>Final Total</span>
                      <span className="text-brand-600">{fmt(calc.final_cost, calc.currency)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
