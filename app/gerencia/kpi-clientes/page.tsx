"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// ============================================================
// TIPOS
// ============================================================

type EstadoComercial =
  | "ACTIVO"
  | "COMPRA CENTRALIZADA"
  | "SIN COMPRA EMPRESA";

type ClienteRow = {
  codigo_cliente: string;
  rut: string;
  rut_key: string;
  cliente: string;
  vendedor: string;
  division: string;
  activo_sap: boolean;

  ultima_compra_codigo: string | null;
  dias_sin_compra_codigo: number | null;

  ultima_compra_rut: string | null;
  dias_sin_compra_rut: number | null;

  venta_codigo_90d: number;
  venta_codigo_90d_anterior: number;
  venta_codigo_12m: number;

  facturas_codigo_12m: number;
  nc_codigo_12m: number;

  unidades_comodato_codigo: number;
  valor_comodato_codigo: number;

  porcentaje_nc_codigo: number;
  eficiencia_codigo: number | null;
  variacion_codigo_90d: number | null;

  venta_rut_90d: number;
  venta_rut_90d_anterior: number;
  venta_rut_12m: number;

  facturas_rut_12m: number;
  nc_rut_12m: number;

  unidades_comodato_rut: number;
  valor_comodato_rut: number;

  porcentaje_nc_rut: number;
  eficiencia_rut: number | null;
  variacion_rut_90d: number | null;
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

function normalize(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function dateCL(
  value: string | null
) {
  if (!value) {
    return "Sin compra";
  }

  const fecha =
    new Date(
      `${value}T12:00:00`
    );

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return value;
  }

  return fecha.toLocaleDateString(
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

// ============================================================
// ESTADO COMERCIAL
// ============================================================

function estadoDe(
  row: ClienteRow
): EstadoComercial | "SIN COMODATO" {
  if (
    row.valor_comodato_codigo <= 0
  ) {
    return "SIN COMODATO";
  }

  // La cuenta específica compra
  if (
    row.dias_sin_compra_codigo !== null &&
    row.dias_sin_compra_codigo <= 60
  ) {
    return "ACTIVO";
  }

  // La cuenta no compra, pero el RUT sí
  if (
    row.dias_sin_compra_rut !== null &&
    row.dias_sin_compra_rut <= 60
  ) {
    return "COMPRA CENTRALIZADA";
  }

  // Ni cuenta ni empresa compran
  return "SIN COMPRA EMPRESA";
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
    estado ===
    "ACTIVO"
  ) {
    return 3;
  }

  return 4;
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

// ============================================================
// PAGE
// ============================================================

export default function GerenciaKpiClientesPage() {
  const supabase =
    useMemo(
      () =>
        createClientComponentClient(),
      []
    );

  // ==========================================================
  // DATOS
  // ==========================================================

  const [
    rows,
    setRows,
  ] =
    useState<
      ClienteRow[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    autorizado,
    setAutorizado,
  ] =
    useState<
      boolean | null
    >(null);

  // ==========================================================
  // FILTROS
  // ==========================================================

  const [
    busqueda,
    setBusqueda,
  ] =
    useState("");

  const [
    divisionFiltro,
    setDivisionFiltro,
  ] =
    useState("TODAS");

  const [
    estadoFiltro,
    setEstadoFiltro,
  ] =
    useState("TODOS");

  const [
    vendedorFiltro,
    setVendedorFiltro,
  ] =
    useState("TODOS");

  // ==========================================================
  // CARGAR TODAS LAS FILAS PAGINADAS
  // ==========================================================

  const cargarFilas =
    useCallback(
      async () => {
        const resultado:
          ClienteRow[] =
          [];

        const pageSize =
          1000;

        let desde = 0;

        while (true) {
          const {
            data,
            error,
          } =
            await supabase
              .from(
                "gerencia_clientes_kpi_ui"
              )
              .select(`
                codigo_cliente,
                rut,
                rut_key,
                cliente,
                vendedor,
                division,
                activo_sap,

                ultima_compra_codigo,
                dias_sin_compra_codigo,

                venta_codigo_90d,
                venta_codigo_90d_anterior,
                venta_codigo_12m,

                facturas_codigo_12m,
                nc_codigo_12m,

                unidades_comodato_codigo,
                valor_comodato_codigo,

                porcentaje_nc_codigo,
                eficiencia_codigo,
                variacion_codigo_90d,

                ultima_compra_rut,
                dias_sin_compra_rut,

                venta_rut_90d,
                venta_rut_90d_anterior,
                venta_rut_12m,

                facturas_rut_12m,
                nc_rut_12m,

                unidades_comodato_rut,
                valor_comodato_rut,

                porcentaje_nc_rut,
                eficiencia_rut,
                variacion_rut_90d
              `)
              .order(
                "codigo_cliente",
                {
                  ascending:
                    true,
                }
              )
              .range(
                desde,
                desde +
                  pageSize -
                  1
              );

          if (error) {
            throw error;
          }

          const lote =
            data || [];

          lote.forEach(
            (r: any) => {
              resultado.push({
                codigo_cliente:
                  String(
                    r.codigo_cliente ||
                      ""
                  ),

                rut:
                  String(
                    r.rut || ""
                  ),

                rut_key:
                  String(
                    r.rut_key ||
                      ""
                  ),

                cliente:
                  String(
                    r.cliente ||
                      ""
                  ),

                vendedor:
                  String(
                    r.vendedor ||
                      ""
                  ),

                division:
                  String(
                    r.division ||
                      "Sin División"
                  ),

                activo_sap:
                  Boolean(
                    r.activo_sap
                  ),

                ultima_compra_codigo:
                  r.ultima_compra_codigo,

                dias_sin_compra_codigo:
                  r.dias_sin_compra_codigo ===
                  null
                    ? null
                    : num(
                        r.dias_sin_compra_codigo
                      ),

                venta_codigo_90d:
                  num(
                    r.venta_codigo_90d
                  ),

                venta_codigo_90d_anterior:
                  num(
                    r.venta_codigo_90d_anterior
                  ),

                venta_codigo_12m:
                  num(
                    r.venta_codigo_12m
                  ),

                facturas_codigo_12m:
                  num(
                    r.facturas_codigo_12m
                  ),

                nc_codigo_12m:
                  num(
                    r.nc_codigo_12m
                  ),

                unidades_comodato_codigo:
                  num(
                    r.unidades_comodato_codigo
                  ),

                valor_comodato_codigo:
                  num(
                    r.valor_comodato_codigo
                  ),

                porcentaje_nc_codigo:
                  num(
                    r.porcentaje_nc_codigo
                  ),

                eficiencia_codigo:
                  r.eficiencia_codigo ===
                  null
                    ? null
                    : num(
                        r.eficiencia_codigo
                      ),

                variacion_codigo_90d:
                  r.variacion_codigo_90d ===
                  null
                    ? null
                    : num(
                        r.variacion_codigo_90d
                      ),

                ultima_compra_rut:
                  r.ultima_compra_rut,

                dias_sin_compra_rut:
                  r.dias_sin_compra_rut ===
                  null
                    ? null
                    : num(
                        r.dias_sin_compra_rut
                      ),

                venta_rut_90d:
                  num(
                    r.venta_rut_90d
                  ),

                venta_rut_90d_anterior:
                  num(
                    r.venta_rut_90d_anterior
                  ),

                venta_rut_12m:
                  num(
                    r.venta_rut_12m
                  ),

                facturas_rut_12m:
                  num(
                    r.facturas_rut_12m
                  ),

                nc_rut_12m:
                  num(
                    r.nc_rut_12m
                  ),

                unidades_comodato_rut:
                  num(
                    r.unidades_comodato_rut
                  ),

                valor_comodato_rut:
                  num(
                    r.valor_comodato_rut
                  ),

                porcentaje_nc_rut:
                  num(
                    r.porcentaje_nc_rut
                  ),

                eficiencia_rut:
                  r.eficiencia_rut ===
                  null
                    ? null
                    : num(
                        r.eficiencia_rut
                      ),

                variacion_rut_90d:
                  r.variacion_rut_90d ===
                  null
                    ? null
                    : num(
                        r.variacion_rut_90d
                      ),
              });
            }
          );

          if (
            lote.length <
            pageSize
          ) {
            break;
          }

          desde +=
            pageSize;
        }

        return resultado;
      },
      [
        supabase,
      ]
    );

  // ==========================================================
  // CARGA PRINCIPAL
  // ==========================================================

  const cargar =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setError("");

          // ----------------------------------------------------
          // SESIÓN
          // ----------------------------------------------------

          const {
            data: {
              session,
            },
          } =
            await supabase.auth.getSession();

          if (
            !session?.user
          ) {
            setAutorizado(
              false
            );

            setError(
              "No existe una sesión activa."
            );

            return;
          }

          const email =
            normalize(
              session.user
                .email
            );

          // ----------------------------------------------------
          // PERFIL
          // ----------------------------------------------------

          const {
            data:
              perfilData,
            error:
              perfilError,
          } =
            await supabase
              .from(
                "profiles"
              )
              .select(`
                role,
                department,
                email
              `)
              .eq(
                "id",
                session
                  .user.id
              )
              .maybeSingle();

          if (
            perfilError
          ) {
            throw perfilError;
          }

          const perfil =
            (perfilData ||
              {}) as Perfil;

          const role =
            normalize(
              perfil.role
            );

          const department =
            normalize(
              perfil.department
            );

          const esGerencia =
            role ===
              "gerencia" ||
            department.startsWith(
              "gerencia_"
            );

          const accesoEspecial =
            email ===
            "silvana.pincheira@spartan.cl";

          if (
            !esGerencia &&
            !accesoEspecial
          ) {
            setAutorizado(
              false
            );

            return;
          }

          setAutorizado(
            true
          );

          // ----------------------------------------------------
          // DATOS
          // ----------------------------------------------------

          const data =
            await cargarFilas();

          setRows(
            data
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
          setLoading(
            false
          );
        }
      },
      [
        supabase,
        cargarFilas,
      ]
    );

  useEffect(
    () => {
      cargar();
    },
    [
      cargar,
    ]
  );

  // ==========================================================
  // DIVISIONES
  // ==========================================================

  const divisiones =
    useMemo(
      () => {
        return [
          ...new Set(
            rows
              .map(
                (
                  r
                ) =>
                  String(
                    r.division ||
                      "Sin División"
                  ).trim()
              )
              .filter(
                Boolean
              )
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
      },
      [
        rows,
      ]
    );

  // ==========================================================
  // EJECUTIVOS DEPENDIENTES DE DIVISIÓN
  // ==========================================================

  const vendedores =
    useMemo(
      () => {
        return [
          ...new Set(
            rows
              .filter(
                (
                  r
                ) =>
                  divisionFiltro ===
                    "TODAS" ||
                  r.division ===
                    divisionFiltro
              )
              .map(
                (
                  r
                ) =>
                  String(
                    r.vendedor ||
                      ""
                  ).trim()
              )
              .filter(
                Boolean
              )
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
      },
      [
        rows,
        divisionFiltro,
      ]
    );

  // ==========================================================
  // RESETEAR EJECUTIVO SI CAMBIA DIVISIÓN
  // ==========================================================

  useEffect(
    () => {
      if (
        vendedorFiltro !==
          "TODOS" &&
        !vendedores.includes(
          vendedorFiltro
        )
      ) {
        setVendedorFiltro(
          "TODOS"
        );
      }
    },
    [
      vendedores,
      vendedorFiltro,
    ]
  );

  // ==========================================================
  // ALCANCE BASE
  //
  // DIVISIÓN + EJECUTIVO + BÚSQUEDA
  // ==========================================================

  const alcanceBase =
    useMemo(
      () => {
        const q =
          normalize(
            busqueda
          );

        return rows.filter(
          (
            r
          ) => {
            // División
            if (
              divisionFiltro !==
                "TODAS" &&
              r.division !==
                divisionFiltro
            ) {
              return false;
            }

            // Ejecutivo
            if (
              vendedorFiltro !==
                "TODOS" &&
              r.vendedor !==
                vendedorFiltro
            ) {
              return false;
            }

            // Búsqueda
            if (!q) {
              return true;
            }

            const texto =
              [
                r.cliente,
                r.rut,
                r.rut_key,
                r.codigo_cliente,
                r.vendedor,
                r.division,
                estadoDe(
                  r
                ),
              ]
                .join(
                  " "
                )
                .toLowerCase();

            return texto.includes(
              q
            );
          }
        );
      },
      [
        rows,
        busqueda,
        divisionFiltro,
        vendedorFiltro,
      ]
    );

  // ==========================================================
  // CUENTAS CON COMODATO
  // ==========================================================

  const comodatosBase =
    useMemo(
      () =>
        alcanceBase.filter(
          (
            r
          ) =>
            r.valor_comodato_codigo >
            0
        ),
      [
        alcanceBase,
      ]
    );

  // ==========================================================
  // TABLA FINAL
  //
  // APLICA TAMBIÉN ESTADO
  // ==========================================================

  const filtrados =
    useMemo(
      () => {
        return comodatosBase
          .filter(
            (
              r
            ) => {
              if (
                estadoFiltro ===
                "TODOS"
              ) {
                return true;
              }

              return (
                estadoDe(
                  r
                ) ===
                estadoFiltro
              );
            }
          )
          .sort(
            (
              a,
              b
            ) => {
              const ea =
                estadoOrden(
                  estadoDe(
                    a
                  )
                );

              const eb =
                estadoOrden(
                  estadoDe(
                    b
                  )
                );

              if (
                ea !==
                eb
              ) {
                return (
                  ea -
                  eb
                );
              }

              return (
                b.valor_comodato_codigo -
                a.valor_comodato_codigo
              );
            }
          );
      },
      [
        comodatosBase,
        estadoFiltro,
      ]
    );

  // ==========================================================
  // DATASET PARA KPI SUPERIORES
  //
  // Si estado = TODOS:
  //   calcula sobre todo el alcance comercial.
  //
  // Si se selecciona un estado:
  //   calcula sobre las cuentas de ese estado.
  // ==========================================================

  const datasetKpi =
    useMemo(
      () => {
        if (
          estadoFiltro ===
          "TODOS"
        ) {
          return alcanceBase;
        }

        return filtrados;
      },
      [
        alcanceBase,
        filtrados,
        estadoFiltro,
      ]
    );

  // ==========================================================
  // KPI SUPERIORES DINÁMICOS
  // ==========================================================

  const kpi =
    useMemo(
      () => {
        // ------------------------------------------------------
        // EMPRESAS ACTIVAS
        //
        // RUT con compra en últimos 60 días.
        // Usa última compra RUT para reconocer compra centralizada.
        // ------------------------------------------------------

        const empresasActivas =
          new Set<string>();

        datasetKpi.forEach(
          (
            r
          ) => {
            if (
              r.rut_key &&
              r.dias_sin_compra_rut !==
                null &&
              r.dias_sin_compra_rut <=
                60
            ) {
              empresasActivas.add(
                r.rut_key
              );
            }
          }
        );

        // ------------------------------------------------------
        // EMPRESAS CON COMODATO SIN COMPRA
        // ------------------------------------------------------

        const empresasSinCompra =
          new Set<string>();

        datasetKpi.forEach(
          (
            r
          ) => {
            if (
              r.valor_comodato_codigo <=
              0
            ) {
              return;
            }

            if (
              !r.rut_key
            ) {
              return;
            }

            if (
              r.dias_sin_compra_rut ===
                null ||
              r.dias_sin_compra_rut >
                60
            ) {
              empresasSinCompra.add(
                r.rut_key
              );
            }
          }
        );

        // ------------------------------------------------------
        // COMODATO
        // ------------------------------------------------------

        const unidades =
          datasetKpi.reduce(
            (
              acc,
              r
            ) =>
              acc +
              (
                r.valor_comodato_codigo >
                0
                  ? r.unidades_comodato_codigo
                  : 0
              ),
            0
          );

        const valorComodato =
          datasetKpi.reduce(
            (
              acc,
              r
            ) =>
              acc +
              (
                r.valor_comodato_codigo >
                0
                  ? r.valor_comodato_codigo
                  : 0
              ),
            0
          );

        // ------------------------------------------------------
        // VENTAS
        //
        // Se suman por código cliente para no duplicar un RUT
        // con varias sucursales.
        // ------------------------------------------------------

        const venta =
          datasetKpi.reduce(
            (
              acc,
              r
            ) =>
              acc +
              r.venta_codigo_12m,
            0
          );

        const facturas =
          datasetKpi.reduce(
            (
              acc,
              r
            ) =>
              acc +
              r.facturas_codigo_12m,
            0
          );

        const nc =
          datasetKpi.reduce(
            (
              acc,
              r
            ) =>
              acc +
              r.nc_codigo_12m,
            0
          );

        const porcentajeNc =
          facturas >
          0
            ? (
                Math.abs(
                  nc
                ) /
                facturas
              ) *
              100
            : 0;

        const eficiencia =
          valorComodato >
          0
            ? venta /
              valorComodato
            : null;

        return {
          empresasActivas:
            empresasActivas.size,

          empresasSinCompra:
            empresasSinCompra.size,

          unidades,

          valorComodato,

          venta,

          facturas,

          nc,

          porcentajeNc,

          eficiencia,
        };
      },
      [
        datasetKpi,
      ]
    );

  // ==========================================================
  // RESUMEN DE ESTADOS
  //
  // RESPONDE A TODOS LOS FILTROS.
  // ==========================================================

  const resumenEstados =
    useMemo(
      () => {
        const resultado =
          {
            activo: 0,
            centralizada:
              0,
            sinCompra: 0,

            valorActivo:
              0,
            valorCentralizada:
              0,
            valorSinCompra:
              0,
          };

        const origen =
          estadoFiltro ===
          "TODOS"
            ? comodatosBase
            : filtrados;

        origen.forEach(
          (
            r
          ) => {
            const estado =
              estadoDe(
                r
              );

            if (
              estado ===
              "ACTIVO"
            ) {
              resultado.activo +=
                1;

              resultado.valorActivo +=
                r.valor_comodato_codigo;
            }

            if (
              estado ===
              "COMPRA CENTRALIZADA"
            ) {
              resultado.centralizada +=
                1;

              resultado.valorCentralizada +=
                r.valor_comodato_codigo;
            }

            if (
              estado ===
              "SIN COMPRA EMPRESA"
            ) {
              resultado.sinCompra +=
                1;

              resultado.valorSinCompra +=
                r.valor_comodato_codigo;
            }
          }
        );

        return resultado;
      },
      [
        comodatosBase,
        filtrados,
        estadoFiltro,
      ]
    );

  // ==========================================================
  // TOTAL EXACTO DE LO FILTRADO
  // ==========================================================

  const totalFiltrado =
    useMemo(
      () => {
        const empresas =
          new Map<
            string,
            ClienteRow
          >();

        filtrados.forEach(
          (
            r
          ) => {
            if (
              r.rut_key &&
              !empresas.has(
                r.rut_key
              )
            ) {
              empresas.set(
                r.rut_key,
                r
              );
            }
          }
        );

        const ventaEmpresas =
          Array.from(
            empresas.values()
          ).reduce(
            (
              acc,
              r
            ) =>
              acc +
              r.venta_rut_12m,
            0
          );

        return {
          cuentas:
            filtrados.length,

          empresas:
            empresas.size,

          unidades:
            filtrados.reduce(
              (
                acc,
                r
              ) =>
                acc +
                r.unidades_comodato_codigo,
              0
            ),

          comodato:
            filtrados.reduce(
              (
                acc,
                r
              ) =>
                acc +
                r.valor_comodato_codigo,
              0
            ),

          ventaCuentas:
            filtrados.reduce(
              (
                acc,
                r
              ) =>
                acc +
                r.venta_codigo_12m,
              0
            ),

          ventaEmpresas,
        };
      },
      [
        filtrados,
      ]
    );

  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading &&
    autorizado ===
      null
  ) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-zinc-600">
            Cargando indicadores
            de Gerencia...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // SIN ACCESO
  // ==========================================================

  if (
    autorizado ===
    false
  ) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">
            Reportería de
            Gerencia
          </h1>

          <p className="mt-3 text-sm text-zinc-600">
            Tu usuario no tiene
            acceso a este módulo.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-[1800px] px-4 py-6 md:px-6 lg:px-8">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Gerencia
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              Gestión de Clientes
              y Comodatos
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Análisis consolidado
              por cuenta SAP, RUT
              empresa y división.
            </p>
          </div>

          <button
            type="button"
            onClick={
              cargar
            }
            disabled={
              loading
            }
            className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Actualizando..."
              : "Actualizar"}
          </button>
        </div>

        {/* ================================================== */}
        {/* ERROR */}
        {/* ================================================== */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ================================================== */}
        {/* FILTRO ACTUAL */}
        {/* ================================================== */}

        {(
          divisionFiltro !==
            "TODAS" ||
          vendedorFiltro !==
            "TODOS" ||
          estadoFiltro !==
            "TODOS" ||
          busqueda.trim()
        ) && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-zinc-500">
              Vista filtrada:
            </span>

            {divisionFiltro !==
              "TODAS" && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700">
                {
                  divisionFiltro
                }
              </span>
            )}

            {vendedorFiltro !==
              "TODOS" && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700">
                {
                  vendedorFiltro
                }
              </span>
            )}

            {estadoFiltro !==
              "TODOS" && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700">
                {
                  estadoFiltro
                }
              </span>
            )}
          </div>
        )}

        {/* ================================================== */}
        {/* KPI */}
        {/* ================================================== */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            label="Empresas activas"
            value={number(
              kpi.empresasActivas
            )}
            detail="RUT con compra en últimos 60 días"
          />

          <KpiCard
            label="Comodato sin compra"
            value={number(
              kpi.empresasSinCompra
            )}
            detail="Empresas +60 días sin compra"
            danger
          />

          <KpiCard
            label="Comodato instalado"
            value={money(
              kpi.valorComodato
            )}
            detail="Valor según filtros aplicados"
          />

          <KpiCard
            label="Unidades instaladas"
            value={number(
              kpi.unidades
            )}
            detail="Equipos según filtros aplicados"
          />

          <KpiCard
            label="% Notas de crédito"
            value={pct(
              kpi.porcentajeNc
            )}
            detail="NC / facturación últimos 12 meses"
          />

          <KpiCard
            label="Eficiencia comodato"
            value={efficiency(
              kpi.eficiencia
            )}
            detail="Venta neta 12m / comodato instalado"
          />
        </section>

        {/* ================================================== */}
        {/* ESTADOS */}
        {/* ================================================== */}

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

        {/* ================================================== */}
        {/* FILTROS */}
        {/* ================================================== */}

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_230px_230px_270px_auto]">

            {/* BUSCAR */}

            <div>
              <FilterLabel>
                Buscar
              </FilterLabel>

              <input
                value={
                  busqueda
                }
                onChange={(
                  e
                ) =>
                  setBusqueda(
                    e.target.value
                  )
                }
                placeholder="Cliente, RUT, código o ejecutivo..."
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* DIVISIÓN */}

            <div>
              <FilterLabel>
                División
              </FilterLabel>

              <select
                value={
                  divisionFiltro
                }
                onChange={(
                  e
                ) =>
                  setDivisionFiltro(
                    e.target.value
                  )
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
              >
                <option value="TODAS">
                  Todas
                </option>

                {divisiones.map(
                  (
                    division
                  ) => (
                    <option
                      key={
                        division
                      }
                      value={
                        division
                      }
                    >
                      {
                        division
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            {/* ESTADO */}

            <div>
              <FilterLabel>
                Estado
              </FilterLabel>

              <select
                value={
                  estadoFiltro
                }
                onChange={(
                  e
                ) =>
                  setEstadoFiltro(
                    e.target.value
                  )
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
              >
                <option value="TODOS">
                  Todos
                </option>

                <option value="ACTIVO">
                  Activo
                </option>

                <option value="COMPRA CENTRALIZADA">
                  Compra centralizada
                </option>

                <option value="SIN COMPRA EMPRESA">
                  Sin compra empresa
                </option>
              </select>
            </div>

            {/* EJECUTIVO */}

            <div>
              <FilterLabel>
                Ejecutivo
              </FilterLabel>

              <select
                value={
                  vendedorFiltro
                }
                onChange={(
                  e
                ) =>
                  setVendedorFiltro(
                    e.target.value
                  )
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
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

            {/* LIMPIAR */}

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setBusqueda(
                    ""
                  );

                  setDivisionFiltro(
                    "TODAS"
                  );

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

          {/* ================================================ */}
          {/* TOTAL FILTRADO */}
          {/* ================================================ */}

          <div className="mt-4 border-t border-zinc-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Total filtrado
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              <MiniTotal
                label="Cuentas"
                value={number(
                  totalFiltrado.cuentas
                )}
              />

              <MiniTotal
                label="Empresas / RUT"
                value={number(
                  totalFiltrado.empresas
                )}
              />

              <MiniTotal
                label="Unidades"
                value={number(
                  totalFiltrado.unidades
                )}
              />

              <MiniTotal
                label="Comodato"
                value={money(
                  totalFiltrado.comodato
                )}
              />

              <MiniTotal
                label="Venta cuentas 12m"
                value={money(
                  totalFiltrado.ventaCuentas
                )}
              />

              <MiniTotal
                label="Venta empresas 12m"
                value={money(
                  totalFiltrado.ventaEmpresas
                )}
              />
            </div>
          </div>
        </section>

        {/* ================================================== */}
        {/* TABLA */}
        {/* ================================================== */}

        <section className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-zinc-900">
                  Análisis por
                  cuenta cliente
                </h2>

                <p className="mt-1 text-xs text-zinc-500">
                  La venta y el
                  comodato se
                  comparan a nivel
                  cuenta y empresa.
                </p>
              </div>

              <div className="text-sm text-zinc-500">
                Mostrando{" "}
                <strong className="font-semibold text-zinc-900">
                  {number(
                    filtrados.length
                  )}
                </strong>{" "}
                cuentas
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[2050px] w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">
                    Estado
                  </th>

                  <th className="px-4 py-3">
                    División
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
                    Venta cuenta 12m
                  </th>

                  <th className="px-4 py-3 text-right">
                    Venta empresa 12m
                  </th>

                  <th className="px-4 py-3 text-right">
                    Comodato cuenta
                  </th>

                  <th className="px-4 py-3 text-right">
                    Comodato empresa
                  </th>

                  <th className="px-4 py-3 text-center">
                    Última compra cuenta
                  </th>

                  <th className="px-4 py-3 text-center">
                    Última compra empresa
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
                  (
                    row
                  ) => {
                    const estado =
                      estadoDe(
                        row
                      );

                    return (
                      <tr
                        key={
                          row.codigo_cliente
                        }
                        className="transition hover:bg-zinc-50/80"
                      >
                        {/* ESTADO */}

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(
                              estado
                            )}`}
                          >
                            {
                              estado
                            }
                          </span>
                        </td>

                        {/* DIVISIÓN */}

                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {
                            row.division
                          }
                        </td>

                        {/* CLIENTE */}

                        <td className="max-w-[280px] px-4 py-3">
                          <div className="font-medium text-zinc-900">
                            {row.cliente ||
                              "—"}
                          </div>
                        </td>

                        {/* RUT */}

                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {row.rut ||
                            "—"}
                        </td>

                        {/* CÓDIGO */}

                        <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-700">
                          {
                            row.codigo_cliente
                          }
                        </td>

                        {/* EJECUTIVO */}

                        <td className="max-w-[220px] px-4 py-3 text-zinc-600">
                          {row.vendedor ||
                            "—"}
                        </td>

                        {/* VENTA CUENTA */}

                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                          {money(
                            row.venta_codigo_12m
                          )}
                        </td>

                        {/* VENTA EMPRESA */}

                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-zinc-900">
                          {money(
                            row.venta_rut_12m
                          )}
                        </td>

                        {/* COMODATO CUENTA */}

                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                          {money(
                            row.valor_comodato_codigo
                          )}
                        </td>

                        {/* COMODATO EMPRESA */}

                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-zinc-900">
                          {money(
                            row.valor_comodato_rut
                          )}
                        </td>

                        {/* ÚLTIMA COMPRA CUENTA */}

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

                        {/* ÚLTIMA COMPRA EMPRESA */}

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

                        {/* EFICIENCIA CUENTA */}

                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                          {efficiency(
                            row.eficiencia_codigo
                          )}
                        </td>

                        {/* EFICIENCIA EMPRESA */}

                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-zinc-900">
                          {efficiency(
                            row.eficiencia_rut
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}

                {filtrados.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        14
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

        {/* ================================================== */}
        {/* NOTA */}
        {/* ================================================== */}

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
          códigos asociados al mismo
          RUT. La división corresponde
          al ejecutivo actualmente
          asignado al cliente en SAP.
        </div>
      </main>
    </div>
  );
}

// ============================================================
// COMPONENTES
// ============================================================

function FilterLabel({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
      {children}
    </label>
  );
}

// ============================================================
// KPI CARD
// ============================================================

function KpiCard({
  label,
  value,
  detail,
  danger = false,
}: {
  label: string;
  value: string;
  detail: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        danger
          ? "border-red-200"
          : "border-zinc-200"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          danger
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
  const bg =
    tone ===
    "green"
      ? "border-emerald-200 bg-emerald-50/60"
      : tone ===
        "amber"
      ? "border-amber-200 bg-amber-50/60"
      : "border-red-200 bg-red-50/60";

  const titulo =
    tone ===
    "green"
      ? "text-emerald-800"
      : tone ===
        "amber"
      ? "text-amber-800"
      : "text-red-800";

  return (
    <div
      className={`rounded-2xl border p-5 ${bg}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className={`text-sm font-semibold ${titulo}`}
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

// ============================================================
// MINI TOTAL
// ============================================================

function MiniTotal({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p className="mt-1 text-base font-semibold text-zinc-900">
        {value}
      </p>
    </div>
  );
}