"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import type { MetalPrice } from "@/types";

const CURRENCY_SYM: Record<string, string> = { INR: "₹", USD: "$", EUR: "€" };

function fmt(price: number, currency: string) {
  const s = CURRENCY_SYM[currency] ?? currency;
  return `${s}${price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function PriceTicker() {
  const [prices, setPrices] = useState<MetalPrice[]>([]);

  async function load() {
    // Don't refresh while user is interacting with an input
    const active = document.activeElement;
    if (active && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName)) return;
    try {
      const res = await api.getPrices();
      setPrices(res.prices);
    } catch {
      // silently fail — ticker is decorative
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (prices.length === 0) return null;

  // Duplicate for seamless infinite scroll
  const items = [...prices, ...prices];

  return (
    <div className="bg-slate-900 border-b border-slate-800 overflow-hidden select-none">
      <div className="flex items-center">
        {/* Static label */}
        <div className="shrink-0 flex items-center gap-1.5 bg-brand-600 px-3 h-8 z-10">
          <TrendingUp size={12} className="text-white" />
          <span className="text-white text-xs font-bold tracking-widest uppercase">Metals</span>
        </div>

        {/* Scrolling track */}
        <div className="flex-1 overflow-hidden relative">
          {/* Left fade */}
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none" />
          {/* Right fade */}
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none" />

          <div className="ticker-track flex items-center">
            {items.map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-5 h-8 whitespace-nowrap group">
                {/* Dot */}
                <span className={`w-1.5 h-1.5 rounded-full ${p.is_live ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />

                {/* Name */}
                <span className="text-slate-400 text-xs font-medium tracking-wide uppercase">
                  {p.display_name}
                </span>

                {/* Price */}
                <span className="text-white text-xs font-bold font-mono">
                  {fmt(p.price, p.currency)}/kg
                </span>

                {/* Badge */}
                {p.is_live ? (
                  <span className="flex items-center gap-0.5 text-emerald-400 text-[10px] font-semibold">
                    <Wifi size={9} />
                    LIVE
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-slate-600 text-[10px]">
                    <WifiOff size={9} />
                    MNL
                  </span>
                )}

                {/* Divider */}
                <span className="text-slate-700 text-xs ml-2">·</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
