// app/layout.tsx
"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const menuItems = [
  { name: "Gestión de Comodatos", href: "/comodatos", icon: "🧪" },
  { name: "Gestión de Ventas", href: "/ventas", icon: "📈" },
  { name: "Logística", href: "/logistica", icon: "🚚" },
  { name: "Inventarios", href: "/inventarios", icon: "📦" },
  { name: "Promociones", href: "/promociones", icon: "🎯" },
  { name: "KPI", href: "/kpi", icon: "📊" },
  { name: "Metas", href: "/metas", icon: "🎯" },
  { name: "Facturas y NC", href: "/facturas", icon: "🧾" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    alert("Cerrar sesión");
  }

  return (
    <html lang="es">
      <body className="flex min-h-screen bg-gray-50 text-zinc-900">
        {/* ==== Menú lateral (desktop) ==== */}
        <aside className="hidden md:flex w-64 bg-white border-r shadow-sm flex-col print:hidden">
          <div className="px-4 py-6 border-b">
            <h1 className="text-xl font-bold text-[#1f4ed8]">Panel Spartan</h1>
          </div>

          {/* Botón Inicio */}
          <div className="px-2 pt-3">
            <Link
              href="/"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition
                ${
                  pathname === "/"
                    ? "bg-[#1f4ed8] text-white"
                    : "text-gray-700 hover:bg-blue-50 hover:text-[#1f4ed8]"
                }`}
            >
              <span>🏠</span>
              Inicio
            </Link>
          </div>

          {/* Links de menú */}
          <nav className="flex-1 px-2 py-3 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition ${
                  pathname === item.href || pathname.startsWith(item.href + "/")
                    ? "bg-[#1f4ed8] text-white"
                    : "text-gray-700 hover:bg-blue-50 hover:text-[#1f4ed8]"
                }`}
              >
                <span>{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Botón cerrar sesión */}
          <div className="p-4 border-t">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-[#1f4ed8] px-3 py-2 text-sm font-medium text-white hover:bg-[#163bb8] transition"
            >
              🚪 Cerrar sesión
            </button>
          </div>
        </aside>

        {/* ==== Menú móvil (drawer) ==== */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between bg-white border-b px-4 py-3 shadow-sm">
          <h1 className="text-lg font-bold text-[#1f4ed8]">Panel Spartan</h1>
          <button
            className="text-2xl"
            onClick={() => setOpen(!open)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
        </div>

        {open && (
          <div className="fixed inset-0 z-30 bg-black bg-opacity-40" onClick={() => setOpen(false)}>
            <div
              className="absolute top-0 left-0 h-full w-64 bg-white shadow-md flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-6 border-b flex justify-between items-center">
                <h1 className="text-xl font-bold text-[#1f4ed8]">Menú</h1>
                <button className="text-xl" onClick={() => setOpen(false)}>✖</button>
              </div>
              <nav className="flex-1 px-2 py-3 space-y-1">
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-3 py-2 rounded-md text-sm font-medium transition ${
                      pathname === item.href || pathname.startsWith(item.href + "/")
                        ? "bg-[#1f4ed8] text-white"
                        : "text-gray-700 hover:bg-blue-50 hover:text-[#1f4ed8]"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    {item.icon} {item.name}
                  </Link>
                ))}
              </nav>
              <div className="p-4 border-t">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-[#1f4ed8] px-3 py-2 text-sm font-medium text-white hover:bg-[#163bb8] transition"
                >
                  🚪 Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==== Contenido principal ==== */}
        <main className="flex-1 p-6 mt-14 md:mt-0 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
