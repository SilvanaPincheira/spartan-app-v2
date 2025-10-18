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
  const [meta, setMeta] = useState(1);
  const [porcentaje, setPorcentaje] = useState(0);
  const [comodatos, setComodatos] = useState(0);
  const [facturas, setFacturas] = useState(0);
  const [alertas, setAlertas] = useState(0);

  // Encuesta
  const [rating, setRating] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviado, setEnviado] = useState(false);

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
            const ventasReal = Number(String(row["total_quimicos"]).replace(/[^0-9.-]/g, ""));
            const metaReal = Number(String(row["meta_septiembre_2025"]).replace(/[^0-9.-]/g, ""));
            setVentas(ventasReal || 0);
            setMeta(metaReal || 1);
            setPorcentaje(metaReal > 0 ? Math.round((ventasReal / metaReal) * 100) : 0);
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
        console.error("❌ Error cargando datos de dashboard:", err);
      }
    })();
  }, [supabase]);

  // Manejo de envío de encuesta
  async function enviarEncuesta(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return alert("Selecciona una puntuación.");

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("encuesta_app").insert([
      {
        user_id: user?.id || null,
        rating,
        comentario,
      },
    ]);

    if (error) console.error(error);
    else setEnviado(true);
  }

  // Fecha y mensajes
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

      {/* Contenido principal */}
      <main className="relative mx-auto max-w-7xl px-6 py-10 space-y-8">
        {/* Saludo */}
        <section className="rounded-2xl border bg-white shadow-sm p-6 text-center">
          <h2 className="text-2xl font-bold text-[#2B6CFF] mb-2">
            👋 Bienvenido{userEmail ? `, ${userEmail}` : ""}
          </h2>
          <p className="text-zinc-600 mb-2">{today}</p>
          <p className="text-lg font-medium">{randomMsg}</p>
        </section>

        {/* Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        {/* Encuesta de satisfacción */}
        <section className="bg-white rounded-2xl shadow p-6 max-w-xl mx-auto mt-10 text-center">
          <h2 className="text-xl font-semibold mb-3 text-blue-600">
            💬 ¿Qué te ha parecido SpartanOne?
          </h2>

          {enviado ? (
            <p className="text-green-600 font-medium">
              ✅ ¡Gracias por tu opinión!
            </p>
          ) : (
            <form onSubmit={enviarEncuesta}>
              <div className="flex justify-center space-x-2 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={`text-3xl ${
                      n <= (rating || 0)
                        ? "text-yellow-400"
                        : "text-gray-300 hover:text-yellow-200"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>

              <textarea
                placeholder="¿Qué podríamos mejorar?"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="w-full border rounded-md p-2 mb-3 text-sm"
                rows={3}
              />

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md"
              >
                Enviar opinión
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
