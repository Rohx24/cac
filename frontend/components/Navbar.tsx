"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, History, Settings, Zap } from "lucide-react";

const links = [
  { href: "/",         label: "Calculator", icon: Calculator },
  { href: "/history",  label: "History",    icon: History },
  { href: "/settings", label: "Settings",   icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop top navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-brand-600 rounded-lg">
                <Zap size={16} className="text-white" />
              </div>
              <span className="font-semibold text-slate-900 text-sm tracking-tight">Castify</span>
            </div>
            <nav className="flex items-center gap-1">
              {links.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 sm:hidden">
        <div className="flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-brand-600 rounded-md">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-sm">Castify</span>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
                active ? "text-brand-600" : "text-slate-400"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
