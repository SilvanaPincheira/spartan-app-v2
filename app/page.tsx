"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  FileText,
  FlaskConical,
  Hourglass,
  Lightbulb,
  PackageCheck,
  ShoppingCart,
  Target,
  TrendingUp,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const LOGO_URL =
  "https://assets.jumpseller.com/store/spartan-de-chile/themes/317202/options/27648963/Logo-spartan-white.png?1600810625";

// ============================================================
// FERIADOS CHILE
// Revisar / actualizar cada año
// ============================================================

const FERIADOS_CL = new Set<string>([
  "2026-01-01",
  "2026-04-03",
  "2026-05-01",
  "2026-05-21",
  "2026-06-29",
  "2026-07-16",
  "2026-09-18",
  "2026-10-12",
  "2026-12-08",
  "2026-12-25",
]);

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

type Estado =
  | "ok"
  | "warn"
  | "bad"
  | "done"
  | "neutral";

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

function pct(value: number) {
  return `${value.toLocaleString(
    "es-CL",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )}%`;
}

/*
 * IMPORTANTE:
 *
 * NO eliminamos prefijos.
 *
 * JUAN PRIETO
 * HC JUAN PRIETO
 *
 * son vendedores comerciales distintos.
 */
function nombreKey(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function nombreDesdeEmail(
  email: string | null
) {
  if (!email) {
    return "";
  }

  const primero =
    email
      .split("@")[0]
      .split(/[._-]/)[0] || "";

  return primero
    ? primero.charAt(0).toUpperCase() +
        primero.slice(1)
    : "";
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function esHabil(d: Date) {
  const dow =
    d.getDay();

  return (
    dow !== 0 &&
    dow !== 6 &&
    !FERIADOS_CL.has(
      ymd(d)
    )
  );
}

/*
 * Ritmo esperado:
 *
 * días hábiles transcurridos
 * ---------------------------
 * días hábiles totales del mes
 */
function calcularRitmo(
  base: Date
) {
  const year =
    base.getFullYear();

  const month =
    base.getMonth();

  const diaActual =
    base.getDate();

  const ultimoDia =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  let total = 0;
  let transcurridos = 0;

  for (
    let dia = 1;
    dia <= ultimoDia;
    dia++
  ) {
    const fecha =
      new Date(
        year,
        month,
        dia,
        12
      );

    if (
      esHabil(
        fecha
      )
    ) {
      total++;

      if (
        dia <=
        diaActual
      ) {
        transcurridos++;
      }
    }
  }

  return {
    total,

    transcurridos,

    restantes:
      total -
      transcurridos,

    ritmo:
      total > 0
        ? (transcurridos /
            total) *
          100
        : 0,
  };
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function HomeMenu() {
  const supabase =
    useMemo(
      () =>
        createClientComponentClient(),
      []
    );

  const [
    userEmail,
    setUserEmail,
  ] =
    useState<
      string | null
    >(null);

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
  ] =
    useState(0);

  const [
    ventaQuimicos,
    setVentaQuimicos,
  ] =
    useState(0);

  const [
    ventaOtros,
    setVentaOtros,
  ] =
    useState(0);

  const [
    ventaTotal,
    setVentaTotal,
  ] =
    useState(0);

  const [
    pedidosQuimicos,
    setPedidosQuimicos,
  ] =
    useState(0);

  const [
    pedidosTotal,
    setPedidosTotal,
  ] =
    useState(0);

  const [
    entregasQuimicos,
    setEntregasQuimicos,
  ] =
    useState(0);

  const [
    entregasTotal,
    setEntregasTotal,
  ] =
    useState(0);

  const [
    cierreQuimicos,
    setCierreQuimicos,
  ] =
    useState(0);

  const [
    cierreOtros,
    setCierreOtros,
  ] =
    useState(0);

  const [
    cierreTotal,
    setCierreTotal,
  ] =
    useState(0);

  // ============================================================
  // INDICADORES EXISTENTES
  // ============================================================

  const [
    comodatos,
    setComodatos,
  ] =
    useState(0);

  const [
    facturas,
    setFacturas,
  ] =
    useState(0);

  const [
    alertas,
    setAlertas,
  ] =
    useState(0);

  // ============================================================
  // CARGAR DASHBOARD
  // ============================================================

  useEffect(() => {
    let activo = true;

    async function cargarDashboard() {
      try {
        setLoading(
          true
        );

        setErrorVentas(
          ""
        );

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
          session
            ?.user
            ?.email
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
        } =
          await supabase
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
          data:
            corteData,

          error:
            corteError,
        } =
          await supabase
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
            .limit(
              1
            );

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

        if (
          !activo
        ) {
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
        } =
          await supabase
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
          ).filter(
            (r) =>
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

        if (
          !activo
        ) {
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

        if (
          activo
        ) {
          setErrorVentas(
            err?.message ||
              "No fue posible cargar tu información comercial."
          );
        }
      } finally {
        if (
          activo
        ) {
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
  }, [
    supabase,
  ]);

  // ============================================================
  // CÁLCULOS
  // ============================================================

  const porcentaje =
    meta > 0
      ? (ventaQuimicos /
          meta) *
        100
      : 0;

  const porcentajeCierre =
    meta > 0
      ? (cierreQuimicos /
          meta) *
        100
      : 0;

  const faltanteMeta =
    Math.max(
      meta -
        ventaQuimicos,
      0
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

  const {
    restantes,
    ritmo,
  } =
    calcularRitmo(
      fechaReferencia
    );

  const necesarioPorDia =
    restantes > 0
      ? faltanteMeta /
        restantes
      : faltanteMeta;

  // ============================================================
  // ESTADO
  // ============================================================

  const estado: Estado =
    meta <= 0
      ? "neutral"
      : faltanteMeta ===
        0
      ? "done"
      : porcentaje >=
        ritmo
      ? "ok"
      : porcentaje >=
        ritmo - 10
      ? "warn"
      : "bad";

  // ============================================================
  // FECHAS
  // ============================================================

  const mesLabel =
    fechaReferencia.toLocaleDateString(
      "es-CL",
      {
        month:
          "long",
      }
    );

  const anioLabel =
    fechaReferencia.getFullYear();

  const fechaCorteLabel =
    fechaCorte
      ? fechaReferencia.toLocaleDateString(
          "es-CL",
          {
            day:
              "numeric",

            month:
              "long",
          }
        )
      : "";

  const today =
    new Date().toLocaleDateString(
      "es-CL",
      {
        weekday:
          "long",

        day:
          "numeric",

        month:
          "long",
      }
    );

  const nombre =
    nombreDesdeEmail(
      userEmail
    );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-900">
      {/* ===================================================== */}
      {/* HEADER RESPONSIVE */}
      {/* ===================================================== */}

      <header className="relative overflow-hidden bg-[#1f4ed8]">
        {/* Decoración solo escritorio/tablet */}
        <div className="pointer-events-none absolute inset-0 hidden md:block">
          <div className="absolute inset-y-0 right-[-12%] w-[48%] -skew-x-12 bg-sky-500/70" />

          <div className="absolute inset-y-0 right-[-18%] w-[28%] -skew-x-12 bg-sky-300/30" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 py-5 sm:px-6 md:py-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-6">
            {/* LOGO + INFORMACIÓN */}

            <div className="flex min-w-0 items-center gap-4 md:gap-6">
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
                className="h-14 w-auto shrink-0 object-contain drop-shadow-sm sm:h-16 md:h-20"
              />

              <div className="min-w-0">
                <h1 className="whitespace-nowrap text-2xl font-semibold uppercase tracking-[0.16em] text-white sm:text-3xl md:tracking-[0.2em]">
                  Spartan One
                </h1>

                {/* En móvil saludo y fecha separados */}
                <div className="mt-2 flex flex-col gap-0.5 text-sm text-blue-100 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
                  {nombre && (
                    <span className="font-medium text-white">
                      Hola,{" "}
                      {
                        nombre
                      }
                    </span>
                  )}

                  {nombre && (
                    <span className="hidden sm:inline text-blue-200">
                      ·
                    </span>
                  )}

                  <span className="leading-relaxed first-letter:uppercase">
                    {
                      today
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* DÍAS HÁBILES
                En móvil queda debajo.
                En escritorio queda a la derecha.
            */}

            {!loading &&
              meta >
                0 && (
                <div className="inline-flex w-fit max-w-full shrink-0 items-center gap-2 self-start rounded-xl border border-white/30 bg-white/10 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm backdrop-blur-sm md:self-center">
                  <CalendarDays className="h-4 w-4 shrink-0" />

                  <span className="whitespace-nowrap">
                    {
                      restantes
                    }{" "}
                    {restantes ===
                    1
                      ? "día hábil"
                      : "días hábiles"}{" "}
                    restantes
                  </span>
                </div>
              )}
          </div>
        </div>
      </header>

      {/* ===================================================== */}
      {/* CONTENIDO */}
      {/* ===================================================== */}

      <main className="relative mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {errorVentas && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

            {
              errorVentas
            }
          </div>
        )}

        {/* ================================================= */}
        {/* AVISO DE RITMO */}
        {/* ================================================= */}

        {!loading &&
          !errorVentas &&
          estado !==
            "neutral" && (
            <RitmoBanner
              estado={
                estado
              }
              ritmo={
                ritmo
              }
              necesarioPorDia={
                necesarioPorDia
              }
              restantes={
                restantes
              }
              faltante={
                faltanteMeta
              }
            />
          )}

        {/* ================================================= */}
        {/* TACÓMETRO + KPIS */}
        {/* ================================================= */}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* ================================================= */}
          {/* TACÓMETRO */}
          {/* ================================================= */}

          <div className="xl:col-span-5">
            <div className="flex h-full min-h-[250px] flex-col items-center rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:min-h-[260px] sm:p-5">
              <h2 className="text-center text-lg font-semibold text-blue-600 first-letter:uppercase sm:text-xl">
                Avance meta{" "}
                {
                  mesLabel
                }{" "}
                {
                  anioLabel
                }
              </h2>

              {loading ? (
                <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
                  Cargando información...
                </div>
              ) : (
                <>
                  <Gauge
                    value={
                      porcentaje
                    }
                    pace={
                      ritmo
                    }
                  />

                  <p className="-mt-1 text-3xl font-bold tracking-tight sm:-mt-2 sm:text-4xl">
                    {pct(
                      porcentaje
                    )}
                  </p>

                  <p className="text-sm text-zinc-500">
                    de{" "}
                    {money(
                      meta
                    )}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#1f4ed8]" />

                      Tu avance
                    </span>

                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-0.5 bg-zinc-900" />

                      Ritmo esperado{" "}
                      {pct(
                        ritmo
                      )}
                    </span>
                  </div>

                  {fechaCorteLabel && (
                    <p className="mt-2 text-[11px] text-zinc-400">
                      Datos al{" "}
                      {
                        fechaCorteLabel
                      }
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ================================================= */}
          {/* 4 KPI PRINCIPALES */}
          {/* ================================================= */}

          <div className="xl:col-span-7">
            <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2 sm:grid-rows-2">
              <KpiCard
                titulo="Venta químicos"
                valor={money(
                  ventaQuimicos
                )}
                detalle={`${pct(
                  porcentaje
                )} de la meta`}
                icon={
                  FlaskConical
                }
                tone="blue"
                loading={
                  loading
                }
              />

              <KpiCard
                titulo="Meta químicos"
                valor={money(
                  meta
                )}
                detalle="Meta mensual"
                icon={
                  Target
                }
                tone="violet"
                loading={
                  loading
                }
              />

              <KpiCard
                titulo="Faltante meta"
                valor={money(
                  faltanteMeta
                )}
                detalle={
                  faltanteMeta ===
                    0 &&
                  meta >
                    0
                    ? "Meta alcanzada"
                    : `${pct(
                        Math.max(
                          100 -
                            porcentaje,
                          0
                        )
                      )} por cubrir`
                }
                icon={
                  Hourglass
                }
                tone="amber"
                loading={
                  loading
                }
              />

              <KpiCard
                titulo="Cierre potencial Q"
                valor={money(
                  cierreQuimicos
                )}
                detalle={`${pct(
                  porcentajeCierre
                )} de la meta`}
                icon={
                  TrendingUp
                }
                tone="emerald"
                progress={
                  porcentajeCierre
                }
                loading={
                  loading
                }
              />
            </div>
          </div>
        </div>

        {/* ================================================= */}
        {/* SEGUNDA FILA */}
        {/* ================================================= */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MiniKpi
            titulo="Venta total"
            valor={money(
              ventaTotal
            )}
            detalle={`Otros: ${money(
              ventaOtros
            )}`}
            icon={
              Banknote
            }
            loading={
              loading
            }
          />

          <MiniKpi
            titulo="Pedidos abiertos"
            valor={money(
              pedidosTotal
            )}
            detalle={`Químicos: ${money(
              pedidosQuimicos
            )}`}
            icon={
              ShoppingCart
            }
            loading={
              loading
            }
          />

          <MiniKpi
            titulo="Entregas"
            valor={money(
              entregasTotal
            )}
            detalle={`Químicos: ${money(
              entregasQuimicos
            )}`}
            icon={
              Truck
            }
            loading={
              loading
            }
          />

          <MiniKpi
            titulo="Cierre potencial total"
            valor={money(
              cierreTotal
            )}
            detalle={`Otros: ${money(
              cierreOtros
            )}`}
            icon={
              PackageCheck
            }
            loading={
              loading
            }
          />
        </div>

        {/* ================================================= */}
        {/* OTROS INDICADORES */}
        {/* ================================================= */}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MiniKpi
            titulo="Comodatos activos"
            valor={String(
              comodatos
            )}
            icon={
              Wrench
            }
            loading={
              loading
            }
          />

          <MiniKpi
            titulo="Facturas emitidas"
            valor={String(
              facturas
            )}
            icon={
              FileText
            }
            loading={
              loading
            }
          />

          <a
            href="/kpi/alertas-clientes-comodatos"
            className="group flex items-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm transition hover:border-red-300 hover:shadow-md"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-red-600">
                Alertas
              </p>

              <p className="text-base font-semibold text-red-800">
                {
                  alertas
                }{" "}
                {alertas ===
                1
                  ? "cliente"
                  : "clientes"}{" "}
                sin comprar
              </p>
            </div>

            <ArrowRight className="h-4 w-4 shrink-0 text-red-400 transition group-hover:translate-x-0.5 group-hover:text-red-600" />
          </a>
        </div>
      </main>
    </div>
  );
}

// ============================================================
// BANNER DE RITMO
// ============================================================

function RitmoBanner({
  estado,
  ritmo,
  necesarioPorDia,
  restantes,
  faltante,
}: {
  estado: Estado;
  ritmo: number;
  necesarioPorDia: number;
  restantes: number;
  faltante: number;
}) {
  const estilos: Record<
    Estado,
    string
  > = {
    ok:
      "border-emerald-200 bg-emerald-50 text-emerald-800",

    done:
      "border-emerald-200 bg-emerald-50 text-emerald-800",

    warn:
      "border-amber-200 bg-amber-50 text-amber-800",

    bad:
      "border-red-200 bg-red-50 text-red-800",

    neutral:
      "border-zinc-200 bg-white text-zinc-700",
  };

  const Icono =
    estado === "ok" ||
    estado === "done"
      ? CheckCircle2
      : Lightbulb;

  let texto:
    ReactNode;

  if (
    estado ===
    "done"
  ) {
    texto = (
      <>
        ¡Meta alcanzada! Todo lo
        que factures desde ahora
        suma sobre la meta.
      </>
    );
  } else if (
    restantes ===
    0
  ) {
    texto = (
      <>
        Último día hábil del mes.
        Faltan{" "}
        <b>
          {money(
            faltante
          )}
        </b>{" "}
        para la meta.
      </>
    );
  } else if (
    estado ===
    "ok"
  ) {
    texto = (
      <>
        Tu avance está sobre el
        ritmo esperado del mes (
        {pct(
          ritmo
        )}
        ). Para alcanzar la meta
        necesitas promediar{" "}
        <b>
          {money(
            necesarioPorDia
          )}
        </b>{" "}
        por día hábil restante.
      </>
    );
  } else {
    texto = (
      <>
        Tu avance está bajo el
        ritmo esperado del mes. A
        esta fecha, el avance
        esperado es{" "}
        <b>
          {pct(
            ritmo
          )}
        </b>
        . Para alcanzar la meta
        necesitas promediar{" "}
        <b>
          {money(
            necesarioPorDia
          )}
        </b>{" "}
        por día hábil restante.
      </>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed sm:items-center ${estilos[estado]}`}
    >
      <Icono className="mt-0.5 h-5 w-5 shrink-0 sm:mt-0" />

      <p className="[&_b]:font-semibold">
        {
          texto
        }
      </p>
    </div>
  );
}

// ============================================================
// TACÓMETRO SVG
// ============================================================

function Gauge({
  value,
  pace,
}: {
  value: number;
  pace: number;
}) {
  const cx =
    100;

  const cy =
    100;

  const n =
    24;

  const avance =
    Math.min(
      Math.max(
        value /
          100,
        0
      ),
      1
    );

  const ritmo =
    Math.min(
      Math.max(
        pace /
          100,
        0
      ),
      1
    );

  const punto = (
    t: number,
    r: number
  ) => {
    const a =
      Math.PI *
      (1 - t);

    return {
      x:
        cx +
        r *
          Math.cos(
            a
          ),

      y:
        cy -
        r *
          Math.sin(
            a
          ),
    };
  };

  const segmentos =
    Array.from(
      {
        length:
          n,
      },

      (
        _,
        i
      ) => {
        const t =
          (i +
            0.5) /
          n;

        const p1 =
          punto(
            t,
            66
          );

        const p2 =
          punto(
            t,
            86
          );

        const color =
          t <
          0.34
            ? "#ef4444"
            : t <
              0.67
            ? "#f59e0b"
            : "#16a34a";

        return {
          p1,
          p2,

          color:
            t <=
            avance
              ? color
              : "#e4e4e7",
        };
      }
    );

  const r1 =
    punto(
      ritmo,
      58
    );

  const r2 =
    punto(
      ritmo,
      94
    );

  const aguja =
    punto(
      avance,
      56
    );

  return (
    <svg
      viewBox="0 0 200 112"
      className="mt-3 w-full max-w-[300px]"
      role="img"
      aria-label={`Avance ${value.toFixed(
        1
      )}% de la meta`}
    >
      {segmentos.map(
        (
          s,
          i
        ) => (
          <line
            key={
              i
            }
            x1={
              s.p1.x
            }
            y1={
              s.p1.y
            }
            x2={
              s.p2.x
            }
            y2={
              s.p2.y
            }
            stroke={
              s.color
            }
            strokeWidth={
              7
            }
            strokeLinecap="round"
          />
        )
      )}

      {/* Marca ritmo esperado */}

      <line
        x1={
          r1.x
        }
        y1={
          r1.y
        }
        x2={
          r2.x
        }
        y2={
          r2.y
        }
        stroke="#18181b"
        strokeWidth={
          2
        }
      />

      {/* Aguja */}

      <line
        x1={
          cx
        }
        y1={
          cy
        }
        x2={
          aguja.x
        }
        y2={
          aguja.y
        }
        stroke="#1f4ed8"
        strokeWidth={
          4
        }
        strokeLinecap="round"
        style={{
          transition:
            "all 700ms ease-out",
        }}
      />

      <circle
        cx={
          cx
        }
        cy={
          cy
        }
        r={
          7
        }
        fill="#1f4ed8"
      />

      <circle
        cx={
          cx
        }
        cy={
          cy
        }
        r={
          3
        }
        fill="#fff"
      />
    </svg>
  );
}

// ============================================================
// KPI PRINCIPAL
// ============================================================

type Tone =
  | "blue"
  | "violet"
  | "amber"
  | "emerald";

const TONOS: Record<
  Tone,
  {
    barra: string;
    icono: string;
    progreso: string;
  }
> = {
  blue: {
    barra:
      "bg-blue-500",

    icono:
      "bg-blue-50 text-blue-600",

    progreso:
      "bg-blue-500",
  },

  violet: {
    barra:
      "bg-violet-500",

    icono:
      "bg-violet-50 text-violet-600",

    progreso:
      "bg-violet-500",
  },

  amber: {
    barra:
      "bg-amber-400",

    icono:
      "bg-amber-50 text-amber-600",

    progreso:
      "bg-amber-400",
  },

  emerald: {
    barra:
      "bg-emerald-500",

    icono:
      "bg-emerald-50 text-emerald-600",

    progreso:
      "bg-emerald-500",
  },
};

function KpiCard({
  titulo,
  valor,
  detalle,
  icon: Icon,
  tone,
  progress,
  loading,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  icon: LucideIcon;
  tone: Tone;
  progress?: number;
  loading?: boolean;
}) {
  const t =
    TONOS[
      tone
    ];

  return (
    <div className="relative flex h-full min-h-[115px] flex-col justify-center overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-4 pt-5 shadow-sm transition hover:shadow-md sm:min-h-[120px]">
      <div
        className={`absolute inset-x-0 top-0 h-1 ${t.barra}`}
      />

      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${t.icono}`}
        >
          <Icon className="h-4 w-4" />
        </span>

        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {
            titulo
          }
        </h3>
      </div>

      {loading ? (
        <Skeleton />
      ) : (
        <>
          <p className="mt-2 break-words text-xl font-bold tracking-tight sm:text-2xl">
            {
              valor
            }
          </p>

          {typeof progress ===
            "number" && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${t.progreso} transition-all duration-700`}
                style={{
                  width: `${Math.min(
                    Math.max(
                      progress,
                      0
                    ),
                    100
                  )}%`,
                }}
              />
            </div>
          )}

          {detalle && (
            <p className="mt-1 text-sm text-zinc-500">
              {
                detalle
              }
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// MINI KPI
// ============================================================

function MiniKpi({
  titulo,
  valor,
  detalle,
  icon: Icon,
  loading,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  icon: LucideIcon;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1f4ed8]">
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {
            titulo
          }
        </h3>

        {loading ? (
          <Skeleton
            small
          />
        ) : (
          <>
            <p className="truncate text-lg font-bold tracking-tight">
              {
                valor
              }
            </p>

            {detalle && (
              <p className="truncate text-xs text-zinc-500">
                {
                  detalle
                }
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SKELETON
// ============================================================

function Skeleton({
  small = false,
}: {
  small?: boolean;
}) {
  return (
    <div className="mt-2 space-y-2">
      <div
        className={`animate-pulse rounded bg-zinc-100 ${
          small
            ? "h-5 w-28"
            : "h-7 w-40"
        }`}
      />

      <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
    </div>
  );
}