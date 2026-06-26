export type Unit = "cm" | "mm" | "in";
export type Currency = "INR" | "USD" | "EUR";

export interface Metal {
  name: string;
  display_name: string;
  density: number;
  is_custom: boolean;
  is_live: boolean;
  price?: number;
}

export interface MetalPrice {
  name: string;
  display_name: string;
  price: number;
  currency: Currency;
  is_live: boolean;
  updated_at: string | null;
}

export interface MetalEntry {
  id: string;
  metal_name: string;
  length: string;
  breadth: string;
  height: string;
  unit: Unit;
}

export interface BreakdownItem {
  metal_name: string;
  display_name: string;
  weight_kg: number;
  price_per_kg: number;
  total_cost: number;
  currency: Currency;
  density: number;
}

export interface CalculationResult {
  breakdown?: BreakdownItem[];
  metal_breakdown?: BreakdownItem[];  // column name in Supabase rows
  total_material_cost: number;
  overhead_percent: number;
  overhead_amount: number;
  final_cost: number;
  currency: Currency;
  calculated_at?: string;
  id?: string;
}

export interface AppSettings {
  default_overhead_percent: number;
  default_currency: Currency;
}
