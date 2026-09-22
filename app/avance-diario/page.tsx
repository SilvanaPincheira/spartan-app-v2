"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type ReporteRow = {
  id: number;
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

function numero(valor: unknown) {
  const n = Number(valor ?? 0);

  return Number.isFinite(n)
    ? n
    : 0;
}

function dinero(valor: unknown) {
  return numero(valor).toLocaleString(
    "es-CL",
    {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }
  );
}

function porcentaje(valor: number) {
  return `${valor.toLocaleString(
    "es-CL",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )}%`;
}

function fechaHora(
  valor: string | null | undefined
) {
  if (!valor) return "—";

  const d = new Date(valor);

  if (Number.isNaN(d.getTime())) {
    return valor;
  }

  return d.toLocaleString(
    "es-CL",
    {
      dateStyle: "short",
      timeStyle: "medium",
    }
  );
}

function colorPorcentaje(
  valor: number
) {
  if (valor >= 100) {
    return "text-green-700";
  }

  if (valor >= 80) {
    return "text-amber-600";
  }

  return "text-red-600";
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

  const [zona, setZona] =
    useState("TODAS");

  const [division, setDivision] =
    useState("TODAS");

  const [equipo, setEquipo] =
    useState("TODOS");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [accesoValidado, setAccesoValidado] =
    useState(false);

  // ============================================================
  // VALIDAR USUARIO
  // ============================================================

  const validarAcceso =
    useCallback(async () => {
      const {
        data: sessionData,
      } =
        await supabase.auth.getSession();

      const session =
        sessionData.session;

      if (!session?.user) {
        window.location.href =
          "/login";

        return false;
      }

      const {
        data: perfil,
        error: perfilError,
      } = await supabase
        .from("profiles")
        .select(
          "role, department"
        )
        .eq(
          "id",
          session.user.id
        )
        .single();

      if (perfilError) {
        console.error(
          "Error perfil:",
          perfilError
        );

        setError(
          "No fue posible validar el perfil del usuario."
        );

        return false;
      }

      const role =
        String(
          perfil?.role || ""
        ).toLowerCase();

      const department =
        String(
          perfil?.department || ""
        ).toLowerCase();

      const permitido =
        role === "gerencia" ||
        department.startsWith(
          "gerencia_"
        );

      if (!permitido) {
        setError(
          "No tienes acceso a este módulo."
        );

        return false;
      }

      setAccesoValidado(true);

      return true;
    }, [supabase]);

  // ============================================================
  // OBTENER ÚLTIMA FECHA DISPONIBLE
  // ============================================================

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

  // ============================================================
  // CARGAR DATOS
  // ============================================================

  const cargarReporte =
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
              setRows([]);

              setError(
                "No existen datos de avance diario."
              );

              return;
            }

            setFechaCorte(
              fecha
            );
          }

          const {
            data,
            error,
          } = await supabase
            .from(
              "reporte_ventas_diario"
            )
            .select(`
              id,
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
            .order(
              "zona",
              {
                ascending: true,
              }
            )
            .order(
              "vendedor",
              {
                ascending: true,
              }
            );

          if (error) {
            throw error;
          }

          setRows(
            (data || []) as ReporteRow[]
          );
        } catch (err: any) {
          console.error(
            "Error avance diario:",
            err
          );

          setRows([]);

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
        fechaCorte,
        obtenerUltimaFecha,
      ]
    );

  // ============================================================
  // INICIO
  // ============================================================

  useEffect(() => {
    async function iniciar() {
      const permitido =
        await validarAcceso();

      if (!permitido) {
        setLoading(false);
        return;
      }

      await cargarReporte();
    }

    iniciar();
  }, []);

  // ============================================================
  // ACTUALIZACIÓN AUTOMÁTICA
  // ============================================================

  useEffect(() => {
    if (
      !accesoValidado ||
      !fechaCorte
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          cargarReporte(
            fechaCorte
          );
        },
        5 * 60 * 1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    accesoValidado,
    fechaCorte,
    cargarReporte,
  ]);

  // ============================================================
  // FILTROS DISPONIBLES
  // ============================================================

  const zonas =
    useMemo(() => {
      return [
        ...new Set(
          rows
            .map(
              (r) =>
                r.zona?.trim() ||
                ""
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
                zona ===
                  "TODAS" ||
                r.zona === zona
            )
            .map(
              (r) =>
                r.division?.trim() ||
                ""
            )
            .filter(Boolean)
        ),
      ].sort();
    }, [
      rows,
      zona,
    ]);

  const equipos =
    useMemo(() => {
      return [
        ...new Set(
          rows
            .filter((r) => {
              if (
                zona !==
                  "TODAS" &&
                r.zona !== zona
              ) {
                return false;
              }

              if (
                division !==
                  "TODAS" &&
                r.division !==
                  division
              ) {
                return false;
              }

              return true;
            })
            .map(
              (r) =>
                r.equipo?.trim() ||
                ""
            )
            .filter(Boolean)
        ),
      ].sort();
    }, [
      rows,
      zona,
      division,
    ]);

  useEffect(() => {
    setDivision(
      "TODAS"
    );

    setEquipo(
      "TODOS"
    );
  }, [zona]);

  useEffect(() => {
    setEquipo(
      "TODOS"
    );
  }, [division]);

  // ============================================================
  // FILAS FILTRADAS
  // ============================================================

  const filasFiltradas =
    useMemo(() => {
      return rows.filter(
        (r) => {
          if (
            zona !==
              "TODAS" &&
            r.zona !== zona
          ) {
            return false;
          }

          if (
            division !==
              "TODAS" &&
            r.division !==
              division
          ) {
            return false;
          }

          if (
            equipo !==
              "TODOS" &&
            r.equipo !== equipo
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      rows,
      zona,
      division,
      equipo,
    ]);

  // ============================================================
  // KPI
  // ============================================================

  const resumen =
    useMemo(() => {
      let meta = 0;

      let ventaQ = 0;

      let ventaOtros = 0;

      let ventaTotal = 0;

      let pedidos = 0;

      let entregas = 0;

      let cierreQ = 0;

      let cierreTotal = 0;

      filasFiltradas.forEach(
        (r) => {
          meta += numero(
            r.meta_mes
          );

          ventaQ += numero(
            r.facturado_quimicos
          );

          ventaOtros += numero(
            r.facturado_otros
          );

          ventaTotal += numero(
            r.facturado_total
          );

          pedidos += numero(
            r.pedidos_total
          );

          entregas += numero(
            r.entregas_total
          );

          cierreQ += numero(
            r.cierre_quimicos
          );

          cierreTotal += numero(
            r.cierre_total
          );
        }
      );

      const avance =
        meta > 0
          ? (ventaQ / meta) *
            100
          : 0;

      const cierrePct =
        meta > 0
          ? (cierreQ / meta) *
            100
          : 0;

      const faltante =
        meta - ventaQ;

      return {
        meta,
        ventaQ,
        ventaOtros,
        ventaTotal,
        pedidos,
        entregas,
        cierreQ,
        cierreTotal,
        avance,
        cierrePct,
        faltante,
      };
    }, [
      filasFiltradas,
    ]);

  // ============================================================
  // ÚLTIMA SINCRONIZACIÓN
  // ============================================================

  const ultimaActualizacion =
    useMemo(() => {
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
              Boolean(x)
          )
          .sort();

      if (
        fechas.length === 0
      ) {
        return null;
      }

      return fechas[
        fechas.length - 1
      ];
    }, [rows]);

  // ============================================================
  // RESUMEN POR ZONA
  // ============================================================

  const resumenPorZona =
    useMemo(() => {
      const mapa =
        new Map<
          string,
          {
            zona: string;
            meta: number;
            ventaQ: number;
            ventaTotal: number;
            pedidos: number;
            entregas: number;
            cierreQ: number;
            cierreTotal: number;
          }
        >();

      filasFiltradas.forEach(
        (r) => {
          const key =
            r.zona ||
            "SIN ZONA";

          if (
            !mapa.has(key)
          ) {
            mapa.set(
              key,
              {
                zona: key,
                meta: 0,
                ventaQ: 0,
                ventaTotal: 0,
                pedidos: 0,
                entregas: 0,
                cierreQ: 0,
                cierreTotal: 0,
              }
            );
          }

          const item =
            mapa.get(key)!;

          item.meta +=
            numero(
              r.meta_mes
            );

          item.ventaQ +=
            numero(
              r.facturado_quimicos
            );

          item.ventaTotal +=
            numero(
              r.facturado_total
            );

          item.pedidos +=
            numero(
              r.pedidos_total
            );

          item.entregas +=
            numero(
              r.entregas_total
            );

          item.cierreQ +=
            numero(
              r.cierre_quimicos
            );

          item.cierreTotal +=
            numero(
              r.cierre_total
            );
        }
      );

      return [
        ...mapa.values(),
      ].sort((a, b) =>
        a.zona.localeCompare(
          b.zona
        )
      );
    }, [
      filasFiltradas,
    ]);

  // ============================================================
  // SIN ACCESO
  // ============================================================

  if (
    error &&
    !accesoValidado
  ) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  // ============================================================
  // PANTALLA
  // ============================================================

  return (
    <div className="space-y-6">
      {/* CABECERA */}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Avance Diario
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Seguimiento de
            ventas, metas,
            pedidos,
            entregas y cierre
            potencial.
          </p>
        </div>

        <div className="text-sm text-gray-500">
          Última sincronización:{" "}
          <span className="font-semibold text-gray-700">
            {fechaHora(
              ultimaActualizacion
            )}
          </span>
        </div>
      </div>

      {/* FILTROS */}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
              Fecha de corte
            </label>

            <input
              type="date"
              value={
                fechaCorte
              }
              onChange={(
                e
              ) =>
                setFechaCorte(
                  e.target.value
                )
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
              Zona
            </label>

            <select
              value={zona}
              onChange={(
                e
              ) =>
                setZona(
                  e.target.value
                )
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="TODAS">
                Todas
              </option>

              {zonas.map(
                (x) => (
                  <option
                    key={x}
                    value={x}
                  >
                    {x}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
              División
            </label>

            <select
              value={
                division
              }
              onChange={(
                e
              ) =>
                setDivision(
                  e.target.value
                )
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="TODAS">
                Todas
              </option>

              {divisiones.map(
                (x) => (
                  <option
                    key={x}
                    value={x}
                  >
                    {x}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
              Equipo
            </label>

            <select
              value={
                equipo
              }
              onChange={(
                e
              ) =>
                setEquipo(
                  e.target.value
                )
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="TODOS">
                Todos
              </option>

              {equipos.map(
                (x) => (
                  <option
                    key={x}
                    value={x}
                  >
                    {x}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                cargarReporte(
                  fechaCorte
                )
              }
              disabled={
                loading ||
                !fechaCorte
              }
              className="w-full rounded-lg bg-[#1f4ed8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#163bb8] disabled:opacity-50"
            >
              {loading
                ? "Cargando..."
                : "Actualizar"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          titulo="Meta Químicos"
          valor={dinero(
            resumen.meta
          )}
          detalle={`${filasFiltradas.length} vendedores`}
        />

        <Kpi
          titulo="Venta Químicos"
          valor={dinero(
            resumen.ventaQ
          )}
          detalle={`Avance ${porcentaje(
            resumen.avance
          )}`}
          color={colorPorcentaje(
            resumen.avance
          )}
        />

        <Kpi
          titulo="Venta Total"
          valor={dinero(
            resumen.ventaTotal
          )}
          detalle={`Otros ${dinero(
            resumen.ventaOtros
          )}`}
        />

        <Kpi
          titulo="Faltante Meta"
          valor={dinero(
            resumen.faltante
          )}
          detalle="Meta químicos"
          color={
            resumen.faltante <=
            0
              ? "text-green-700"
              : "text-red-600"
          }
        />

        <Kpi
          titulo="Pedidos Abiertos"
          valor={dinero(
            resumen.pedidos
          )}
        />

        <Kpi
          titulo="Entregas"
          valor={dinero(
            resumen.entregas
          )}
        />

        <Kpi
          titulo="Cierre Potencial Q"
          valor={dinero(
            resumen.cierreQ
          )}
          detalle={`Cierre ${porcentaje(
            resumen.cierrePct
          )}`}
          color={colorPorcentaje(
            resumen.cierrePct
          )}
        />

        <Kpi
          titulo="Cierre Potencial Total"
          valor={dinero(
            resumen.cierreTotal
          )}
        />
      </div>

      {/* RESUMEN ZONA */}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-gray-900">
            Resumen por Zona
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">
                  Zona
                </th>

                <th className="px-4 py-3 text-right">
                  Meta
                </th>

                <th className="px-4 py-3 text-right">
                  Venta Q
                </th>

                <th className="px-4 py-3 text-right">
                  % Avance
                </th>

                <th className="px-4 py-3 text-right">
                  Venta Total
                </th>

                <th className="px-4 py-3 text-right">
                  Pedidos
                </th>

                <th className="px-4 py-3 text-right">
                  Entregas
                </th>

                <th className="px-4 py-3 text-right">
                  Cierre Q
                </th>

                <th className="px-4 py-3 text-right">
                  % Cierre
                </th>

                <th className="px-4 py-3 text-right">
                  Cierre Total
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {resumenPorZona.map(
                (r) => {
                  const avance =
                    r.meta > 0
                      ? (r.ventaQ /
                          r.meta) *
                        100
                      : 0;

                  const cierre =
                    r.meta > 0
                      ? (r.cierreQ /
                          r.meta) *
                        100
                      : 0;

                  return (
                    <tr
                      key={
                        r.zona
                      }
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 font-semibold">
                        {r.zona}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {dinero(
                          r.meta
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {dinero(
                          r.ventaQ
                        )}
                      </td>

                      <td
                        className={`px-4 py-3 text-right font-semibold ${colorPorcentaje(
                          avance
                        )}`}
                      >
                        {porcentaje(
                          avance
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {dinero(
                          r.ventaTotal
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {dinero(
                          r.pedidos
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {dinero(
                          r.entregas
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {dinero(
                          r.cierreQ
                        )}
                      </td>

                      <td
                        className={`px-4 py-3 text-right font-semibold ${colorPorcentaje(
                          cierre
                        )}`}
                      >
                        {porcentaje(
                          cierre
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {dinero(
                          r.cierreTotal
                        )}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETALLE */}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-gray-900">
            Detalle por Vendedor
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            {
              filasFiltradas.length
            }{" "}
            registros
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1650px] w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-3 text-left">
                  Zona
                </th>

                <th className="px-3 py-3 text-left">
                  División
                </th>

                <th className="px-3 py-3 text-left">
                  Equipo
                </th>

                <th className="px-3 py-3 text-left">
                  Vendedor
                </th>

                <th className="px-3 py-3 text-right">
                  Meta
                </th>

                <th className="px-3 py-3 text-right">
                  Venta Q
                </th>

                <th className="px-3 py-3 text-right">
                  % Avance
                </th>

                <th className="px-3 py-3 text-right">
                  Otros
                </th>

                <th className="px-3 py-3 text-right">
                  Venta Total
                </th>

                <th className="px-3 py-3 text-right">
                  Pedidos
                </th>

                <th className="px-3 py-3 text-right">
                  Entregas
                </th>

                <th className="px-3 py-3 text-right">
                  Cierre Q
                </th>

                <th className="px-3 py-3 text-right">
                  % Cierre
                </th>

                <th className="px-3 py-3 text-right">
                  Cierre Total
                </th>

                <th className="px-3 py-3 text-right">
                  Faltante
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {filasFiltradas.map(
                (r) => {
                  const meta =
                    numero(
                      r.meta_mes
                    );

                  const ventaQ =
                    numero(
                      r.facturado_quimicos
                    );

                  const cierreQ =
                    numero(
                      r.cierre_quimicos
                    );

                  const avance =
                    meta > 0
                      ? (ventaQ /
                          meta) *
                        100
                      : 0;

                  const pctCierre =
                    meta > 0
                      ? (cierreQ /
                          meta) *
                        100
                      : 0;

                  const faltante =
                    meta -
                    ventaQ;

                  return (
                    <tr
                      key={`${r.fecha_corte}-${r.slpcode}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-3 py-3">
                        {r.zona ||
                          "—"}
                      </td>

                      <td className="px-3 py-3">
                        {r.division ||
                          "—"}
                      </td>

                      <td className="px-3 py-3">
                        {r.equipo ||
                          "—"}
                      </td>

                      <td className="px-3 py-3 font-medium">
                        {r.vendedor}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {dinero(
                          meta
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {dinero(
                          ventaQ
                        )}
                      </td>

                      <td
                        className={`px-3 py-3 text-right font-semibold ${colorPorcentaje(
                          avance
                        )}`}
                      >
                        {porcentaje(
                          avance
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {dinero(
                          r.facturado_otros
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {dinero(
                          r.facturado_total
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {dinero(
                          r.pedidos_total
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {dinero(
                          r.entregas_total
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {dinero(
                          cierreQ
                        )}
                      </td>

                      <td
                        className={`px-3 py-3 text-right font-semibold ${colorPorcentaje(
                          pctCierre
                        )}`}
                      >
                        {porcentaje(
                          pctCierre
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {dinero(
                          r.cierre_total
                        )}
                      </td>

                      <td
                        className={`px-3 py-3 text-right font-semibold ${
                          faltante <=
                          0
                            ? "text-green-700"
                            : "text-red-600"
                        }`}
                      >
                        {dinero(
                          faltante
                        )}
                      </td>
                    </tr>
                  );
                }
              )}

              {!loading &&
                filasFiltradas.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        15
                      }
                      className="px-4 py-10 text-center text-gray-500"
                    >
                      No hay
                      información
                      para los
                      filtros
                      seleccionados.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// KPI CARD
// ================================================================

function Kpi({
  titulo,
  valor,
  detalle,
  color = "text-gray-900",
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {titulo}
      </div>

      <div
        className={`mt-2 text-2xl font-bold ${color}`}
      >
        {valor}
      </div>

      {detalle && (
        <div className="mt-1 text-xs text-gray-500">
          {detalle}
        </div>
      )}
    </div>
  );
}