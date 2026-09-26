"use client";

import React, {
  useEffect,
  useState,
} from "react";

import { useParams } from "next/navigation";

import {
  createClientComponentClient,
} from "@supabase/auth-helpers-nextjs";

/* =========================================================
   CONFIG
========================================================= */

const SHEET_ID =
  "1Te8xrWiWSvLl_YwqgK55rHw6eBGHeVeMGi0Z1G2ft4E";

/*
 * Mantén aquí el GID real
 * de la hoja Reclamos.
 */
const GID_RECLAMOS =
  "REEMPLAZAR_GID_RECLAMOS";

/* =========================================================
   TIPOS
========================================================= */

type Tab =
  | "ingreso"
  | "investigacion"
  | "acciones"
  | "seguimiento"
  | "cierre";

interface Reclamo {
  id: string;

  numeroReclamo: string;

  fechaIngreso: string;

  estado: string;

  ejecutivo: string;

  ejecutivoEmail: string;

  cliente: string;

  rut: string;

  contactoCliente: string;

  correoContacto: string;

  producto: string;

  presentacion: string;

  cantidadAfectada: string;

  unidadCantidad: string;

  lote: string;

  fechaElaboracion: string;

  clasificacion: string;

  motivo: string;

  descripcion: string;

  accionesInmediatas: string[];

  accionInmediataDetalle: string;

  aplicacion: string;

  proceso: string;

  dilucion: string;

  dosis: string;

  temperatura: string;

  tiempoAccion: string;

  superficie: string;

  equipoDosificacion: string;

  productoAnterior: string;

  cambioProcedimiento: string;

  cambioProcedimientoDetalle: string;
}

interface Investigacion {
  responsableInvestigacion: string;

  areaResponsable: string;

  investigacionRealizada: string;

  revisionFabricacionLote: string;

  revisionMateriasPrimas: string;

  analisisMuestra: string;

  revisionLogistica: string;

  revisionAplicacionCliente: string;

  comparacionEspecificacion: string;

  conclusionAtribucion: string;

  causaDeterminada: string;
}

interface AccionCorrectiva {
  id: string;

  accionCorrectiva: string;

  responsable: string;

  areaResponsable: string;

  fechaAsignacion: string;

  fechaCompromiso: string;

  fechaEjecucion: string;

  estado: string;

  observaciones: string;
}

interface Seguimiento {
  id: string;

  fechaSeguimiento: string;

  responsable: string;

  resultado: string;

  comentarios: string;
}

interface Cierre {
  resultadoEficacia: string;

  fechaVerificacion: string;

  responsableVerificacion: string;

  metodoVerificacion: string;

  resultadoObtenido: string;

  comentarioVerificacion: string;

  resultadoFinal: string;

  comentariosCierre: string;
}

/* =========================================================
   OPCIONES
========================================================= */

const CONCLUSIONES = [
  "Atribuible al producto",
  "Atribuible al proceso de fabricación",
  "Atribuible a almacenamiento interno",
  "Atribuible al transporte interno",
  "Atribuible al transporte externo",
  "Atribuible al despacho",
  "Atribuible al uso/aplicación del cliente",
  "Atribuible a asesoría técnica/comercial",
  "Reclamo no comprobado",
  "Sin antecedentes suficientes",
  "Otro",
];

const ESTADOS_ACCION = [
  "Pendiente",
  "En ejecución",
  "Ejecutada",
  "Vencida",
  "Cancelada",
];

/* =========================================================
   CSV
========================================================= */

function parseCsv(
  texto: string
): Record<string, string>[] {
  const rows: string[][] = [];

  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (
    let i = 0;
    i < texto.length;
    i++
  ) {
    const char = texto[i];

    if (quoted) {
      if (char === '"') {
        if (
          texto[i + 1] === '"'
        ) {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }

    } else {
      if (char === '"') {
        quoted = true;

      } else if (
        char === ","
      ) {
        row.push(cell);
        cell = "";

      } else if (
        char === "\n"
      ) {
        row.push(cell);

        rows.push(row);

        row = [];
        cell = "";

      } else if (
        char !== "\r"
      ) {
        cell += char;
      }
    }
  }

  if (
    cell.length ||
    row.length
  ) {
    row.push(cell);
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers =
    rows[0].map(
      (header) =>
        header.trim()
    );

  return rows
    .slice(1)
    .filter(
      (r) =>
        r.some(
          (value) =>
            String(value).trim()
        )
    )
    .map((r) => {
      const obj:
        Record<string, string> =
        {};

      headers.forEach(
        (header, index) => {
          obj[header] =
            r[index] || "";
        }
      );

      return obj;
    });
}

function valorFila(
  fila: Record<string, string>,
  ...campos: string[]
) {
  for (
    const campo
    of campos
  ) {
    if (
      fila[campo] !== undefined &&
      fila[campo] !== ""
    ) {
      return fila[campo];
    }
  }

  return "";
}

function separarLista(
  valor: string
) {
  return String(valor || "")
    .split(/[;,]/)
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean);
}

/* =========================================================
   HELPERS
========================================================= */

function nuevoId(
  prefijo: string
) {
  if (
    typeof crypto !==
      "undefined" &&
    crypto.randomUUID
  ) {
    return `${prefijo}-${crypto.randomUUID()}`;
  }

  return `${prefijo}-${Date.now()}-${Math.random()}`;
}

/* =========================================================
   PAGE
========================================================= */

export default function ReclamoDetallePage() {
  const params =
    useParams();

  const id =
    String(params?.id || "");

  const [
    reclamo,
    setReclamo,
  ] =
    useState<Reclamo | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    tab,
    setTab,
  ] =
    useState<Tab>(
      "ingreso"
    );

  const [
    guardando,
    setGuardando,
  ] =
    useState(false);

  const [
    mensaje,
    setMensaje,
  ] =
    useState("");

  const [
    userEmail,
    setUserEmail,
  ] =
    useState("");

  const supabase =
    createClientComponentClient();

  /* =======================================================
     INVESTIGACIÓN
  ======================================================= */

  const [
    investigacion,
    setInvestigacion,
  ] =
    useState<Investigacion>({
      responsableInvestigacion:
        "",

      areaResponsable:
        "",

      investigacionRealizada:
        "",

      revisionFabricacionLote:
        "",

      revisionMateriasPrimas:
        "",

      analisisMuestra:
        "",

      revisionLogistica:
        "",

      revisionAplicacionCliente:
        "",

      comparacionEspecificacion:
        "",

      conclusionAtribucion:
        "",

      causaDeterminada:
        "",
    });

  /* =======================================================
     ACCIONES
  ======================================================= */

  const [
    acciones,
    setAcciones,
  ] =
    useState<
      AccionCorrectiva[]
    >([]);

  /* =======================================================
     SEGUIMIENTOS
  ======================================================= */

  const [
    seguimientos,
    setSeguimientos,
  ] =
    useState<
      Seguimiento[]
    >([]);

  /* =======================================================
     CIERRE
  ======================================================= */

  const [
    cierre,
    setCierre,
  ] =
    useState<Cierre>({
      resultadoEficacia:
        "",

      fechaVerificacion:
        "",

      responsableVerificacion:
        "",

      metodoVerificacion:
        "",

      resultadoObtenido:
        "",

      comentarioVerificacion:
        "",

      resultadoFinal:
        "",

      comentariosCierre:
        "",
    });

  /* =======================================================
     USUARIO
  ======================================================= */

  useEffect(() => {
    async function cargarUsuario() {
      const { data } =
        await supabase.auth.getUser();

      setUserEmail(
        data?.user?.email || ""
      );
    }

    cargarUsuario();
  }, []);

  /* =======================================================
     CARGAR RECLAMO
  ======================================================= */

  useEffect(() => {
    if (!id) return;

    async function cargarReclamo() {
      try {
        setLoading(true);

        const url =
          `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_RECLAMOS}`;

        const res =
          await fetch(
            url,
            {
              cache:
                "no-store",
            }
          );

        if (!res.ok) {
          throw new Error(
            "No se pudo leer la hoja de reclamos."
          );
        }

        const texto =
          await res.text();

        const data =
          parseCsv(texto);

        const found =
          data.find(
            (fila) => {

              const filaId =
                valorFila(
                  fila,
                  "ID",
                  "id",
                  "N° Reclamo",
                  "Numero Reclamo",
                  "numeroReclamo",
                  "0"
                );

              return (
                String(filaId) ===
                id
              );
            }
          );

        if (!found) {
          setReclamo(null);
          return;
        }

        setReclamo({
          id,

          numeroReclamo:
            valorFila(
              found,
              "N° Reclamo",
              "Numero Reclamo",
              "numeroReclamo",
              "ID",
              "id",
              "0"
            ) || id,

          fechaIngreso:
            valorFila(
              found,
              "Fecha ingreso",
              "Fecha envío",
              "fechaIngreso"
            ),

          estado:
            valorFila(
              found,
              "Estado",
              "estado"
            ) ||
            "Ingresado",

          ejecutivo:
            valorFila(
              found,
              "Ejecutivo de ventas",
              "Ejecutivo",
              "ejecutivo"
            ),

          ejecutivoEmail:
            valorFila(
              found,
              "Correo Ejecutivo",
              "ejecutivoEmail"
            ),

          cliente:
            valorFila(
              found,
              "Cliente",
              "cliente"
            ),

          rut:
            valorFila(
              found,
              "RUT cliente",
              "Rut empresa",
              "rut"
            ),

          contactoCliente:
            valorFila(
              found,
              "Contacto cliente",
              "contactoCliente"
            ),

          correoContacto:
            valorFila(
              found,
              "Correo de contacto",
              "correo"
            ),

          producto:
            valorFila(
              found,
              "Producto",
              "producto"
            ),

          presentacion:
            valorFila(
              found,
              "Presentación",
              "presentacion"
            ),

          cantidadAfectada:
            valorFila(
              found,
              "Cantidad afectada",
              "cantidadAfectada"
            ),

          unidadCantidad:
            valorFila(
              found,
              "Unidad",
              "unidadCantidad"
            ),

          lote:
            valorFila(
              found,
              "Lote",
              "lote"
            ),

          fechaElaboracion:
            valorFila(
              found,
              "Fecha elaboración",
              "fechaElaboracion"
            ),

          clasificacion:
            valorFila(
              found,
              "Clasificación",
              "clasificacion"
            ),

          motivo:
            valorFila(
              found,
              "Motivo",
              "motivo"
            ),

          descripcion:
            valorFila(
              found,
              "DESCRIPCIÓN DEL PROBLEMA",
              "Descripción del reclamo",
              "descripcion"
            ),

          accionesInmediatas:
            separarLista(
              valorFila(
                found,
                "Acciones inmediatas",
                "accionesInmediatas"
              )
            ),

          accionInmediataDetalle:
            valorFila(
              found,
              "Detalle acción inmediata",
              "accionInmediataDetalle"
            ),

          aplicacion:
            valorFila(
              found,
              "Aplicación",
              "aplicacion"
            ),

          proceso:
            valorFila(
              found,
              "Proceso",
              "proceso"
            ),

          dilucion:
            valorFila(
              found,
              "Dilución",
              "dilucion"
            ),

          dosis:
            valorFila(
              found,
              "Dosis de uso",
              "Dosificación",
              "dosis"
            ),

          temperatura:
            valorFila(
              found,
              "Temperatura de solución",
              "Temperatura",
              "temperatura"
            ),

          tiempoAccion:
            valorFila(
              found,
              "Tiempo de acción",
              "Tiempo de contacto",
              "tiempoAccion"
            ),

          superficie:
            valorFila(
              found,
              "Superficie donde se aplica",
              "Superficie",
              "superficie"
            ),

          equipoDosificacion:
            valorFila(
              found,
              "Equipo dosificación",
              "equipoDosificacion"
            ),

          productoAnterior:
            valorFila(
              found,
              "Producto anterior",
              "productoAnterior"
            ),

          cambioProcedimiento:
            valorFila(
              found,
              "Cambio procedimiento",
              "cambioProcedimiento"
            ),

          cambioProcedimientoDetalle:
            valorFila(
              found,
              "Detalle cambio procedimiento",
              "cambioProcedimientoDetalle"
            ),
        });

      } catch (error) {
        console.error(
          "Error cargando reclamo:",
          error
        );

      } finally {
        setLoading(false);
      }
    }

    cargarReclamo();

  }, [id]);

  /* =======================================================
     GUARDAR GESTIÓN
  ======================================================= */

  async function guardarGestion(
    etapa: string,
    datos: any,
    estado?: string
  ) {
    if (!reclamo) return;

    try {
      setGuardando(true);
      setMensaje("");

      /*
       * Esta API es el próximo archivo
       * que construiremos.
       */
      const response =
        await fetch(
          "/api/reclamo-gestion",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                reclamoId:
                  reclamo.id,

                numeroReclamo:
                  reclamo.numeroReclamo,

                etapa,

                estado,

                usuario:
                  userEmail,

                datos,
              }),
          }
        );

      const resultado =
        await response
          .json()
          .catch(() => ({}));

      if (
        !response.ok ||
        resultado.success ===
          false
      ) {
        throw new Error(
          resultado.error ||
          "No se pudo guardar la gestión."
        );
      }

      if (estado) {
        setReclamo(
          (actual) =>
            actual
              ? {
                  ...actual,
                  estado,
                }
              : actual
        );
      }

      setMensaje(
        "Cambios guardados correctamente."
      );

      return true;

    } catch (error) {
      console.error(error);

      setMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo guardar."
      );

      return false;

    } finally {
      setGuardando(false);
    }
  }

  /* =======================================================
     INVESTIGACIÓN
  ======================================================= */

  async function guardarInvestigacion() {
    if (
      !investigacion.responsableInvestigacion ||
      !investigacion.areaResponsable
    ) {
      alert(
        "Indica responsable y área responsable."
      );

      return;
    }

    if (
      !investigacion.conclusionAtribucion ||
      !investigacion.causaDeterminada
    ) {
      alert(
        "Debes registrar la conclusión y la causa determinada."
      );

      return;
    }

    const ok =
      await guardarGestion(
        "Investigación",
        investigacion,
        "Acciones en ejecución"
      );

    if (ok) {
      setTab("acciones");
    }
  }

  /* =======================================================
     ACCIONES
  ======================================================= */

  function agregarAccion() {
    setAcciones(
      (actual) => [
        ...actual,

        {
          id:
            nuevoId("ACC"),

          accionCorrectiva:
            "",

          responsable:
            "",

          areaResponsable:
            "",

          fechaAsignacion:
            new Date()
              .toISOString()
              .slice(0, 10),

          fechaCompromiso:
            "",

          fechaEjecucion:
            "",

          estado:
            "Pendiente",

          observaciones:
            "",
        },
      ]
    );
  }

  function actualizarAccion(
    index: number,
    campo:
      keyof AccionCorrectiva,
    valor: string
  ) {
    setAcciones(
      (actual) =>
        actual.map(
          (accion, i) =>
            i === index
              ? {
                  ...accion,
                  [campo]:
                    valor,
                }
              : accion
        )
    );
  }

  function eliminarAccion(
    index: number
  ) {
    setAcciones(
      (actual) =>
        actual.filter(
          (_, i) =>
            i !== index
        )
    );
  }

  async function guardarAcciones() {
    if (!acciones.length) {
      alert(
        "Debes registrar al menos una acción correctiva."
      );

      return;
    }

    const incompleta =
      acciones.some(
        (accion) =>
          !accion.accionCorrectiva ||
          !accion.responsable ||
          !accion.fechaCompromiso
      );

    if (incompleta) {
      alert(
        "Completa acción, responsable y fecha compromiso."
      );

      return;
    }

    const ok =
      await guardarGestion(
        "Acciones",
        {
          acciones,
        },
        "En seguimiento"
      );

    if (ok) {
      setTab("seguimiento");
    }
  }

  /* =======================================================
     SEGUIMIENTO
  ======================================================= */

  function agregarSeguimiento() {
    setSeguimientos(
      (actual) => [
        ...actual,

        {
          id:
            nuevoId("SEG"),

          fechaSeguimiento:
            new Date()
              .toISOString()
              .slice(0, 10),

          responsable:
            "",

          resultado:
            "",

          comentarios:
            "",
        },
      ]
    );
  }

  function actualizarSeguimiento(
    index: number,
    campo:
      keyof Seguimiento,
    valor: string
  ) {
    setSeguimientos(
      (actual) =>
        actual.map(
          (seguimiento, i) =>
            i === index
              ? {
                  ...seguimiento,
                  [campo]:
                    valor,
                }
              : seguimiento
        )
    );
  }

  function eliminarSeguimiento(
    index: number
  ) {
    setSeguimientos(
      (actual) =>
        actual.filter(
          (_, i) =>
            i !== index
        )
    );
  }

  async function guardarSeguimientos() {
    if (
      !seguimientos.length
    ) {
      alert(
        "Registra al menos un seguimiento."
      );

      return;
    }

    const ok =
      await guardarGestion(
        "Seguimiento",
        {
          seguimientos,
        },
        "Pendiente de verificación de eficacia"
      );

    if (ok) {
      setTab("cierre");
    }
  }

  /* =======================================================
     CIERRE
  ======================================================= */

  async function guardarCierre() {
    if (
      !cierre.resultadoEficacia ||
      !cierre.responsableVerificacion ||
      !cierre.metodoVerificacion ||
      !cierre.resultadoObtenido
    ) {
      alert(
        "Completa la verificación de eficacia."
      );

      return;
    }

    /*
     * La regla exige mantener abierto
     * si la acción no fue eficaz.
     */
    if (
      cierre.resultadoEficacia ===
      "No eficaz"
    ) {
      await guardarGestion(
        "Verificación de eficacia",
        cierre,
        "En seguimiento"
      );

      alert(
        "La verificación fue No eficaz. El reclamo continuará abierto y deberá generar nuevas acciones."
      );

      setTab("acciones");

      return;
    }

    if (
      cierre.resultadoEficacia !==
      "Eficaz"
    ) {
      alert(
        "La eficacia debe estar verificada antes de cerrar."
      );

      return;
    }

    if (
      !cierre.resultadoFinal ||
      !cierre.comentariosCierre
    ) {
      alert(
        "Completa el resultado final y los comentarios de cierre."
      );

      return;
    }

    const confirmacion =
      window.confirm(
        "¿Confirma el cierre definitivo de este reclamo?"
      );

    if (!confirmacion) {
      return;
    }

    await guardarGestion(
      "Cierre",
      {
        ...cierre,

        usuarioCierre:
          userEmail,

        fechaCierre:
          new Date()
            .toISOString(),
      },
      "Cerrado"
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  if (loading) {
    return (
      <div className="p-8 text-zinc-500">
        Cargando reclamo...
      </div>
    );
  }

  if (!reclamo) {
    return (
      <div className="p-8 text-red-600">
        Reclamo no encontrado.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-6">

      <div className="mx-auto max-w-7xl space-y-5">

        {/* HEADER */}

        <div className="rounded-2xl border bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <p className="text-sm font-semibold text-blue-600">
                Gestión de Reclamos
              </p>

              <h1 className="text-2xl font-bold text-zinc-900">
                Reclamo {reclamo.numeroReclamo}
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {reclamo.cliente} · {reclamo.producto}
              </p>

            </div>

            <div>

              <span className="inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
                {reclamo.estado}
              </span>

            </div>

          </div>

        </div>

        {/* MENSAJE */}

        {mensaje && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            {mensaje}
          </div>
        )}

        {/* TABS */}

        <div className="overflow-x-auto rounded-2xl border bg-white p-2 shadow-sm">

          <div className="flex min-w-max gap-2">

            <TabButton
              activo={
                tab === "ingreso"
              }
              onClick={() =>
                setTab("ingreso")
              }
            >
              1. Ingreso
            </TabButton>

            <TabButton
              activo={
                tab ===
                "investigacion"
              }
              onClick={() =>
                setTab(
                  "investigacion"
                )
              }
            >
              2. Investigación
            </TabButton>

            <TabButton
              activo={
                tab ===
                "acciones"
              }
              onClick={() =>
                setTab("acciones")
              }
            >
              3. Acciones
            </TabButton>

            <TabButton
              activo={
                tab ===
                "seguimiento"
              }
              onClick={() =>
                setTab(
                  "seguimiento"
                )
              }
            >
              4. Seguimiento
            </TabButton>

            <TabButton
              activo={
                tab === "cierre"
              }
              onClick={() =>
                setTab("cierre")
              }
            >
              5. Cierre
            </TabButton>

          </div>

        </div>

        {/* =================================================
            INGRESO
        ================================================= */}

        {tab === "ingreso" && (

          <section className="rounded-2xl border bg-white p-6 shadow-sm">

            <TituloEtapa
              titulo="Antecedentes ingresados por el ejecutivo"
              descripcion="Información original del reclamo."
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

              <Dato
                titulo="Fecha ingreso"
                valor={
                  reclamo.fechaIngreso
                }
              />

              <Dato
                titulo="Ejecutivo"
                valor={
                  reclamo.ejecutivo
                }
              />

              <Dato
                titulo="Cliente"
                valor={
                  reclamo.cliente
                }
              />

              <Dato
                titulo="RUT"
                valor={reclamo.rut}
              />

              <Dato
                titulo="Contacto"
                valor={
                  reclamo.contactoCliente
                }
              />

              <Dato
                titulo="Producto"
                valor={
                  reclamo.producto
                }
              />

              <Dato
                titulo="Presentación"
                valor={
                  reclamo.presentacion
                }
              />

              <Dato
                titulo="Cantidad afectada"
                valor={`${reclamo.cantidadAfectada} ${reclamo.unidadCantidad}`}
              />

              <Dato
                titulo="Lote"
                valor={
                  reclamo.lote
                }
              />

              <Dato
                titulo="Clasificación"
                valor={
                  reclamo.clasificacion
                }
              />

              <Dato
                titulo="Motivo"
                valor={
                  reclamo.motivo
                }
              />

            </div>

            <div className="mt-5 rounded-xl border bg-zinc-50 p-4">

              <p className="text-xs font-medium text-zinc-500">
                Descripción
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm">
                {reclamo.descripcion ||
                  "Sin información"}
              </p>

            </div>

            <div className="mt-5 rounded-xl border bg-zinc-50 p-4">

              <p className="text-xs font-medium text-zinc-500">
                Acciones inmediatas
              </p>

              <p className="mt-2 text-sm">
                {reclamo
                  .accionesInmediatas
                  .length
                  ? reclamo
                      .accionesInmediatas
                      .join(", ")
                  : "Sin información"}
              </p>

              {reclamo
                .accionInmediataDetalle && (

                <p className="mt-2 text-sm text-zinc-600">
                  {
                    reclamo
                      .accionInmediataDetalle
                  }
                </p>

              )}

            </div>

          </section>

        )}

        {/* =================================================
            INVESTIGACIÓN
        ================================================= */}

        {tab ===
          "investigacion" && (

          <section className="rounded-2xl border bg-white p-6 shadow-sm">

            <TituloEtapa
              titulo="Investigación / análisis de causa"
              descripcion="Esta sección corresponde al área responsable."
            />

            <div className="grid gap-4 md:grid-cols-2">

              <InputGestion
                label="Responsable de investigación"
                value={
                  investigacion.responsableInvestigacion
                }
                onChange={(valor) =>
                  setInvestigacion(
                    (actual) => ({
                      ...actual,

                      responsableInvestigacion:
                        valor,
                    })
                  )
                }
              />

              <InputGestion
                label="Área responsable"
                value={
                  investigacion.areaResponsable
                }
                onChange={(valor) =>
                  setInvestigacion(
                    (actual) => ({
                      ...actual,

                      areaResponsable:
                        valor,
                    })
                  )
                }
              />

            </div>

            <AreaGestion
              label="Investigación realizada"
              value={
                investigacion.investigacionRealizada
              }
              onChange={(valor) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    investigacionRealizada:
                      valor,
                  })
                )
              }
            />

            <AreaGestion
              label="Revisión de fabricación / lote"
              value={
                investigacion.revisionFabricacionLote
              }
              onChange={(valor) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    revisionFabricacionLote:
                      valor,
                  })
                )
              }
            />

            <AreaGestion
              label="Revisión de materias primas y controles de calidad"
              value={
                investigacion.revisionMateriasPrimas
              }
              onChange={(valor) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    revisionMateriasPrimas:
                      valor,
                  })
                )
              }
            />

            <AreaGestion
              label="Análisis de muestra"
              value={
                investigacion.analisisMuestra
              }
              onChange={(valor) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    analisisMuestra:
                      valor,
                  })
                )
              }
            />

            <AreaGestion
              label="Revisión logística / documental"
              value={
                investigacion.revisionLogistica
              }
              onChange={(valor) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    revisionLogistica:
                      valor,
                  })
                )
              }
            />

            <AreaGestion
              label="Revisión de aplicación en cliente"
              value={
                investigacion.revisionAplicacionCliente
              }
              onChange={(valor) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    revisionAplicacionCliente:
                      valor,
                  })
                )
              }
            />

            <AreaGestion
              label="Comparación contra especificación"
              value={
                investigacion.comparacionEspecificacion
              }
              onChange={(valor) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    comparacionEspecificacion:
                      valor,
                  })
                )
              }
            />

            <label className="mt-4 block">

              <span className="text-sm font-medium">
                Conclusión / atribución del reclamo *
              </span>

              <select
                value={
                  investigacion.conclusionAtribucion
                }
                onChange={(e) =>
                  setInvestigacion(
                    (actual) => ({
                      ...actual,

                      conclusionAtribucion:
                        e.target.value,
                    })
                  )
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >

                <option value="">
                  Seleccione...
                </option>

                {CONCLUSIONES.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  )
                )}

              </select>

            </label>

            <AreaGestion
              label="Descripción de la causa determinada *"
              value={
                investigacion.causaDeterminada
              }
              onChange={(valor) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    causaDeterminada:
                      valor,
                  })
                )
              }
            />

            <BotonGuardar
              guardando={
                guardando
              }
              onClick={
                guardarInvestigacion
              }
            >
              Guardar investigación
            </BotonGuardar>

          </section>

        )}

        {/* =================================================
            ACCIONES
        ================================================= */}

        {tab === "acciones" && (

          <section className="rounded-2xl border bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <TituloEtapa
                titulo="Acciones correctivas"
                descripcion="Registra responsables, fechas compromiso y avance."
              />

              <button
                type="button"
                onClick={agregarAccion}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Acción
              </button>

            </div>

            {!acciones.length && (

              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-zinc-500">
                No hay acciones correctivas registradas.
              </div>

            )}

            <div className="space-y-4">

              {acciones.map(
                (accion, index) => (

                  <div
                    key={accion.id}
                    className="rounded-xl border bg-zinc-50 p-4"
                  >

                    <div className="mb-4 flex items-center justify-between">

                      <h3 className="font-semibold">
                        Acción {index + 1}
                      </h3>

                      <button
                        type="button"
                        onClick={() =>
                          eliminarAccion(
                            index
                          )
                        }
                        className="text-sm text-red-600"
                      >
                        Eliminar
                      </button>

                    </div>

                    <div className="grid gap-4 md:grid-cols-2">

                      <InputGestion
                        label="Acción correctiva"
                        value={
                          accion.accionCorrectiva
                        }
                        onChange={(valor) =>
                          actualizarAccion(
                            index,
                            "accionCorrectiva",
                            valor
                          )
                        }
                      />

                      <InputGestion
                        label="Responsable"
                        value={
                          accion.responsable
                        }
                        onChange={(valor) =>
                          actualizarAccion(
                            index,
                            "responsable",
                            valor
                          )
                        }
                      />

                      <InputGestion
                        label="Área responsable"
                        value={
                          accion.areaResponsable
                        }
                        onChange={(valor) =>
                          actualizarAccion(
                            index,
                            "areaResponsable",
                            valor
                          )
                        }
                      />

                      <InputGestion
                        label="Fecha compromiso"
                        type="date"
                        value={
                          accion.fechaCompromiso
                        }
                        onChange={(valor) =>
                          actualizarAccion(
                            index,
                            "fechaCompromiso",
                            valor
                          )
                        }
                      />

                      <InputGestion
                        label="Fecha ejecución"
                        type="date"
                        value={
                          accion.fechaEjecucion
                        }
                        onChange={(valor) =>
                          actualizarAccion(
                            index,
                            "fechaEjecucion",
                            valor
                          )
                        }
                      />

                      <label>

                        <span className="text-sm font-medium">
                          Estado
                        </span>

                        <select
                          value={
                            accion.estado
                          }
                          onChange={(e) =>
                            actualizarAccion(
                              index,
                              "estado",
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                        >

                          {ESTADOS_ACCION.map(
                            (estado) => (
                              <option
                                key={estado}
                                value={
                                  estado
                                }
                              >
                                {
                                  estado
                                }
                              </option>
                            )
                          )}

                        </select>

                      </label>

                    </div>

                    <AreaGestion
                      label="Observaciones"
                      value={
                        accion.observaciones
                      }
                      onChange={(valor) =>
                        actualizarAccion(
                          index,
                          "observaciones",
                          valor
                        )
                      }
                    />

                  </div>

                )
              )}

            </div>

            {!!acciones.length && (

              <BotonGuardar
                guardando={guardando}
                onClick={
                  guardarAcciones
                }
              >
                Guardar acciones
              </BotonGuardar>

            )}

          </section>

        )}

        {/* =================================================
            SEGUIMIENTO
        ================================================= */}

        {tab ===
          "seguimiento" && (

          <section className="rounded-2xl border bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <TituloEtapa
                titulo="Seguimiento"
                descripcion="Puedes registrar múltiples seguimientos."
              />

              <button
                type="button"
                onClick={
                  agregarSeguimiento
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Seguimiento
              </button>

            </div>

            <div className="space-y-4">

              {seguimientos.map(
                (
                  seguimiento,
                  index
                ) => (

                  <div
                    key={
                      seguimiento.id
                    }
                    className="rounded-xl border bg-zinc-50 p-4"
                  >

                    <div className="mb-4 flex justify-between">

                      <h3 className="font-semibold">
                        Seguimiento{" "}
                        {index + 1}
                      </h3>

                      <button
                        type="button"
                        onClick={() =>
                          eliminarSeguimiento(
                            index
                          )
                        }
                        className="text-sm text-red-600"
                      >
                        Eliminar
                      </button>

                    </div>

                    <div className="grid gap-4 md:grid-cols-2">

                      <InputGestion
                        label="Fecha"
                        type="date"
                        value={
                          seguimiento.fechaSeguimiento
                        }
                        onChange={(valor) =>
                          actualizarSeguimiento(
                            index,
                            "fechaSeguimiento",
                            valor
                          )
                        }
                      />

                      <InputGestion
                        label="Responsable"
                        value={
                          seguimiento.responsable
                        }
                        onChange={(valor) =>
                          actualizarSeguimiento(
                            index,
                            "responsable",
                            valor
                          )
                        }
                      />

                    </div>

                    <AreaGestion
                      label="Resultado del seguimiento"
                      value={
                        seguimiento.resultado
                      }
                      onChange={(valor) =>
                        actualizarSeguimiento(
                          index,
                          "resultado",
                          valor
                        )
                      }
                    />

                    <AreaGestion
                      label="Comentarios"
                      value={
                        seguimiento.comentarios
                      }
                      onChange={(valor) =>
                        actualizarSeguimiento(
                          index,
                          "comentarios",
                          valor
                        )
                      }
                    />

                  </div>

                )
              )}

            </div>

            {!!seguimientos.length && (

              <BotonGuardar
                guardando={
                  guardando
                }
                onClick={
                  guardarSeguimientos
                }
              >
                Guardar seguimiento
              </BotonGuardar>

            )}

          </section>

        )}

        {/* =================================================
            CIERRE
        ================================================= */}

        {tab === "cierre" && (

          <section className="rounded-2xl border bg-white p-6 shadow-sm">

            <TituloEtapa
              titulo="Verificación de eficacia y cierre"
              descripcion="El reclamo solo puede cerrarse cuando la eficacia haya sido verificada."
            />

            <div className="grid gap-4 md:grid-cols-2">

              <label>

                <span className="text-sm font-medium">
                  Resultado de eficacia *
                </span>

                <select
                  value={
                    cierre.resultadoEficacia
                  }
                  onChange={(e) =>
                    setCierre(
                      (actual) => ({
                        ...actual,

                        resultadoEficacia:
                          e.target.value,
                      })
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >

                  <option value="">
                    Seleccione...
                  </option>

                  <option value="Eficaz">
                    Eficaz
                  </option>

                  <option value="No eficaz">
                    No eficaz
                  </option>

                  <option value="Pendiente">
                    Pendiente
                  </option>

                </select>

              </label>

              <InputGestion
                label="Fecha de verificación"
                type="date"
                value={
                  cierre.fechaVerificacion
                }
                onChange={(valor) =>
                  setCierre(
                    (actual) => ({
                      ...actual,

                      fechaVerificacion:
                        valor,
                    })
                  )
                }
              />

              <InputGestion
                label="Responsable"
                value={
                  cierre.responsableVerificacion
                }
                onChange={(valor) =>
                  setCierre(
                    (actual) => ({
                      ...actual,

                      responsableVerificacion:
                        valor,
                    })
                  )
                }
              />

              <InputGestion
                label="Método utilizado"
                value={
                  cierre.metodoVerificacion
                }
                onChange={(valor) =>
                  setCierre(
                    (actual) => ({
                      ...actual,

                      metodoVerificacion:
                        valor,
                    })
                  )
                }
              />

            </div>

            <AreaGestion
              label="Resultado obtenido"
              value={
                cierre.resultadoObtenido
              }
              onChange={(valor) =>
                setCierre(
                  (actual) => ({
                    ...actual,

                    resultadoObtenido:
                      valor,
                  })
                )
              }
            />

            <AreaGestion
              label="Comentarios de verificación"
              value={
                cierre.comentarioVerificacion
              }
              onChange={(valor) =>
                setCierre(
                  (actual) => ({
                    ...actual,

                    comentarioVerificacion:
                      valor,
                  })
                )
              }
            />

            <div className="my-6 border-t" />

            <InputGestion
              label="Resultado final"
              value={
                cierre.resultadoFinal
              }
              onChange={(valor) =>
                setCierre(
                  (actual) => ({
                    ...actual,

                    resultadoFinal:
                      valor,
                  })
                )
              }
            />

            <AreaGestion
              label="Comentarios de cierre"
              value={
                cierre.comentariosCierre
              }
              onChange={(valor) =>
                setCierre(
                  (actual) => ({
                    ...actual,

                    comentariosCierre:
                      valor,
                  })
                )
              }
            />

            <BotonGuardar
              guardando={
                guardando
              }
              onClick={
                guardarCierre
              }
              rojo={
                cierre.resultadoEficacia ===
                "Eficaz"
              }
            >
              {cierre.resultadoEficacia ===
              "Eficaz"
                ? "Cerrar reclamo"
                : "Guardar verificación"}
            </BotonGuardar>

          </section>

        )}

      </div>

    </div>
  );
}

/* =========================================================
   COMPONENTES
========================================================= */

function TabButton({
  activo,
  onClick,
  children,
}: {
  activo: boolean;

  onClick: () => void;

  children:
    React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-5 py-3 text-sm font-medium transition ${
        activo
          ? "bg-blue-600 text-white"
          : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

function TituloEtapa({
  titulo,
  descripcion,
}: {
  titulo: string;

  descripcion: string;
}) {
  return (
    <div className="mb-5">

      <h2 className="text-lg font-semibold text-blue-700">
        {titulo}
      </h2>

      <p className="mt-1 text-sm text-zinc-500">
        {descripcion}
      </p>

    </div>
  );
}

function Dato({
  titulo,
  valor,
}: {
  titulo: string;

  valor: string;
}) {
  return (
    <div className="rounded-xl border bg-zinc-50 p-4">

      <p className="text-xs text-zinc-500">
        {titulo}
      </p>

      <p className="mt-1 font-medium">
        {valor ||
          "Sin información"}
      </p>

    </div>
  );
}

function InputGestion({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;

  value: string;

  onChange:
    (value: string) => void;

  type?: string;
}) {
  return (
    <label>

      <span className="text-sm font-medium">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        className="mt-1 w-full rounded-lg border px-3 py-2"
      />

    </label>
  );
}

function AreaGestion({
  label,
  value,
  onChange,
}: {
  label: string;

  value: string;

  onChange:
    (value: string) => void;
}) {
  return (
    <label className="mt-4 block">

      <span className="text-sm font-medium">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        rows={3}
        className="mt-1 w-full rounded-lg border px-3 py-2"
      />

    </label>
  );
}

function BotonGuardar({
  guardando,
  onClick,
  children,
  rojo = false,
}: {
  guardando: boolean;

  onClick: () => void;

  children:
    React.ReactNode;

  rojo?: boolean;
}) {
  return (
    <div className="mt-6 flex justify-end">

      <button
        type="button"
        disabled={guardando}
        onClick={onClick}
        className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:bg-zinc-400 ${
          rojo
            ? "bg-red-600 hover:bg-red-700"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >

        {guardando
          ? "Guardando..."
          : children}

      </button>

    </div>
  );
}