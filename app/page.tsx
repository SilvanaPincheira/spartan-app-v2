// app/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Card, CardContent } from "@/components/ui/card";
import GaugeChart from "react-gauge-chart";

const LOGO_URL =
  "https://assets.jumpseller.com/store/spartan-de-chile/themes/317202/options/27648963/Logo-spartan-white.png?1600810625";

export default function HomeMenu() {
  const supabase = createClientComponentClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Datos del dashboard
  const [ventas, setVentas] = useState(0);
  const [meta, setMeta] = useState(1); // evitar división por cero
  const [porcentaje, setPorcentaje] = useState(0);
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
        // ⚡ Consumir APIs internas
        const [metasRes, comodatosRes, facturasRes, alertasRes] =
          await Promise.all([
            fetch("/api/metas"),
            fetch("/api/comodatos"),
            fetch("/api/facturas"),
            fetch("/api/kpi/alertas-clientes-comodatos"),
          ]);

        // Metas y ventas
        if (metasRes.ok) {
          const json = await metasRes.json();
          const row = json?.data?.[0];
          if (row) {
            const ventasReal = Number(
              String(row["total_quimicos"]).replace(/[^0-9.-]/g, "")
            );
            const metaReal = Number(
              String(row["meta_septiembre_2025"]).replace(/[^0-9.-]/g, "")
            );

            setVentas(ventasReal || 0);
            setMeta(metaReal || 1);
            setPorcentaje(
              metaReal > 0 ? Math.round((ventasReal / metaReal) * 100) : 0
            );
          }
        }

        // Comodatos
        if (comodatosRes.ok) {
          const json = await comodatosRes.json();
          setComodatos(json?.data?.length || 0);
        }

        // Facturas
        if (facturasRes.ok) {
          const json = await facturasRes.json();
          setFacturas(json?.data?.length || 0);
        }

        // Alertas
        if (alertasRes.ok) {
          const json = await alertasRes.json();
          setAlertas(json?.data?.length || 0);
        }
      } catch (err) {
        console.error("❌ Error cargando datos de dashboard:", err);
      }
    })();
  }, [supabase]);

  // Fecha actual
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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header corporativo */}
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
            <div className="min-w-0">
              <h1 className="text-white uppercase font-semibold tracking-widest text-2xl md:text-3xl">
                Spartan One
              </h1>
              <p className="mt-1 text-white/80 text-sm max-w-2xl">
                Bienvenido al panel central de gestión y reportes.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Mensaje dinámico */}
      <main className="relative mx-auto max-w-7xl px-6 py-10 space-y-8">
        <section className="rounded-2xl border bg-white shadow-sm p-6 text-center">
          <h2 className="text-2xl font-bold text-[#2B6CFF] mb-2">
            👋 Bienvenido{userEmail ? `, ${userEmail}` : ""}
          </h2>
          <p className="text-zinc-600 mb-2">{today}</p>
          <p className="text-lg font-medium">{randomMsg}</p>
        </section>

        {/* === Dashboard === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Odómetro */}
          <div className="bg-white shadow rounded-2xl p-6 flex flex-col items-center">
            <h2 className="text-lg font-semibold text-blue-600 mb-4">
              Avance Meta Mensual
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

            {/* Alerta rápida */}
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
    </div>
  );
}
