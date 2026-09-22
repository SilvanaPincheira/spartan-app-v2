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
  slpcode: number;
  vendedor: string;
  zona: string | null;
  division: string | null;
  equipo: string | null;

  meta_mes: number | string | null;

  facturado_quimicos: number | string | null;
  facturado_otros: number | string | null;
  facturado_total: number | string | null;

  synced_at: string | null;
};

type GestionRow = {
  fecha_corte: string;
  slpcode: number;

  proyeccion_total_mes:
    | number
    | string
    | null;

  monto_mitigacion:
    | number
    | string
    | null;
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

function porcentaje(value: number) {
  return `${value.toLocaleString(
    "es-CL",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )}%`;
}

function clasePorcentaje(
  value: number
) {
  if (value >= 100) {
    return "bg-green-100 text-green-800";
  }

  if (value >= 80) {
    return "bg-yellow-100 text-yellow-800";
  }

  return "bg-red-100 text-red-700";
}

function claseDiferencia(
  value: number
) {
  if (value >= 0) {
    return "bg-green-50 text-green-800";
  }

  return "bg-red-50 text-red-700";
}

export default function ResumenAvanceDiarioPage() {
  const supabase = useMemo(
    () => createClientComponentClient(),
    []
  );

  const [rows, setRows] =
    useState<ReporteRow[]>([]);

  const [gestion, setGestion] =
    useState<
      Record<
        number,
        GestionRow
      >
    >({});

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

  // ============================================================
  // ÚLTIMA FECHA
  // ============================================================

  const obtenerUltimaFecha =
    useCallback(async () => {
      const { data, error } =
        await supabase
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

  // ============================================================
  // CARGAR
  // ============================================================

  const cargar =
    useCallback(
      async (
        fechaSolicitada?: string
      ) => {
        try {
          setLoading(true);
          setError("");

          let fecha =
            fechaSolicitada ||
            fechaCorte;

          if (!fecha) {
            fecha =
              await obtenerUltimaFecha();

            if (!fecha) {
              setError(
                "No existen datos de Avance Diario."
              );

              setRows([]);

              return;
            }

            setFechaCorte(
              fecha
            );
          }

          const [
            reporteResult,
            gestionResult,
          ] =
            await Promise.all([
              supabase
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
                  synced_at
                `)
                .eq(
                  "fecha_corte",
                  fecha
                )
                .order("zona")
                .order(
                  "vendedor"
                ),

              supabase
                .from(
                  "avance_diario_gestion"
                )
                .select(`
                  fecha_corte,
                  slpcode,
                  proyeccion_total_mes,
                  monto_mitigacion
                `)
                .eq(
                  "fecha_corte",
                  fecha
                ),
            ]);

          if (
            reporteResult.error
          ) {
            throw reporteResult.error;
          }

          if (
            gestionResult.error
          ) {
            throw gestionResult.error;
          }

          const reporte =
            (reporteResult.data ||
              []) as ReporteRow[];

          const gestionRows =
            (gestionResult.data ||
              []) as GestionRow[];

          const mapa: Record<
            number,
            GestionRow
          > = {};

          gestionRows.forEach(
            (g) => {
              mapa[
                Number(
                  g.slpcode
                )
              ] = g;
            }
          );

          setRows(reporte);
          setGestion(mapa);
        } catch (err: any) {
          console.error(err);

          setError(
            err?.message ||
              "No fue posible cargar el resumen."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        supabase,
        fechaCorte,
        obtenerUltimaFecha,
      ]
    );

  // ============================================================
  // INICIO
  // ============================================================

  useEffect(() => {
    cargar();
  }, []);

  // ============================================================
  // FILTROS
  // ============================================================

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

  // ============================================================
  // CALCULAR FILA
  // ============================================================

  function calcular(
    r: ReporteRow
  ) {
    const meta =
      num(r.meta_mes);

    const quimicos =
      num(
        r.facturado_quimicos
      );

    const otros =
      num(
        r.facturado_otros
      );

    const ventaTotal =
      num(
        r.facturado_total
      );

    const g =
      gestion[r.slpcode];

    const proyeccion =
      num(
        g?.proyeccion_total_mes
      );

    const mitigacion =
      num(
        g?.monto_mitigacion
      );

    const avance =
      meta > 0
        ? (quimicos /
            meta) *
          100
        : 0;

    const cumplimiento =
      meta > 0
        ? (proyeccion /
            meta) *
          100
        : 0;

    const diferencia =
      proyeccion -
      meta;

    const total =
      proyeccion +
      mitigacion;

    const cumplimientoFinal =
      meta > 0
        ? (total /
            meta) *
          100
        : 0;

    return {
      meta,
      quimicos,
      otros,
      ventaTotal,
      avance,
      proyeccion,
      cumplimiento,
      diferencia,
      mitigacion,
      total,
      cumplimientoFinal,
    };
  }

  // ============================================================
  // AGRUPAR ZONA
  // ============================================================

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

      return [
        ...mapa.entries(),
      ];
    }, [filtrados]);

  // ============================================================
  // TOTALIZAR
  // ============================================================

  function totalizar(
    lista: ReporteRow[]
  ) {
    let meta = 0;
    let quimicos = 0;
    let otros = 0;
    let ventaTotal = 0;
    let proyeccion = 0;
    let mitigacion = 0;

    lista.forEach(
      (r) => {
        const c =
          calcular(r);

        meta += c.meta;
        quimicos +=
          c.quimicos;
        otros += c.otros;
        ventaTotal +=
          c.ventaTotal;
        proyeccion +=
          c.proyeccion;
        mitigacion +=
          c.mitigacion;
      }
    );

    const avance =
      meta > 0
        ? (quimicos /
            meta) *
          100
        : 0;

    const cumplimiento =
      meta > 0
        ? (proyeccion /
            meta) *
          100
        : 0;

    const diferencia =
      proyeccion -
      meta;

    const total =
      proyeccion +
      mitigacion;

    const cumplimientoFinal =
      meta > 0
        ? (total /
            meta) *
          100
        : 0;

    return {
      meta,
      quimicos,
      otros,
      ventaTotal,
      avance,
      proyeccion,
      cumplimiento,
      diferencia,
      mitigacion,
      total,
      cumplimientoFinal,
    };
  }

  const totalEmpresa =
    useMemo(
      () =>
        totalizar(
          filtrados
        ),
      [
        filtrados,
        gestion,
      ]
    );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-5">
      {/* CABECERA */}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Resumen Avance Diario
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Resumen de ventas netas y
            proyección de cierre.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/avance-diario"
            className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            ← Volver al Dashboard
          </Link>

          <button
            onClick={() =>
              window.print()
            }
            className="rounded-lg bg-[#1f4ed8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163bb8]"
          >
            Imprimir
          </button>
        </div>
      </div>

      {/* FILTROS */}

      <div className="rounded-xl border bg-white p-4 shadow-sm print:hidden">
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
              className="w-full rounded-lg bg-[#1f4ed8] px-4 py-2 font-semibold text-white"
            >
              {loading
                ? "Cargando..."
                : "Actualizar"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      {/* TÍTULO IMPRESIÓN */}

      <div className="hidden print:block">
        <h1 className="text-xl font-bold">
          Avance Diario
        </h1>

        <p>
          Fecha:{" "}
          {fechaCorte}
        </p>
      </div>

      {/* TABLA */}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-[1500px] w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th
                colSpan={7}
                className="border bg-gray-100 px-2 py-2 text-left text-sm font-bold"
              >
                AVANCE DIARIO
              </th>

              <th
                colSpan={6}
                className="border bg-yellow-100 px-2 py-2 text-center text-sm font-bold"
              >
                PROYECCIÓN DE CIERRE
              </th>
            </tr>

            <tr>
              <Th>
                Zona
              </Th>

              <Th>
                Empleado Ventas
              </Th>

              <Th>
                Meta del Mes
              </Th>

              <Th>
                Vta Neta Químicos
              </Th>

              <Th>
                % Tot
              </Th>

              <Th>
                Venta Neta Otros
              </Th>

              <Th>
                Venta Neta Total
              </Th>

              <Th amarillo>
                Proyección Total Mes
              </Th>

              <Th verde>
                % Cum
              </Th>

              <Th>
                Diferencia
              </Th>

              <Th amarillo>
                $$ Mitigación
              </Th>

              <Th verde>
                Total
              </Th>

              <Th verde>
                % Cum
              </Th>
            </tr>
          </thead>

          <tbody>
            {/* TOTAL EMPRESA */}

            <FilaTotal
              zona=""
              nombre="TOTAL"
              t={
                totalEmpresa
              }
            />

            {/* ZONAS */}

            {grupos.map(
              ([
                zona,
                lista,
              ]) => {
                const totalZona =
                  totalizar(
                    lista
                  );

                return (
                  <React.Fragment
                    key={zona}
                  >
                    <FilaTotal
                      zona={
                        zona
                      }
                      nombre={`Total ${zona}`}
                      t={
                        totalZona
                      }
                    />

                    {lista.map(
                      (r) => {
                        const c =
                          calcular(
                            r
                          );

                        return (
                          <tr
                            key={`${r.fecha_corte}-${r.slpcode}`}
                          >
                            <Td izquierda>
                              {r.zona}
                            </Td>

                            <Td
                              izquierda
                              fuerte
                            >
                              {
                                r.vendedor
                              }
                            </Td>

                            <Td>
                              {money(
                                c.meta
                              )}
                            </Td>

                            <Td>
                              {money(
                                c.quimicos
                              )}
                            </Td>

                            <Td
                              clase={clasePorcentaje(
                                c.avance
                              )}
                            >
                              {porcentaje(
                                c.avance
                              )}
                            </Td>

                            <Td>
                              {money(
                                c.otros
                              )}
                            </Td>

                            <Td fuerte>
                              {money(
                                c.ventaTotal
                              )}
                            </Td>

                            <Td clase="bg-yellow-50">
                              {money(
                                c.proyeccion
                              )}
                            </Td>

                            <Td
                              clase={clasePorcentaje(
                                c.cumplimiento
                              )}
                            >
                              {porcentaje(
                                c.cumplimiento
                              )}
                            </Td>

                            <Td
                              clase={claseDiferencia(
                                c.diferencia
                              )}
                            >
                              {money(
                                c.diferencia
                              )}
                            </Td>

                            <Td clase="bg-yellow-50">
                              {money(
                                c.mitigacion
                              )}
                            </Td>

                            <Td
                              fuerte
                              clase="bg-green-50"
                            >
                              {money(
                                c.total
                              )}
                            </Td>

                            <Td
                              clase={clasePorcentaje(
                                c.cumplimientoFinal
                              )}
                            >
                              {porcentaje(
                                c.cumplimientoFinal
                              )}
                            </Td>
                          </tr>
                        );
                      }
                    )}
                  </React.Fragment>
                );
              }
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTES
// ============================================================

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

function Th({
  children,
  amarillo = false,
  verde = false,
}: {
  children: React.ReactNode;
  amarillo?: boolean;
  verde?: boolean;
}) {
  return (
    <th
      className={`border px-2 py-2 text-center font-bold ${
        amarillo
          ? "bg-yellow-300"
          : verde
          ? "bg-green-300"
          : "bg-gray-100"
      }`}
    >
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
      className={`border px-2 py-2 ${
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

function FilaTotal({
  zona,
  nombre,
  t,
}: {
  zona: string;
  nombre: string;

  t: {
    meta: number;
    quimicos: number;
    otros: number;
    ventaTotal: number;
    avance: number;
    proyeccion: number;
    cumplimiento: number;
    diferencia: number;
    mitigacion: number;
    total: number;
    cumplimientoFinal: number;
  };
}) {
  return (
    <tr className="bg-gray-200 font-bold">
      <Td izquierda>
        {zona}
      </Td>

      <Td izquierda>
        {nombre}
      </Td>

      <Td>
        {money(
          t.meta
        )}
      </Td>

      <Td>
        {money(
          t.quimicos
        )}
      </Td>

      <Td
        clase={clasePorcentaje(
          t.avance
        )}
      >
        {porcentaje(
          t.avance
        )}
      </Td>

      <Td>
        {money(
          t.otros
        )}
      </Td>

      <Td>
        {money(
          t.ventaTotal
        )}
      </Td>

      <Td clase="bg-yellow-100">
        {money(
          t.proyeccion
        )}
      </Td>

      <Td
        clase={clasePorcentaje(
          t.cumplimiento
        )}
      >
        {porcentaje(
          t.cumplimiento
        )}
      </Td>

      <Td
        clase={claseDiferencia(
          t.diferencia
        )}
      >
        {money(
          t.diferencia
        )}
      </Td>

      <Td class="bg-yellow-100">
        {money(
          t.mitigacion
        )}
      </Td>

      <Td
        fuerte
        clase="bg-green-100"
      >
        {money(
          t.total
        )}
      </Td>

      <Td
        clase={clasePorcentaje(
          t.cumplimientoFinal
        )}
      >
        {porcentaje(
          t.cumplimientoFinal
        )}
      </Td>
    </tr>
  );
}