import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PriceTicker from "@/components/PriceTicker";

export const metadata: Metadata = {
  title: "Castify",
  description: "Live metal prices with cost breakdown for manufacturing",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <Navbar />
        <PriceTicker />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 sm:pb-6">
          {children}
        </main>
      </body>
    </html>
  );
}
