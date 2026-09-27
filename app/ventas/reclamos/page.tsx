"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

/* =========================================================
   TIPOS
========================================================= */

interface Reclamo {
  id: string;
  numeroReclamo: string;

  fecha: string;
  estado: string;

  ejecutivo: string;

  cliente: string;
  rut: string;

  producto: string;

  clasificacion: string;
  motivo: string;

  actualizadoPor: string;
  fechaActualizacion: string;
}

type RolReclamos =
  | "calidad"
  | "ejecutivo"
  | "";

/* =========================================================
   HELPERS
========================================================= */

function valor(
  objeto: Record<string, any>,
  ...campos: string[]
) {
  for (const campo of campos) {
    const dato =
      objeto?.[campo];

    if (
      dato !== undefined &&
      dato !== null &&
      String(dato).trim() !== ""
    ) {
      return String(dato);
    }
  }

  return "";
}

function normalizar(
  texto: string
) {
  return String(
    texto || ""
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

/*
 * Convierte la fecha recibida desde
 * Sheets / Apps Script a un formato
 * más amigable para la bandeja.
 */
function formatearFecha(
  fecha: string
) {
  if (!fecha) {
    return "-";
  }

  /*
   * Si viene como:
   * 26-09-2026 20:44:23
   *
   * la dejamos igual.
   */
  if (
    /^\d{2}-\d{2}-\d{4}/.test(
      fecha
    )
  ) {
    return fecha;
  }

  /*
   * Si viene como:
   * 2026-09-26T23:44:23.000Z
   */
  const date =
    new Date(fecha);

  if (
    !Number.isNaN(
      date.getTime()
    )
  ) {
    return new Intl.DateTimeFormat(
      "es-CL",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).format(date);
  }

  return fecha;
}

/* =========================================================
   PAGE
========================================================= */

export default function ReclamosPage() {
  const [
    reclamos,
    setReclamos,
  ] =
    useState<Reclamo[]>([]);

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
    busqueda,
    setBusqueda,
  ] =
    useState("");

  const [
    filtroEstado,
    setFiltroEstado,
  ] =
    useState("Todos");

  /*
   * La API nos indicará si el usuario
   * pertenece a Control de Calidad.
   */
  const [
    puedeGestionar,
    setPuedeGestionar,
  ] =
    useState(false);

  const [
    rol,
    setRol,
  ] =
    useState<RolReclamos>(
      ""
    );

  const [
    usuarioActual,
    setUsuarioActual,
  ] =
    useState("");

  /* =======================================================
     CARGAR RECLAMOS
  ======================================================= */

  async function cargarReclamos() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          "/api/reclamos",
          {
            method: "GET",
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        data.success === false
      ) {
        throw new Error(
          data.error ||
          "No se pudieron cargar los reclamos."
        );
      }

      /*
       * ============================================
       * PERMISOS DEL USUARIO
       * ============================================
       */

      setPuedeGestionar(
        data.puedeGestionar ===
          true
      );

      setRol(
        data.rol ===
          "calidad"
          ? "calidad"
          : "ejecutivo"
      );

      setUsuarioActual(
        String(
          data.usuarioActual ||
          ""
        )
      );

      /*
       * IMPORTANTE:
       *
       * /api/reclamos ya devuelve:
       *
       * CALIDAD:
       * todos los reclamos.
       *
       * EJECUTIVO:
       * solamente los propios.
       *
       * Aquí no hacemos otro filtro
       * de seguridad.
       */

      const lista =
        Array.isArray(
          data.reclamos
        )
          ? data.reclamos
          : [];

      const normalizados:
        Reclamo[] =
        lista.map(
          (
            raw:
              Record<
                string,
                any
              >
          ) => {
            const id =
              valor(
                raw,
                "ID"
              );

            const numero =
              valor(
                raw,
                "N° Reclamo"
              );

            return {
              id,

              numeroReclamo:
                numero ||
                (id
                  ? `Reclamo #${id}`
                  : "Sin identificación"),

              fecha:
                valor(
                  raw,
                  "Fecha envío"
                ),

              estado:
                valor(
                  raw,
                  "Estado"
                ) ||
                "Sin estado",

              ejecutivo:
                valor(
                  raw,
                  "Ejecutivo de ventas"
                ),

              cliente:
                valor(
                  raw,
                  "Cliente"
                ),

              rut:
                valor(
                  raw,
                  "Rut empresa"
                ),

              producto:
                valor(
                  raw,
                  "Producto"
                ),

              clasificacion:
                valor(
                  raw,
                  "Clasificación"
                ),

              motivo:
                valor(
                  raw,
                  "Motivo"
                ),

              actualizadoPor:
                valor(
                  raw,
                  "Actualizado por"
                ),

              fechaActualizacion:
                valor(
                  raw,
                  "Fecha actualización"
                ),
            };
          }
        );

      /*
       * Mostramos primero
       * los más nuevos.
       */
      setReclamos(
        normalizados.reverse()
      );

    } catch (err) {
      console.error(
        "Error cargando reclamos:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "No fue posible cargar los reclamos."
      );

      setReclamos([]);

      setPuedeGestionar(
        false
      );

      setRol("");

      setUsuarioActual("");

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarReclamos();
  }, []);

  /* =======================================================
     ESTADOS DISPONIBLES
  ======================================================= */

  const estados =
    useMemo(() => {
      const encontrados =
        Array.from(
          new Set(
            reclamos
              .map(
                (r) =>
                  r.estado
              )
              .filter(Boolean)
          )
        );

      return [
        "Todos",
        ...encontrados,
      ];

    }, [reclamos]);

  /* =======================================================
     FILTROS
  ======================================================= */

  const reclamosFiltrados =
    useMemo(() => {
      const texto =
        normalizar(
          busqueda
        );

      return reclamos.filter(
        (reclamo) => {
          const coincideEstado =
            filtroEstado ===
              "Todos" ||
            reclamo.estado ===
              filtroEstado;

          if (!coincideEstado) {
            return false;
          }

          if (!texto) {
            return true;
          }

          const contenido =
            normalizar(
              [
                reclamo.numeroReclamo,
                reclamo.id,
                reclamo.cliente,
                reclamo.rut,
                reclamo.producto,
                reclamo.ejecutivo,
                reclamo.clasificacion,
                reclamo.motivo,
                reclamo.estado,
              ].join(" ")
            );

          return contenido.includes(
            texto
          );
        }
      );

    }, [
      reclamos,
      busqueda,
      filtroEstado,
    ]);

  /* =======================================================
     KPIS
  ======================================================= */

  const total =
    reclamos.length;

  const abiertos =
    reclamos.filter(
      (reclamo) =>
        reclamo.estado !==
        "Cerrado"
    ).length;

  const enSeguimiento =
    reclamos.filter(
      (reclamo) =>
        reclamo.estado ===
        "En seguimiento"
    ).length;

  const pendientesVerificacion =
    reclamos.filter(
      (reclamo) =>
        reclamo.estado ===
        "Pendiente de verificación de eficacia"
    ).length;

  const cerrados =
    reclamos.filter(
      (reclamo) =>
        reclamo.estado ===
        "Cerrado"
    ).length;

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-zinc-50 p-4 text-zinc-900 md:p-6">

      <div className="mx-auto max-w-7xl">

        {/* ===============================================
            HEADER
        =============================================== */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <p className="text-sm font-semibold text-blue-600">
              Calidad / Gestión
            </p>

            <h1 className="text-2xl font-bold">
              Gestión de Reclamos
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Registro, investigación, seguimiento y cierre de reclamos.
            </p>

            {/* ===========================================
                INFORMACIÓN DEL ROL
            =========================================== */}

            {!loading &&
              rol && (

              <div className="mt-3 flex flex-wrap items-center gap-2">

                {puedeGestionar ? (

                  <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    Control de Calidad
                  </span>

                ) : (

                  <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                    Ejecutivo
                  </span>

                )}

                {usuarioActual && (

                  <span className="text-xs text-zinc-400">
                    {usuarioActual}
                  </span>

                )}

              </div>

            )}

          </div>

          <div className="flex gap-2">

            <button
              type="button"
              onClick={
                cargarReclamos
              }
              disabled={loading}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            >
              {loading
                ? "Actualizando..."
                : "Actualizar"}
            </button>

            {/*
             * Tanto Calidad como Ejecutivo
             * pueden registrar nuevos reclamos.
             *
             * Si más adelante quieres que
             * solamente ejecutivos puedan crearlos,
             * lo restringimos aquí.
             */}
            <Link
              href="/ventas/reclamos/nuevo"
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Nuevo Reclamo
            </Link>

          </div>

        </div>

        {/* ===============================================
            MENSAJE SEGÚN ROL
        =============================================== */}

        {!loading &&
          !error && (

          <div
            className={`mb-5 rounded-xl border p-4 text-sm ${
              puedeGestionar
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : "border-zinc-200 bg-white text-zinc-600"
            }`}
          >

            {puedeGestionar ? (

              <>
                Tienes acceso de{" "}
                <strong>
                  Control de Calidad
                </strong>
                . Puedes visualizar y gestionar los reclamos de todos los ejecutivos.
              </>

            ) : (

              <>
                Se muestran únicamente los reclamos ingresados por tu usuario. Puedes consultar su avance, pero la investigación, acciones, seguimiento y cierre son gestionados por Control de Calidad.
              </>

            )}

          </div>

        )}

        {/* ===============================================
            KPIS
        =============================================== */}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

          <Kpi
            titulo="Total"
            valor={total}
          />

          <Kpi
            titulo="Abiertos"
            valor={abiertos}
          />

          <Kpi
            titulo="En seguimiento"
            valor={
              enSeguimiento
            }
          />

          <Kpi
            titulo="Pendiente verificación"
            valor={
              pendientesVerificacion
            }
          />

          <Kpi
            titulo="Cerrados"
            valor={
              cerrados
            }
          />

        </div>

        {/* ===============================================
            ERROR
        =============================================== */}

        {error && (

          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>

        )}

        {/* ===============================================
            FILTROS
        =============================================== */}

        <div className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">

          <div className="grid gap-4 md:grid-cols-[1fr_260px]">

            <label>

              <span className="text-xs font-medium text-zinc-500">
                Buscar reclamo
              </span>

              <input
                value={
                  busqueda
                }
                onChange={(e) =>
                  setBusqueda(
                    e.target.value
                  )
                }
                placeholder="N° reclamo, cliente, RUT, producto, ejecutivo..."
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />

            </label>

            <label>

              <span className="text-xs font-medium text-zinc-500">
                Estado
              </span>

              <select
                value={
                  filtroEstado
                }
                onChange={(e) =>
                  setFiltroEstado(
                    e.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >

                {estados.map(
                  (estado) => (

                    <option
                      key={estado}
                      value={estado}
                    >
                      {estado}
                    </option>

                  )
                )}

              </select>

            </label>

          </div>

        </div>

        {/* ===============================================
            TABLA
        =============================================== */}

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">

          {loading ? (

            <div className="p-10 text-center text-sm text-zinc-500">
              Cargando reclamos...
            </div>

          ) : !reclamosFiltrados.length ? (

            <div className="p-10 text-center">

              <p className="font-medium text-zinc-700">
                No se encontraron reclamos.
              </p>

              <p className="mt-1 text-sm text-zinc-500">

                {puedeGestionar
                  ? "No existen reclamos que coincidan con los filtros seleccionados."
                  : "No tienes reclamos que coincidan con los filtros seleccionados."}

              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="min-w-full text-sm">

                <thead className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">

                  <tr>

                    <th className="px-4 py-3">
                      Reclamo
                    </th>

                    <th className="px-4 py-3">
                      Fecha
                    </th>

                    <th className="px-4 py-3">
                      Cliente
                    </th>

                    <th className="px-4 py-3">
                      Producto
                    </th>

                    <th className="px-4 py-3">
                      Clasificación
                    </th>

                    <th className="px-4 py-3">
                      Ejecutivo
                    </th>

                    <th className="px-4 py-3">
                      Estado
                    </th>

                    <th className="px-4 py-3 text-right">
                      Acción
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y">

                  {reclamosFiltrados.map(
                    (reclamo) => {
                      /*
                       * Nuevos reclamos:
                       * REC-2026-xxxxx
                       *
                       * Históricos:
                       * ID numérico.
                       */
                      const identificador =
                        reclamo
                          .numeroReclamo
                          .startsWith(
                            "REC-"
                          )
                          ? reclamo.numeroReclamo
                          : reclamo.id;

                      return (

                        <tr
                          key={`${reclamo.numeroReclamo}-${reclamo.id}`}
                          className="hover:bg-zinc-50"
                        >

                          {/* RECLAMO */}

                          <td className="px-4 py-4">

                            <div className="font-semibold text-blue-700">
                              {
                                reclamo.numeroReclamo
                              }
                            </div>

                            {reclamo.id && (

                              <div className="mt-1 text-xs text-zinc-400">
                                ID{" "}
                                {
                                  reclamo.id
                                }
                              </div>

                            )}

                          </td>

                          {/* FECHA */}

                          <td className="whitespace-nowrap px-4 py-4 text-zinc-600">
                            {formatearFecha(
                              reclamo.fecha
                            )}
                          </td>

                          {/* CLIENTE */}

                          <td className="px-4 py-4">

                            <div className="font-medium">
                              {reclamo.cliente ||
                                "-"}
                            </div>

                            <div className="mt-1 text-xs text-zinc-400">
                              {
                                reclamo.rut
                              }
                            </div>

                          </td>

                          {/* PRODUCTO */}

                          <td className="px-4 py-4">
                            {reclamo.producto ||
                              "-"}
                          </td>

                          {/* CLASIFICACIÓN */}

                          <td className="px-4 py-4">

                            <div>
                              {reclamo.clasificacion ||
                                "-"}
                            </div>

                            {reclamo.motivo && (

                              <div className="mt-1 max-w-[240px] text-xs text-zinc-400">
                                {
                                  reclamo.motivo
                                }
                              </div>

                            )}

                          </td>

                          {/* EJECUTIVO */}

                          <td className="px-4 py-4">
                            {reclamo.ejecutivo ||
                              "-"}
                          </td>

                          {/* ESTADO */}

                          <td className="px-4 py-4">

                            <EstadoBadge
                              estado={
                                reclamo.estado
                              }
                            />

                          </td>

                          {/* ACCIÓN */}

                          <td className="px-4 py-4 text-right">

                            {identificador ? (

                              <Link
                                href={`/ventas/reclamos/${encodeURIComponent(
                                  identificador
                                )}`}
                                className={`inline-flex rounded-lg border px-3 py-2 text-xs font-semibold ${
                                  puedeGestionar
                                    ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                                }`}
                              >

                                {puedeGestionar
                                  ? "Gestionar"
                                  : "Ver"}

                              </Link>

                            ) : (

                              <span className="text-xs text-zinc-400">
                                Sin ID
                              </span>

                            )}

                          </td>

                        </tr>

                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          )}

        </div>

        {/* ===============================================
            TOTAL FILTRADO
        =============================================== */}

        {!loading && (

          <p className="mt-3 text-right text-xs text-zinc-400">
            Mostrando{" "}
            {
              reclamosFiltrados.length
            }{" "}
            de{" "}
            {
              reclamos.length
            }{" "}
            reclamos
          </p>

        )}

      </div>

    </div>
  );
}

/* =========================================================
   COMPONENTES
========================================================= */

function Kpi({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">

      <p className="text-xs font-medium text-zinc-500">
        {titulo}
      </p>

      <p className="mt-2 text-2xl font-bold text-zinc-900">
        {valor}
      </p>

    </div>
  );
}

function EstadoBadge({
  estado,
}: {
  estado: string;
}) {
  let clases =
    "bg-zinc-100 text-zinc-700";

  if (
    estado ===
    "Ingresado"
  ) {
    clases =
      "bg-blue-100 text-blue-700";
  }

  if (
    estado ===
    "En investigación"
  ) {
    clases =
      "bg-amber-100 text-amber-700";
  }

  if (
    estado ===
    "Pendiente de antecedentes"
  ) {
    clases =
      "bg-yellow-100 text-yellow-700";
  }

  if (
    estado ===
    "Acciones en ejecución"
  ) {
    clases =
      "bg-orange-100 text-orange-700";
  }

  if (
    estado ===
    "En seguimiento"
  ) {
    clases =
      "bg-purple-100 text-purple-700";
  }

  if (
    estado ===
    "Pendiente de verificación de eficacia"
  ) {
    clases =
      "bg-yellow-100 text-yellow-800";
  }

  if (
    estado ===
    "Cerrado"
  ) {
    clases =
      "bg-green-100 text-green-700";
  }

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${clases}`}
    >
      {estado ||
        "Sin estado"}
    </span>
  );
}