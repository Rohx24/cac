"use client";

import { X, Wifi, WifiOff, Pencil } from "lucide-react";
import type { Metal, MetalPrice, MetalEntry, Unit } from "@/types";

interface Props {
  entry: MetalEntry;
  metals: Metal[];
  prices: MetalPrice[];
  priceOverride?: number;
  onPriceOverride: (metalName: string, price: number) => void;
  onChange: (id: string, field: keyof MetalEntry, value: string) => void;
  onRemove: (id: string) => void;
  onAddCustom: () => void;
  currency: string;
}

const UNITS: Unit[] = ["cm", "mm", "in"];

function toCm(val: number, unit: Unit): number {
  if (unit === "mm") return val / 10;
  if (unit === "in") return val * 2.54;
  return val;
}

function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€" };
  const sym = symbols[currency] ?? currency;
  return `${sym}${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MetalRow({
  entry, metals, prices, priceOverride, onPriceOverride,
  onChange, onRemove, onAddCustom, currency,
}: Props) {
  const selectedMetal = metals.find((m) => m.name === entry.metal_name);
  const priceData = prices.find((p) => p.name === entry.metal_name);
  const isLive = priceData?.is_live ?? false;

  // Effective price: user override > fetched price > 0
  const effectivePrice = priceOverride ?? priceData?.price ?? 0;

  const l = parseFloat(entry.length) || 0;
  const b = parseFloat(entry.breadth) || 0;
  const h = parseFloat(entry.height) || 0;
  const density = selectedMetal?.density ?? 7.85;

  const lcm = toCm(l, entry.unit);
  const bcm = toCm(b, entry.unit);
  const hcm = toCm(h, entry.unit);
  const weightKg = (lcm * bcm * hcm * density) / 1000;
  const totalCost = weightKg * effectivePrice;

  const hasValues = l > 0 && b > 0 && h > 0;
  const sym = { INR: "₹", USD: "$", EUR: "€" }[currency] ?? currency;

  return (
    <div className="card p-4 relative group">
      {/* Remove button */}
      <button
        onClick={() => onRemove(entry.id)}
        className="absolute top-3 right-3 p-1 text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        title="Remove"
      >
        <X size={14} />
      </button>

      {/* Metal selector */}
      <div className="mb-3">
        <label className="label">Metal</label>
        <div className="relative">
          <select
            className="select"
            value={entry.metal_name}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                onAddCustom();
              } else {
                onChange(entry.id, "metal_name", e.target.value);
              }
            }}
          >
            <optgroup label="Standard Metals">
              {metals.filter((m) => !m.is_custom).map((m) => (
                <option key={m.name} value={m.name}>{m.display_name}</option>
              ))}
            </optgroup>
            {metals.some((m) => m.is_custom) && (
              <optgroup label="Custom Metals">
                {metals.filter((m) => m.is_custom).map((m) => (
                  <option key={m.name} value={m.name}>{m.display_name}</option>
                ))}
              </optgroup>
            )}
            <option value="__custom__">+ Add Custom Metal…</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {(["length", "breadth", "height"] as const).map((dim) => (
          <div key={dim}>
            <label className="label capitalize">{dim.charAt(0).toUpperCase()}</label>
            <input
              type="number"
              min="0"
              step="any"
              className="input"
              placeholder="0"
              value={entry[dim]}
              onChange={(e) => onChange(entry.id, dim, e.target.value)}
            />
          </div>
        ))}
        <div>
          <label className="label">Unit</label>
          <select
            className="select"
            value={entry.unit}
            onChange={(e) => onChange(entry.id, "unit", e.target.value)}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Price row */}
      <div className="pt-2 border-t border-slate-100">
        {isLive ? (
          /* Live price — read-only display */
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="badge-live">
                <Wifi size={10} />
                Live
              </span>
              <span className="text-slate-500 font-medium">
                {formatCurrency(effectivePrice, currency)}/kg
              </span>
              {priceData?.updated_at && (
                <span className="text-slate-400">· {timeAgo(priceData.updated_at)}</span>
              )}
            </div>
            {hasValues && (
              <div className="flex items-center gap-3 font-medium">
                <span className="text-slate-500">{weightKg.toFixed(3)} kg</span>
                <span className="text-brand-600">{formatCurrency(totalCost, currency)}</span>
              </div>
            )}
          </div>
        ) : (
          /* Manual price — editable input */
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="badge-manual">
                <WifiOff size={10} />
                Manual
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Pencil size={9} />
                Set your price
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 text-sm font-medium pointer-events-none">
                  {sym}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input pl-7 font-mono text-sm"
                  placeholder={String(priceData?.price ?? 0)}
                  value={priceOverride ?? priceData?.price ?? ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0) {
                      onPriceOverride(entry.metal_name, val);
                    }
                  }}
                />
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">/kg</span>
              {hasValues && (
                <span className="text-sm font-bold text-brand-600 whitespace-nowrap">
                  = {formatCurrency(totalCost, currency)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
