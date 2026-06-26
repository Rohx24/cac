import type { Metal, MetalPrice, CalculationResult, AppSettings, Currency, MetalEntry } from "@/types";

const BASE = process.env.FLASK_API_URL ?? process.env.NEXT_PUBLIC_FLASK_API_URL ?? "http://localhost:5000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `API ${path} failed (${res.status})`);
  }
  return json as T;
}

export const api = {
  getPrices: () =>
    apiFetch<{ prices: MetalPrice[]; success: boolean }>("/api/prices"),

  getMetals: () =>
    apiFetch<{ metals: Metal[]; success: boolean }>("/api/metals"),

  calculate: (payload: {
    metals: Array<MetalEntry & { name: string }>;
    overhead_percent: number;
    currency: Currency;
  }) =>
    apiFetch<CalculationResult & { success: boolean }>("/api/calculate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  addCustomMetal: (metal: { name: string; density: number; price: number; currency: Currency }) =>
    apiFetch<{ metal: Metal; success: boolean }>("/api/metals/custom", {
      method: "POST",
      body: JSON.stringify(metal),
    }),

  getHistory: () =>
    apiFetch<{ history: CalculationResult[]; success: boolean }>("/api/history"),

  getSettings: () =>
    apiFetch<{ settings: Record<string, string>; success: boolean }>("/api/settings"),

  saveSettings: (settings: Partial<AppSettings>) =>
    apiFetch<{ success: boolean }>("/api/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
};
