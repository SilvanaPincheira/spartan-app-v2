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
  slpcode: number;
  vendedor: string;
  zona: string | null;
  division: string | null;
  equipo: string | null;

  meta_mes: number | string | null;

  facturado_quimicos: number | string | null;
  facturado_otros: number | string | null;
  facturado_total: number | string | null;

  pedidos_total: number | string | null;
  entregas_total: number | string | null;

  cierre_quimicos: number | string | null;
  cierre_total: number | string | null;

  synced_at: string | null;
};

type GestionRow = {
  fecha_corte: string;
  slpcode: number;
  proyeccion_total_mes: number | string | null;
  driver: string | null;
  acciones_mitigacion: string | null;
  monto_mitigacion: number | string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

type GestionEdit = {
  proyeccion_total_mes: string;
  driver: string;
  acciones_mitigacion: string;
  monto_mitigacion: string;
};

function n(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function money(value: unknown) {
  return n(value).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function pct(value: number) {
  return `${value.toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function fechaHora(value?: string | null) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return value;
  }

  return d.toLocaleString("es-CL");
}

function colorPct(value: number) {
  if (value >= 100) {
    return "bg-green-100 text-green-800";
  }

  if (value >= 80) {
    return "bg-yellow-100 text-yellow-800";
  }

  return "bg-red-100 text-red-700";
}

function colorDiferencia(value: number) {
  if (value >= 0) {
    return "bg-green-50 text-green-800";
  }

  return "bg-red-50 text-red-700";
}

export default function AvanceDiarioPage() {
  const supabase = useMemo(
    () => createClientComponentClient(),
    []
  );

  const [rows, setRows] = useState<ReporteRow[]>([]);
  const [gestion, setGestion] = useState<Record<number, GestionEdit>>({});

  const [fechaCorte, setFechaCorte] = useState("");
  const [zonaFiltro, setZonaFiltro] = useState("TODAS");
  const [divisionFiltro, setDivisionFiltro] = useState("TODAS");
  const [equipoFiltro, setEquipoFiltro] = useState("TODOS");

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [emailUsuario, setEmailUsuario] = useState("");

  // ============================================================
  // SESIÓN
  // ============================================================

  const validarSesion = useCallback(async () => {
    const { data } = await supabase.auth.getSession();

    const session = data.session;

    if (!session?.user) {
      window.location.href = "/login";
      return false;
    }

    setEmailUsuario(
      session.user.email || ""
    );

    return true;
  }, [supabase]);

  // ============================================================
  // ÚLTIMA FECHA
  // ============================================================

  const obtenerUltimaFecha = useCallback(async () => {
    const { data, error } = await supabase
      .from("reporte_ventas_diario")
      .select("fecha_corte")
      .order("fecha_corte", {
        ascending: false,
      })
      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0]?.fecha_corte || "";
  }, [supabase]);

  // ============================================================
  // CARGAR
  // ============================================================

  const cargar = useCallback(
    async (fechaSolicitada?: string) => {
      try {
        setLoading(true);
        setError("");
        setMensaje("");

        let fecha = fechaSolicitada || fechaCorte;

        if (!fecha) {
          fecha = await obtenerUltimaFecha();

          if (!fecha) {
            setError("No existen datos de Avance Diario.");
            setRows([]);
            return;
          }

          setFechaCorte(fecha);
        }

        const [
          reporteResult,
          gestionResult,
        ] = await Promise.all([
          supabase
            .from("reporte_ventas_diario")
            .select(`
              id,
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
              pedidos_total,
              entregas_total,
              cierre_quimicos,
              cierre_total,
              synced_at
            `)
            .eq("fecha_corte", fecha)
            .order("zona")
            .order("vendedor"),

          supabase
            .from("avance_diario_gestion")
            .select(`
              fecha_corte,
              slpcode,
              proyeccion_total_mes,
              driver,
              acciones_mitigacion,
              monto_mitigacion,
              updated_at,
              updated_by
            `)
            .eq("fecha_corte", fecha),
        ]);

        if (reporteResult.error) {
          throw reporteResult.error;
        }

        if (gestionResult.error) {
          throw gestionResult.error;
        }

        const reporte =
          (reporteResult.data || []) as ReporteRow[];

        const gestionDb =
          (gestionResult.data || []) as GestionRow[];

        setRows(reporte);

        const gestionMap: Record<number, GestionEdit> = {};

        reporte.forEach((r) => {
          const existente = gestionDb.find(
            (g) => Number(g.slpcode) === Number(r.slpcode)
          );

          gestionMap[r.slpcode] = {
            proyeccion_total_mes:
              existente?.proyeccion_total_mes != null
                ? String(existente.proyeccion_total_mes)
                : "",

            driver:
              existente?.driver || "",

            acciones_mitigacion:
              existente?.acciones_mitigacion || "",

            monto_mitigacion:
              existente?.monto_mitigacion != null
                ? String(existente.monto_mitigacion)
                : "",
          };
        });

        setGestion(gestionMap);
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
      fechaCorte,
      obtenerUltimaFecha,
    ]
  );

  // ============================================================
  // INICIO
  // ============================================================

  useEffect(() => {
    async function iniciar() {
      const ok = await validarSesion();

      if (!ok) {
        setLoading(false);
        return;
      }

      await cargar();
    }

    iniciar();
  }, []);

  // ============================================================
  // ACTUALIZACIÓN AUTOMÁTICA
  // ============================================================

  useEffect(() => {
    if (!fechaCorte) return;

    const timer = window.setInterval(() => {
      cargar(fechaCorte);
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    fechaCorte,
    cargar,
  ]);

  // ============================================================
  // FILTROS
  // ============================================================

  const zonas = useMemo(() => {
    return [
      ...new Set(
        rows
          .map((r) => r.zona || "")
          .filter(Boolean)
      ),
    ].sort();
  }, [rows]);

  const divisiones = useMemo(() => {
    return [
      ...new Set(
        rows
          .filter(
            (r) =>
              zonaFiltro === "TODAS" ||
              r.zona === zonaFiltro
          )
          .map((r) => r.division || "")
          .filter(Boolean)
      ),
    ].sort();
  }, [
    rows,
    zonaFiltro,
  ]);

  const equipos = useMemo(() => {
    return [
      ...new Set(
        rows
          .filter((r) => {
            if (
              zonaFiltro !== "TODAS" &&
              r.zona !== zonaFiltro
            ) {
              return false;
            }

            if (
              divisionFiltro !== "TODAS" &&
              r.division !== divisionFiltro
            ) {
              return false;
            }

            return true;
          })
          .map((r) => r.equipo || "")
          .filter(Boolean)
      ),
    ].sort();
  }, [
    rows,
    zonaFiltro,
    divisionFiltro,
  ]);

  const filtrados = useMemo(() => {
    return rows.filter((r) => {
      if (
        zonaFiltro !== "TODAS" &&
        r.zona !== zonaFiltro
      ) {
        return false;
      }

      if (
        divisionFiltro !== "TODAS" &&
        r.division !== divisionFiltro
      ) {
        return false;
      }

      if (
        equipoFiltro !== "TODOS" &&
        r.equipo !== equipoFiltro
      ) {
        return false;
      }

      return true;
    });
  }, [
    rows,
    zonaFiltro,
    divisionFiltro,
    equipoFiltro,
  ]);

  useEffect(() => {
    setDivisionFiltro("TODAS");
    setEquipoFiltro("TODOS");
  }, [zonaFiltro]);

  useEffect(() => {
    setEquipoFiltro("TODOS");
  }, [divisionFiltro]);

  // ============================================================
  // EDITAR
  // ============================================================

  function editar(
    slpcode: number,
    campo: keyof GestionEdit,
    valor: string
  ) {
    setGestion((prev) => ({
      ...prev,
      [slpcode]: {
        ...(prev[slpcode] || {
          proyeccion_total_mes: "",
          driver: "",
          acciones_mitigacion: "",
          monto_mitigacion: "",
        }),
        [campo]: valor,
      },
    }));
  }

  // ============================================================
  // GUARDAR
  // ============================================================

  async function guardarCambios() {
    if (!fechaCorte) return;

    try {
      setGuardando(true);
      setMensaje("");
      setError("");

      const payload = filtrados.map((r) => {
        const g = gestion[r.slpcode] || {
          proyeccion_total_mes: "",
          driver: "",
          acciones_mitigacion: "",
          monto_mitigacion: "",
        };

        return {
          fecha_corte: fechaCorte,
          slpcode: r.slpcode,

          proyeccion_total_mes:
            n(g.proyeccion_total_mes),

          driver:
            g.driver?.trim() || null,

          acciones_mitigacion:
            g.acciones_mitigacion?.trim() || null,

          monto_mitigacion:
            n(g.monto_mitigacion),

          updated_at:
            new Date().toISOString(),

          updated_by:
            emailUsuario || null,
        };
      });

      const { error } = await supabase
        .from("avance_diario_gestion")
        .upsert(
          payload,
          {
            onConflict:
              "fecha_corte,slpcode",
          }
        );

      if (error) {
        throw error;
      }

      setMensaje(
        "Cambios guardados correctamente."
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "No fue posible guardar los cambios."
      );
    } finally {
      setGuardando(false);
    }
  }

  // ============================================================
  // CÁLCULO POR VENDEDOR
  // ============================================================

  function calc(r: ReporteRow) {
    const g = gestion[r.slpcode];

    const meta =
      n(r.meta_mes);

    const quimicos =
      n(r.facturado_quimicos);

    const otros =
      n(r.facturado_otros);

    const ventaTotal =
      n(r.facturado_total);

    const proyeccion =
      n(g?.proyeccion_total_mes);

    const mitigacion =
      n(g?.monto_mitigacion);

    const avance =
      meta > 0
        ? (quimicos / meta) * 100
        : 0;

    const cumplimiento =
      meta > 0
        ? (proyeccion / meta) * 100
        : 0;

    const diferencia =
      proyeccion - meta;

    const total =
      proyeccion + mitigacion;

    const cumplimientoFinal =
      meta > 0
        ? (total / meta) * 100
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
  // AGRUPACIÓN ZONA
  // ============================================================

  const grupos = useMemo(() => {
    const mapa = new Map<string, ReporteRow[]>();

    filtrados.forEach((r) => {
      const zona =
        r.zona || "SIN ZONA";

      if (!mapa.has(zona)) {
        mapa.set(zona, []);
      }

      mapa.get(zona)!.push(r);
    });

    return [...mapa.entries()];
  }, [filtrados]);

  // ============================================================
  // TOTALES
  // ============================================================

  function totalGrupo(
    lista: ReporteRow[]
  ) {
    let meta = 0;
    let quimicos = 0;
    let otros = 0;
    let ventaTotal = 0;
    let proyeccion = 0;
    let mitigacion = 0;

    lista.forEach((r) => {
      const c = calc(r);

      meta += c.meta;
      quimicos += c.quimicos;
      otros += c.otros;
      ventaTotal += c.ventaTotal;
      proyeccion += c.proyeccion;
      mitigacion += c.mitigacion;
    });

    const avance =
      meta > 0
        ? (quimicos / meta) * 100
        : 0;

    const cumplimiento =
      meta > 0
        ? (proyeccion / meta) * 100
        : 0;

    const diferencia =
      proyeccion - meta;

    const total =
      proyeccion + mitigacion;

    const cumplimientoFinal =
      meta > 0
        ? (total / meta) * 100
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
      () => totalGrupo(filtrados),
      [
        filtrados,
        gestion,
      ]
    );

  const ultimaSync =
    useMemo(() => {
      const fechas = rows
        .map((r) => r.synced_at)
        .filter(
          (x): x is string =>
            Boolean(x)
        )
        .sort();

      return fechas.length
        ? fechas[
            fechas.length - 1
          ]
        : null;
    }, [rows]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-5">
      {/* CABECERA */}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Avance Diario
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Ventas netas, proyección de cierre y acciones de mitigación.
          </p>
        </div>

        <div className="text-sm text-gray-500">
          Última sincronización SAP:{" "}
          <strong>
            {fechaHora(ultimaSync)}
          </strong>
        </div>
      </div>

      {/* FILTROS */}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Filtro label="Fecha de corte">
            <input
              type="date"
              value={fechaCorte}
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
              value={zonaFiltro}
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

              {zonas.map((z) => (
                <option
                  key={z}
                  value={z}
                >
                  {z}
                </option>
              ))}
            </select>
          </Filtro>

          <Filtro label="División">
            <select
              value={divisionFiltro}
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
              value={equipoFiltro}
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

          <div className="flex items-end gap-2">
            <button
              onClick={() =>
                cargar(fechaCorte)
              }
              className="flex-1 rounded-lg border px-4 py-2 font-semibold hover:bg-gray-50"
            >
              Actualizar
            </button>

            <button
              onClick={guardarCambios}
              disabled={guardando}
              className="flex-1 rounded-lg bg-[#1f4ed8] px-4 py-2 font-semibold text-white hover:bg-[#163bb8] disabled:opacity-50"
            >
              {guardando
                ? "Guardando..."
                : "Guardar"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {mensaje}
        </div>
      )}

      {/* TOTAL EMPRESA */}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-[1900px] w-full border-collapse text-xs">
          <thead>
            <tr>
              <th
                colSpan={7}
                className="border bg-gray-100 px-3 py-2 text-left text-sm font-bold"
              >
                AVANCE REAL
              </th>

              <th
                colSpan={8}
                className="border bg-yellow-100 px-3 py-2 text-center text-sm font-bold"
              >
                PROYECCIÓN Y ACCIONES DE MITIGACIÓN
              </th>
            </tr>

            <tr className="bg-gray-50">
              <Cab>Zona</Cab>
              <Cab>Empleado Ventas</Cab>
              <Cab>Meta del Mes</Cab>
              <Cab>Vta Neta Químicos</Cab>
              <Cab>% Tot</Cab>
              <Cab>Venta Neta Otros</Cab>
              <Cab>Venta Neta Total</Cab>

              <Cab amarillo>
                Proyección Total Mes
              </Cab>

              <Cab verde>
                % Cum
              </Cab>

              <Cab>
                Diferencia
              </Cab>

              <Cab>
                Driver
              </Cab>

              <Cab>
                Acciones de Mitigación para llegar a Meta con Riesgo
              </Cab>

              <Cab amarillo>
                $$ Mitigación
              </Cab>

              <Cab verde>
                Total
              </Cab>

              <Cab verde>
                % Cum
              </Cab>
            </tr>
          </thead>

          <tbody>
            {/* TOTAL EMPRESA */}

            <FilaTotal
              nombre="TOTAL"
              zona=""
              t={totalEmpresa}
            />

            {/* ZONAS */}

            {grupos.map(
              ([zona, lista]) => {
                const totalZona =
                  totalGrupo(lista);

                return (
                  <React.Fragment
                    key={zona}
                  >
                    <FilaTotal
                      nombre={`Total ${zona}`}
                      zona={zona}
                      t={totalZona}
                    />

                    {lista.map(
                      (r) => {
                        const c =
                          calc(r);

                        const g =
                          gestion[
                            r.slpcode
                          ] || {
                            proyeccion_total_mes:
                              "",
                            driver: "",
                            acciones_mitigacion:
                              "",
                            monto_mitigacion:
                              "",
                          };

                        return (
                          <tr
                            key={`${r.fecha_corte}-${r.slpcode}`}
                            className="hover:bg-blue-50"
                          >
                            <Celda>
                              {r.zona}
                            </Celda>

                            <Celda
                              izquierda
                              fuerte
                            >
                              {r.vendedor}
                            </Celda>

                            <Celda>
                              {money(
                                c.meta
                              )}
                            </Celda>

                            <Celda>
                              {money(
                                c.quimicos
                              )}
                            </Celda>

                            <Celda
                              clase={colorPct(
                                c.avance
                              )}
                            >
                              {pct(
                                c.avance
                              )}
                            </Celda>

                            <Celda>
                              {money(
                                c.otros
                              )}
                            </Celda>

                            <Celda fuerte>
                              {money(
                                c.ventaTotal
                              )}
                            </Celda>

                            {/* PROYECCIÓN */}

                            <td className="border bg-yellow-50 p-1">
                              <input
                                type="number"
                                value={
                                  g.proyeccion_total_mes
                                }
                                onChange={(
                                  e
                                ) =>
                                  editar(
                                    r.slpcode,
                                    "proyeccion_total_mes",
                                    e.target.value
                                  )
                                }
                                className="w-32 rounded border border-yellow-300 bg-yellow-50 px-2 py-1 text-right"
                              />
                            </td>

                            <Celda
                              clase={colorPct(
                                c.cumplimiento
                              )}
                            >
                              {pct(
                                c.cumplimiento
                              )}
                            </Celda>

                            <Celda
                              clase={colorDiferencia(
                                c.diferencia
                              )}
                            >
                              {money(
                                c.diferencia
                              )}
                            </Celda>

                            <td className="min-w-[220px] border p-1">
                              <textarea
                                value={
                                  g.driver
                                }
                                onChange={(
                                  e
                                ) =>
                                  editar(
                                    r.slpcode,
                                    "driver",
                                    e.target.value
                                  )
                                }
                                rows={2}
                                className="w-full resize-y rounded border px-2 py-1"
                              />
                            </td>

                            <td className="min-w-[300px] border p-1">
                              <textarea
                                value={
                                  g.acciones_mitigacion
                                }
                                onChange={(
                                  e
                                ) =>
                                  editar(
                                    r.slpcode,
                                    "acciones_mitigacion",
                                    e.target.value
                                  )
                                }
                                rows={2}
                                className="w-full resize-y rounded border px-2 py-1"
                              />
                            </td>

                            <td className="border bg-yellow-50 p-1">
                              <input
                                type="number"
                                value={
                                  g.monto_mitigacion
                                }
                                onChange={(
                                  e
                                ) =>
                                  editar(
                                    r.slpcode,
                                    "monto_mitigacion",
                                    e.target.value
                                  )
                                }
                                className="w-28 rounded border border-yellow-300 bg-yellow-50 px-2 py-1 text-right"
                              />
                            </td>

                            <Celda
                              fuerte
                              clase="bg-green-50"
                            >
                              {money(
                                c.total
                              )}
                            </Celda>

                            <Celda
                              clase={colorPct(
                                c.cumplimientoFinal
                              )}
                            >
                              {pct(
                                c.cumplimientoFinal
                              )}
                            </Celda>
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

      {!loading &&
        filtrados.length === 0 && (
          <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
            No existen registros para los filtros seleccionados.
          </div>
        )}
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

function Cab({
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
          ? "bg-yellow-200"
          : verde
          ? "bg-green-200"
          : "bg-gray-100"
      }`}
    >
      {children}
    </th>
  );
}

function Celda({
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
      <td className="border px-2 py-2 text-left">
        {zona}
      </td>

      <td className="border px-2 py-2 text-left">
        {nombre}
      </td>

      <td className="border px-2 py-2 text-right">
        {money(t.meta)}
      </td>

      <td className="border px-2 py-2 text-right">
        {money(t.quimicos)}
      </td>

      <td
        className={`border px-2 py-2 text-right ${colorPct(
          t.avance
        )}`}
      >
        {pct(t.avance)}
      </td>

      <td className="border px-2 py-2 text-right">
        {money(t.otros)}
      </td>

      <td className="border px-2 py-2 text-right">
        {money(t.ventaTotal)}
      </td>

      <td className="border bg-yellow-100 px-2 py-2 text-right">
        {money(t.proyeccion)}
      </td>

      <td
        className={`border px-2 py-2 text-right ${colorPct(
          t.cumplimiento
        )}`}
      >
        {pct(t.cumplimiento)}
      </td>

      <td
        className={`border px-2 py-2 text-right ${colorDiferencia(
          t.diferencia
        )}`}
      >
        {money(t.diferencia)}
      </td>

      <td className="border bg-gray-100" />

      <td className="border bg-gray-100" />

      <td className="border bg-yellow-100 px-2 py-2 text-right">
        {money(t.mitigacion)}
      </td>

      <td className="border bg-green-100 px-2 py-2 text-right">
        {money(t.total)}
      </td>

      <td
        className={`border px-2 py-2 text-right ${colorPct(
          t.cumplimientoFinal
        )}`}
      >
        {pct(
          t.cumplimientoFinal
        )}
      </td>
    </tr>
  );
}