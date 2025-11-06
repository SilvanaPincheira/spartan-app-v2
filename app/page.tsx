"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Card, CardContent } from "@/components/ui/card";
import GaugeChart from "react-gauge-chart";
import {
  Home,
  Package,
  FileText,
  Truck,
  Receipt,
  Gauge,
  Target,
  DollarSign,
  Wrench,
} from "lucide-react";

const LOGO_URL =
  "https://assets.jumpseller.com/store/spartan-de-chile/themes/317202/options/27648963/Logo-spartan-white.png?1600810625";

export default function HomeMenu() {
  const supabase = createClientComponentClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [ventas, setVentas] = useState(0);
  const [meta, setMeta] = useState(1);
  const [porcentaje, setPorcentaje] = useState(0);
  const [comodatos, setComodatos] = useState(0);
  const [facturas, setFacturas] = useState(0);
  const [alertas, setAlertas] = useState(0);

  const now = new Date();
  const meses = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
  ];
  const mesActual = meses[now.getMonth()];
  const anioActual = now.getFullYear();

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const email = session?.user?.email || null;
      setUserEmail(email);
      if (!email) return;

      try {
        const [metasRes, comodatosRes, facturasRes, alertasRes] = await Promise.all([
          fetch("/api/metas"),
          fetch("/api/comodatos"),
          fetch(`/api/facturas?email=${encodeURIComponent(email)}`),
          fetch("/api/kpi/alertas-clientes-comodatos"),
        ]);

        if (metasRes.ok) {
          const json = await metasRes.json();
          const row = json?.data?.[0];
          if (row) {
            const metaKey = `meta_${mesActual.toLowerCase()}_${anioActual}`;
            const ventasReal = Number(String(row["total_quimicos"]).replace(/[^0-9.-]/g, ""));
            const metaReal = Number(String(row[metaKey]).replace(/[^0-9.-]/g, ""));
            const cumplimientoPct = Number(String(row["cumplimiento_"]).replace(/[^0-9.-]/g, ""));
            setVentas(ventasReal || 0);
            setMeta(metaReal || 1);
            setPorcentaje(
              cumplimientoPct > 0
                ? Math.round(cumplimientoPct)
                : metaReal > 0
                ? Math.round((ventasReal / metaReal) * 100)
                : 0
            );
          }
        }

        if (comodatosRes.ok) {
          const json = await comodatosRes.json();
          setComodatos(json?.data?.length || 0);
        }

        if (facturasRes.ok) {
          const json = await facturasRes.json();
          const facturasUser = (json?.data || []).filter(
            (f: any) =>
              String(f.EMAIL_COL || "").toLowerCase().trim() === email.toLowerCase().trim()
          );
          setFacturas(facturasUser.length);
        }

        if (alertasRes.ok) {
          const json = await alertasRes.json();
          setAlertas(json?.data?.length || 0);
        }
      } catch (err) {
        console.error("❌ Error cargando datos:", err);
      }
    })();
  }, [supabase, mesActual, anioActual]);

  const today = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const mensajes = [
    "🚀 Listo para un día productivo.",
    "📊 Revisa tus reportes y KPIs.",
    "⚡ Gestiona tus comodatos y ventas fácilmente.",
    "✅ No olvides dar seguimiento a tus clientes.",
  ];
  const randomMsg = mensajes[Math.floor(Math.random() * mensajes.length)];

  // 📋 Menú lateral unificado
  const menu = [
    { name: "Inicio", href: "/inicio", icon: Home },
    { name: "Gestión de Comodatos", href: "/comodatos", icon: Package },
    { name: "Gestión de Ventas", href: "/ventas", icon: FileText },
    { name: "Logística", href: "/logistica", icon: Truck },
    { name: "KPI", href: "/kpi", icon: Gauge },
    { name: "Metas", href: "/metas", icon: Target },
    { name: "Facturas y NC", href: "/facturas", icon: Receipt },
    { name: "Comisiones", href: "/comisiones", icon: DollarSign },
    {
      name: "Herramientas",
      href: "#",
      icon: Wrench,
      children: [
        { name: "Catálogo", href: "/herramientas/catalogo" },
        { name: "Folletos", href: "/herramientas/folletos" },
        { name: "Fichas Técnicas", href: "/herramientas/ft-fichas-tecnicas" },
        { name: "Hojas de Seguridad", href: "/herramientas/hds-hojas-seguridad" },
        { name: "Info TIPS", href: "/herramientas/info-tips" },
        { name: "Registros ISP", href: "/herramientas/registros-isp" },
        { name: "Registros SAG", href: "/herramientas/registros-sag" },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* === MENÚ LATERAL === */}
      <aside className="w-64 bg-white border-r shadow-sm p-4 space-y-4">
        <div className="flex flex-col items-center text-center border-b pb-4">
          <Image src={LOGO_URL} alt="Spartan" width={150} height={50} unoptimized />
          <p className="text-sm mt-2 text-zinc-600">{userEmail}</p>
        </div>

        <nav className="space-y-1">
          {menu.map((item) => (
            <div key={item.name}>
              <Link
                href={item.href}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-50 text-zinc-700 hover:text-blue-600 transition"
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
              {item.children && (
                <div className="ml-6 mt-1 space-y-1">
                  {item.children.map((sub) => (
                    <Link
                      key={sub.name}
                      href={sub.href}
                      className="block text-sm text-zinc-600 hover:text-blue-600 hover:bg-blue-50 rounded-md px-2 py-1"
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* === CONTENIDO PRINCIPAL === */}
      <main className="flex-1 mx-auto max-w-6xl px-6 py-10 space-y-8">
        {/* Header */}
        <header className="relative overflow-hidden rounded-2xl shadow bg-gradient-to-r from-blue-800 to-sky-500 p-6 text-white">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-wide">Panel Spartan</h1>
              <p className="text-white/80 text-sm">{today}</p>
            </div>
            <p className="text-lg font-medium">{randomMsg}</p>
          </div>
        </header>

        {/* Dashboard */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-2xl p-6 flex flex-col items-center">
            <h2 className="text-lg font-semibold text-blue-600 mb-4">
              Avance Meta {mesActual.charAt(0) + mesActual.slice(1).toLowerCase()} {anioActual}
            </h2>
            <GaugeChart
              id="gauge-chart"
              nrOfLevels={20}
              percent={porcentaje / 100}
              colors={["#dc2626", "#eab308", "#16a34a"]}
              arcWidth={0.3}
              textColor="#000000"
            />
            <p className="mt-4 text-2xl font-bold">{porcentaje}%</p>
            <p className="text-gray-500">
              {ventas.toLocaleString("es-CL", { style: "currency", currency: "CLP" })} de{" "}
              {meta.toLocaleString("es-CL", { style: "currency", currency: "CLP" })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card><CardContent className="p-4"><h3 className="text-sm text-gray-500">Ventas del Mes</h3><p className="text-2xl font-bold text-green-600">{ventas.toLocaleString("es-CL",{style:"currency",currency:"CLP"})}</p></CardContent></Card>
            <Card><CardContent className="p-4"><h3 className="text-sm text-gray-500">Meta Mensual</h3><p className="text-2xl font-bold text-blue-600">{meta.toLocaleString("es-CL",{style:"currency",currency:"CLP"})}</p></CardContent></Card>
            <Card><CardContent className="p-4"><h3 className="text-sm text-gray-500">Comodatos Activos</h3><p className="text-2xl font-bold text-orange-600">{comodatos}</p></CardContent></Card>
            <Card><CardContent className="p-4"><h3 className="text-sm text-gray-500">Facturas Emitidas</h3><p className="text-2xl font-bold text-purple-600">{facturas}</p></CardContent></Card>
            <Card className="border-l-4 border-red-600 col-span-2"><CardContent className="p-4"><h3 className="text-sm text-red-600 font-semibold">⚠️ Alertas</h3><p className="text-lg font-bold text-red-700">Tienes {alertas} clientes sin comprar</p><a href="/kpi/alertas-clientes-comodatos" className="text-sm text-blue-600 hover:underline">Ver detalles →</a></CardContent></Card>
          </div>
        </section>
      </main>
    </div>
  );
}
