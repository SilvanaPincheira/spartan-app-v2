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

          </div>


          <div className="flex gap-2">

            <button
              type="button"
              onClick={
                cargarReclamos
              }
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Actualizar
            </button>


            <Link
              href="/ventas/reclamos/nuevo"
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Nuevo Reclamo
            </Link>

          </div>

        </div>


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
            valor={enSeguimiento}
          />

          <Kpi
            titulo="Pendiente verificación"
            valor={
              pendientesVerificacion
            }
          />

          <Kpi
            titulo="Cerrados"
            valor={cerrados}
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
                value={busqueda}
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
                Cambia los filtros o crea un nuevo reclamo.
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
                       * usamos REC-...
                       *
                       * Reclamos históricos:
                       * usamos ID.
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

                          <td className="px-4 py-4">

                            <div className="font-semibold text-blue-700">
                              {
                                reclamo.numeroReclamo
                              }
                            </div>

                            {reclamo.id && (

                              <div className="mt-1 text-xs text-zinc-400">
                                ID {reclamo.id}
                              </div>

                            )}

                          </td>


                          <td className="whitespace-nowrap px-4 py-4 text-zinc-600">
                            {reclamo.fecha ||
                              "-"}
                          </td>


                          <td className="px-4 py-4">

                            <div className="font-medium">
                              {reclamo.cliente ||
                                "-"}
                            </div>

                            <div className="mt-1 text-xs text-zinc-400">
                              {reclamo.rut}
                            </div>

                          </td>


                          <td className="px-4 py-4">
                            {reclamo.producto ||
                              "-"}
                          </td>


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


                          <td className="px-4 py-4">
                            {reclamo.ejecutivo ||
                              "-"}
                          </td>


                          <td className="px-4 py-4">

                            <EstadoBadge
                              estado={
                                reclamo.estado
                              }
                            />

                          </td>


                          <td className="px-4 py-4 text-right">

                            {identificador ? (

                              <Link
                                href={`/ventas/reclamos/${encodeURIComponent(
                                  identificador
                                )}`}
                                className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                Gestionar
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
            de {reclamos.length} reclamos
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