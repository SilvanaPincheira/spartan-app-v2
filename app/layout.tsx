"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import AvisoFlotante from "@/app/components/AvisoFlotante";

// 🧩 Importa los módulos de modo offline
import { useOfflineSync } from "@/lib/hooks/useOfflineSync";
import { dbGetAll } from "@/lib/offline/db";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 🟢 Activa el modo offline apenas carga la app
  useOfflineSync();

  useEffect(() => {
    // Fuerza la creación de la base IndexedDB
    dbGetAll().then(() => console.log("🟢 IndexedDB inicializada (spartan_offline_db)"));
  }, []);

  // 🔹 Cargar sesión y perfil desde Supabase
  useEffect(() => {
    const supabase = createClientComponentClient();

    async function cargarDatos() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);

      if (data.session?.user) {
        const { data: perfilData } = await supabase
          .from("profiles")
          .select("role, department, display_name, email")
          .eq("id", data.session.user.id)
          .single();

        if (perfilData) setPerfil(perfilData);
      }
    }

    cargarDatos();
  }, []);

  // 🔹 Recalcular menú cuando el perfil esté listo
  useEffect(() => {
    const baseMenu = [
      { name: "Gestión de Comodatos", href: "/comodatos", icon: "🧪" },
      { name: "Gestión de Ventas", href: "/ventas", icon: "📈" },
      { name: "Logística", href: "/logistica/seguimiento", icon: "🚚" },
      { name: "Inventarios", href: "/inventarios", icon: "📦" },
      { name: "Promociones", href: "/promociones", icon: "🎯" },
      { name: "KPI", href: "/kpi", icon: "📊" },
      { name: "Metas", href: "/metas", icon: "🎯" },
      { name: "Facturas y NC", href: "/facturas-nc", icon: "🧾" },
      { name: "Comisiones", href: "/comisiones", icon: "💰" },
      { name: "Herramientas", href: "/herramientas", icon: "🧰" }
    ];

    if (perfil?.role === "gerencia" || perfil?.department?.startsWith("gerencia_")) {
      baseMenu.push({ name: "Gerencia", href: "/gerencia", icon: "🏢" });
    }

    setMenuItems(baseMenu);
  }, [perfil]);

  async function handleLogout() {
    const supabase = createClientComponentClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <html lang="es">
      <body className="flex min-h-screen bg-gray-50 text-zinc-900">
        {/* ==== Sidebar fijo (PC) ==== */}
        <aside className="hidden md:flex w-64 bg-white border-r shadow-sm flex-col print:hidden">
          <div className="px-4 py-6 border-b">
            <h1 className="text-xl font-bold text-[#1f4ed8]">Panel Spartan</h1>
            {perfil && (
              <p className="text-xs text-gray-500 mt-1">
                👤 {perfil.display_name || perfil.email}
                <br />
                <span className="capitalize text-gray-400">
                  {perfil.role} · {perfil.department?.replace("gerencia_", "").toUpperCase()}
                </span>
              </p>
            )}
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

          {/* ==== Botón login/logout (PC) ==== */}
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

        {/* ==== Barra superior móvil ==== */}
        <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b flex items-center justify-between px-4 py-3 shadow-sm z-20">
          <h1 className="text-lg font-bold text-[#1f4ed8]">Panel Spartan</h1>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-md border text-gray-700"
          >
            {mobileOpen ? "✖️" : "☰"}
          </button>
        </div>

        {/* ==== Menú móvil ==== */}
        {mobileOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-30 z-30">
            <aside className="absolute top-0 left-0 w-64 h-full bg-white shadow-md flex flex-col">
              <div className="px-4 py-6 border-b flex justify-between items-center">
                <h1 className="text-xl font-bold text-[#1f4ed8]">Panel Spartan</h1>
                <button onClick={() => setMobileOpen(false)}>✖️</button>
              </div>

              <div className="px-2 pt-3">
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
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

              <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
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

              <div className="p-4 border-t">
                {session ? (
                  <button
                    onClick={() => {
                      handleLogout();
                      setMobileOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-[#1f4ed8] px-3 py-2 text-sm font-medium text-white hover:bg-[#163bb8] transition"
                  >
                    🚪 Cerrar sesión
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
                  >
                    🔑 Iniciar sesión
                  </Link>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* ==== Contenido principal ==== */}
        <main className="flex-1 p-6 mt-14 md:mt-0 overflow-y-auto">{children}</main>

        {/* ==== Aviso flotante global ==== */}
        <AvisoFlotante />
      </body>
    </html>
  );
}
