"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  Card,
  CardContent,
} from "@/app/components/ui/card";

import GaugeChart from "react-gauge-chart";

const LOGO_URL =
  "https://assets.jumpseller.com/store/spartan-de-chile/themes/317202/options/27648963/Logo-spartan-white.png?1600810625";

// ============================================================
// TIPOS
// ============================================================

type EjecutivoRow = {
  nombre: string;
  email: string | null;
};

type AvanceRow = {
  fecha_corte: string;
  slpcode: number;
  vendedor: string;

  zona: string | null;
  division: string | null;
  equipo: string | null;

  meta_mes: number | string | null;

  facturado_quimicos: number | string | null;
  facturado_otros: number | string | null;
  facturado_total: number | string | null;

  pedidos_quimicos: number | string | null;
  pedidos_otros: number | string | null;
  pedidos_total: number | string | null;

  entregas_quimicos: number | string | null;
  entregas_otros: number | string | null;
  entregas_total: number | string | null;

  cierre_quimicos: number | string | null;
  cierre_otros: number | string | null;
  cierre_total: number | string | null;

  synced_at: string | null;
};

// ============================================================
// HELPERS
// ============================================================

function num(value: unknown) {
  const n = Number(value ?? 0);

  return Number.isFinite(n)
    ? n
    : 0;
}

function money(value: unknown) {
  return num(value).toLocaleString(
    "es-CL",
    {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }
  );
}

/*
 * IMPORTANTE:
 *
 * NO quitamos prefijos.
 *
 * JUAN PRIETO
 * HC JUAN PRIETO
 *
 * son vendedores comerciales diferentes.
 */
function nombreKey(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function HomeMenu() {
  const supabase = useMemo(
    () =>
      createClientComponentClient(),
    []
  );

  const [
    userEmail,
    setUserEmail,
  ] =
    useState<string | null>(
      null
    );

  const [
    fechaCorte,
    setFechaCorte,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorVentas,
    setErrorVentas,
  ] =
    useState("");

  // ============================================================
  // DATOS COMERCIALES
  // ============================================================

  const [
    meta,
    setMeta,
  ] = useState(0);

  const [
    ventaQuimicos,
    setVentaQuimicos,
  ] = useState(0);

  const [
    ventaOtros,
    setVentaOtros,
  ] = useState(0);

  const [
    ventaTotal,
    setVentaTotal,
  ] = useState(0);

  const [
    pedidosQuimicos,
    setPedidosQuimicos,
  ] = useState(0);

  const [
    pedidosTotal,
    setPedidosTotal,
  ] = useState(0);

  const [
    entregasQuimicos,
    setEntregasQuimicos,
  ] = useState(0);

  const [
    entregasTotal,
    setEntregasTotal,
  ] = useState(0);

  const [
    cierreQuimicos,
    setCierreQuimicos,
  ] = useState(0);

  const [
    cierreOtros,
    setCierreOtros,
  ] = useState(0);

  const [
    cierreTotal,
    setCierreTotal,
  ] = useState(0);

  // ============================================================
  // INDICADORES EXISTENTES
  // ============================================================

  const [
    comodatos,
    setComodatos,
  ] = useState(0);

  const [
    facturas,
    setFacturas,
  ] = useState(0);

  const [
    alertas,
    setAlertas,
  ] = useState(0);

  // ============================================================
  // CARGAR DASHBOARD
  // ============================================================

  useEffect(() => {
    let activo = true;

    async function cargarDashboard() {
      try {
        setLoading(true);
        setErrorVentas("");

        // ======================================================
        // 1. SESIÓN
        // ======================================================

        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        const email =
          session?.user?.email
            ?.trim()
            .toLowerCase() ||
          null;

        if (!activo) {
          return;
        }

        setUserEmail(
          email
        );

        if (!email) {
          setErrorVentas(
            "No se encontró una sesión activa."
          );

          return;
        }

        // ======================================================
        // 2. EJECUTIVOS ASOCIADOS AL LOGIN
        // ======================================================

        const {
          data:
            ejecutivosData,
          error:
            ejecutivosError,
        } = await supabase
          .from(
            "ejecutivos"
          )
          .select(`
            nombre,
            email
          `)
          .ilike(
            "email",
            email
          );

        if (
          ejecutivosError
        ) {
          throw ejecutivosError;
        }

        const registrosEjecutivo =
          (
            ejecutivosData ||
            []
          ) as EjecutivoRow[];

        const nombres = [
          ...new Set(
            registrosEjecutivo
              .map((r) =>
                String(
                  r.nombre ||
                    ""
                ).trim()
              )
              .filter(
                Boolean
              )
          ),
        ];

        if (
          nombres.length ===
          0
        ) {
          setErrorVentas(
            "Tu correo no tiene un ejecutivo comercial asociado."
          );

          return;
        }

        /*
         * Se conservan los nombres completos.
         *
         * Ejemplo:
         * JUAN PRIETO
         * HC JUAN PRIETO
         *
         * NO se mezclan.
         */
        const nombresPermitidos =
          new Set(
            nombres.map(
              nombreKey
            )
          );

        // ======================================================
        // 3. ÚLTIMA FECHA DISPONIBLE
        // ======================================================

        const {
          data: corteData,
          error:
            corteError,
        } = await supabase
          .from(
            "reporte_ventas_diario"
          )
          .select(
            "fecha_corte"
          )
          .order(
            "fecha_corte",
            {
              ascending:
                false,
            }
          )
          .limit(1);

        if (
          corteError
        ) {
          throw corteError;
        }

        const ultimaFecha =
          corteData?.[0]
            ?.fecha_corte ||
          "";

        if (
          !ultimaFecha
        ) {
          setErrorVentas(
            "No existen datos comerciales disponibles para tu usuario."
          );

          return;
        }

        if (!activo) {
          return;
        }

        setFechaCorte(
          ultimaFecha
        );

        // ======================================================
        // 4. DATOS DEL ÚLTIMO CORTE
        // ======================================================

        const {
          data:
            avanceData,
          error:
            avanceError,
        } = await supabase
          .from(
            "reporte_ventas_diario"
          )
          .select(`
            fecha_corte,
            slpcode,
            vendedor,
            zona,
            division,
            equipo,
            meta_mes,
            facturado_quimicos,
            facturado_otros,
            facturado_total,
            pedidos_quimicos,
            pedidos_otros,
            pedidos_total,
            entregas_quimicos,
            entregas_otros,
            entregas_total,
            cierre_quimicos,
            cierre_otros,
            cierre_total,
            synced_at
          `)
          .eq(
            "fecha_corte",
            ultimaFecha
          );

        if (
          avanceError
        ) {
          throw avanceError;
        }

        // ======================================================
        // 5. FILTRAR SEGÚN LOGIN
        // ======================================================

        const filasUsuario =
          (
            (avanceData ||
              []) as AvanceRow[]
          ).filter((r) =>
            nombresPermitidos.has(
              nombreKey(
                r.vendedor
              )
            )
          );

        if (
          filasUsuario.length ===
          0
        ) {
          setErrorVentas(
            "Se encontró tu ejecutivo, pero no existe información de ventas asociada al último corte."
          );

          return;
        }

        // ======================================================
        // 6. CONSOLIDAR
        // ======================================================

        const totales =
          filasUsuario.reduce(
            (
              acc,
              r
            ) => {
              acc.meta +=
                num(
                  r.meta_mes
                );

              acc.ventaQuimicos +=
                num(
                  r.facturado_quimicos
                );

              acc.ventaOtros +=
                num(
                  r.facturado_otros
                );

              acc.ventaTotal +=
                num(
                  r.facturado_total
                );

              acc.pedidosQuimicos +=
                num(
                  r.pedidos_quimicos
                );

              acc.pedidosTotal +=
                num(
                  r.pedidos_total
                );

              acc.entregasQuimicos +=
                num(
                  r.entregas_quimicos
                );

              acc.entregasTotal +=
                num(
                  r.entregas_total
                );

              acc.cierreQuimicos +=
                num(
                  r.cierre_quimicos
                );

              acc.cierreOtros +=
                num(
                  r.cierre_otros
                );

              acc.cierreTotal +=
                num(
                  r.cierre_total
                );

              return acc;
            },
            {
              meta: 0,

              ventaQuimicos:
                0,

              ventaOtros:
                0,

              ventaTotal:
                0,

              pedidosQuimicos:
                0,

              pedidosTotal:
                0,

              entregasQuimicos:
                0,

              entregasTotal:
                0,

              cierreQuimicos:
                0,

              cierreOtros:
                0,

              cierreTotal:
                0,
            }
          );

        if (!activo) {
          return;
        }

        setMeta(
          totales.meta
        );

        setVentaQuimicos(
          totales.ventaQuimicos
        );

        setVentaOtros(
          totales.ventaOtros
        );

        setVentaTotal(
          totales.ventaTotal
        );

        setPedidosQuimicos(
          totales.pedidosQuimicos
        );

        setPedidosTotal(
          totales.pedidosTotal
        );

        setEntregasQuimicos(
          totales.entregasQuimicos
        );

        setEntregasTotal(
          totales.entregasTotal
        );

        setCierreQuimicos(
          totales.cierreQuimicos
        );

        setCierreOtros(
          totales.cierreOtros
        );

        setCierreTotal(
          totales.cierreTotal
        );

        // ======================================================
        // 7. INDICADORES EXISTENTES
        // ======================================================

        const [
          comodatosRes,
          facturasRes,
          alertasRes,
        ] =
          await Promise.all(
            [
              fetch(
                "/api/comodatos"
              ),

              fetch(
                `/api/facturas?email=${encodeURIComponent(
                  email
                )}`
              ),

              fetch(
                "/api/kpi/alertas-clientes-comodatos"
              ),
            ]
          );

        // ======================================================
        // COMODATOS
        // ======================================================

        if (
          comodatosRes.ok
        ) {
          const json =
            await comodatosRes.json();

          setComodatos(
            json?.data
              ?.length ||
              0
          );
        }

        // ======================================================
        // FACTURAS
        // ======================================================

        if (
          facturasRes.ok
        ) {
          const json =
            await facturasRes.json();

          const facturasUser =
            (
              json?.data ||
              []
            ).filter(
              (f: any) =>
                String(
                  f.EMAIL_COL ||
                    ""
                )
                  .toLowerCase()
                  .trim() ===
                email
            );

          setFacturas(
            facturasUser.length
          );
        }

        // ======================================================
        // ALERTAS
        // ======================================================

        if (
          alertasRes.ok
        ) {
          const json =
            await alertasRes.json();

          setAlertas(
            json?.data
              ?.length ||
              0
          );
        }
      } catch (
        err: any
      ) {
        console.error(
          "❌ Error cargando dashboard:",
          err
        );

        if (activo) {
          setErrorVentas(
            err?.message ||
              "No fue posible cargar tu información comercial."
          );
        }
      } finally {
        if (activo) {
          setLoading(
            false
          );
        }
      }
    }

    cargarDashboard();

    return () => {
      activo = false;
    };
  }, [supabase]);

  // ============================================================
  // CÁLCULOS
  // ============================================================

  const porcentaje =
    meta > 0
      ? (
          ventaQuimicos /
          meta
        ) *
        100
      : 0;

  const porcentajeCierre =
    meta > 0
      ? (
          cierreQuimicos /
          meta
        ) *
        100
      : 0;

  const faltanteMeta =
    Math.max(
      meta -
        ventaQuimicos,
      0
    );

  /*
   * GaugeChart funciona entre 0 y 1.
   *
   * Si supera 100%, la aguja llega
   * al máximo, pero el porcentaje
   * mostrado mantiene el valor real.
   */
  const porcentajeGauge =
    Math.min(
      Math.max(
        porcentaje /
          100,
        0
      ),
      1
    );

  // ============================================================
  // FECHA DEL CORTE
  // ============================================================

  const fechaReferencia =
    fechaCorte
      ? new Date(
          `${fechaCorte}T12:00:00`
        )
      : new Date();

  const mesLabel =
    fechaReferencia.toLocaleDateString(
      "es-CL",
      {
        month: "long",
      }
    );

  const mesTitulo =
    mesLabel
      .charAt(0)
      .toUpperCase() +
    mesLabel.slice(1);

  const anioLabel =
    fechaReferencia.getFullYear();

  // ============================================================
  // FECHA ACTUAL
  // ============================================================

  const today =
    new Date().toLocaleDateString(
      "es-CL",
      {
        weekday:
          "long",

        year:
          "numeric",

        month:
          "long",

        day:
          "numeric",
      }
    );

  const mensajes = [
    "🚀 Listo para un día productivo.",
    "📊 Revisa tus reportes y KPIs.",
    "⚡ Gestiona tus comodatos y ventas fácilmente.",
    "✅ No olvides dar seguimiento a tus clientes.",
  ];

  const mensaje =
    mensajes[
      new Date().getDate() %
        mensajes.length
    ];

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* ===================================================== */}
      {/* HEADER */}
      {/* ===================================================== */}

      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[#1f4ed8]" />

        <div className="absolute inset-y-0 right-[-20%] w-[60%] rotate-[-8deg] bg-sky-400/60" />

        <div className="relative mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center gap-4 md:gap-6">
            <Image
              src={
                LOGO_URL
              }
              alt="Spartan"
              width={
                200
              }
              height={
                60
              }
              unoptimized
              className="h-12 w-auto object-contain drop-shadow-sm md:h-20"
            />

            <div>
              <h1 className="text-2xl font-semibold uppercase tracking-widest text-white md:text-3xl">
                Spartan One
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-white/80">
                Bienvenido al panel central de gestión y reportes.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ===================================================== */}
      {/* CONTENIDO */}
      {/* ===================================================== */}

      <main className="relative mx-auto max-w-7xl space-y-5 px-6 py-6">
        {/* ================================================= */}
        {/* SALUDO */}
        {/* ================================================= */}

        <section className="rounded-2xl border bg-white p-4 text-center shadow-sm">
          <h2 className="text-xl font-bold text-[#2B6CFF] md:text-2xl">
            👋 Bienvenido
            {userEmail
              ? `, ${userEmail}`
              : ""}
          </h2>

          <p className="mt-1 text-sm text-zinc-600">
            {today}
          </p>

          <p className="mt-1.5 text-base font-medium">
            {mensaje}
          </p>
        </section>

        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {errorVentas && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {
              errorVentas
            }
          </div>
        )}

        {/* ================================================= */}
        {/* TACÓMETRO + KPIS */}
        {/* ================================================= */}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* ================================================= */}
          {/* TACÓMETRO */}
          {/* ================================================= */}

          <div className="xl:col-span-4">
            <div className="flex h-full min-h-[245px] flex-col rounded-2xl border bg-white p-4 shadow-sm">
              <h2 className="text-center text-lg font-semibold text-blue-600">
                Avance Meta{" "}
                {
                  mesTitulo
                }{" "}
                {
                  anioLabel
                }
              </h2>

              {loading ? (
                <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
                  Cargando información...
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <div className="w-full max-w-[265px]">
                    <GaugeChart
                      id="gauge-chart"
                      nrOfLevels={
                        20
                      }
                      percent={
                        porcentajeGauge
                      }
                      colors={[
                        "#dc2626",
                        "#eab308",
                        "#16a34a",
                      ]}
                      arcWidth={
                        0.24
                      }
                      textColor="#000000"
                      needleColor="#4b5563"
                      needleBaseColor="#4b5563"
                      hideText={
                        false
                      }
                      formatTextValue={() =>
                        `${porcentaje.toLocaleString(
                          "es-CL",
                          {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          }
                        )}%`
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================================================= */}
          {/* 4 KPI PRINCIPALES */}
          {/* ================================================= */}

          <div className="xl:col-span-8">
            <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2 sm:grid-rows-2">
              <KpiCard
                titulo="Venta Químicos"
                valor={money(
                  ventaQuimicos
                )}
                detalle={`${porcentaje.toLocaleString(
                  "es-CL",
                  {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }
                )}% de la meta`}
                tipo="blue"
              />

              <KpiCard
                titulo="Meta Químicos"
                valor={money(
                  meta
                )}
                detalle="Meta mensual"
                tipo="blue"
              />

              <KpiCard
                titulo="Faltante Meta"
                valor={money(
                  faltanteMeta
                )}
                detalle={
                  faltanteMeta ===
                    0 &&
                  meta > 0
                    ? "Meta alcanzada"
                    : "Sólo químicos"
                }
                tipo="orange"
              />

              <KpiCard
                titulo="Cierre Potencial Q"
                valor={money(
                  cierreQuimicos
                )}
                detalle={`${porcentajeCierre.toLocaleString(
                  "es-CL",
                  {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }
                )}% de la meta`}
                tipo="green"
              />
            </div>
          </div>
        </div>

        {/* ================================================= */}
        {/* SEGUNDA FILA */}
        {/* ================================================= */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            titulo="Venta Total"
            valor={money(
              ventaTotal
            )}
            detalle={`Otros: ${money(
              ventaOtros
            )}`}
            tipo="green"
          />

          <KpiCard
            titulo="Pedidos Abiertos"
            valor={money(
              pedidosTotal
            )}
            detalle={`Químicos: ${money(
              pedidosQuimicos
            )}`}
            tipo="blue"
          />

          <KpiCard
            titulo="Entregas"
            valor={money(
              entregasTotal
            )}
            detalle={`Químicos: ${money(
              entregasQuimicos
            )}`}
            tipo="purple"
          />

          <KpiCard
            titulo="Cierre Potencial Total"
            valor={money(
              cierreTotal
            )}
            detalle={`Otros: ${money(
              cierreOtros
            )}`}
            tipo="green"
          />
        </div>

        {/* ================================================= */}
        {/* INDICADORES EXISTENTES */}
        {/* ================================================= */}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Comodatos Activos
              </h3>

              <p className="mt-1.5 text-xl font-bold text-orange-600">
                {
                  comodatos
                }
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Facturas Emitidas
              </h3>

              <p className="mt-1.5 text-xl font-bold text-purple-600">
                {
                  facturas
                }
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-l-4 border-red-600 shadow-sm md:col-span-2">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-red-600">
                ⚠️ Alertas
              </h3>

              <p className="mt-1 text-lg font-bold text-red-700">
                Tienes{" "}
                {
                  alertas
                }{" "}
                clientes sin comprar
              </p>

              <a
                href="/kpi/alertas-clientes-comodatos"
                className="mt-1 inline-block text-sm text-blue-600 hover:underline"
              >
                Ver detalles →
              </a>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

// ============================================================
// KPI CARD
// ============================================================

function KpiCard({
  titulo,
  valor,
  detalle,
  tipo = "default",
}: {
  titulo: string;
  valor: string;
  detalle?: string;

  tipo?:
    | "default"
    | "blue"
    | "green"
    | "orange"
    | "purple";
}) {
  const estilos = {
    default:
      "border-gray-200",

    blue:
      "border-blue-200",

    green:
      "border-green-200",

    orange:
      "border-orange-200",

    purple:
      "border-purple-200",
  };

  return (
    <Card
      className={`${estilos[tipo]} h-full rounded-2xl shadow-sm`}
    >
      <CardContent className="flex h-full min-h-[112px] flex-col justify-center p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {
            titulo
          }
        </h3>

        <p className="mt-1.5 text-xl font-bold text-gray-900">
          {
            valor
          }
        </p>

        {detalle && (
          <p className="mt-1 text-sm text-gray-500">
            {
              detalle
            }
          </p>
        )}
      </CardContent>
    </Card>
  );
}