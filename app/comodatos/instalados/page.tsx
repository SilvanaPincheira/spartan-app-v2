"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import { createClientComponentClient } from
  "@supabase/auth-helpers-nextjs";

/* ============================================================
   TIPOS
============================================================ */

type SaldoComodato = {
  codigo_cliente: string | null;
  codigo_producto: string | null;

  nombre_cliente: string | null;
  rut_cliente: string | null;
  empleado_ventas: string | null;

  producto: string | null;

  cantidad_instalada: number | string | null;
  valor_instalado: number | string | null;

  primer_movimiento: string | null;
  ultimo_movimiento: string | null;

  movimientos: number | string | null;
};

type MovimientoComodato = {
  id: number;

  fecha_contab: string | null;

  tipo_movimiento: string | null;
  tipo_gdd: string | null;

  docnum: number | null;
  prefijo: string | null;
  numero_folio: string | null;

  codigo_cliente: string | null;
  rut_cliente: string | null;
  nombre_cliente: string | null;

  empleado_ventas: string | null;

  codigo_producto: string | null;
  producto: string | null;

  cantidad: number | string | null;
  precio_unitario: number | string | null;
  total: number | string | null;

  comentario: string | null;

  sap_origen: string | null;
};

/* ============================================================
   HELPERS
============================================================ */

function numero(valor: unknown) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : 0;
}

function normalizar(valor: unknown) {
  return String(valor ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function moneda(valor: unknown) {
  return numero(valor).toLocaleString(
    "es-CL",
    {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }
  );
}

function cantidad(valor: unknown) {
  return numero(valor).toLocaleString(
    "es-CL",
    {
      maximumFractionDigits: 2,
    }
  );
}

function fecha(valor: string | null) {
  if (!valor) return "-";

  const d = new Date(valor);

  if (Number.isNaN(d.getTime())) {
    return valor;
  }

  return d.toLocaleDateString(
    "es-CL"
  );
}

function guiaMovimiento(
  row: MovimientoComodato
) {
  const prefijo =
    String(
      row.prefijo || ""
    ).trim();

  const folio =
    String(
      row.numero_folio || ""
    ).trim();

  if (prefijo && folio) {
    return `${prefijo}-${folio}`;
  }

  if (folio) {
    return folio;
  }

  return row.docnum
    ? String(row.docnum)
    : "-";
}

/* ============================================================
   COMPONENTE
============================================================ */

export default function ComodatosInstaladosPage() {
  const supabase =
    useMemo(
      () =>
        createClientComponentClient(),
      []
    );

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    emailUsuario,
    setEmailUsuario,
  ] = useState("");

  const [
    saldo,
    setSaldo,
  ] =
    useState<SaldoComodato[]>([]);

  const [
    movimientos,
    setMovimientos,
  ] =
    useState<MovimientoComodato[]>([]);

  const [
    pestana,
    setPestana,
  ] =
    useState<
      "instalados" | "historico"
    >("instalados");

  // ==========================================================
  // FILTROS
  // ==========================================================

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    tipoMovimiento,
    setTipoMovimiento,
  ] = useState("");

  const [
    fechaDesde,
    setFechaDesde,
  ] = useState("");

  const [
    fechaHasta,
    setFechaHasta,
  ] = useState("");

  /* ==========================================================
     CARGA PAGINADA
     Evita el límite habitual de 1000 filas de Supabase.
  ========================================================== */

  const cargarSaldo =
    useCallback(async () => {
      const todos:
        SaldoComodato[] = [];

      const limite = 1000;

      let desde = 0;

      while (true) {
        const hasta =
          desde +
          limite -
          1;

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "comodatos_saldo_actual"
            )
            .select(`
              codigo_cliente,
              codigo_producto,
              nombre_cliente,
              rut_cliente,
              empleado_ventas,
              producto,
              cantidad_instalada,
              valor_instalado,
              primer_movimiento,
              ultimo_movimiento,
              movimientos
            `)
            .order(
              "ultimo_movimiento",
              {
                ascending: false,
              }
            )
            .range(
              desde,
              hasta
            );

        if (error) {
          throw error;
        }

        const bloque =
          (data ||
            []) as SaldoComodato[];

        todos.push(
          ...bloque
        );

        if (
          bloque.length <
          limite
        ) {
          break;
        }

        desde += limite;
      }

      return todos;
    }, [supabase]);

  const cargarHistorico =
    useCallback(async () => {
      const todos:
        MovimientoComodato[] = [];

      const limite = 1000;

      let desde = 0;

      while (true) {
        const hasta =
          desde +
          limite -
          1;

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "comodatos_instalados"
            )
            .select(`
              id,
              fecha_contab,
              tipo_movimiento,
              tipo_gdd,
              docnum,
              prefijo,
              numero_folio,
              codigo_cliente,
              rut_cliente,
              nombre_cliente,
              empleado_ventas,
              codigo_producto,
              producto,
              cantidad,
              precio_unitario,
              total,
              comentario,
              sap_origen
            `)
            .order(
              "fecha_contab",
              {
                ascending: false,
              }
            )
            .order(
              "id",
              {
                ascending: false,
              }
            )
            .range(
              desde,
              hasta
            );

        if (error) {
          throw error;
        }

        const bloque =
          (data ||
            []) as MovimientoComodato[];

        todos.push(
          ...bloque
        );

        if (
          bloque.length <
          limite
        ) {
          break;
        }

        desde += limite;
      }

      return todos;
    }, [supabase]);

  /* ==========================================================
     CARGAR INFORMACIÓN
  ========================================================== */

  const cargarDatos =
    useCallback(async () => {
      try {
        setCargando(true);

        setError("");

        const {
          data: {
            session,
          },
        } =
          await supabase
            .auth
            .getSession();

        const email =
          session
            ?.user
            ?.email
            ?.trim()
            .toLowerCase() ||
          "";

        if (!email) {
          throw new Error(
            "No se encontró una sesión activa."
          );
        }

        setEmailUsuario(
          email
        );

        /*
         * NO filtramos manualmente
         * por ejecutivo aquí.
         *
         * Supabase RLS usa el login
         * y solo devuelve las filas
         * autorizadas para este usuario.
         */

        const [
          saldoData,
          movimientosData,
        ] =
          await Promise.all([
            cargarSaldo(),
            cargarHistorico(),
          ]);

        setSaldo(
          saldoData
        );

        setMovimientos(
          movimientosData
        );
      } catch (
        err: any
      ) {
        console.error(
          "Error cargando comodatos:",
          err
        );

        setError(
          err?.message ||
            "No fue posible cargar los comodatos."
        );
      } finally {
        setCargando(false);
      }
    }, [
      supabase,
      cargarSaldo,
      cargarHistorico,
    ]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  /* ==========================================================
     FILTRO SALDO ACTUAL
  ========================================================== */

  const saldoFiltrado =
    useMemo(() => {
      const buscar =
        normalizar(
          busqueda
        );

      if (!buscar) {
        return saldo;
      }

      return saldo.filter(
        (row) => {
          const texto =
            [
              row.codigo_cliente,
              row.rut_cliente,
              row.nombre_cliente,
              row.empleado_ventas,
              row.codigo_producto,
              row.producto,
            ]
              .map(
                normalizar
              )
              .join(" ");

          return texto.includes(
            buscar
          );
        }
      );
    }, [
      saldo,
      busqueda,
    ]);

  /* ==========================================================
     FILTRO HISTÓRICO
  ========================================================== */

  const historicoFiltrado =
    useMemo(() => {
      const buscar =
        normalizar(
          busqueda
        );

      return movimientos.filter(
        (row) => {
          if (
            tipoMovimiento &&
            row.tipo_movimiento !==
              tipoMovimiento
          ) {
            return false;
          }

          if (
            fechaDesde &&
            row.fecha_contab
          ) {
            const fechaFila =
              row.fecha_contab.slice(
                0,
                10
              );

            if (
              fechaFila <
              fechaDesde
            ) {
              return false;
            }
          }

          if (
            fechaHasta &&
            row.fecha_contab
          ) {
            const fechaFila =
              row.fecha_contab.slice(
                0,
                10
              );

            if (
              fechaFila >
              fechaHasta
            ) {
              return false;
            }
          }

          if (!buscar) {
            return true;
          }

          const guia =
            guiaMovimiento(
              row
            );

          const texto =
            [
              guia,
              row.docnum,
              row.codigo_cliente,
              row.rut_cliente,
              row.nombre_cliente,
              row.empleado_ventas,
              row.codigo_producto,
              row.producto,
              row.comentario,
            ]
              .map(
                normalizar
              )
              .join(" ");

          return texto.includes(
            buscar
          );
        }
      );
    }, [
      movimientos,
      busqueda,
      tipoMovimiento,
      fechaDesde,
      fechaHasta,
    ]);

  /* ==========================================================
     INDICADORES
     Se calculan sobre los datos que RLS permitió visualizar.
  ========================================================== */

  const indicadores =
    useMemo(() => {
      const clientes =
        new Set(
          saldo
            .map(
              (row) =>
                row.codigo_cliente
            )
            .filter(Boolean)
        ).size;

      const unidades =
        saldo.reduce(
          (acc, row) =>
            acc +
            numero(
              row.cantidad_instalada
            ),
          0
        );

      const valor =
        saldo.reduce(
          (acc, row) =>
            acc +
            numero(
              row.valor_instalado
            ),
          0
        );

      return {
        clientes,
        unidades,
        valor,
        movimientos:
          movimientos.length,
      };
    }, [
      saldo,
      movimientos,
    ]);

  /* ==========================================================
     LIMPIAR FILTROS
  ========================================================== */

  function limpiarFiltros() {
    setBusqueda("");

    setTipoMovimiento("");

    setFechaDesde("");

    setFechaHasta("");
  }

  /* ==========================================================
     LOADING
  ========================================================== */

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />

          <p className="font-medium text-slate-700">
            Cargando comodatos...
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Consultando información autorizada para tu usuario.
          </p>
        </div>
      </div>
    );
  }

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="space-y-6 pb-10">

      {/* ======================================================
          CABECERA
      ====================================================== */}

      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-lg md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <div className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">
              Gestión de Comodatos
            </div>

            <h1 className="text-3xl font-bold">
              Comodatos Instalados
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-blue-100">
              Histórico de movimientos y equipos actualmente instalados en clientes.
            </p>

            <p className="mt-3 text-xs text-blue-200">
              Usuario:{" "}
              {emailUsuario}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/comodatos"
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
            >
              ← Gestión de Comodatos
            </Link>

            <button
              type="button"
              onClick={
                cargarDatos
              }
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
            >
              Actualizar
            </button>
          </div>
        </div>
      </section>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          <p className="font-semibold">
            No fue posible cargar los comodatos.
          </p>

          <p className="mt-1 text-sm">
            {error}
          </p>
        </div>
      )}

      {!error && (
        <>

          {/* ==================================================
              KPI
          ================================================== */}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <TarjetaKpi
              titulo="Clientes con comodato"
              valor={indicadores.clientes.toLocaleString(
                "es-CL"
              )}
              detalle="Clientes con saldo instalado"
            />

            <TarjetaKpi
              titulo="Unidades instaladas"
              valor={cantidad(
                indicadores.unidades
              )}
              detalle="Saldo actual de equipos"
            />

            <TarjetaKpi
              titulo="Valor instalado"
              valor={moneda(
                indicadores.valor
              )}
              detalle="Valor actual de comodatos"
            />

            <TarjetaKpi
              titulo="Movimientos históricos"
              valor={indicadores.movimientos.toLocaleString(
                "es-CL"
              )}
              detalle="Salidas + entradas"
            />

          </section>

          {/* ==================================================
              FILTROS
          ================================================== */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              <div>
                <h2 className="font-bold text-slate-900">
                  Buscar y filtrar
                </h2>

                <p className="text-sm text-slate-500">
                  Puedes buscar por guía, cliente, código cliente, equipo o código de equipo.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  limpiarFiltros
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Limpiar filtros
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">

              <div className="xl:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Buscar
                </label>

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
                  placeholder="Guía, cliente, código cliente, equipo..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {pestana ===
                "historico" && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      Movimiento
                    </label>

                    <select
                      value={
                        tipoMovimiento
                      }
                      onChange={(
                        e
                      ) =>
                        setTipoMovimiento(
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    >
                      <option value="">
                        Todos
                      </option>

                      <option value="SALIDA_COMODATO">
                        Salida comodato
                      </option>

                      <option value="ENTRADA_COMODATO">
                        Entrada comodato
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      Desde
                    </label>

                    <input
                      type="date"
                      value={
                        fechaDesde
                      }
                      onChange={(
                        e
                      ) =>
                        setFechaDesde(
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      Hasta
                    </label>

                    <input
                      type="date"
                      value={
                        fechaHasta
                      }
                      onChange={(
                        e
                      ) =>
                        setFechaHasta(
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ==================================================
              PESTAÑAS
          ================================================== */}

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">

              <button
                type="button"
                onClick={() =>
                  setPestana(
                    "instalados"
                  )
                }
                className={
                  pestana ===
                  "instalados"
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                }
              >
                Instalados actualmente
              </button>

              <button
                type="button"
                onClick={() =>
                  setPestana(
                    "historico"
                  )
                }
                className={
                  pestana ===
                  "historico"
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                }
              >
                Histórico
              </button>
            </div>

            {/* ==================================================
                INSTALADOS
            ================================================== */}

            {pestana ===
              "instalados" && (
              <div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      Saldo instalado actual
                    </h2>

                    <p className="text-sm text-slate-500">
                      {
                        saldoFiltrado.length
                      }{" "}
                      registros
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[1200px] w-full text-sm">

                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-3 py-3 text-left">
                          Cliente
                        </th>

                        <th className="px-3 py-3 text-left">
                          Código cliente
                        </th>

                        <th className="px-3 py-3 text-left">
                          RUT
                        </th>

                        <th className="px-3 py-3 text-left">
                          Código equipo
                        </th>

                        <th className="px-3 py-3 text-left">
                          Equipo
                        </th>

                        <th className="px-3 py-3 text-right">
                          Cantidad
                        </th>

                        <th className="px-3 py-3 text-right">
                          Valor instalado
                        </th>

                        <th className="px-3 py-3 text-left">
                          Último movimiento
                        </th>

                        <th className="px-3 py-3 text-left">
                          Ejecutivo
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {saldoFiltrado.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={
                              9
                            }
                            className="px-4 py-10 text-center text-slate-500"
                          >
                            No se encontraron comodatos instalados.
                          </td>
                        </tr>
                      )}

                      {saldoFiltrado.map(
                        (
                          row,
                          index
                        ) => (
                          <tr
                            key={`${row.codigo_cliente}-${row.codigo_producto}-${index}`}
                            className="border-b border-slate-100 hover:bg-blue-50/40"
                          >
                            <td className="px-3 py-3 font-medium text-slate-800">
                              {
                                row.nombre_cliente ||
                                "-"
                              }
                            </td>

                            <td className="px-3 py-3 font-mono text-xs">
                              {
                                row.codigo_cliente ||
                                "-"
                              }
                            </td>

                            <td className="px-3 py-3">
                              {
                                row.rut_cliente ||
                                "-"
                              }
                            </td>

                            <td className="px-3 py-3 font-mono text-xs">
                              {
                                row.codigo_producto ||
                                "-"
                              }
                            </td>

                            <td className="px-3 py-3">
                              {
                                row.producto ||
                                "-"
                              }
                            </td>

                            <td className="px-3 py-3 text-right font-bold text-blue-700">
                              {cantidad(
                                row.cantidad_instalada
                              )}
                            </td>

                            <td className="px-3 py-3 text-right font-semibold">
                              {moneda(
                                row.valor_instalado
                              )}
                            </td>

                            <td className="px-3 py-3">
                              {fecha(
                                row.ultimo_movimiento
                              )}
                            </td>

                            <td className="px-3 py-3">
                              {
                                row.empleado_ventas ||
                                "-"
                              }
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ==================================================
                HISTÓRICO
            ================================================== */}

            {pestana ===
              "historico" && (
              <div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      Histórico de movimientos
                    </h2>

                    <p className="text-sm text-slate-500">
                      {
                        historicoFiltrado.length
                      }{" "}
                      movimientos
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">

                  <table className="min-w-[1500px] w-full text-sm">

                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-3 py-3 text-left">
                          Fecha
                        </th>

                        <th className="px-3 py-3 text-left">
                          Movimiento
                        </th>

                        <th className="px-3 py-3 text-left">
                          Guía / Doc.
                        </th>

                        <th className="px-3 py-3 text-left">
                          Cliente
                        </th>

                        <th className="px-3 py-3 text-left">
                          Código cliente
                        </th>

                        <th className="px-3 py-3 text-left">
                          Código equipo
                        </th>

                        <th className="px-3 py-3 text-left">
                          Equipo
                        </th>

                        <th className="px-3 py-3 text-right">
                          Cantidad
                        </th>

                        <th className="px-3 py-3 text-right">
                          Precio
                        </th>

                        <th className="px-3 py-3 text-right">
                          Total
                        </th>

                        <th className="px-3 py-3 text-left">
                          Ejecutivo
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {historicoFiltrado.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={
                              11
                            }
                            className="px-4 py-10 text-center text-slate-500"
                          >
                            No se encontraron movimientos.
                          </td>
                        </tr>
                      )}

                      {historicoFiltrado.map(
                        (
                          row
                        ) => {
                          const esEntrada =
                            row.tipo_movimiento ===
                            "ENTRADA_COMODATO";

                          return (
                            <tr
                              key={
                                row.id
                              }
                              className="border-b border-slate-100 hover:bg-slate-50"
                            >
                              <td className="px-3 py-3">
                                {fecha(
                                  row.fecha_contab
                                )}
                              </td>

                              <td className="px-3 py-3">
                                <span
                                  className={
                                    esEntrada
                                      ? "inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700"
                                      : "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                  }
                                >
                                  {esEntrada
                                    ? "Entrada"
                                    : "Salida"}
                                </span>
                              </td>

                              <td className="px-3 py-3 font-medium">
                                {guiaMovimiento(
                                  row
                                )}
                              </td>

                              <td className="px-3 py-3">
                                {
                                  row.nombre_cliente ||
                                  "-"
                                }
                              </td>

                              <td className="px-3 py-3 font-mono text-xs">
                                {
                                  row.codigo_cliente ||
                                  "-"
                                }
                              </td>

                              <td className="px-3 py-3 font-mono text-xs">
                                {
                                  row.codigo_producto ||
                                  "-"
                                }
                              </td>

                              <td className="px-3 py-3">
                                {
                                  row.producto ||
                                  "-"
                                }
                              </td>

                              <td
                                className={
                                  esEntrada
                                    ? "px-3 py-3 text-right font-semibold text-red-600"
                                    : "px-3 py-3 text-right font-semibold text-emerald-700"
                                }
                              >
                                {cantidad(
                                  row.cantidad
                                )}
                              </td>

                              <td className="px-3 py-3 text-right">
                                {moneda(
                                  row.precio_unitario
                                )}
                              </td>

                              <td
                                className={
                                  esEntrada
                                    ? "px-3 py-3 text-right font-semibold text-red-600"
                                    : "px-3 py-3 text-right font-semibold"
                                }
                              >
                                {moneda(
                                  row.total
                                )}
                              </td>

                              <td className="px-3 py-3">
                                {
                                  row.empleado_ventas ||
                                  "-"
                                }
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ============================================================
   KPI
============================================================ */

function TarjetaKpi({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: string;
  detalle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <p className="text-sm font-medium text-slate-500">
        {titulo}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {valor}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {detalle}
      </p>
    </div>
  );
}