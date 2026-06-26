"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Currency } from "@/types";

interface Props {
  currency: Currency;
  onClose: () => void;
  onAdded: () => void;
}

export default function CustomMetalModal({ currency, onClose, onAdded }: Props) {
  const [name, setName]       = useState("");
  const [density, setDensity] = useState("");
  const [price, setPrice]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const symbols: Record<Currency, string> = { INR: "₹", USD: "$", EUR: "€" };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !density || !price) {
      setError("All fields are required.");
      return;
    }

    const densityNum = parseFloat(density);
    const priceNum   = parseFloat(price);
    if (densityNum <= 0 || priceNum <= 0) {
      setError("Density and price must be positive numbers.");
      return;
    }

    setLoading(true);
    try {
      await api.addCustomMetal({ name: name.trim(), density: densityNum, price: priceNum, currency });
      onAdded();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add metal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6 mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">Add Custom Metal</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Metal Name</label>
            <input
              className="input"
              placeholder="e.g. Titanium"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="label">Density (g/cm³)</label>
            <input
              type="number"
              className="input"
              placeholder="e.g. 4.50"
              step="0.01"
              min="0.01"
              value={density}
              onChange={(e) => setDensity(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">
              Common: Titanium 4.51 · Lead 11.34 · Gold 19.32
            </p>
          </div>

          <div>
            <label className="label">Price / kg ({symbols[currency]})</label>
            <input
              type="number"
              className="input"
              placeholder="e.g. 4500"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? "Saving…" : "Add Metal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
