"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type ReporteRow = {
  fecha_corte: string;
  anio: number;
  mes: number;

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
  return `${value.toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function clasePct(value: number) {
  if (value >= 100) {
    return "bg-green-100 text-green-800";
  }

  if (value >= 80) {
    return "bg-yellow-100 text-yellow-800";
  }

  return "bg-red-100 text-red-700";
}

function formatSync(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return date.toLocaleString(
    "es-CL",
    {
      dateStyle: "short",
      timeStyle: "medium",
    }
  );
}

export default function AvanceDiarioPage() {
  const supabase = useMemo(
    () => createClientComponentClient(),
    []
  );

  const [rows, setRows] =
    useState<ReporteRow[]>([]);

  const [fechaCorte, setFechaCorte] =
    useState("");

  const [zonaFiltro, setZonaFiltro] =
    useState("TODAS");

  const [divisionFiltro, setDivisionFiltro] =
    useState("TODAS");

  const [equipoFiltro, setEquipoFiltro] =
    useState("TODOS");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // =========================================================
  // OBTENER ÚLTIMA FECHA DISPONIBLE
  // =========================================================

  const obtenerUltimaFecha =
    useCallback(async () => {
      const {
        data,
        error,
      } = await supabase
        .from(
          "reporte_ventas_diario"
        )
        .select("fecha_corte")
        .order(
          "fecha_corte",
          {
            ascending: false,
          }
        )
        .limit(1);

      if (error) {
        throw error;
      }

      return (
        data?.[0]
          ?.fecha_corte || ""
      );
    }, [supabase]);

  // =========================================================
  // CARGAR DATOS
  // =========================================================

  const cargar =
    useCallback(
      async (
        fechaSolicitada?: string
      ) => {
        try {
          setLoading(true);
          setError("");

          let fecha =
            fechaSolicitada || "";

          if (!fecha) {
            fecha =
              await obtenerUltimaFecha();
          }

          if (!fecha) {
            setRows([]);

            setError(
              "No existen datos disponibles."
            );

            return;
          }

          setFechaCorte(fecha);

          const {
            data,
            error,
          } = await supabase
            .from(
              "reporte_ventas_diario"
            )
            .select(`
              fecha_corte,
              anio,
              mes,
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
              fecha
            )
            .order("zona")
            .order("vendedor");

          if (error) {
            throw error;
          }

          setRows(
            (data ||
              []) as ReporteRow[]
          );
        } catch (err: any) {
          console.error(err);

          setError(
            err?.message ||
              "No fue posible cargar el Avance Diario."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        supabase,
        obtenerUltimaFecha,
      ]
    );

  // =========================================================
  // CARGA INICIAL
  // =========================================================

  useEffect(() => {
    cargar();
  }, [cargar]);

  // =========================================================
  // REFRESCO AUTOMÁTICO CADA 5 MIN
  // =========================================================

  useEffect(() => {
    if (!fechaCorte) {
      return;
    }

    const interval =
      window.setInterval(() => {
        cargar(fechaCorte);
      }, 5 * 60 * 1000);

    return () =>
      window.clearInterval(
        interval
      );
  }, [
    fechaCorte,
    cargar,
  ]);

  // =========================================================
  // FILTROS
  // =========================================================

  const zonas =
    useMemo(() => {
      return [
        ...new Set(
          rows
            .map(
              (r) =>
                r.zona || ""
            )
            .filter(Boolean)
        ),
      ].sort();
    }, [rows]);

  const divisiones =
    useMemo(() => {
      return [
        ...new Set(
          rows
            .filter(
              (r) =>
                zonaFiltro ===
                  "TODAS" ||
                r.zona ===
                  zonaFiltro
            )
            .map(
              (r) =>
                r.division ||
                ""
            )
            .filter(Boolean)
        ),
      ].sort();
    }, [
      rows,
      zonaFiltro,
    ]);

  const equipos =
    useMemo(() => {
      return [
        ...new Set(
          rows
            .filter(
              (r) => {
                if (
                  zonaFiltro !==
                    "TODAS" &&
                  r.zona !==
                    zonaFiltro
                ) {
                  return false;
                }

                if (
                  divisionFiltro !==
                    "TODAS" &&
                  r.division !==
                    divisionFiltro
                ) {
                  return false;
                }

                return true;
              }
            )
            .map(
              (r) =>
                r.equipo || ""
            )
            .filter(Boolean)
        ),
      ].sort();
    }, [
      rows,
      zonaFiltro,
      divisionFiltro,
    ]);

  const filtrados =
    useMemo(() => {
      return rows.filter(
        (r) => {
          if (
            zonaFiltro !==
              "TODAS" &&
            r.zona !==
              zonaFiltro
          ) {
            return false;
          }

          if (
            divisionFiltro !==
              "TODAS" &&
            r.division !==
              divisionFiltro
          ) {
            return false;
          }

          if (
            equipoFiltro !==
              "TODOS" &&
            r.equipo !==
              equipoFiltro
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      rows,
      zonaFiltro,
      divisionFiltro,
      equipoFiltro,
    ]);

  useEffect(() => {
    setDivisionFiltro(
      "TODAS"
    );

    setEquipoFiltro(
      "TODOS"
    );
  }, [zonaFiltro]);

  useEffect(() => {
    setEquipoFiltro(
      "TODOS"
    );
  }, [divisionFiltro]);

  // =========================================================
  // TOTALIZAR
  // =========================================================

  function totalizar(
    lista: ReporteRow[]
  ) {
    const total = {
      meta: 0,

      facturadoQuimicos: 0,
      facturadoOtros: 0,
      facturadoTotal: 0,

      pedidosQuimicos: 0,
      pedidosOtros: 0,
      pedidosTotal: 0,

      entregasQuimicos: 0,
      entregasOtros: 0,
      entregasTotal: 0,

      cierreQuimicos: 0,
      cierreOtros: 0,
      cierreTotal: 0,
    };

    lista.forEach((r) => {
      total.meta +=
        num(r.meta_mes);

      total.facturadoQuimicos +=
        num(
          r.facturado_quimicos
        );

      total.facturadoOtros +=
        num(
          r.facturado_otros
        );

      total.facturadoTotal +=
        num(
          r.facturado_total
        );

      total.pedidosQuimicos +=
        num(
          r.pedidos_quimicos
        );

      total.pedidosOtros +=
        num(
          r.pedidos_otros
        );

      total.pedidosTotal +=
        num(
          r.pedidos_total
        );

      total.entregasQuimicos +=
        num(
          r.entregas_quimicos
        );

      total.entregasOtros +=
        num(
          r.entregas_otros
        );

      total.entregasTotal +=
        num(
          r.entregas_total
        );

      total.cierreQuimicos +=
        num(
          r.cierre_quimicos
        );

      total.cierreOtros +=
        num(
          r.cierre_otros
        );

      total.cierreTotal +=
        num(
          r.cierre_total
        );
    });

    return {
      ...total,

      avance:
        total.meta > 0
          ? (
              total.facturadoQuimicos /
              total.meta
            ) *
            100
          : 0,

      cierrePct:
        total.meta > 0
          ? (
              total.cierreQuimicos /
              total.meta
            ) *
            100
          : 0,

      faltante:
        total.meta -
        total.facturadoQuimicos,
    };
  }

  const totalGeneral =
    useMemo(
      () =>
        totalizar(
          filtrados
        ),
      [filtrados]
    );

  // =========================================================
  // AGRUPAR POR ZONA
  // =========================================================

  const grupos =
    useMemo(() => {
      const mapa =
        new Map<
          string,
          ReporteRow[]
        >();

      filtrados.forEach(
        (r) => {
          const zona =
            r.zona ||
            "SIN ZONA";

          if (
            !mapa.has(zona)
          ) {
            mapa.set(
              zona,
              []
            );
          }

          mapa
            .get(zona)!
            .push(r);
        }
      );

      const orden: Record<
        string,
        number
      > = {
        CENTRO: 1,
        NORTE: 2,
        SUR: 3,
      };

      return [
        ...mapa.entries(),
      ].sort(
        ([a], [b]) =>
          (orden[a] || 99) -
          (orden[b] || 99)
      );
    }, [filtrados]);

  // =========================================================
  // ÚLTIMA SINCRONIZACIÓN
  // =========================================================

  const ultimaSync =
    useMemo(() => {
      if (
        rows.length === 0
      ) {
        return null;
      }

      const fechas =
        rows
          .map(
            (r) =>
              r.synced_at
          )
          .filter(
            (
              x
            ): x is string =>
              !!x
          )
          .map(
            (x) =>
              new Date(x)
          )
          .sort(
            (a, b) =>
              b.getTime() -
              a.getTime()
          );

      return fechas[0]
        ? fechas[0].toISOString()
        : null;
    }, [rows]);

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="space-y-5">
      {/* HEADER */}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Avance Diario
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Seguimiento automático de
            ventas, metas, pedidos,
            entregas y cierre potencial.
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs uppercase text-gray-400">
            Última sincronización SAP
          </div>

          <div className="mt-1 text-sm font-semibold text-gray-700">
            {formatSync(
              ultimaSync
            )}
          </div>

          <Link
            href="/tablero-control"
            className="mt-2 inline-block text-sm font-semibold text-[#1f4ed8] hover:underline"
          >
            ← Volver al Tablero
          </Link>
        </div>
      </div>

      {/* FILTROS */}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Filtro label="Fecha de corte">
            <input
              type="date"
              value={
                fechaCorte
              }
              onChange={(e) =>
                setFechaCorte(
                  e.target.value
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            />
          </Filtro>

          <Filtro label="Zona">
            <select
              value={
                zonaFiltro
              }
              onChange={(e) =>
                setZonaFiltro(
                  e.target.value
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="TODAS">
                Todas
              </option>

              {zonas.map(
                (z) => (
                  <option
                    key={z}
                    value={z}
                  >
                    {z}
                  </option>
                )
              )}
            </select>
          </Filtro>

          <Filtro label="División">
            <select
              value={
                divisionFiltro
              }
              onChange={(e) =>
                setDivisionFiltro(
                  e.target.value
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="TODAS">
                Todas
              </option>

              {divisiones.map(
                (d) => (
                  <option
                    key={d}
                    value={d}
                  >
                    {d}
                  </option>
                )
              )}
            </select>
          </Filtro>

          <Filtro label="Equipo">
            <select
              value={
                equipoFiltro
              }
              onChange={(e) =>
                setEquipoFiltro(
                  e.target.value
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="TODOS">
                Todos
              </option>

              {equipos.map(
                (e) => (
                  <option
                    key={e}
                    value={e}
                  >
                    {e}
                  </option>
                )
              )}
            </select>
          </Filtro>

          <div className="flex items-end">
            <button
              onClick={() =>
                cargar(
                  fechaCorte
                )
              }
              disabled={
                loading
              }
              className="w-full rounded-lg bg-[#1f4ed8] px-4 py-2 font-semibold text-white hover:bg-[#163bb8] disabled:opacity-50"
            >
              {loading
                ? "Actualizando..."
                : "Actualizar"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPIs */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          titulo="Meta Químicos"
          valor={money(
            totalGeneral.meta
          )}
          detalle="Meta mensual"
        />

        <Kpi
          titulo="Venta Químicos"
          valor={money(
            totalGeneral.facturadoQuimicos
          )}
          detalle={`${pct(
            totalGeneral.avance
          )} de la meta`}
          destacado
        />

        <Kpi
          titulo="Venta Total"
          valor={money(
            totalGeneral.facturadoTotal
          )}
          detalle={`Otros: ${money(
            totalGeneral.facturadoOtros
          )}`}
        />

        <Kpi
          titulo="Faltante Meta"
          valor={money(
            Math.max(
              totalGeneral.faltante,
              0
            )
          )}
          detalle={
            totalGeneral.faltante <=
            0
              ? "Meta alcanzada"
              : "Sólo químicos"
          }
        />

        <Kpi
          titulo="Pedidos Abiertos"
          valor={money(
            totalGeneral.pedidosTotal
          )}
          detalle={`Químicos: ${money(
            totalGeneral.pedidosQuimicos
          )}`}
        />

        <Kpi
          titulo="Entregas"
          valor={money(
            totalGeneral.entregasTotal
          )}
          detalle={`Químicos: ${money(
            totalGeneral.entregasQuimicos
          )}`}
        />

        <Kpi
          titulo="Cierre Potencial Q"
          valor={money(
            totalGeneral.cierreQuimicos
          )}
          detalle={`${pct(
            totalGeneral.cierrePct
          )} de la meta`}
          destacado
        />

        <Kpi
          titulo="Cierre Potencial Total"
          valor={money(
            totalGeneral.cierreTotal
          )}
          detalle={`Otros: ${money(
            totalGeneral.cierreOtros
          )}`}
        />
      </div>

      {/* RESUMEN POR ZONA */}

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-bold text-gray-900">
            Resumen por Zona
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            Valores acumulados a la fecha
            seleccionada.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <Th>Zona</Th>
                <Th>Meta Q</Th>
                <Th>Venta Q</Th>
                <Th>% Avance</Th>
                <Th>Venta Otros</Th>
                <Th>Venta Total</Th>
                <Th>Pedidos</Th>
                <Th>Entregas</Th>
                <Th>Cierre Q</Th>
                <Th>% Cierre</Th>
                <Th>Cierre Total</Th>
              </tr>
            </thead>

            <tbody>
              <FilaResumen
                nombre="TOTAL"
                total={
                  totalGeneral
                }
                totalGeneral
              />

              {grupos.map(
                ([
                  zona,
                  lista,
                ]) => {
                  const t =
                    totalizar(
                      lista
                    );

                  return (
                    <FilaResumen
                      key={
                        zona
                      }
                      nombre={
                        zona
                      }
                      total={
                        t
                      }
                    />
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETALLE VENDEDORES */}

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-bold text-gray-900">
            Detalle por Vendedor
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            Información proveniente
            automáticamente de SAP.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1450px] w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50">
                <Th>
                  Zona
                </Th>

                <Th>
                  Vendedor
                </Th>

                <Th>
                  División
                </Th>

                <Th>
                  Equipo
                </Th>

                <Th>
                  Meta Q
                </Th>

                <Th>
                  Venta Q
                </Th>

                <Th>
                  % Avance
                </Th>

                <Th>
                  Otros
                </Th>

                <Th>
                  Venta Total
                </Th>

                <Th>
                  Pedidos
                </Th>

                <Th>
                  Entregas
                </Th>

                <Th>
                  Cierre Q
                </Th>

                <Th>
                  % Cierre
                </Th>

                <Th>
                  Cierre Total
                </Th>
              </tr>
            </thead>

            <tbody>
              {filtrados.map(
                (r) => {
                  const meta =
                    num(
                      r.meta_mes
                    );

                  const ventaQ =
                    num(
                      r.facturado_quimicos
                    );

                  const cierreQ =
                    num(
                      r.cierre_quimicos
                    );

                  const avance =
                    meta > 0
                      ? (
                          ventaQ /
                          meta
                        ) *
                        100
                      : 0;

                  const cierrePct =
                    meta > 0
                      ? (
                          cierreQ /
                          meta
                        ) *
                        100
                      : 0;

                  return (
                    <tr
                      key={`${r.fecha_corte}-${r.slpcode}`}
                      className="hover:bg-gray-50"
                    >
                      <Td izquierda>
                        {r.zona ||
                          "—"}
                      </Td>

                      <Td
                        izquierda
                        fuerte
                      >
                        {
                          r.vendedor
                        }
                      </Td>

                      <Td izquierda>
                        {r.division ||
                          "—"}
                      </Td>

                      <Td izquierda>
                        {r.equipo ||
                          "—"}
                      </Td>

                      <Td>
                        {money(
                          meta
                        )}
                      </Td>

                      <Td>
                        {money(
                          ventaQ
                        )}
                      </Td>

                      <Td
                        clase={clasePct(
                          avance
                        )}
                      >
                        {pct(
                          avance
                        )}
                      </Td>

                      <Td>
                        {money(
                          r.facturado_otros
                        )}
                      </Td>

                      <Td fuerte>
                        {money(
                          r.facturado_total
                        )}
                      </Td>

                      <Td>
                        {money(
                          r.pedidos_total
                        )}
                      </Td>

                      <Td>
                        {money(
                          r.entregas_total
                        )}
                      </Td>

                      <Td>
                        {money(
                          cierreQ
                        )}
                      </Td>

                      <Td
                        clase={clasePct(
                          cierrePct
                        )}
                      >
                        {pct(
                          cierrePct
                        )}
                      </Td>

                      <Td fuerte>
                        {money(
                          r.cierre_total
                        )}
                      </Td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// COMPONENTES
// =========================================================

function Filtro({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
        {label}
      </label>

      {children}
    </div>
  );
}

function Kpi({
  titulo,
  valor,
  detalle,
  destacado = false,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-5 shadow-sm ${
        destacado
          ? "border-blue-200"
          : ""
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {titulo}
      </div>

      <div className="mt-2 text-2xl font-bold text-gray-900">
        {valor}
      </div>

      <div
        className={`mt-2 text-sm ${
          destacado
            ? "font-semibold text-[#1f4ed8]"
            : "text-gray-500"
        }`}
      >
        {detalle}
      </div>
    </div>
  );
}

function Th({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="border-b border-r px-3 py-3 text-center font-semibold text-gray-700 last:border-r-0">
      {children}
    </th>
  );
}

function Td({
  children,
  izquierda = false,
  fuerte = false,
  clase = "",
}: {
  children: React.ReactNode;
  izquierda?: boolean;
  fuerte?: boolean;
  clase?: string;
}) {
  return (
    <td
      className={`border-b border-r px-3 py-2.5 last:border-r-0 ${
        izquierda
          ? "text-left"
          : "text-right"
      } ${
        fuerte
          ? "font-semibold"
          : ""
      } ${clase}`}
    >
      {children}
    </td>
  );
}

function FilaResumen({
  nombre,
  total,
  totalGeneral = false,
}: {
  nombre: string;

  total: {
    meta: number;
    facturadoQuimicos: number;
    facturadoOtros: number;
    facturadoTotal: number;
    pedidosQuimicos: number;
    pedidosOtros: number;
    pedidosTotal: number;
    entregasQuimicos: number;
    entregasOtros: number;
    entregasTotal: number;
    cierreQuimicos: number;
    cierreOtros: number;
    cierreTotal: number;
    avance: number;
    cierrePct: number;
    faltante: number;
  };

  totalGeneral?: boolean;
}) {
  return (
    <tr
      className={
        totalGeneral
          ? "bg-gray-200 font-bold"
          : "bg-white font-semibold"
      }
    >
      <Td izquierda>
        {nombre}
      </Td>

      <Td>
        {money(
          total.meta
        )}
      </Td>

      <Td>
        {money(
          total.facturadoQuimicos
        )}
      </Td>

      <Td
        clase={clasePct(
          total.avance
        )}
      >
        {pct(
          total.avance
        )}
      </Td>

      <Td>
        {money(
          total.facturadoOtros
        )}
      </Td>

      <Td>
        {money(
          total.facturadoTotal
        )}
      </Td>

      <Td>
        {money(
          total.pedidosTotal
        )}
      </Td>

      <Td>
        {money(
          total.entregasTotal
        )}
      </Td>

      <Td>
        {money(
          total.cierreQuimicos
        )}
      </Td>

      <Td
        clase={clasePct(
          total.cierrePct
        )}
      >
        {pct(
          total.cierrePct
        )}
      </Td>

      <Td>
        {money(
          total.cierreTotal
        )}
      </Td>
    </tr>
  );
}