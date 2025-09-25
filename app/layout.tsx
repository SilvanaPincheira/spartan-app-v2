"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const menuItems = [
  { name: "Gestión de Comodatos", href: "/comodatos", icon: "🧪" },
  { name: "Gestión de Ventas", href: "/ventas", icon: "📈" },
  { name: "Logística", href: "/logistica/seguimiento", icon: "🚚" },
  { name: "Inventarios", href: "/inventarios", icon: "📦" },
  { name: "Promociones", href: "/promociones", icon: "🎯" },
  { name: "KPI", href: "/kpi", icon: "📊" },
  { name: "Metas", href: "/metas", icon: "🎯" },
  { name: "Facturas y NC", href: "/facturas", icon: "🧾" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<any>(null);

  // ⚡ Debug: verificar si las variables existen
  console.log("SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log(
    "SUPABASE_KEY:",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 10) + "..."
  );

  useEffect(() => {
    try {
      const supabase = createClientComponentClient();

      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
      });
    } catch (err) {
      console.warn("⚠️ Supabase client no inicializado:", err);
    }
  }, []);

  async function handleLogout() {
    try {
      const supabase = createClientComponentClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (err) {
      console.warn("⚠️ Error al cerrar sesión:", err);
    }
  }

  return (
    <html lang="es">
      <body className="flex min-h-screen bg-gray-50 text-zinc-900">
        {/* ==== Menú lateral ==== */}
        <aside className="hidden md:flex w-64 bg-white border-r shadow-sm flex-col print:hidden">
          <div className="px-4 py-6 border-b">
            <h1 className="text-xl font-bold text-[#1f4ed8]">Panel Spartan</h1>
          </div>

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

          {/* Botón según login */}
          <div className="p-4 border-t">
            {session ? (
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-[#1f4ed8] px-3 py-2 text-sm font-medium text-white hover:bg-[#163bb8] transition"
              >
                🚪 Cerrar sesión
              </button>
            ) : (
              <Link
                href="/login"
                className="w-full flex items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
              >
                🔑 Iniciar sesión
              </Link>
            )}
          </div>
        </aside>

        {/* ==== Contenido principal ==== */}
        <main className="flex-1 p-6 mt-14 md:mt-0 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}

