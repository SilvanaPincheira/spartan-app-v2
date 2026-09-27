"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClientComponentClient } from
  "@supabase/auth-helpers-nextjs";

/* ============================================================
   TIPOS
============================================================ */

type Documento = {
  sap_origen: string;
  sap_docentry: number;

  tipo_documento: string | null;
  fecha_contabilizacion: string | null;

  folio: number | null;

  vendedor: string | null;

  rut: string | null;
  codigo_cliente: string | null;
  cliente: string | null;

  region: string | null;

  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;

  total_documento: number | string | null;

  lineas: number | string | null;
};

type DetalleLinea = {
  id: number;

  sap_origen: string;
  sap_docentry: number;
  sap_linenum: number;

  tipo_documento: string | null;

  fecha_contabilizacion: string | null;
  folio: number | null;

  vendedor: string | null;

  rut: string | null;
  codigo_cliente: string | null;
  cliente: string | null;

  division: string | null;

  codigo_articulo: string | null;
  articulo: string | null;

  cantidad_kilos: number | string | null;
  unidades: string | null;
  cantidad: number | string | null;

  precio_unitario: number | string | null;
  costo: number | string | null;
  descuento: number | string | null;
  total_venta: number | string | null;
};

/* ============================================================
   HELPERS
============================================================ */

function numero(valor: unknown) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return 0;
  }

  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : 0;
}

function money(valor: unknown) {
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

function fechaCL(valor: string | null) {
  if (!valor) return "-";

  const [year, month, day] =
    valor.slice(0, 10).split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return valor;
  }

  return `${day}-${month}-${year}`;
}

function normalizar(valor: unknown) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

/* ============================================================
   PÁGINA
============================================================ */

export default function FacturasNCPage() {
  const supabase =
    useMemo(
      () =>
        createClientComponentClient(),
      []
    );

  const [
    userEmail,
    setUserEmail,
  ] = useState("");

  const [
    documentos,
    setDocumentos,
  ] =
    useState<Documento[]>([]);

  const [
    detalle,
    setDetalle,
  ] =
    useState<DetalleLinea[] | null>(
      null
    );

  const [
    documentoSeleccionado,
    setDocumentoSeleccionado,
  ] =
    useState<Documento | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadingDetalle,
    setLoadingDetalle,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* ==========================================================
     FILTROS
  ========================================================== */

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    tipoFiltro,
    setTipoFiltro,
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
     CARGAR DOCUMENTOS

     Se carga la vista resumida:
     1 fila = 1 factura / NC

     Se pagina de 1000 en 1000 para no quedar limitado
     por Supabase.
  ========================================================== */

  const cargarDocumentos =
    useCallback(async () => {
      try {
        setLoading(true);
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

        setUserEmail(email);

        const todos:
          Documento[] = [];

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
                "facturas_nc_documentos"
              )
              .select(`
                sap_origen,
                sap_docentry,
                tipo_documento,
                fecha_contabilizacion,
                folio,
                vendedor,
                rut,
                codigo_cliente,
                cliente,
                region,
                direccion,
                comuna,
                ciudad,
                total_documento,
                lineas
              `)
              .order(
                "fecha_contabilizacion",
                {
                  ascending: false,
                }
              )
              .order(
                "folio",
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
              []) as Documento[];

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

        setDocumentos(
          todos
        );
      } catch (
        err: any
      ) {
        console.error(
          "Error cargando Facturas/NC:",
          err
        );

        setError(
          err?.message ||
            "No fue posible cargar Facturas y Notas de Crédito."
        );
      } finally {
        setLoading(false);
      }
    }, [supabase]);

  useEffect(() => {
    cargarDocumentos();
  }, [cargarDocumentos]);

  /* ==========================================================
     ABRIR DETALLE
  ========================================================== */

  async function abrirDetalle(
    documento: Documento
  ) {
    try {
      setLoadingDetalle(
        true
      );

      setDocumentoSeleccionado(
        documento
      );

      setDetalle([]);

      const {
        data,
        error,
      } =
        await supabase
          .from("facturas_nc")
          .select(`
            id,
            sap_origen,
            sap_docentry,
            sap_linenum,
            tipo_documento,
            fecha_contabilizacion,
            folio,
            vendedor,
            rut,
            codigo_cliente,
            cliente,
            division,
            codigo_articulo,
            articulo,
            cantidad_kilos,
            unidades,
            cantidad,
            precio_unitario,
            costo,
            descuento,
            total_venta
          `)
          .eq(
            "sap_origen",
            documento.sap_origen
          )
          .eq(
            "sap_docentry",
            documento.sap_docentry
          )
          .order(
            "sap_linenum",
            {
              ascending: true,
            }
          );

      if (error) {
        throw error;
      }

      setDetalle(
        (data ||
          []) as DetalleLinea[]
      );
    } catch (
      err: any
    ) {
      console.error(
        "Error cargando detalle:",
        err
      );

      alert(
        err?.message ||
          "No fue posible cargar el detalle."
      );

      setDetalle(null);

      setDocumentoSeleccionado(
        null
      );
    } finally {
      setLoadingDetalle(
        false
      );
    }
  }

  function cerrarDetalle() {
    setDetalle(null);

    setDocumentoSeleccionado(
      null
    );
  }

  /* ==========================================================
     FILTROS
  ========================================================== */

  const filtered =
    useMemo(() => {
      const buscar =
        normalizar(
          search
        );

      return documentos.filter(
        (r) => {
          if (
            tipoFiltro &&
            r.tipo_documento !==
              tipoFiltro
          ) {
            return false;
          }

          if (
            fechaDesde &&
            r.fecha_contabilizacion
          ) {
            const fecha =
              r.fecha_contabilizacion.slice(
                0,
                10
              );

            if (
              fecha <
              fechaDesde
            ) {
              return false;
            }
          }

          if (
            fechaHasta &&
            r.fecha_contabilizacion
          ) {
            const fecha =
              r.fecha_contabilizacion.slice(
                0,
                10
              );

            if (
              fecha >
              fechaHasta
            ) {
              return false;
            }
          }

          if (!buscar) {
            return true;
          }

          const texto =
            [
              r.folio,
              r.rut,
              r.codigo_cliente,
              r.cliente,
              r.vendedor,
              r.region,
              r.direccion,
              r.comuna,
              r.ciudad,
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
      documentos,
      search,
      tipoFiltro,
      fechaDesde,
      fechaHasta,
    ]);

  /* ==========================================================
     INDICADORES
  ========================================================== */

  const indicadores =
    useMemo(() => {
      let facturas = 0;
      let notasCredito = 0;

      let ventaFacturas = 0;
      let ventaNC = 0;

      for (
        const documento
        of documentos
      ) {
        if (
          documento.tipo_documento ===
          "FE"
        ) {
          facturas++;

          ventaFacturas +=
            numero(
              documento.total_documento
            );
        }

        if (
          documento.tipo_documento ===
          "NC"
        ) {
          notasCredito++;

          ventaNC +=
            numero(
              documento.total_documento
            );
        }
      }

      return {
        facturas,
        notasCredito,
        ventaFacturas,
        ventaNC,
        neto:
          ventaFacturas +
          ventaNC,
      };
    }, [documentos]);

  function limpiarFiltros() {
    setSearch("");

    setTipoFiltro("");

    setFechaDesde("");

    setFechaHasta("");
  }

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="space-y-6 p-6">

      {/* ======================================================
          CABECERA
      ====================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
            🧾 Facturas y Notas de Crédito
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Documentos sincronizados directamente desde SAP.
          </p>

          {userEmail && (
            <p className="mt-1 text-xs text-zinc-400">
              Sesión:{" "}
              {userEmail}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={
            cargarDocumentos
          }
          className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-50"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-700">
            No fue posible cargar los documentos.
          </p>

          <p className="mt-1 text-sm text-red-600">
            {error}
          </p>
        </div>
      )}

      {!error && (
        <>
          {/* ==================================================
              INDICADORES
          ================================================== */}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <TarjetaIndicador
              titulo="Facturas"
              valor={indicadores.facturas.toLocaleString(
                "es-CL"
              )}
              detalle={money(
                indicadores.ventaFacturas
              )}
            />

            <TarjetaIndicador
              titulo="Notas de Crédito"
              valor={indicadores.notasCredito.toLocaleString(
                "es-CL"
              )}
              detalle={money(
                indicadores.ventaNC
              )}
            />

            <TarjetaIndicador
              titulo="Venta neta"
              valor={money(
                indicadores.neto
              )}
              detalle="Facturas + Notas de Crédito"
            />

            <TarjetaIndicador
              titulo="Documentos"
              valor={documentos.length.toLocaleString(
                "es-CL"
              )}
              detalle="Documentos visibles para tu usuario"
            />

          </div>

          {/* ==================================================
              FILTROS
          ================================================== */}

          <div className="rounded-2xl border bg-white p-5 shadow-sm">

            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              <div>
                <h2 className="font-semibold text-zinc-900">
                  Buscar documentos
                </h2>

                <p className="text-sm text-zinc-500">
                  Busca por RUT, cliente, código cliente, folio o vendedor.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  limpiarFiltros
                }
                className="rounded-lg border px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Limpiar filtros
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">

              <div className="xl:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">
                  Buscar
                </label>

                <input
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="RUT, cliente, código cliente, folio..."
                  value={
                    search
                  }
                  onChange={(
                    e
                  ) =>
                    setSearch(
                      e.target.value
                    )
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">
                  Tipo
                </label>

                <select
                  value={
                    tipoFiltro
                  }
                  onChange={(
                    e
                  ) =>
                    setTipoFiltro(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">
                    Todos
                  </option>

                  <option value="FE">
                    Facturas
                  </option>

                  <option value="NC">
                    Notas de Crédito
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">
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
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">
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
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

            </div>
          </div>

          {/* ==================================================
              TABLA
          ================================================== */}

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">

            <div className="flex items-center justify-between border-b px-5 py-4">

              <div>
                <h2 className="font-semibold text-zinc-900">
                  Documentos
                </h2>

                <p className="text-sm text-zinc-500">
                  {filtered.length.toLocaleString(
                    "es-CL"
                  )}{" "}
                  documentos encontrados
                </p>
              </div>

            </div>

            {loading ? (
              <div className="p-10 text-center text-zinc-500">
                Cargando Facturas y Notas de Crédito...
              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="min-w-[1300px] w-full text-sm">

                  <thead className="bg-zinc-100">

                    <tr>
                      <th className="border-b px-3 py-3 text-left">
                        Tipo
                      </th>

                      <th className="border-b px-3 py-3 text-left">
                        Fecha
                      </th>

                      <th className="border-b px-3 py-3 text-left">
                        Folio
                      </th>

                      <th className="border-b px-3 py-3 text-left">
                        Vendedor
                      </th>

                      <th className="border-b px-3 py-3 text-left">
                        Código Cliente
                      </th>

                      <th className="border-b px-3 py-3 text-left">
                        RUT
                      </th>

                      <th className="border-b px-3 py-3 text-left">
                        Cliente
                      </th>

                      <th className="border-b px-3 py-3 text-left">
                        Región
                      </th>

                      <th className="border-b px-3 py-3 text-left">
                        Comuna
                      </th>

                      <th className="border-b px-3 py-3 text-right">
                        Total
                      </th>

                      <th className="border-b px-3 py-3 text-center">
                        Líneas
                      </th>

                      <th className="border-b px-3 py-3 text-center">
                        Acción
                      </th>
                    </tr>

                  </thead>

                  <tbody>

                    {filtered.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={
                            12
                          }
                          className="px-3 py-10 text-center text-zinc-500"
                        >
                          Sin documentos para mostrar.
                        </td>
                      </tr>
                    )}

                    {filtered.map(
                      (
                        r
                      ) => {
                        const esNC =
                          r.tipo_documento ===
                          "NC";

                        return (
                          <tr
                            key={`${r.sap_origen}-${r.sap_docentry}`}
                            className="border-t hover:bg-zinc-50"
                          >

                            <td className="px-3 py-2">
                              <span
                                className={
                                  esNC
                                    ? "inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700"
                                    : "inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700"
                                }
                              >
                                {
                                  r.tipo_documento
                                }
                              </span>
                            </td>

                            <td className="px-3 py-2">
                              {fechaCL(
                                r.fecha_contabilizacion
                              )}
                            </td>

                            <td className="px-3 py-2 font-semibold">
                              {
                                r.folio ??
                                "-"
                              }
                            </td>

                            <td className="px-3 py-2">
                              {
                                r.vendedor ||
                                "-"
                              }
                            </td>

                            <td className="px-3 py-2 font-mono text-xs">
                              {
                                r.codigo_cliente ||
                                "-"
                              }
                            </td>

                            <td className="px-3 py-2">
                              {
                                r.rut ||
                                "-"
                              }
                            </td>

                            <td className="px-3 py-2">
                              {
                                r.cliente ||
                                "-"
                              }
                            </td>

                            <td className="px-3 py-2">
                              {
                                r.region ||
                                "-"
                              }
                            </td>

                            <td className="px-3 py-2">
                              {
                                r.comuna ||
                                "-"
                              }
                            </td>

                            <td
                              className={
                                esNC
                                  ? "px-3 py-2 text-right font-semibold text-red-600"
                                  : "px-3 py-2 text-right font-semibold"
                              }
                            >
                              {money(
                                r.total_documento
                              )}
                            </td>

                            <td className="px-3 py-2 text-center">
                              {numero(
                                r.lineas
                              )}
                            </td>

                            <td className="px-3 py-2 text-center">

                              <button
                                type="button"
                                onClick={() =>
                                  abrirDetalle(
                                    r
                                  )
                                }
                                className="font-medium text-blue-600 underline underline-offset-4 hover:text-blue-800"
                              >
                                Detalle
                              </button>

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
        </>
      )}

      {/* ======================================================
          MODAL DETALLE
      ====================================================== */}

      {detalle !== null &&
        documentoSeleccionado && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="max-h-[90vh] w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* CABECERA MODAL */}

            <div className="flex items-start justify-between border-b bg-zinc-50 p-5">

              <div>
                <h2 className="text-xl font-bold text-zinc-900">
                  Detalle —{" "}
                  {
                    documentoSeleccionado.tipo_documento
                  }{" "}
                  {
                    documentoSeleccionado.folio
                  }
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  {
                    documentoSeleccionado.codigo_cliente
                  }{" "}
                  —{" "}
                  {
                    documentoSeleccionado.cliente
                  }
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  Fecha:{" "}
                  {fechaCL(
                    documentoSeleccionado.fecha_contabilizacion
                  )}
                  {" · "}
                  Ejecutivo:{" "}
                  {
                    documentoSeleccionado.vendedor
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={
                  cerrarDetalle
                }
                className="rounded-lg px-3 py-2 text-zinc-500 hover:bg-zinc-200"
              >
                ✕
              </button>

            </div>

            {/* CUERPO */}

            <div className="max-h-[70vh] overflow-auto">

              {loadingDetalle ? (

                <div className="p-10 text-center text-zinc-500">
                  Cargando detalle...
                </div>

              ) : (

                <table className="min-w-[1400px] w-full text-sm">

                  <thead className="sticky top-0 bg-zinc-100">

                    <tr>
                      <th className="border-b px-3 py-3 text-left">
                        Código
                      </th>

                      <th className="border-b px-3 py-3 text-left">
                        Artículo
                      </th>

                      <th className="border-b px-3 py-3 text-left">
                        División
                      </th>

                      <th className="border-b px-3 py-3 text-right">
                        Cantidad
                      </th>

                      <th className="border-b px-3 py-3 text-right">
                        Kilos
                      </th>

                      <th className="border-b px-3 py-3 text-left">
                        Unidad
                      </th>

                      <th className="border-b px-3 py-3 text-right">
                        Precio Unitario
                      </th>

                      <th className="border-b px-3 py-3 text-right">
                        Costo
                      </th>

                      <th className="border-b px-3 py-3 text-right">
                        Desc. %
                      </th>

                      <th className="border-b px-3 py-3 text-right">
                        Total
                      </th>
                    </tr>

                  </thead>

                  <tbody>

                    {detalle.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={
                            10
                          }
                          className="px-3 py-10 text-center text-zinc-500"
                        >
                          No se encontraron líneas para este documento.
                        </td>
                      </tr>
                    )}

                    {detalle.map(
                      (
                        d
                      ) => {

                        const esNC =
                          d.tipo_documento ===
                          "NC";

                        return (
                          <tr
                            key={
                              d.id
                            }
                            className="border-t hover:bg-zinc-50"
                          >

                            <td className="px-3 py-2 font-mono text-xs">
                              {
                                d.codigo_articulo ||
                                "-"
                              }
                            </td>

                            <td className="px-3 py-2">
                              {
                                d.articulo ||
                                "-"
                              }
                            </td>

                            <td className="px-3 py-2">
                              {
                                d.division ||
                                "-"
                              }
                            </td>

                            <td
                              className={
                                esNC
                                  ? "px-3 py-2 text-right text-red-600"
                                  : "px-3 py-2 text-right"
                              }
                            >
                              {cantidad(
                                d.cantidad
                              )}
                            </td>

                            <td
                              className={
                                esNC
                                  ? "px-3 py-2 text-right text-red-600"
                                  : "px-3 py-2 text-right"
                              }
                            >
                              {cantidad(
                                d.cantidad_kilos
                              )}
                            </td>

                            <td className="px-3 py-2">
                              {
                                d.unidades ||
                                "-"
                              }
                            </td>

                            <td
                              className={
                                esNC
                                  ? "px-3 py-2 text-right text-red-600"
                                  : "px-3 py-2 text-right"
                              }
                            >
                              {money(
                                d.precio_unitario
                              )}
                            </td>

                            <td className="px-3 py-2 text-right">
                              {money(
                                d.costo
                              )}
                            </td>

                            <td className="px-3 py-2 text-right">
                              {cantidad(
                                d.descuento
                              )}
                              %
                            </td>

                            <td
                              className={
                                esNC
                                  ? "px-3 py-2 text-right font-semibold text-red-600"
                                  : "px-3 py-2 text-right font-semibold"
                              }
                            >
                              {money(
                                d.total_venta
                              )}
                            </td>

                          </tr>
                        );
                      }
                    )}

                  </tbody>

                </table>
              )}

            </div>

            {/* PIE */}

            <div className="flex flex-col gap-2 border-t bg-zinc-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

              <p className="text-sm text-zinc-500">
                {
                  detalle.length
                }{" "}
                líneas
              </p>

              <div className="text-right">

                <p className="text-xs uppercase text-zinc-500">
                  Total documento
                </p>

                <p
                  className={
                    documentoSeleccionado.tipo_documento ===
                    "NC"
                      ? "text-xl font-bold text-red-600"
                      : "text-xl font-bold text-zinc-900"
                  }
                >
                  {money(
                    documentoSeleccionado.total_documento
                  )}
                </p>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

/* ============================================================
   TARJETA KPI
============================================================ */

function TarjetaIndicador({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: string;
  detalle: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">

      <p className="text-sm font-medium text-zinc-500">
        {titulo}
      </p>

      <p className="mt-2 text-2xl font-bold text-zinc-900">
        {valor}
      </p>

      <p className="mt-1 text-xs text-zinc-400">
        {detalle}
      </p>

    </div>
  );
}