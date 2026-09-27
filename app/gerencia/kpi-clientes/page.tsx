"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// ============================================================
// TIPOS
// ============================================================

type KpiGlobal = {
  empresas_activas_60d: number;
  empresas_comodato_sin_compra_60d: number;
  unidades_comodato: number;
  valor_comodato: number;
  venta_neta_12m: number;
  facturas_12m: number;
  nc_12m: number;
  porcentaje_nc_12m: number;
  eficiencia_comodato_global: number | null;
};

type AlertaCliente = {
  codigo_cliente: string;
  rut: string;
  rut_key: string;
  cliente: string;
  vendedor: string;

  ultima_compra_codigo: string | null;
  dias_sin_compra_codigo: number | null;

  ultima_compra_rut: string | null;
  dias_sin_compra_rut: number | null;

  venta_codigo_12m: number;
  venta_rut_12m: number;

  unidades_comodato_codigo: number;
  valor_comodato_codigo: number;

  unidades_comodato_rut: number;
  valor_comodato_rut: number;

  eficiencia_codigo: number | null;
  eficiencia_rut: number | null;

  porcentaje_nc_codigo: number;
  porcentaje_nc_rut: number;

  variacion_codigo_90d: number | null;
  variacion_rut_90d: number | null;

  estado_comercial:
    | "ACTIVO"
    | "COMPRA CENTRALIZADA"
    | "SIN COMPRA EMPRESA"
    | "OTRO";
};

type Perfil = {
  role?: string | null;
  department?: string | null;
  email?: string | null;
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

function number(value: unknown) {
  return num(value).toLocaleString(
    "es-CL",
    {
      maximumFractionDigits: 0,
    }
  );
}

function pct(value: unknown) {
  return `${num(value).toLocaleString(
    "es-CL",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )}%`;
}

function efficiency(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return `${Number(value).toLocaleString(
    "es-CL",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )}x`;
}

function dateCL(
  value: string | null | undefined
) {
  if (!value) {
    return "Sin compra";
  }

  const date = new Date(
    `${value}T12:00:00`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "es-CL"
  );
}

function diasTexto(
  value: number | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "Sin compra";
  }

  if (value === 0) {
    return "Hoy";
  }

  if (value === 1) {
    return "1 día";
  }

  return `${number(value)} días`;
}

function normalize(value: unknown) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function normalizeRole(
  value: unknown
) {
  return normalize(value);
}

function estadoBadge(
  estado: string
) {
  switch (estado) {
    case "ACTIVO":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "COMPRA CENTRALIZADA":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "SIN COMPRA EMPRESA":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-600";
  }
}

function estadoOrden(
  estado: string
) {
  if (
    estado ===
    "SIN COMPRA EMPRESA"
  ) {
    return 1;
  }

  if (
    estado ===
    "COMPRA CENTRALIZADA"
  ) {
    return 2;
  }

  if (
    estado === "ACTIVO"
  ) {
    return 3;
  }

  return 4;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function GerenciaKpiClientesPage() {
  const supabase = useMemo(
    () =>
      createClientComponentClient(),
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    autorizado,
    setAutorizado,
  ] = useState<boolean | null>(
    null
  );

  const [
    kpi,
    setKpi,
  ] = useState<KpiGlobal | null>(
    null
  );

  const [
    rows,
    setRows,
  ] = useState<
    AlertaCliente[]
  >([]);

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    estadoFiltro,
    setEstadoFiltro,
  ] = useState("TODOS");

  const [
    vendedorFiltro,
    setVendedorFiltro,
  ] = useState("TODOS");

  // ============================================================
  // CARGA
  // ============================================================

  const cargarDatos =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        // --------------------------------------------------------
        // 1. SESIÓN
        // --------------------------------------------------------

        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        if (!session?.user) {
          setAutorizado(false);

          setError(
            "No existe una sesión activa."
          );

          return;
        }

        const email =
          normalize(
            session.user.email
          );

        // --------------------------------------------------------
        // 2. PERFIL
        // --------------------------------------------------------

        const {
          data: perfilData,
          error: perfilError,
        } =
          await supabase
            .from("profiles")
            .select(
              `
              role,
              department,
              email
            `
            )
            .eq(
              "id",
              session.user.id
            )
            .maybeSingle();

        if (perfilError) {
          throw perfilError;
        }

        const perfil =
          (perfilData ||
            {}) as Perfil;

        const role =
          normalizeRole(
            perfil.role
          );

        const department =
          normalizeRole(
            perfil.department
          );

        const esGerencia =
          role === "gerencia" ||
          department.startsWith(
            "gerencia_"
          );

        /*
         * Se conserva el acceso especial que
         * ya utilizas en las políticas actuales.
         */
        const accesoEspecial =
          email ===
          "silvana.pincheira@spartan.cl";

        if (
          !esGerencia &&
          !accesoEspecial
        ) {
          setAutorizado(false);
          return;
        }

        setAutorizado(true);

        // --------------------------------------------------------
        // 3. KPI GLOBAL
        // --------------------------------------------------------

        const {
          data: kpiData,
          error: kpiError,
        } =
          await supabase
            .from(
              "gerencia_kpi_global"
            )
            .select("*")
            .maybeSingle();

        if (kpiError) {
          throw kpiError;
        }

        if (kpiData) {
          setKpi({
            empresas_activas_60d:
              num(
                kpiData.empresas_activas_60d
              ),

            empresas_comodato_sin_compra_60d:
              num(
                kpiData.empresas_comodato_sin_compra_60d
              ),

            unidades_comodato:
              num(
                kpiData.unidades_comodato
              ),

            valor_comodato:
              num(
                kpiData.valor_comodato
              ),

            venta_neta_12m:
              num(
                kpiData.venta_neta_12m
              ),

            facturas_12m:
              num(
                kpiData.facturas_12m
              ),

            nc_12m:
              num(
                kpiData.nc_12m
              ),

            porcentaje_nc_12m:
              num(
                kpiData.porcentaje_nc_12m
              ),

            eficiencia_comodato_global:
              kpiData.eficiencia_comodato_global ===
                null
                ? null
                : num(
                    kpiData.eficiencia_comodato_global
                  ),
          });
        }

        // --------------------------------------------------------
        // 4. ALERTAS / CUENTAS CON COMODATO
        // --------------------------------------------------------

        const {
          data: alertasData,
          error: alertasError,
        } =
          await supabase
            .from(
              "gerencia_alertas_clientes"
            )
            .select("*")
            .order(
              "valor_comodato_codigo",
              {
                ascending: false,
              }
            )
            .range(
              0,
              999
            );

        if (alertasError) {
          throw alertasError;
        }

        setRows(
          (
            alertasData ||
            []
          ).map(
            (r: any) => ({
              ...r,

              venta_codigo_12m:
                num(
                  r.venta_codigo_12m
                ),

              venta_rut_12m:
                num(
                  r.venta_rut_12m
                ),

              unidades_comodato_codigo:
                num(
                  r.unidades_comodato_codigo
                ),

              valor_comodato_codigo:
                num(
                  r.valor_comodato_codigo
                ),

              unidades_comodato_rut:
                num(
                  r.unidades_comodato_rut
                ),

              valor_comodato_rut:
                num(
                  r.valor_comodato_rut
                ),

              porcentaje_nc_codigo:
                num(
                  r.porcentaje_nc_codigo
                ),

              porcentaje_nc_rut:
                num(
                  r.porcentaje_nc_rut
                ),

              eficiencia_codigo:
                r.eficiencia_codigo ===
                  null
                  ? null
                  : num(
                      r.eficiencia_codigo
                    ),

              eficiencia_rut:
                r.eficiencia_rut ===
                  null
                  ? null
                  : num(
                      r.eficiencia_rut
                    ),

              variacion_codigo_90d:
                r.variacion_codigo_90d ===
                  null
                  ? null
                  : num(
                      r.variacion_codigo_90d
                    ),

              variacion_rut_90d:
                r.variacion_rut_90d ===
                  null
                  ? null
                  : num(
                      r.variacion_rut_90d
                    ),

              dias_sin_compra_codigo:
                r.dias_sin_compra_codigo ===
                  null
                  ? null
                  : num(
                      r.dias_sin_compra_codigo
                    ),

              dias_sin_compra_rut:
                r.dias_sin_compra_rut ===
                  null
                  ? null
                  : num(
                      r.dias_sin_compra_rut
                    ),
            })
          )
        );
      } catch (
        err: any
      ) {
        console.error(
          "Error KPI Gerencia:",
          err
        );

        setError(
          err?.message ||
            "No fue posible cargar los indicadores."
        );
      } finally {
        setLoading(false);
      }
    }, [supabase]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ============================================================
  // OPCIONES FILTROS
  // ============================================================

  const vendedores =
    useMemo(() => {
      return [
        ...new Set(
          rows
            .map((r) =>
              String(
                r.vendedor || ""
              ).trim()
            )
            .filter(Boolean)
        ),
      ].sort(
        (
          a,
          b
        ) =>
          a.localeCompare(
            b,
            "es"
          )
      );
    }, [rows]);

  // ============================================================
  // FILTRADO
  // ============================================================

  const filtrados =
    useMemo(() => {
      const q =
        normalize(
          busqueda
        );

      return rows
        .filter((r) => {
          if (
            estadoFiltro !==
              "TODOS" &&
            r.estado_comercial !==
              estadoFiltro
          ) {
            return false;
          }

          if (
            vendedorFiltro !==
              "TODOS" &&
            r.vendedor !==
              vendedorFiltro
          ) {
            return false;
          }

          if (!q) {
            return true;
          }

          const texto = [
            r.codigo_cliente,
            r.rut,
            r.cliente,
            r.vendedor,
            r.estado_comercial,
          ]
            .join(" ")
            .toLowerCase();

          return texto.includes(
            q
          );
        })
        .sort(
          (
            a,
            b
          ) => {
            const estadoA =
              estadoOrden(
                a.estado_comercial
              );

            const estadoB =
              estadoOrden(
                b.estado_comercial
              );

            if (
              estadoA !==
              estadoB
            ) {
              return (
                estadoA -
                estadoB
              );
            }

            return (
              b.valor_comodato_codigo -
              a.valor_comodato_codigo
            );
          }
        );
    }, [
      rows,
      busqueda,
      estadoFiltro,
      vendedorFiltro,
    ]);

  // ============================================================
  // RESUMEN ESTADOS
  // ============================================================

  const resumenEstados =
    useMemo(() => {
      const base = {
        activo: 0,
        centralizada: 0,
        sinCompra: 0,

        valorActivo: 0,
        valorCentralizada: 0,
        valorSinCompra: 0,
      };

      rows.forEach(
        (r) => {
          if (
            r.estado_comercial ===
            "ACTIVO"
          ) {
            base.activo += 1;

            base.valorActivo +=
              r.valor_comodato_codigo;
          }

          if (
            r.estado_comercial ===
            "COMPRA CENTRALIZADA"
          ) {
            base.centralizada +=
              1;

            base.valorCentralizada +=
              r.valor_comodato_codigo;
          }

          if (
            r.estado_comercial ===
            "SIN COMPRA EMPRESA"
          ) {
            base.sinCompra += 1;

            base.valorSinCompra +=
              r.valor_comodato_codigo;
          }
        }
      );

      return base;
    }, [rows]);

  // ============================================================
  // LOADING
  // ============================================================

  if (
    loading &&
    autorizado === null
  ) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-zinc-600">
              Cargando indicadores
              de Gerencia...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // SIN ACCESO
  // ============================================================

  if (
    autorizado === false
  ) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-zinc-900">
              Reportería de
              Gerencia
            </h1>

            <p className="mt-3 text-sm text-zinc-600">
              Tu usuario no tiene
              acceso a este módulo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-[1800px] px-4 py-6 md:px-6 lg:px-8">
        {/* ==================================================== */}
        {/* HEADER */}
        {/* ==================================================== */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Gerencia
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">
              Gestión de Clientes
              y Comodatos
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-zinc-500">
              Análisis consolidado
              por cuenta SAP y por
              RUT empresa.
            </p>
          </div>

          <button
            type="button"
            onClick={
              cargarDatos
            }
            disabled={
              loading
            }
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Actualizando..."
              : "Actualizar"}
          </button>
        </div>

        {/* ==================================================== */}
        {/* ERROR */}
        {/* ==================================================== */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ==================================================== */}
        {/* KPI PRINCIPALES */}
        {/* ==================================================== */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            label="Empresas activas"
            value={number(
              kpi?.empresas_activas_60d
            )}
            detail="Con compra en últimos 60 días"
          />

          <KpiCard
            label="Comodato sin compra"
            value={number(
              kpi?.empresas_comodato_sin_compra_60d
            )}
            detail="Empresas +60 días sin compra"
            emphasis="danger"
          />

          <KpiCard
            label="Comodato instalado"
            value={money(
              kpi?.valor_comodato
            )}
            detail="Valor actualmente instalado"
          />

          <KpiCard
            label="Unidades instaladas"
            value={number(
              kpi?.unidades_comodato
            )}
            detail="Equipos actualmente en clientes"
          />

          <KpiCard
            label="% Notas de crédito"
            value={pct(
              kpi?.porcentaje_nc_12m
            )}
            detail="NC / Facturación últimos 12 meses"
          />

          <KpiCard
            label="Eficiencia comodato"
            value={efficiency(
              kpi?.eficiencia_comodato_global
            )}
            detail="Venta neta 12m / comodato instalado"
          />
        </section>

        {/* ==================================================== */}
        {/* ESTADOS */}
        {/* ==================================================== */}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <EstadoCard
            title="Activo"
            count={
              resumenEstados.activo
            }
            value={
              resumenEstados.valorActivo
            }
            description="La cuenta presenta compra reciente."
            tone="green"
          />

          <EstadoCard
            title="Compra centralizada"
            count={
              resumenEstados.centralizada
            }
            value={
              resumenEstados.valorCentralizada
            }
            description="La cuenta no compra directamente, pero el RUT empresa sí."
            tone="amber"
          />

          <EstadoCard
            title="Sin compra empresa"
            count={
              resumenEstados.sinCompra
            }
            value={
              resumenEstados.valorSinCompra
            }
            description="Ni la cuenta ni el RUT registran compra reciente."
            tone="red"
          />
        </section>

        {/* ==================================================== */}
        {/* FILTROS */}
        {/* ==================================================== */}

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_240px_280px_auto]">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Buscar
              </label>

              <input
                value={
                  busqueda
                }
                onChange={(e) =>
                  setBusqueda(
                    e.target.value
                  )
                }
                placeholder="Cliente, RUT, código o ejecutivo..."
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Estado
              </label>

              <select
                value={
                  estadoFiltro
                }
                onChange={(e) =>
                  setEstadoFiltro(
                    e.target.value
                  )
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="TODOS">
                  Todos
                </option>

                <option value="ACTIVO">
                  Activo
                </option>

                <option value="COMPRA CENTRALIZADA">
                  Compra
                  centralizada
                </option>

                <option value="SIN COMPRA EMPRESA">
                  Sin compra
                  empresa
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Ejecutivo
              </label>

              <select
                value={
                  vendedorFiltro
                }
                onChange={(e) =>
                  setVendedorFiltro(
                    e.target.value
                  )
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="TODOS">
                  Todos
                </option>

                {vendedores.map(
                  (
                    vendedor
                  ) => (
                    <option
                      key={
                        vendedor
                      }
                      value={
                        vendedor
                      }
                    >
                      {
                        vendedor
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setBusqueda("");
                  setEstadoFiltro(
                    "TODOS"
                  );
                  setVendedorFiltro(
                    "TODOS"
                  );
                }}
                className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-zinc-100 pt-4 text-sm text-zinc-500">
            <span>
              Mostrando{" "}
              <strong className="font-semibold text-zinc-800">
                {
                  filtrados.length
                }
              </strong>{" "}
              cuentas
            </span>

            <span>
              Total cargado:{" "}
              <strong className="font-semibold text-zinc-800">
                {
                  rows.length
                }
              </strong>
            </span>
          </div>
        </section>

        {/* ==================================================== */}
        {/* TABLA */}
        {/* ==================================================== */}

        <section className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="font-semibold text-zinc-900">
              Análisis por cuenta
              cliente
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              La venta y el
              comodato se muestran
              tanto a nivel de
              código cliente como
              consolidado por RUT.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1750px] w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">
                    Estado
                  </th>

                  <th className="px-4 py-3">
                    Cliente
                  </th>

                  <th className="px-4 py-3">
                    RUT
                  </th>

                  <th className="px-4 py-3">
                    Código
                  </th>

                  <th className="px-4 py-3">
                    Ejecutivo
                  </th>

                  <th className="px-4 py-3 text-right">
                    Venta cuenta
                    12m
                  </th>

                  <th className="px-4 py-3 text-right">
                    Venta empresa
                    12m
                  </th>

                  <th className="px-4 py-3 text-right">
                    Comodato cuenta
                  </th>

                  <th className="px-4 py-3 text-right">
                    Comodato empresa
                  </th>

                  <th className="px-4 py-3 text-center">
                    Última compra
                    cuenta
                  </th>

                  <th className="px-4 py-3 text-center">
                    Última compra
                    empresa
                  </th>

                  <th className="px-4 py-3 text-right">
                    Eficiencia cuenta
                  </th>

                  <th className="px-4 py-3 text-right">
                    Eficiencia empresa
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {filtrados.map(
                  (row) => (
                    <tr
                      key={`${row.codigo_cliente}-${row.rut_key}`}
                      className="transition hover:bg-zinc-50/80"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(
                            row.estado_comercial
                          )}`}
                        >
                          {
                            row.estado_comercial
                          }
                        </span>
                      </td>

                      <td className="max-w-[280px] px-4 py-3">
                        <div className="font-medium text-zinc-900">
                          {row.cliente ||
                            "—"}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {row.rut ||
                          "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-700">
                        {
                          row.codigo_cliente
                        }
                      </td>

                      <td className="max-w-[220px] px-4 py-3 text-zinc-600">
                        {row.vendedor ||
                          "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        {money(
                          row.venta_codigo_12m
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-zinc-900">
                        {money(
                          row.venta_rut_12m
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        {money(
                          row.valor_comodato_codigo
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-zinc-900">
                        {money(
                          row.valor_comodato_rut
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="whitespace-nowrap text-zinc-700">
                          {dateCL(
                            row.ultima_compra_codigo
                          )}
                        </div>

                        <div className="mt-0.5 whitespace-nowrap text-xs text-zinc-400">
                          {diasTexto(
                            row.dias_sin_compra_codigo
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="whitespace-nowrap font-medium text-zinc-800">
                          {dateCL(
                            row.ultima_compra_rut
                          )}
                        </div>

                        <div className="mt-0.5 whitespace-nowrap text-xs text-zinc-400">
                          {diasTexto(
                            row.dias_sin_compra_rut
                          )}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        {efficiency(
                          row.eficiencia_codigo
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-zinc-900">
                        {efficiency(
                          row.eficiencia_rut
                        )}
                      </td>
                    </tr>
                  )
                )}

                {filtrados.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        13
                      }
                      className="px-6 py-12 text-center text-sm text-zinc-500"
                    >
                      No existen
                      resultados para
                      los filtros
                      seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ==================================================== */}
        {/* NOTA */}
        {/* ==================================================== */}

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs leading-5 text-zinc-500">
          <strong className="font-semibold text-zinc-700">
            Cuenta:
          </strong>{" "}
          corresponde al código
          cliente SAP.{" "}
          <strong className="font-semibold text-zinc-700">
            Empresa:
          </strong>{" "}
          consolida todos los
          códigos cliente asociados
          al mismo RUT.
        </div>
      </main>
    </div>
  );
}

// ============================================================
// KPI CARD
// ============================================================

function KpiCard({
  label,
  value,
  detail,
  emphasis = "normal",
}: {
  label: string;
  value: string;
  detail: string;
  emphasis?:
    | "normal"
    | "danger";
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        emphasis ===
        "danger"
          ? "border-red-200"
          : "border-zinc-200"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          emphasis ===
          "danger"
            ? "text-red-700"
            : "text-zinc-900"
        }`}
      >
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-zinc-500">
        {detail}
      </p>
    </div>
  );
}

// ============================================================
// ESTADO CARD
// ============================================================

function EstadoCard({
  title,
  count,
  value,
  description,
  tone,
}: {
  title: string;
  count: number;
  value: number;
  description: string;
  tone:
    | "green"
    | "amber"
    | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50/60"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50/60"
      : "border-red-200 bg-red-50/60";

  const titleClass =
    tone === "green"
      ? "text-emerald-800"
      : tone === "amber"
      ? "text-amber-800"
      : "text-red-800";

  return (
    <div
      className={`rounded-2xl border p-5 ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className={`text-sm font-semibold ${titleClass}`}
          >
            {title}
          </p>

          <p className="mt-1 text-xs leading-5 text-zinc-600">
            {description}
          </p>
        </div>

        <div className="rounded-xl bg-white/80 px-3 py-2 text-center shadow-sm">
          <div className="text-xl font-semibold text-zinc-900">
            {number(
              count
            )}
          </div>

          <div className="text-[10px] uppercase tracking-wide text-zinc-400">
            cuentas
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-black/5 pt-3">
        <p className="text-xs text-zinc-500">
          Comodato asociado
        </p>

        <p className="mt-1 text-lg font-semibold text-zinc-900">
          {money(
            value
          )}
        </p>
      </div>
    </div>
  );
}