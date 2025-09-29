// app/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import GaugeChart from "react-gauge-chart";
import { Card, CardContent } from "@/components/ui/card";

const LOGO_URL =
  "https://assets.jumpseller.com/store/spartan-de-chile/themes/317202/options/27648963/Logo-spartan-white.png?1600810625";

export default function HomeMenu() {
  const supabase = createClientComponentClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Datos del dashboard
  const [ventas, setVentas] = useState(0);
  const [meta, setMeta] = useState(1);
  const [cumplimiento, setCumplimiento] = useState(0); // porcentaje
  const [comodatos, setComodatos] = useState(0);
  const [facturas, setFacturas] = useState(0);
  const [alertas, setAlertas] = useState(0);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }

      try {
        const [metasRes, comodatosRes, facturasRes, alertasRes] =
          await Promise.all([
            fetch("/api/metas"),
            fetch("/api/comodatos"),
            fetch("/api/facturas"),
            fetch("/api/kpi/alertas-clientes-comodatos"),
          ]);

        if (metasRes.ok) {
          const json = await metasRes.json();
          const fila = json?.data?.[0] || {};
          setVentas(Number(fila.cumplimiento_monto || 0));
          setMeta(Number(fila.meta_mes || 1));
          setCumplimiento(Number(fila.cumplimiento_pct || 0));
        }

        if (comodatosRes.ok) {
          const json = await comodatosRes.json();
          setComodatos(json?.data?.length || 0);
        }

        if (facturasRes.ok) {
          const json = await facturasRes.json();
          setFacturas(json?.data?.length || 0);
        }

        if (alertasRes.ok) {
          const json = await alertasRes.json();
          setAlertas(json?.data?.length || 0);
        }
      } catch (err) {
        console.error("❌ Error cargando datos de dashboard:", err);
      }
    })();
  }, [supabase]);

  // Fecha
  const today = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Mensajes dinámicos
  const mensajes = [
    "🚀 Listo para un día productivo.",
    "📊 Revisa tus reportes y KPIs.",
    "⚡ Gestiona tus comodatos y ventas fácilmente.",
    "✅ No olvides dar seguimiento a tus clientes.",
  ];
  const randomMsg = mensajes[Math.floor(Math.random() * mensajes.length)];

  // % avance
  const porcentaje = cumplimiento || Math.round((ventas / meta) * 100);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[#1f4ed8]" />
        <div className="absolute inset-y-0 right-[-20%] w-[60%] rotate-[-8deg] bg-sky-400/60" />
        <div className="relative mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center gap-4 md:gap-6">
            <Image
              src={LOGO_URL}
              alt="Spartan"
              width={200}
              height={60}
              unoptimized
              className="h-12 w-auto md:h-28 object-contain drop-shadow-sm"
            />
            <div>
              <h1 className="text-white uppercase font-semibold tracking-widest text-2xl md:text-3xl">
                Spartan — Panel Principal
              </h1>
              <p className="mt-1 text-white/80 text-sm">
                Bienvenido al panel central de gestión y reportes.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative mx-auto max-w-7xl px-6 py-10 space-y-8">
        <section className="rounded-2xl border bg-white shadow-sm p-6 text-center">
          <h2 className="text-2xl font-bold text-[#2B6CFF] mb-2">
            👋 Bienvenido{userEmail ? `, ${userEmail}` : ""}
          </h2>
          <p className="text-zinc-600 mb-2">{today}</p>
          <p className="text-lg font-medium">{randomMsg}</p>
        </section>

        {/* Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Odómetro */}
          <div className="bg-white shadow rounded-2xl p-6 flex flex-col items-center">
            <h2 className="text-lg font-semibold text-blue-600 mb-4">
              Avance Meta Mensual
            </h2>
            <GaugeChart
              id="gauge-chart"
              nrOfLevels={20}
              colors={["#dc2626", "#eab308", "#16a34a"]}
              arcWidth={0.3}
              percent={Math.min(porcentaje / 100, 1)}
              textColor="#000000"
            />
            <p className="mt-4 text-2xl font-bold">{porcentaje}%</p>
            <p className="text-gray-500">
              {ventas.toLocaleString("es-CL", {
                style: "currency",
                currency: "CLP",
              })}{" "}
              de{" "}
              {meta.toLocaleString("es-CL", {
                style: "currency",
                currency: "CLP",
              })}
            </p>
          </div>

          {/* Tarjetas */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm text-gray-500">Ventas del Mes</h3>
                <p className="text-2xl font-bold text-green-600">
                  {ventas.toLocaleString("es-CL", {
                    style: "currency",
                    currency: "CLP",
                  })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm text-gray-500">Meta Mensual</h3>
                <p className="text-2xl font-bold text-blue-600">
                  {meta.toLocaleString("es-CL", {
                    style: "currency",
                    currency: "CLP",
                  })}
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

            <Card className="border-l-4 border-red-600 col-span-2">
              <CardContent className="p-4">
                <h3 className="text-sm text-red-600 font-semibold">⚠️ Alertas</h3>
                <p className="text-lg font-bold text-red-700">
                  Tienes {alertas} clientes sin comprar
                </p>
                <a
                  href="/kpi/alertas-clientes-comodatos"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Ver detalles →
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* WhatsApp */}
      <a
        href="https://wa.me/56075290961?text=Hola%20Silvana,%20necesito%20m%C3%A1s%20informaci%C3%B3n"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-[#25D366] hover:bg-[#1ebe5b] text-white rounded-full p-4 shadow-lg print:hidden"
        title="Escríbenos por WhatsApp"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M20.52 3.48A11.86 11.86 0 0012.07 0C5.58 0 .07 5.52.07 12c0 2.1.55 4.15 1.6 5.96L0 24l6.21-1.63A11.9 11.9 0 0012.07 24c6.49 0 11.93-5.52 11.93-12 0-3.18-1.24-6.17-3.48-8.52zm-8.45 18.07c-1.96 0-3.87-.53-5.54-1.54l-.39-.23-3.69.97.99-3.6-.25-.37a9.7 9.7 0 01-1.48-5.23c0-5.35 4.38-9.7 9.79-9.7a9.7 9.7 0 019.79 9.7c0 5.36-4.38 9.7-9.79 9.7zm5.36-7.3c-.29-.14-1.71-.84-1.97-.94-.26-.1-.45-.14-.64.14-.19.29-.74.94-.91 1.13-.17.19-.34.21-.63.07-.29-.14-1.22-.45-2.32-1.43-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.59.13-.13.29-.34.43-.51.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.14-.64-1.54-.88-2.11-.23-.55-.47-.48-.64-.49h-.55c-.19 0-.5.07-.76.36s-1 1-1 2.43 1.02 2.82 1.16 3.01c.14.19 2 3.06 4.84 4.29.68.29 1.21.46 1.63.59.68.22 1.29.19 1.77.12.54-.08 1.71-.7 1.95-1.37.24-.67.24-1.24.17-1.37-.07-.13-.26-.2-.55-.34z" />
        </svg>
      </a>
    </div>
  );
}
