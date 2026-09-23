"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type VentaRow = {
  anio: number;
  mes: number;

  vendedor: string;

  zona: string | null;
  gerencia: string | null;
  supervisor: string | null;
  division: string | null;
  equipo: string | null;

  venta_quimicos: number | string | null;
  venta_otros: number | string | null;
  venta_total: number | string | null;
};

type Metrica =
  | "venta_total"
  | "venta_quimicos"
  | "venta_otros";

type Resumen = {
  vendedor: string;
  zona: string;
  gerencia: string;
  supervisor: string;
  division: string;
  equipo: string;

  mesLY: number;
  mesCY: number;

  ytdLY: number;
  ytdCY: number;
};

const MESES = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

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

function pct(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${value.toLocaleString(
    "es-CL",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )}%`;
}

function porcentajeCYLY(
  actual: number,
  anterior: number
) {
  if (anterior === 0) {
    return null;
  }

  return (actual / anterior) * 100;
}

function claseCYLY(
  value: number | null
) {
  if (value === null) {
    return "bg-gray-50 text-gray-500";
  }

  if (value > 100) {
    return "bg-green-100 text-green-800";
  }

  if (value < 100) {
    return "bg-red-100 text-red-700";
  }

  return "bg-gray-100 text-gray-700";
}

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

function zonaDe(row: VentaRow) {
  return clean(row.zona) || "SIN CLASIFICAR";
}

function vendedorKey(nombre: string) {
    return String(nombre || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
  }

function valorMetrica(
  row: VentaRow,
  metrica: Metrica
) {
  return num(row[metrica]);
}

export default function ComparativoPage() {
  const supabase = useMemo(
    () =>
      createClientComponentClient(),
    []
  );

  const [rows, setRows] =
    useState<VentaRow[]>([]);

  const [anio, setAnio] =
    useState<number>(0);

  const [mes, setMes] =
    useState<number>(0);

  const [metrica, setMetrica] =
    useState<Metrica>("venta_total");

  const [zonaFiltro, setZonaFiltro] =
    useState("TODAS");

  const [gerenciaFiltro, setGerenciaFiltro] =
    useState("TODAS");

  const [supervisorFiltro, setSupervisorFiltro] =
    useState("TODOS");

  const [divisionFiltro, setDivisionFiltro] =
    useState("TODAS");

  const [equipoFiltro, setEquipoFiltro] =
    useState("TODOS");

  const [vendedorFiltro, setVendedorFiltro] =
    useState("TODOS");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // ========================================================
  // CARGAR ÚLTIMO PERÍODO
  // ========================================================

  const obtenerUltimoPeriodo =
    useCallback(async () => {
      const {
        data,
        error,
      } = await supabase
        .from(
          "reporte_ventas_mensual"
        )
        .select("anio, mes")
        .order("anio", {
          ascending: false,
        })
        .order("mes", {
          ascending: false,
        })
        .limit(1);

      if (error) {
        throw error;
      }

      if (!data?.length) {
        return null;
      }

      return {
        anio: Number(
          data[0].anio
        ),
        mes: Number(
          data[0].mes
        ),
      };
    }, [supabase]);

  // ========================================================
  // CARGAR CY + LY
  // ========================================================

  const cargar = useCallback(
    async (
      anioSolicitado?: number,
      mesSolicitado?: number
    ) => {
      try {
        setLoading(true);
        setError("");
  
        let year = anioSolicitado || anio;
        let month = mesSolicitado || mes;
  
        // =====================================================
        // DETERMINAR PERÍODO
        // =====================================================
  
        if (!year) {
          const ultimo =
            await obtenerUltimoPeriodo();
  
          if (!ultimo) {
            setError(
              "No existen datos históricos."
            );
            return;
          }
  
          year = ultimo.anio;
          month = ultimo.mes;
  
          setAnio(year);
          setMes(month);
        }
  
        if (!month) {
          const {
            data: ultimoMes,
            error: mesError,
          } = await supabase
            .from("reporte_ventas_mensual")
            .select("mes")
            .eq("anio", year)
            .order("mes", {
              ascending: false,
            })
            .limit(1);
  
          if (mesError) {
            throw mesError;
          }
  
          month = Number(
            ultimoMes?.[0]?.mes || 1
          );
  
          setMes(month);
        }
  
        // =====================================================
        // HISTÓRICO MENSUAL
        // =====================================================
  
        const camposMensual = `
          anio,
          mes,
          vendedor,
          zona,
          gerencia,
          supervisor,
          division,
          equipo,
          venta_quimicos,
          venta_otros,
          venta_total
        `;
  
        const [
          actualResult,
          anteriorResult,
        ] = await Promise.all([
          supabase
            .from("reporte_ventas_mensual")
            .select(camposMensual)
            .eq("anio", year)
            .order("mes"),
  
          supabase
            .from("reporte_ventas_mensual")
            .select(camposMensual)
            .eq("anio", year - 1)
            .order("mes"),
        ]);
  
        if (actualResult.error) {
          throw actualResult.error;
        }
  
        if (anteriorResult.error) {
          throw anteriorResult.error;
        }
  
        const mensualCY =
          (actualResult.data || []) as VentaRow[];
  
        const mensualLY =
          (anteriorResult.data || []) as VentaRow[];
  
        // =====================================================
        // ¿ES EL MES ACTUAL?
        // =====================================================
  
        const hoy = new Date();
  
        const esMesActual =
          year === hoy.getFullYear() &&
          month === hoy.getMonth() + 1;
  
        // Si NO es el mes actual, usamos solamente histórico.
        if (!esMesActual) {
          setRows([
            ...mensualLY,
            ...mensualCY,
          ]);
  
          return;
        }
  
        // =====================================================
        // BUSCAR ÚLTIMO CORTE DEL AVANCE DIARIO
        // =====================================================
  
        const {
          data: corteData,
          error: corteError,
        } = await supabase
          .from("reporte_ventas_diario")
          .select("fecha_corte")
          .eq("anio", year)
          .eq("mes", month)
          .order("fecha_corte", {
            ascending: false,
          })
          .limit(1);
  
        if (corteError) {
          throw corteError;
        }
  
        const fechaCorte =
          corteData?.[0]?.fecha_corte;
  
        // Si todavía no hay Avance Diario,
        // mantenemos el histórico importado.
        if (!fechaCorte) {
          setRows([
            ...mensualLY,
            ...mensualCY,
          ]);
  
          return;
        }
  
        // =====================================================
        // LEER MES ACTUAL DIRECTAMENTE DEL DIARIO
        // =====================================================
  
        const {
          data: diarioData,
          error: diarioError,
        } = await supabase
          .from("reporte_ventas_diario")
          .select(`
            vendedor,
            zona,
            division,
            equipo,
            facturado_quimicos,
            facturado_otros,
            facturado_total
          `)
          .eq("fecha_corte", fechaCorte);
  
        if (diarioError) {
          throw diarioError;
        }
  
        // =====================================================
        // METADATOS DEL HISTÓRICO
        // gerencia / supervisor
        // =====================================================
  
        const metadataMap =
          new Map<string, VentaRow>();
  
        mensualCY
          .filter(
            (r) => Number(r.mes) === month
          )
          .forEach((r) => {
            metadataMap.set(
              vendedorKey(r.vendedor),
              r
            );
          });
  
        // =====================================================
        // TRANSFORMAR DIARIO A FORMATO MENSUAL
        // =====================================================
  
        const mesActualEnVivo: VentaRow[] =
          (diarioData || []).map(
            (d: any) => {
              const historico =
                metadataMap.get(
                  vendedorKey(
                    d.vendedor
                  )
                );
  
              return {
                anio: year,
                mes: month,
  
                vendedor:
                  d.vendedor,
  
                zona:
                  d.zona ??
                  historico?.zona ??
                  null,
  
                gerencia:
                  historico?.gerencia ??
                  null,
  
                supervisor:
                  historico?.supervisor ??
                  null,
  
                division:
                  d.division ??
                  historico?.division ??
                  null,
  
                equipo:
                  d.equipo ??
                  historico?.equipo ??
                  null,
  
                venta_quimicos:
                  d.facturado_quimicos,
  
                venta_otros:
                  d.facturado_otros,
  
                venta_total:
                  d.facturado_total,
              };
            }
          );
  
        // =====================================================
        // CY:
        // Enero - mes anterior = histórico
        // Mes actual           = SAP / Diario
        // =====================================================
  
        const mesesCerradosCY =
          mensualCY.filter(
            (r) =>
              Number(r.mes) !== month
          );
  
        setRows([
          ...mensualLY,
          ...mesesCerradosCY,
          ...mesActualEnVivo,
        ]);
      } catch (err: any) {
        console.error(err);
  
        setError(
          err?.message ||
            "No fue posible cargar el comparativo."
        );
      } finally {
        setLoading(false);
      }
    },
    [
      supabase,
      anio,
      mes,
      obtenerUltimoPeriodo,
    ]
  );
  useEffect(() => {
    cargar();
  }, []);

  // ========================================================
  // OPCIONES
  // ========================================================

  function opcionesCampo(
    getter: (
      row: VentaRow
    ) => string
  ) {
    return [
      ...new Set(
        rows
          .map(getter)
          .filter(Boolean)
      ),
    ].sort();
  }

  const zonas =
    useMemo(
      () =>
        opcionesCampo(
          (r) =>
            zonaDe(r)
        ),
      [rows]
    );

  const gerencias =
    useMemo(
      () =>
        opcionesCampo(
          (r) =>
            clean(
              r.gerencia
            )
        ),
      [rows]
    );

  const supervisores =
    useMemo(
      () =>
        opcionesCampo(
          (r) =>
            clean(
              r.supervisor
            )
        ),
      [rows]
    );

  const divisiones =
    useMemo(
      () =>
        opcionesCampo(
          (r) =>
            clean(
              r.division
            )
        ),
      [rows]
    );

  const equipos =
    useMemo(
      () =>
        opcionesCampo(
          (r) =>
            clean(
              r.equipo
            )
        ),
      [rows]
    );

  const vendedores =
    useMemo(() => {
      const mapa =
        new Map<
          string,
          string
        >();

      rows.forEach((r) => {
        const key =
          vendedorKey(
            r.vendedor
          );

        if (!key) {
          return;
        }

        /*
         * Preferimos el nombre del año actual,
         * por si antes no tenía prefijo.
         */
        if (
          !mapa.has(key) ||
          r.anio === anio
        ) {
          mapa.set(
            key,
            r.vendedor
          );
        }
      });

      return [
        ...mapa.entries(),
      ].sort((a, b) =>
        a[1].localeCompare(
          b[1],
          "es"
        )
      );
    }, [rows, anio]);

  // ========================================================
  // FILTRADO
  // ========================================================

  const rowsFiltradas =
    useMemo(() => {
      return rows.filter(
        (r) => {
          if (
            zonaFiltro !==
              "TODAS" &&
            zonaDe(r) !==
              zonaFiltro
          ) {
            return false;
          }

          if (
            gerenciaFiltro !==
              "TODAS" &&
            clean(
              r.gerencia
            ) !==
              gerenciaFiltro
          ) {
            return false;
          }

          if (
            supervisorFiltro !==
              "TODOS" &&
            clean(
              r.supervisor
            ) !==
              supervisorFiltro
          ) {
            return false;
          }

          if (
            divisionFiltro !==
              "TODAS" &&
            clean(
              r.division
            ) !==
              divisionFiltro
          ) {
            return false;
          }

          if (
            equipoFiltro !==
              "TODOS" &&
            clean(
              r.equipo
            ) !==
              equipoFiltro
          ) {
            return false;
          }

          if (
            vendedorFiltro !==
              "TODOS" &&
            vendedorKey(
              r.vendedor
            ) !==
              vendedorFiltro
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      rows,
      zonaFiltro,
      gerenciaFiltro,
      supervisorFiltro,
      divisionFiltro,
      equipoFiltro,
      vendedorFiltro,
    ]);

  // ========================================================
  // TOTAL GENERAL
  // ========================================================

  const totalGeneral =
    useMemo(() => {
      let mesLY = 0;
      let mesCY = 0;

      let ytdLY = 0;
      let ytdCY = 0;

      rowsFiltradas.forEach(
        (r) => {
          const valor =
            valorMetrica(
              r,
              metrica
            );

          if (
            r.anio ===
              anio - 1 &&
            r.mes === mes
          ) {
            mesLY += valor;
          }

          if (
            r.anio ===
              anio &&
            r.mes === mes
          ) {
            mesCY += valor;
          }

          if (
            r.anio ===
              anio - 1 &&
            r.mes <= mes
          ) {
            ytdLY += valor;
          }

          if (
            r.anio ===
              anio &&
            r.mes <= mes
          ) {
            ytdCY += valor;
          }
        }
      );

      return {
        mesLY,
        mesCY,
        mesDif:
          mesCY -
          mesLY,

        mesVar:
          porcentajeCYLY(
            mesCY,
            mesLY
          ),

        ytdLY,
        ytdCY,

        ytdDif:
          ytdCY -
          ytdLY,

        ytdVar:
          porcentajeCYLY(
            ytdCY,
            ytdLY
          ),
      };
    }, [
      rowsFiltradas,
      anio,
      mes,
      metrica,
    ]);

  // ========================================================
  // RESUMEN POR VENDEDOR
  // ========================================================

  const resumenVendedores =
    useMemo(() => {
      const mapa =
        new Map<
          string,
          Resumen
        >();

      rowsFiltradas.forEach(
        (r) => {
          const key =
            vendedorKey(
              r.vendedor
            );

          if (!key) {
            return;
          }

          if (
            !mapa.has(key)
          ) {
            mapa.set(
              key,
              {
                vendedor:
                  r.vendedor,

                zona:
                  zonaDe(r),

                gerencia:
                  clean(
                    r.gerencia
                  ),

                supervisor:
                  clean(
                    r.supervisor
                  ),

                division:
                  clean(
                    r.division
                  ),

                equipo:
                  clean(
                    r.equipo
                  ),

                mesLY: 0,
                mesCY: 0,

                ytdLY: 0,
                ytdCY: 0,
              }
            );
          }

          const item =
            mapa.get(key)!;

          /*
           * Si existe información del año actual,
           * la usamos como estructura preferida.
           */
          if (
            r.anio === anio
          ) {
            item.vendedor =
              r.vendedor;

            if (r.zona) {
              item.zona =
                zonaDe(r);
            }

            if (
              r.gerencia
            ) {
              item.gerencia =
                r.gerencia;
            }

            if (
              r.supervisor
            ) {
              item.supervisor =
                r.supervisor;
            }

            if (
              r.division
            ) {
              item.division =
                r.division;
            }

            if (
              r.equipo
            ) {
              item.equipo =
                r.equipo;
            }
          }

          const valor =
            valorMetrica(
              r,
              metrica
            );

          if (
            r.anio ===
              anio - 1 &&
            r.mes === mes
          ) {
            item.mesLY +=
              valor;
          }

          if (
            r.anio ===
              anio &&
            r.mes === mes
          ) {
            item.mesCY +=
              valor;
          }

          if (
            r.anio ===
              anio - 1 &&
            r.mes <= mes
          ) {
            item.ytdLY +=
              valor;
          }

          if (
            r.anio ===
              anio &&
            r.mes <= mes
          ) {
            item.ytdCY +=
              valor;
          }
        }
      );

      return [
        ...mapa.values(),
      ].sort(
        (a, b) =>
          b.mesCY -
          a.mesCY
      );
    }, [
      rowsFiltradas,
      anio,
      mes,
      metrica,
    ]);

  // ========================================================
  // AGRUPAR POR ZONA
  // ========================================================

  const grupos =
    useMemo(() => {
      const mapa =
        new Map<
          string,
          Resumen[]
        >();

      resumenVendedores.forEach(
        (r) => {
          const zona =
            r.zona ||
            "SIN CLASIFICAR";

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
        "SIN CLASIFICAR": 99,
      };

      return [
        ...mapa.entries(),
      ].sort(
        ([a], [b]) =>
          (orden[a] ||
            50) -
          (orden[b] ||
            50)
      );
    }, [
      resumenVendedores,
    ]);

  function totalZona(
    lista: Resumen[]
  ) {
    const total =
      lista.reduce(
        (acc, r) => {
          acc.mesLY +=
            r.mesLY;

          acc.mesCY +=
            r.mesCY;

          acc.ytdLY +=
            r.ytdLY;

          acc.ytdCY +=
            r.ytdCY;

          return acc;
        },
        {
          mesLY: 0,
          mesCY: 0,
          ytdLY: 0,
          ytdCY: 0,
        }
      );

    return {
      ...total,

      mesVar:
        porcentajeCYLY(
          total.mesCY,
          total.mesLY
        ),

      ytdVar:
        porcentajeCYLY(
          total.ytdCY,
          total.ytdLY
        ),
    };
  }

  const nombreMetrica =
    metrica ===
    "venta_quimicos"
      ? "Químicos"
      : metrica ===
        "venta_otros"
      ? "Otros"
      : "Venta Total";

  const periodoActual =
    anio ===
      new Date().getFullYear() &&
    mes ===
      new Date().getMonth() + 1;

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <div className="space-y-5">
      {/* HEADER */}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Comparativo Comercial
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Comparación mensual y
            acumulada contra el año
            anterior.
          </p>
        </div>

        <Link
          href="/tablero-control"
          className="w-fit rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          ← Tablero de Control
        </Link>
      </div>

      {/* ADVERTENCIA MES EN CURSO */}

      {periodoActual && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>
            Período en curso:
          </strong>{" "}
          los valores CY corresponden
          a la información cargada hasta
          el último corte disponible.
          El período LY corresponde al
          histórico almacenado.
        </div>
      )}

      {/* FILTROS */}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Filtro label="Año CY">
            <input
              type="number"
              value={
                anio || ""
              }
              onChange={(e) =>
                setAnio(
                  Number(
                    e.target.value
                  )
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            />
          </Filtro>

          <Filtro label="Mes">
            <select
              value={mes}
              onChange={(e) =>
                setMes(
                  Number(
                    e.target.value
                  )
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            >
              {MESES.slice(
                1
              ).map(
                (nombre, i) => (
                  <option
                    key={
                      i + 1
                    }
                    value={
                      i + 1
                    }
                  >
                    {nombre}
                  </option>
                )
              )}
            </select>
          </Filtro>

          <Filtro label="Métrica">
            <select
              value={
                metrica
              }
              onChange={(e) =>
                setMetrica(
                  e.target
                    .value as Metrica
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="venta_total">
                Venta Total
              </option>

              <option value="venta_quimicos">
                Químicos
              </option>

              <option value="venta_otros">
                Otros
              </option>
            </select>
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

          <Filtro label="Gerencia">
            <select
              value={
                gerenciaFiltro
              }
              onChange={(e) =>
                setGerenciaFiltro(
                  e.target.value
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="TODAS">
                Todas
              </option>

              {gerencias.map(
                (g) => (
                  <option
                    key={g}
                    value={g}
                  >
                    {g}
                  </option>
                )
              )}
            </select>
          </Filtro>

          <Filtro label="Supervisor">
            <select
              value={
                supervisorFiltro
              }
              onChange={(e) =>
                setSupervisorFiltro(
                  e.target.value
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="TODOS">
                Todos
              </option>

              {supervisores.map(
                (s) => (
                  <option
                    key={s}
                    value={s}
                  >
                    {s}
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

          <Filtro label="Vendedor">
            <select
              value={
                vendedorFiltro
              }
              onChange={(e) =>
                setVendedorFiltro(
                  e.target.value
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="TODOS">
                Todos
              </option>

              {vendedores.map(
                ([
                  key,
                  nombre,
                ]) => (
                  <option
                    key={key}
                    value={key}
                  >
                    {nombre}
                  </option>
                )
              )}
            </select>
          </Filtro>

          <div className="flex items-end">
            <button
              onClick={() =>
                cargar(
                  anio,
                  mes
                )
              }
              disabled={
                loading
              }
              className="w-full rounded-lg bg-[#1f4ed8] px-4 py-2 font-semibold text-white hover:bg-[#163bb8] disabled:opacity-50"
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

      {/* KPIs MES */}

      <div>
        <h2 className="mb-3 font-bold text-gray-900">
          {MESES[mes]} —{" "}
          {nombreMetrica}
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi
            titulo={`MES LY ${anio - 1}`}
            valor={money(
              totalGeneral.mesLY
            )}
            detalle={
              MESES[mes]
            }
          />

          <Kpi
            titulo={`MES CY ${anio}`}
            valor={money(
              totalGeneral.mesCY
            )}
            detalle={
              MESES[mes]
            }
            destacado
          />

          <Kpi
            titulo="Variación $"
            valor={money(
              totalGeneral.mesDif
            )}
            detalle="CY - LY"
          />

          <Kpi
            titulo="% CY/LY"
            valor={pct(
              totalGeneral.mesVar
            )}
            detalle="CY / LY"
            clase={claseCYLY(
              totalGeneral.mesVar
            )}
          />
        </div>
      </div>

      {/* KPIs YTD */}

      <div>
        <h2 className="mb-3 font-bold text-gray-900">
          Acumulado YTD — Enero a{" "}
          {MESES[mes]}
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi
            titulo={`YTD LY ${anio - 1}`}
            valor={money(
              totalGeneral.ytdLY
            )}
            detalle={`Enero - ${MESES[mes]}`}
          />

          <Kpi
            titulo={`YTD CY ${anio}`}
            valor={money(
              totalGeneral.ytdCY
            )}
            detalle={`Enero - ${MESES[mes]}`}
            destacado
          />

          <Kpi
            titulo="Variación YTD $"
            valor={money(
              totalGeneral.ytdDif
            )}
            detalle="CY - LY"
          />

          <Kpi
            titulo="% YTD CY/LY"
            valor={pct(
              totalGeneral.ytdVar
            )}
            detalle="CY / LY"
            clase={claseCYLY(
              totalGeneral.ytdVar
            )}
          />
        </div>
      </div>

      {/* TABLA */}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-bold text-gray-900">
            Comparativo por Zona y Vendedor
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            Métrica seleccionada:{" "}
            {nombreMetrica}
          </p>
        </div>

        <table className="min-w-[1150px] w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50">
              <Th>Zona</Th>
              <Th>Vendedor</Th>

              <Th>
                MES LY
              </Th>

              <Th>
                MES CY
              </Th>

              <Th>
                Var. $
              </Th>

              <Th>
                % CY/LY
              </Th>

              <Th>
                YTD LY
              </Th>

              <Th>
                YTD CY
              </Th>

              <Th>
                Var. YTD $
              </Th>

              <Th>
                % YTD CY/LY
              </Th>
            </tr>
          </thead>

          <tbody>
            {/* TOTAL */}

            <FilaComparativo
              zona=""
              vendedor="TOTAL"
              mesLY={
                totalGeneral.mesLY
              }
              mesCY={
                totalGeneral.mesCY
              }
              ytdLY={
                totalGeneral.ytdLY
              }
              ytdCY={
                totalGeneral.ytdCY
              }
              total
            />

            {/* ZONAS */}

            {grupos.map(
              ([
                zona,
                lista,
              ]) => {
                const t =
                  totalZona(
                    lista
                  );

                return (
                  <React.Fragment
                    key={zona}
                  >
                    <FilaComparativo
                      zona={zona}
                      vendedor={`Total ${zona}`}
                      mesLY={
                        t.mesLY
                      }
                      mesCY={
                        t.mesCY
                      }
                      ytdLY={
                        t.ytdLY
                      }
                      ytdCY={
                        t.ytdCY
                      }
                      subtotal
                    />

                    {lista.map(
                      (r) => (
                        <FilaComparativo
                          key={`${zona}-${vendedorKey(
                            r.vendedor
                          )}`}
                          zona=""
                          vendedor={
                            r.vendedor
                          }
                          mesLY={
                            r.mesLY
                          }
                          mesCY={
                            r.mesCY
                          }
                          ytdLY={
                            r.ytdLY
                          }
                          ytdCY={
                            r.ytdCY
                          }
                        />
                      )
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

// ========================================================
// COMPONENTES
// ========================================================

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
  clase = "",
}: {
  titulo: string;
  valor: string;
  detalle: string;
  destacado?: boolean;
  clase?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${
        clase ||
        (destacado
          ? "border-blue-200 bg-blue-50"
          : "bg-white")
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {titulo}
      </div>

      <div className="mt-2 text-2xl font-bold text-gray-900">
        {valor}
      </div>

      <div className="mt-2 text-sm text-gray-500">
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

function FilaComparativo({
  zona,
  vendedor,
  mesLY,
  mesCY,
  ytdLY,
  ytdCY,
  total = false,
  subtotal = false,
}: {
  zona: string;
  vendedor: string;

  mesLY: number;
  mesCY: number;

  ytdLY: number;
  ytdCY: number;

  total?: boolean;
  subtotal?: boolean;
}) {
  const mesDif =
    mesCY -
    mesLY;

  const mesVar =
    porcentajeCYLY(
      mesCY,
      mesLY
    );

  const ytdDif =
    ytdCY -
    ytdLY;

  const ytdVar =
    porcentajeCYLY(
      ytdCY,
      ytdLY
    );

  const fondo =
    total
      ? "bg-gray-300 font-bold"
      : subtotal
      ? "bg-gray-100 font-bold"
      : "bg-white";

  return (
    <tr className={fondo}>
      <Td izquierda>
        {zona}
      </Td>

      <Td
        izquierda
        fuerte={
          total ||
          subtotal
        }
      >
        {vendedor}
      </Td>

      <Td>
        {money(
          mesLY
        )}
      </Td>

      <Td fuerte>
        {money(
          mesCY
        )}
      </Td>

      <Td>
        {money(
          mesDif
        )}
      </Td>

      <Td
        clase={claseCYLY(
          mesVar
        )}
      >
        {pct(
          mesVar
        )}
      </Td>

      <Td>
        {money(
          ytdLY
        )}
      </Td>

      <Td fuerte>
        {money(
          ytdCY
        )}
      </Td>

      <Td>
        {money(
          ytdDif
        )}
      </Td>

      <Td
        clase={claseCYLY(
          ytdVar
        )}
      >
        {pct(
          ytdVar
        )}
      </Td>
    </tr>
  );
}