"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Card, CardContent } from "@/components/ui/card";
import GaugeChart from "react-gauge-chart";
import {
  Home,
  Gauge,
  FileText,
  Package,
  FolderCog,
  BookMarked,
  Info,
  Shield,
  BookOpen,
  ClipboardList,
  FlaskConical,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

const LOGO_URL =
  "https://assets.jumpseller.com/store/spartan-de-chile/themes/317202/options/27648963/Logo-spartan-white.png?1600810625";

export default function HomeMenu() {
  const supabase = createClientComponentClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [openHerramientas, setOpenHerramientas] = useState(false);

  // Datos del dashboard
  const [ventas, setVentas] = useState(0);
  const [meta, setMeta] = useState(1);
  const [porcentaje, setPorcentaje] = useState(0);
  const [comodatos, setComodatos] = useState(0);
  const [facturas, setFacturas] = useState(0);
  const [alertas, setAlertas] = useState(0);

  // Fecha actual
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
            const cumplimientoPct = Number(
              String(row["cumplimiento_"]).replace(/[^0-9.-]/g, "")
            );

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
        console.error("❌ Error cargando dashboard:", err);
      }
    })();
  }, [supabase, mesActual, anioActual]);

  // Sidebar principal
  const herramientas = [
    { name: "Catálogo", href: "/herramientas/catalogo", icon: BookMarked },
    { name: "Folletos", href: "/herramientas/folletos", icon: Info },
    { name: "Fichas Técnicas", href: "/herramientas/ft-fichas-tecnicas", icon: FileText },
    { name: "Hojas de Seguridad", href: "/herramientas/hds-hojas-seguridad", icon: Shield },
    { name: "Info TIPS", href: "/herramientas/info-tips", icon: BookOpen },
    { name: "Productos", href: "/herramientas/productos", icon: Package },
    { name: "Registros ISP", href: "/herramientas/registros-isp", icon: FlaskConical },
    { name: "Registros SAG", href: "/herramientas/registros-sag", icon: ClipboardList },
  ];

  const today = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      {/* === Sidebar === */}
      <aside className="w-64 bg-white border-r h-screen p-4 space-y-3 shadow-sm">
        <Image
          src={LOGO_URL}
          alt="Spartan"
          width={180}
          height={50}
          unoptimized
          className="mx-auto mb-4"
        />

        <Link
          href="/inicio"
          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-50 text-sm font-medium text-gray-700"
        >
          <Home size={18} /> Inicio
        </Link>

        <Link
          href="/metas"
          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-50 text-sm font-medium text-gray-700"
        >
          <Gauge size={18} /> Metas
        </Link>

        <Link
          href="/notasventa"
          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-50 text-sm font-medium text-gray-700"
        >
          <FileText size={18} /> Notas de Venta
        </Link>

        <Link
          href="/comodatos"
          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-50 text-sm font-medium text-gray-700"
        >
          <Package size={18} /> Comodatos
        </Link>

        {/* === Herramientas === */}
        <button
          onClick={() => setOpenHerramientas(!openHerramientas)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            <FolderCog size={18} />
            Herramientas
          </span>
          {openHerramientas ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {openHerramientas && (
          <div className="ml-5 space-y-1">
            {herramientas.map((sub) => (
              <Link
                key={sub.name}
                href={sub.href}
                className="flex items-center gap-2 px-3 py-1 rounded-md text-sm text-gray-600 hover:bg-gray-50"
              >
                <sub.icon size={16} />
                {sub.name}
              </Link>
            ))}
          </div>
        )}
      </aside>

      {/* === Contenido central === */}
      <main className="flex-1 p-8 overflow-y-auto">
        <section className="rounded-2xl border bg-white shadow-sm p-6 text-center mb-8">
          <h2 className="text-2xl font-bold text-[#2B6CFF] mb-2">
            👋 Bienvenido{userEmail ? `, ${userEmail}` : ""}
          </h2>
          <p className="text-zinc-600 mb-2">{today}</p>
          <p className="text-lg font-medium">📊 Revisa tus reportes y KPIs.</p>
        </section>

        {/* Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-2xl p-6 flex flex-col items-center">
            <h2 className="text-lg font-semibold text-blue-600 mb-4">
              Avance Meta {mesActual} {anioActual}
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
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm text-gray-500">Ventas del Mes</h3>
                <p className="text-2xl font-bold text-green-600">
                  {ventas.toLocaleString("es-CL", { style: "currency", currency: "CLP" })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm text-gray-500">Meta Mensual</h3>
                <p className="text-2xl font-bold text-blue-600">
                  {meta.toLocaleString("es-CL", { style: "currency", currency: "CLP" })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm text-gray-500">Comodatos Activos</h3>
                <p className="text-2xl font-bold text-orange-600">{comodatos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm text-gray-500">Facturas Emitidas</h3>
                <p className="text-2xl font-bold text-purple-600">{facturas}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
