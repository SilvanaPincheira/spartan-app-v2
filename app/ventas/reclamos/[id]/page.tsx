"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useParams } from "next/navigation";

import {
  createClientComponentClient,
} from "@supabase/auth-helpers-nextjs";

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

  evidencias: string[];

  creadoPor: string;
  fechaCreacion: string;

  actualizadoPor: string;
  fechaActualizacion: string;
}

interface Investigacion {
  responsableInvestigacion: string;
  areaResponsable: string;
  fechaAsignacion: string;

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

  cerradoPor: string;
  fechaCierre: string;
}

interface HistorialItem {
  fecha: string;
  usuario: string;
  etapa: string;
  accion: string;
  estadoAnterior: string;
  estadoNuevo: string;
  detalle: string;
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
   ESTADOS INICIALES
========================================================= */

const INVESTIGACION_INICIAL: Investigacion = {
  responsableInvestigacion: "",
  areaResponsable: "",
  fechaAsignacion: "",

  investigacionRealizada: "",

  revisionFabricacionLote: "",
  revisionMateriasPrimas: "",
  analisisMuestra: "",

  revisionLogistica: "",
  revisionAplicacionCliente: "",
  comparacionEspecificacion: "",

  conclusionAtribucion: "",
  causaDeterminada: "",
};

const CIERRE_INICIAL: Cierre = {
  resultadoEficacia: "",
  fechaVerificacion: "",
  responsableVerificacion: "",
  metodoVerificacion: "",
  resultadoObtenido: "",
  comentarioVerificacion: "",

  resultadoFinal: "",
  comentariosCierre: "",

  cerradoPor: "",
  fechaCierre: "",
};

/* =========================================================
   HELPERS
========================================================= */

function valor(
  objeto: Record<string, any>,
  ...campos: string[]
) {
  for (const campo of campos) {
    const dato = objeto?.[campo];

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

function separarPipe(dato: any) {
  if (!dato) return [];

  if (Array.isArray(dato)) {
    return dato
      .map((x) => String(x).trim())
      .filter(Boolean);
  }

  return String(dato)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function nuevoId(prefijo: string) {
  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {
    return `${prefijo}-${crypto.randomUUID()}`;
  }

  return `${prefijo}-${Date.now()}-${Math.random()}`;
}

function fechaHoy() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

/*
 * Para inputs type=date.
 *
 * Apps Script / Sheets puede devolver:
 * 2026-09-26T03:00:00.000Z
 *
 * El input date necesita:
 * 2026-09-26
 */
function fechaInput(valorFecha: any) {
  if (!valorFecha) return "";

  const texto = String(valorFecha);

  const match =
    texto.match(
      /^(\d{4}-\d{2}-\d{2})/
    );

  if (match) {
    return match[1];
  }

  return texto;
}

/* =========================================================
   PAGE
========================================================= */

export default function ReclamoDetallePage() {
  const params = useParams();

  const id =
    String(
      params?.id || ""
    );

  const supabase =
    createClientComponentClient();

  /* =======================================================
     ESTADOS GENERALES
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    mensaje,
    setMensaje,
  ] = useState("");

  const [
    tab,
    setTab,
  ] = useState<Tab>(
    "ingreso"
  );

  const [
    userEmail,
    setUserEmail,
  ] = useState("");

  /* =======================================================
     DATOS
  ======================================================= */

  const [
    reclamo,
    setReclamo,
  ] =
    useState<Reclamo | null>(
      null
    );

  const [
    investigacion,
    setInvestigacion,
  ] =
    useState<Investigacion>({
      ...INVESTIGACION_INICIAL,
    });

  const [
    acciones,
    setAcciones,
  ] =
    useState<
      AccionCorrectiva[]
    >([]);

  const [
    seguimientos,
    setSeguimientos,
  ] =
    useState<
      Seguimiento[]
    >([]);

  const [
    cierre,
    setCierre,
  ] =
    useState<Cierre>({
      ...CIERRE_INICIAL,
    });

  const [
    historial,
    setHistorial,
  ] =
    useState<
      HistorialItem[]
    >([]);

  /* =======================================================
     DERIVADOS
  ======================================================= */

  const cerrado =
    reclamo?.estado ===
    "Cerrado";

  const mostrarTecnicos =
    useMemo(
      () =>
        Boolean(
          reclamo?.aplicacion ||
          reclamo?.proceso ||
          reclamo?.dilucion ||
          reclamo?.dosis ||
          reclamo?.temperatura ||
          reclamo?.tiempoAccion ||
          reclamo?.superficie ||
          reclamo?.equipoDosificacion ||
          reclamo?.productoAnterior ||
          reclamo?.cambioProcedimiento
        ),
      [reclamo]
    );

  /* =======================================================
     USUARIO LOGUEADO
  ======================================================= */

  useEffect(() => {
    async function cargarUsuario() {
      try {
        const { data } =
          await supabase.auth.getUser();

        setUserEmail(
          data?.user?.email ||
          ""
        );
      } catch (err) {
        console.error(
          "Error obteniendo usuario:",
          err
        );
      }
    }

    cargarUsuario();
  }, []);

  /* =======================================================
     CARGAR GESTIÓN COMPLETA
  ======================================================= */

  async function cargarGestion(
    mostrarLoading = true
  ) {
    if (!id) return;

    try {
      if (mostrarLoading) {
        setLoading(true);
      }

      setError("");

      const response =
        await fetch(
          `/api/reclamo-gestion?id=${encodeURIComponent(
            id
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      console.log(
        "📥 Gestión reclamo:",
        data
      );

      if (
        !response.ok ||
        data.success === false
      ) {
        throw new Error(
          data.error ||
          "No se pudo cargar el reclamo."
        );
      }

      const raw =
        data.reclamo || {};

      /* ===============================================
         RECLAMO PRINCIPAL
      =============================================== */

      const numeroReclamo =
        valor(
          raw,
          "N° Reclamo"
        ) || id;

      setReclamo({
        id:
          valor(
            raw,
            "ID"
          ) || id,

        numeroReclamo,

        fechaIngreso:
          valor(
            raw,
            "Fecha envío"
          ),

        estado:
          valor(
            raw,
            "Estado"
          ) ||
          "Ingresado",

        ejecutivo:
          valor(
            raw,
            "Ejecutivo de ventas"
          ),

        ejecutivoEmail:
          valor(
            raw,
            "Correo Ejecutivo"
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

        contactoCliente:
          valor(
            raw,
            "Contacto cliente"
          ),

        correoContacto:
          valor(
            raw,
            "Correo de contacto"
          ),

        producto:
          valor(
            raw,
            "Producto"
          ),

        presentacion:
          valor(
            raw,
            "Presentación"
          ),

        cantidadAfectada:
          valor(
            raw,
            "Cantidad afectada"
          ),

        unidadCantidad:
          valor(
            raw,
            "Unidad"
          ),

        lote:
          valor(
            raw,
            "Lote"
          ),

        fechaElaboracion:
          valor(
            raw,
            "Fecha elaboración"
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

        descripcion:
          valor(
            raw,
            "DESCRIPCIÓN DEL PROBLEMA"
          ),

        accionesInmediatas:
          separarPipe(
            raw[
              "Acciones inmediatas"
            ]
          ),

        accionInmediataDetalle:
          valor(
            raw,
            "Detalle acción inmediata"
          ),

        aplicacion:
          valor(
            raw,
            "Aplicación"
          ),

        proceso:
          valor(
            raw,
            "Proceso"
          ),

        dilucion:
          valor(
            raw,
            "Dilución"
          ),

        dosis:
          valor(
            raw,
            "Dosis de uso"
          ),

        temperatura:
          valor(
            raw,
            "Temperatura de solución"
          ),

        tiempoAccion:
          valor(
            raw,
            "Tiempo de acción"
          ),

        superficie:
          valor(
            raw,
            "Superficie en dónde se aplica"
          ),

        equipoDosificacion:
          valor(
            raw,
            "Equipo dosificación"
          ),

        productoAnterior:
          valor(
            raw,
            "Producto anterior"
          ),

        cambioProcedimiento:
          valor(
            raw,
            "Cambio procedimiento"
          ),

        cambioProcedimientoDetalle:
          valor(
            raw,
            "Detalle cambio procedimiento"
          ),

        evidencias:
          separarPipe(
            raw["Evidencias"]
          ),

        creadoPor:
          valor(
            raw,
            "Creado por"
          ),

        fechaCreacion:
          valor(
            raw,
            "Fecha creación"
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
      });

      /* ===============================================
         INVESTIGACIÓN
      =============================================== */

      const inv =
        data.investigacion ||
        {};

      setInvestigacion({
        responsableInvestigacion:
          valor(
            inv,
            "responsableInvestigacion"
          ),

        areaResponsable:
          valor(
            inv,
            "areaResponsable"
          ),

        fechaAsignacion:
          valor(
            inv,
            "fechaAsignacion"
          ),

        investigacionRealizada:
          valor(
            inv,
            "investigacionRealizada"
          ),

        revisionFabricacionLote:
          valor(
            inv,
            "revisionFabricacionLote"
          ),

        revisionMateriasPrimas:
          valor(
            inv,
            "revisionMateriasPrimas"
          ),

        analisisMuestra:
          valor(
            inv,
            "analisisMuestra"
          ),

        revisionLogistica:
          valor(
            inv,
            "revisionLogistica"
          ),

        revisionAplicacionCliente:
          valor(
            inv,
            "revisionAplicacionCliente"
          ),

        comparacionEspecificacion:
          valor(
            inv,
            "comparacionEspecificacion"
          ),

        conclusionAtribucion:
          valor(
            inv,
            "conclusionAtribucion"
          ),

        causaDeterminada:
          valor(
            inv,
            "causaDeterminada"
          ),
      });

      /* ===============================================
         ACCIONES
      =============================================== */

      setAcciones(
        Array.isArray(
          data.acciones
        )
          ? data.acciones.map(
              (
                accion:
                  any
              ) => ({
                id:
                  String(
                    accion.id ||
                    nuevoId("ACC")
                  ),

                accionCorrectiva:
                  String(
                    accion.accionCorrectiva ||
                    ""
                  ),

                responsable:
                  String(
                    accion.responsable ||
                    ""
                  ),

                areaResponsable:
                  String(
                    accion.areaResponsable ||
                    ""
                  ),

                fechaAsignacion:
                  fechaInput(
                    accion.fechaAsignacion
                  ),

                fechaCompromiso:
                  fechaInput(
                    accion.fechaCompromiso
                  ),

                fechaEjecucion:
                  fechaInput(
                    accion.fechaEjecucion
                  ),

                estado:
                  String(
                    accion.estado ||
                    "Pendiente"
                  ),

                observaciones:
                  String(
                    accion.observaciones ||
                    ""
                  ),
              })
            )
          : []
      );

      /* ===============================================
         SEGUIMIENTOS
      =============================================== */

      setSeguimientos(
        Array.isArray(
          data.seguimientos
        )
          ? data.seguimientos.map(
              (
                seguimiento:
                  any
              ) => ({
                id:
                  String(
                    seguimiento.id ||
                    nuevoId("SEG")
                  ),

                fechaSeguimiento:
                  fechaInput(
                    seguimiento.fechaSeguimiento
                  ),

                responsable:
                  String(
                    seguimiento.responsable ||
                    ""
                  ),

                resultado:
                  String(
                    seguimiento.resultado ||
                    ""
                  ),

                comentarios:
                  String(
                    seguimiento.comentarios ||
                    ""
                  ),
              })
            )
          : []
      );

      /* ===============================================
         CIERRE
      =============================================== */

      const datosCierre =
        data.cierre ||
        {};

      setCierre({
        resultadoEficacia:
          valor(
            datosCierre,
            "resultadoEficacia"
          ),

        fechaVerificacion:
          fechaInput(
            valor(
              datosCierre,
              "fechaVerificacion"
            )
          ),

        responsableVerificacion:
          valor(
            datosCierre,
            "responsableVerificacion"
          ),

        metodoVerificacion:
          valor(
            datosCierre,
            "metodoVerificacion"
          ),

        resultadoObtenido:
          valor(
            datosCierre,
            "resultadoObtenido"
          ),

        comentarioVerificacion:
          valor(
            datosCierre,
            "comentarioVerificacion"
          ),

        resultadoFinal:
          valor(
            datosCierre,
            "resultadoFinal"
          ),

        comentariosCierre:
          valor(
            datosCierre,
            "comentariosCierre"
          ),

        cerradoPor:
          valor(
            datosCierre,
            "cerradoPor"
          ),

        fechaCierre:
          valor(
            datosCierre,
            "fechaCierre"
          ),
      });

      /* ===============================================
         HISTORIAL
      =============================================== */

      setHistorial(
        Array.isArray(
          data.historial
        )
          ? data.historial
          : []
      );

    } catch (err) {
      console.error(
        "❌ Error cargando reclamo:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el reclamo."
      );

      setReclamo(null);

    } finally {
      if (mostrarLoading) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    cargarGestion();
  }, [id]);

  /* =======================================================
     GUARDAR GESTIÓN
  ======================================================= */

  async function guardarGestion(
    etapa: string,
    datos: any,
    estado?: string
  ) {
    if (!reclamo) {
      return false;
    }

    if (
      reclamo.estado ===
      "Cerrado"
    ) {
      alert(
        "Este reclamo está cerrado y no puede modificarse."
      );

      return false;
    }

    try {
      setGuardando(true);
      setMensaje("");
      setError("");

      const response =
        await fetch(
          "/api/reclamo-gestion",
          {
            method: "POST",

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
        await response.json();

      if (
        !response.ok ||
        resultado.success === false
      ) {
        throw new Error(
          resultado.error ||
          "No se pudo guardar la gestión."
        );
      }

      setMensaje(
        "Cambios guardados correctamente."
      );

      /*
       * Volver a consultar al backend
       * para dejar la pantalla sincronizada
       * con Sheets.
       */
      await cargarGestion(false);

      return true;

    } catch (err) {
      console.error(
        "❌ Error guardando gestión:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
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
      !investigacion.responsableInvestigacion.trim()
    ) {
      alert(
        "Indica el responsable de investigación."
      );

      return;
    }

    if (
      !investigacion.areaResponsable.trim()
    ) {
      alert(
        "Indica el área responsable."
      );

      return;
    }

    if (
      !investigacion.conclusionAtribucion.trim()
    ) {
      alert(
        "Selecciona la conclusión / atribución del reclamo."
      );

      return;
    }

    if (
      !investigacion.causaDeterminada.trim()
    ) {
      alert(
        "Debes ingresar la causa determinada."
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
            fechaHoy(),

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
    dato: string
  ) {
    setAcciones(
      (actual) =>
        actual.map(
          (accion, i) =>
            i === index
              ? {
                  ...accion,
                  [campo]:
                    dato,
                }
              : accion
        )
    );
  }

  function eliminarAccion(
    index: number
  ) {
    const confirmar =
      window.confirm(
        "¿Eliminar esta acción?"
      );

    if (!confirmar) return;

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
          !accion.accionCorrectiva.trim() ||
          !accion.responsable.trim() ||
          !accion.fechaCompromiso
      );

    if (incompleta) {
      alert(
        "Todas las acciones deben tener acción correctiva, responsable y fecha compromiso."
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
      setTab(
        "seguimiento"
      );
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
            fechaHoy(),

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
    dato: string
  ) {
    setSeguimientos(
      (actual) =>
        actual.map(
          (
            seguimiento,
            i
          ) =>
            i === index
              ? {
                  ...seguimiento,
                  [campo]:
                    dato,
                }
              : seguimiento
        )
    );
  }

  function eliminarSeguimiento(
    index: number
  ) {
    const confirmar =
      window.confirm(
        "¿Eliminar este seguimiento?"
      );

    if (!confirmar) return;

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
        "Debes registrar al menos un seguimiento."
      );

      return;
    }

    const incompleto =
      seguimientos.some(
        (seguimiento) =>
          !seguimiento.fechaSeguimiento ||
          !seguimiento.responsable.trim() ||
          !seguimiento.resultado.trim()
      );

    if (incompleto) {
      alert(
        "Cada seguimiento debe tener fecha, responsable y resultado."
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
     CIERRE / VERIFICACIÓN
  ======================================================= */

  async function guardarCierre() {
    if (
      !cierre.resultadoEficacia
    ) {
      alert(
        "Selecciona el resultado de la verificación de eficacia."
      );

      return;
    }

    if (
      !cierre.fechaVerificacion
    ) {
      alert(
        "Ingresa la fecha de verificación."
      );

      return;
    }

    if (
      !cierre.responsableVerificacion.trim()
    ) {
      alert(
        "Ingresa el responsable de la verificación."
      );

      return;
    }

    if (
      !cierre.metodoVerificacion.trim()
    ) {
      alert(
        "Indica el método utilizado para verificar."
      );

      return;
    }

    if (
      !cierre.resultadoObtenido.trim()
    ) {
      alert(
        "Ingresa el resultado obtenido."
      );

      return;
    }

    /* ===============================================
       PENDIENTE
    =============================================== */

    if (
      cierre.resultadoEficacia ===
      "Pendiente"
    ) {
      await guardarGestion(
        "Verificación de eficacia",
        cierre,
        "Pendiente de verificación de eficacia"
      );

      return;
    }

    /* ===============================================
       NO EFICAZ
    =============================================== */

    if (
      cierre.resultadoEficacia ===
      "No eficaz"
    ) {
      const ok =
        await guardarGestion(
          "Verificación de eficacia",
          cierre,
          "En seguimiento"
        );

      if (ok) {
        alert(
          "La verificación resultó No eficaz. El reclamo permanecerá abierto y deberán definirse nuevas acciones."
        );

        setTab(
          "acciones"
        );
      }

      return;
    }

    /* ===============================================
       EFICAZ → CIERRE
    =============================================== */

    if (
      cierre.resultadoEficacia ===
      "Eficaz"
    ) {
      if (
        !cierre.resultadoFinal.trim()
      ) {
        alert(
          "Ingresa el resultado final."
        );

        return;
      }

      if (
        !cierre.comentariosCierre.trim()
      ) {
        alert(
          "Ingresa los comentarios de cierre."
        );

        return;
      }

      const confirmar =
        window.confirm(
          "¿Confirma el cierre definitivo de este reclamo?"
        );

      if (!confirmar) return;

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
  }

  /* =======================================================
     LOADING / ERROR
  ======================================================= */

  if (loading) {
    return (
      <div className="p-8 text-zinc-500">
        Cargando reclamo...
      </div>
    );
  }

  if (
    error &&
    !reclamo
  ) {
    return (
      <div className="p-8">

        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>

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

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-zinc-50 p-4 text-zinc-900 md:p-6">

      <div className="mx-auto max-w-7xl space-y-5">

        {/* =================================================
            HEADER
        ================================================= */}

        <section className="rounded-2xl border bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

            <div>

              <p className="text-sm font-semibold text-blue-600">
                Gestión de Reclamos
              </p>

              <h1 className="mt-1 text-2xl font-bold">
                {reclamo.numeroReclamo}
              </h1>

              <p className="mt-2 text-sm text-zinc-500">
                {reclamo.cliente}
                {" · "}
                {reclamo.producto}
              </p>

              {reclamo.fechaIngreso && (

                <p className="mt-1 text-xs text-zinc-400">
                  Ingresado:{" "}
                  {reclamo.fechaIngreso}
                </p>

              )}

            </div>

            <div className="flex flex-wrap items-center gap-3">

              <EstadoBadge
                estado={
                  reclamo.estado
                }
              />

              <button
                type="button"
                onClick={() =>
                  cargarGestion()
                }
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Actualizar
              </button>

            </div>

          </div>

        </section>

        {/* =================================================
            CERRADO
        ================================================= */}

        {cerrado && (

          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">

            Este reclamo se encuentra cerrado.

            {cierre.fechaCierre && (
              <>
                {" "}
                Fecha de cierre:{" "}
                <strong>
                  {
                    cierre.fechaCierre
                  }
                </strong>.
              </>
            )}

            {cierre.cerradoPor && (
              <>
                {" "}
                Cerrado por{" "}
                <strong>
                  {
                    cierre.cerradoPor
                  }
                </strong>.
              </>
            )}

          </div>

        )}

        {/* =================================================
            MENSAJES
        ================================================= */}

        {mensaje && (

          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {mensaje}
          </div>

        )}

        {error && reclamo && (

          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>

        )}

        {/* =================================================
            PESTAÑAS
        ================================================= */}

        <div className="overflow-x-auto rounded-2xl border bg-white p-2 shadow-sm">

          <div className="flex min-w-max gap-2">

            <TabButton
              activo={
                tab ===
                "ingreso"
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
                tab ===
                "cierre"
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
            1. INGRESO
        ================================================= */}

        {tab === "ingreso" && (

          <section className="rounded-2xl border bg-white p-6 shadow-sm">

            <TituloEtapa
              titulo="Antecedentes del reclamo"
              descripcion="Información registrada originalmente por el ejecutivo comercial."
            />

            <Subtitulo>
              Cliente
            </Subtitulo>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

              <Dato
                titulo="Ejecutivo"
                valor={
                  reclamo.ejecutivo
                }
              />

              <Dato
                titulo="Correo ejecutivo"
                valor={
                  reclamo.ejecutivoEmail
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
                valor={
                  reclamo.rut
                }
              />

              <Dato
                titulo="Contacto"
                valor={
                  reclamo.contactoCliente
                }
              />

              <Dato
                titulo="Correo contacto"
                valor={
                  reclamo.correoContacto
                }
              />

            </div>

            <Subtitulo>
              Producto afectado
            </Subtitulo>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

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
                valor={
                  `${reclamo.cantidadAfectada || ""} ${reclamo.unidadCantidad || ""}`.trim()
                }
              />

              <Dato
                titulo="Lote"
                valor={
                  reclamo.lote
                }
              />

              <Dato
                titulo="Fecha elaboración"
                valor={
                  reclamo.fechaElaboracion
                }
              />

            </div>

            <Subtitulo>
              Clasificación
            </Subtitulo>

            <div className="grid gap-4 md:grid-cols-2">

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

            <div className="mt-4 rounded-xl border bg-zinc-50 p-4">

              <p className="text-xs font-medium text-zinc-500">
                Descripción del reclamo
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm">
                {reclamo.descripcion ||
                  "Sin información"}
              </p>

            </div>

            <Subtitulo>
              Acciones inmediatas
            </Subtitulo>

            <div className="rounded-xl border bg-zinc-50 p-4">

              {reclamo
                .accionesInmediatas
                .length ? (

                <div className="flex flex-wrap gap-2">

                  {reclamo
                    .accionesInmediatas
                    .map(
                      (accion) => (

                        <span
                          key={accion}
                          className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700"
                        >
                          {accion}
                        </span>

                      )
                    )}

                </div>

              ) : (

                <p className="text-sm text-zinc-500">
                  Sin acciones inmediatas registradas.
                </p>

              )}

              {reclamo
                .accionInmediataDetalle && (

                <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">
                  {
                    reclamo
                      .accionInmediataDetalle
                  }
                </p>

              )}

            </div>

            {mostrarTecnicos && (
              <>
                <Subtitulo>
                  Antecedentes técnicos
                </Subtitulo>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

                  <Dato
                    titulo="Aplicación"
                    valor={
                      reclamo.aplicacion
                    }
                  />

                  <Dato
                    titulo="Proceso"
                    valor={
                      reclamo.proceso
                    }
                  />

                  <Dato
                    titulo="Dilución"
                    valor={
                      reclamo.dilucion
                    }
                  />

                  <Dato
                    titulo="Dosificación"
                    valor={
                      reclamo.dosis
                    }
                  />

                  <Dato
                    titulo="Temperatura"
                    valor={
                      reclamo.temperatura
                    }
                  />

                  <Dato
                    titulo="Tiempo de contacto"
                    valor={
                      reclamo.tiempoAccion
                    }
                  />

                  <Dato
                    titulo="Superficie"
                    valor={
                      reclamo.superficie
                    }
                  />

                  <Dato
                    titulo="Equipo dosificación"
                    valor={
                      reclamo.equipoDosificacion
                    }
                  />

                  <Dato
                    titulo="Producto anterior"
                    valor={
                      reclamo.productoAnterior
                    }
                  />

                  <Dato
                    titulo="Cambio procedimiento"
                    valor={
                      reclamo.cambioProcedimiento
                    }
                  />

                </div>

                {reclamo
                  .cambioProcedimientoDetalle && (

                  <div className="mt-4 rounded-xl border bg-zinc-50 p-4 text-sm">

                    <strong>
                      Detalle cambio:
                    </strong>{" "}

                    {
                      reclamo
                        .cambioProcedimientoDetalle
                    }

                  </div>

                )}

              </>
            )}

            <Subtitulo>
              Evidencias
            </Subtitulo>

            {reclamo
              .evidencias
              .length ? (

              <div className="rounded-xl border bg-zinc-50 p-4">

                {reclamo
                  .evidencias
                  .map(
                    (archivo) => (

                      <p
                        key={
                          archivo
                        }
                        className="text-sm"
                      >
                        • {archivo}
                      </p>

                    )
                  )}

              </div>

            ) : (

              <p className="text-sm text-zinc-500">
                No se registraron evidencias.
              </p>

            )}

          </section>

        )}

        {/* =================================================
            2. INVESTIGACIÓN
        ================================================= */}

        {tab ===
          "investigacion" && (

          <section className="rounded-2xl border bg-white p-6 shadow-sm">

            <TituloEtapa
              titulo="Investigación / análisis de causa"
              descripcion="Registro del análisis realizado por el área responsable."
            />

            <div className="grid gap-4 md:grid-cols-2">

              <InputGestion
                label="Responsable de investigación *"
                value={
                  investigacion.responsableInvestigacion
                }
                disabled={
                  cerrado
                }
                onChange={(dato) =>
                  setInvestigacion(
                    (actual) => ({
                      ...actual,

                      responsableInvestigacion:
                        dato,
                    })
                  )
                }
              />

              <InputGestion
                label="Área responsable *"
                value={
                  investigacion.areaResponsable
                }
                disabled={
                  cerrado
                }
                onChange={(dato) =>
                  setInvestigacion(
                    (actual) => ({
                      ...actual,

                      areaResponsable:
                        dato,
                    })
                  )
                }
              />

            </div>

            {investigacion
              .fechaAsignacion && (

              <div className="mt-4 max-w-sm">

                <Dato
                  titulo="Fecha de asignación"
                  valor={
                    investigacion.fechaAsignacion
                  }
                />

              </div>

            )}

            <AreaGestion
              label="Investigación realizada"
              value={
                investigacion.investigacionRealizada
              }
              disabled={
                cerrado
              }
              onChange={(dato) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    investigacionRealizada:
                      dato,
                  })
                )
              }
            />

            <AreaGestion
              label="Revisión de fabricación / lote"
              value={
                investigacion.revisionFabricacionLote
              }
              disabled={
                cerrado
              }
              onChange={(dato) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    revisionFabricacionLote:
                      dato,
                  })
                )
              }
            />

            <AreaGestion
              label="Revisión de materias primas y controles de calidad"
              value={
                investigacion.revisionMateriasPrimas
              }
              disabled={
                cerrado
              }
              onChange={(dato) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    revisionMateriasPrimas:
                      dato,
                  })
                )
              }
            />

            <AreaGestion
              label="Análisis de muestra"
              value={
                investigacion.analisisMuestra
              }
              disabled={
                cerrado
              }
              onChange={(dato) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    analisisMuestra:
                      dato,
                  })
                )
              }
            />

            <AreaGestion
              label="Revisión logística / documental"
              value={
                investigacion.revisionLogistica
              }
              disabled={
                cerrado
              }
              onChange={(dato) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    revisionLogistica:
                      dato,
                  })
                )
              }
            />

            <AreaGestion
              label="Revisión de aplicación en cliente"
              value={
                investigacion.revisionAplicacionCliente
              }
              disabled={
                cerrado
              }
              onChange={(dato) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    revisionAplicacionCliente:
                      dato,
                  })
                )
              }
            />

            <AreaGestion
              label="Comparación contra especificación"
              value={
                investigacion.comparacionEspecificacion
              }
              disabled={
                cerrado
              }
              onChange={(dato) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    comparacionEspecificacion:
                      dato,
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
                disabled={
                  cerrado
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
                className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-zinc-100"
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
              disabled={
                cerrado
              }
              onChange={(dato) =>
                setInvestigacion(
                  (actual) => ({
                    ...actual,

                    causaDeterminada:
                      dato,
                  })
                )
              }
            />

            {!cerrado && (

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

            )}

          </section>

        )}

        {/* =================================================
            3. ACCIONES
        ================================================= */}

        {tab === "acciones" && (

          <section className="rounded-2xl border bg-white p-6 shadow-sm">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <TituloEtapa
                titulo="Acciones correctivas"
                descripcion="Cada acción debe contar con responsable, fecha compromiso y estado."
              />

              {!cerrado && (

                <button
                  type="button"
                  onClick={
                    agregarAccion
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  + Nueva acción
                </button>

              )}

            </div>

            {!acciones.length && (

              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-zinc-500">
                No hay acciones correctivas registradas.
              </div>

            )}

            <div className="space-y-4">

              {acciones.map(
                (
                  accion,
                  index
                ) => (

                  <div
                    key={
                      accion.id ||
                      index
                    }
                    className="rounded-xl border bg-zinc-50 p-4"
                  >

                    <div className="mb-4 flex items-center justify-between">

                      <h3 className="font-semibold">
                        Acción{" "}
                        {index + 1}
                      </h3>

                      {!cerrado && (

                        <button
                          type="button"
                          onClick={() =>
                            eliminarAccion(
                              index
                            )
                          }
                          className="text-sm font-medium text-red-600"
                        >
                          Eliminar
                        </button>

                      )}

                    </div>

                    <div className="grid gap-4 md:grid-cols-2">

                      <InputGestion
                        label="Acción correctiva *"
                        value={
                          accion.accionCorrectiva
                        }
                        disabled={
                          cerrado
                        }
                        onChange={(dato) =>
                          actualizarAccion(
                            index,
                            "accionCorrectiva",
                            dato
                          )
                        }
                      />

                      <InputGestion
                        label="Responsable *"
                        value={
                          accion.responsable
                        }
                        disabled={
                          cerrado
                        }
                        onChange={(dato) =>
                          actualizarAccion(
                            index,
                            "responsable",
                            dato
                          )
                        }
                      />

                      <InputGestion
                        label="Área responsable"
                        value={
                          accion.areaResponsable
                        }
                        disabled={
                          cerrado
                        }
                        onChange={(dato) =>
                          actualizarAccion(
                            index,
                            "areaResponsable",
                            dato
                          )
                        }
                      />

                      <InputGestion
                        label="Fecha asignación"
                        value={
                          accion.fechaAsignacion
                        }
                        type="date"
                        disabled={
                          cerrado
                        }
                        onChange={(dato) =>
                          actualizarAccion(
                            index,
                            "fechaAsignacion",
                            dato
                          )
                        }
                      />

                      <InputGestion
                        label="Fecha compromiso *"
                        value={
                          accion.fechaCompromiso
                        }
                        type="date"
                        disabled={
                          cerrado
                        }
                        onChange={(dato) =>
                          actualizarAccion(
                            index,
                            "fechaCompromiso",
                            dato
                          )
                        }
                      />

                      <InputGestion
                        label="Fecha ejecución"
                        value={
                          accion.fechaEjecucion
                        }
                        type="date"
                        disabled={
                          cerrado
                        }
                        onChange={(dato) =>
                          actualizarAccion(
                            index,
                            "fechaEjecucion",
                            dato
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
                          disabled={
                            cerrado
                          }
                          onChange={(e) =>
                            actualizarAccion(
                              index,
                              "estado",
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-zinc-100"
                        >

                          {ESTADOS_ACCION.map(
                            (estado) => (

                              <option
                                key={
                                  estado
                                }
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
                      disabled={
                        cerrado
                      }
                      onChange={(dato) =>
                        actualizarAccion(
                          index,
                          "observaciones",
                          dato
                        )
                      }
                    />

                  </div>

                )
              )}

            </div>

            {!cerrado &&
              acciones.length >
                0 && (

              <BotonGuardar
                guardando={
                  guardando
                }
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
            4. SEGUIMIENTO
        ================================================= */}

        {tab ===
          "seguimiento" && (

          <section className="rounded-2xl border bg-white p-6 shadow-sm">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <TituloEtapa
                titulo="Seguimiento"
                descripcion="El reclamo puede contener múltiples seguimientos."
              />

              {!cerrado && (

                <button
                  type="button"
                  onClick={
                    agregarSeguimiento
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  + Nuevo seguimiento
                </button>

              )}

            </div>

            {!seguimientos.length && (

              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-zinc-500">
                No hay seguimientos registrados.
              </div>

            )}

            <div className="space-y-4">

              {seguimientos.map(
                (
                  seguimiento,
                  index
                ) => (

                  <div
                    key={
                      seguimiento.id ||
                      index
                    }
                    className="rounded-xl border bg-zinc-50 p-4"
                  >

                    <div className="mb-4 flex justify-between">

                      <h3 className="font-semibold">
                        Seguimiento{" "}
                        {index + 1}
                      </h3>

                      {!cerrado && (

                        <button
                          type="button"
                          onClick={() =>
                            eliminarSeguimiento(
                              index
                            )
                          }
                          className="text-sm font-medium text-red-600"
                        >
                          Eliminar
                        </button>

                      )}

                    </div>

                    <div className="grid gap-4 md:grid-cols-2">

                      <InputGestion
                        label="Fecha de seguimiento *"
                        type="date"
                        value={
                          seguimiento.fechaSeguimiento
                        }
                        disabled={
                          cerrado
                        }
                        onChange={(dato) =>
                          actualizarSeguimiento(
                            index,
                            "fechaSeguimiento",
                            dato
                          )
                        }
                      />

                      <InputGestion
                        label="Responsable *"
                        value={
                          seguimiento.responsable
                        }
                        disabled={
                          cerrado
                        }
                        onChange={(dato) =>
                          actualizarSeguimiento(
                            index,
                            "responsable",
                            dato
                          )
                        }
                      />

                    </div>

                    <AreaGestion
                      label="Resultado del seguimiento *"
                      value={
                        seguimiento.resultado
                      }
                      disabled={
                        cerrado
                      }
                      onChange={(dato) =>
                        actualizarSeguimiento(
                          index,
                          "resultado",
                          dato
                        )
                      }
                    />

                    <AreaGestion
                      label="Comentarios"
                      value={
                        seguimiento.comentarios
                      }
                      disabled={
                        cerrado
                      }
                      onChange={(dato) =>
                        actualizarSeguimiento(
                          index,
                          "comentarios",
                          dato
                        )
                      }
                    />

                  </div>

                )
              )}

            </div>

            {!cerrado &&
              seguimientos.length >
                0 && (

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
            5. CIERRE
        ================================================= */}

        {tab === "cierre" && (

          <section className="rounded-2xl border bg-white p-6 shadow-sm">

            <TituloEtapa
              titulo="Verificación de eficacia y cierre"
              descripcion="Si la acción no es eficaz, el reclamo permanece abierto y debe permitir nuevas acciones."
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
                  disabled={
                    cerrado
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
                  className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-zinc-100"
                >

                  <option value="">
                    Seleccione...
                  </option>

                  <option value="Pendiente">
                    Pendiente
                  </option>

                  <option value="Eficaz">
                    Eficaz
                  </option>

                  <option value="No eficaz">
                    No eficaz
                  </option>

                </select>

              </label>

              <InputGestion
                label="Fecha de verificación *"
                type="date"
                value={
                  cierre.fechaVerificacion
                }
                disabled={
                  cerrado
                }
                onChange={(dato) =>
                  setCierre(
                    (actual) => ({
                      ...actual,

                      fechaVerificacion:
                        dato,
                    })
                  )
                }
              />

              <InputGestion
                label="Responsable *"
                value={
                  cierre.responsableVerificacion
                }
                disabled={
                  cerrado
                }
                onChange={(dato) =>
                  setCierre(
                    (actual) => ({
                      ...actual,

                      responsableVerificacion:
                        dato,
                    })
                  )
                }
              />

              <InputGestion
                label="Método utilizado para verificar *"
                value={
                  cierre.metodoVerificacion
                }
                disabled={
                  cerrado
                }
                onChange={(dato) =>
                  setCierre(
                    (actual) => ({
                      ...actual,

                      metodoVerificacion:
                        dato,
                    })
                  )
                }
              />

            </div>

            <AreaGestion
              label="Resultado obtenido *"
              value={
                cierre.resultadoObtenido
              }
              disabled={
                cerrado
              }
              onChange={(dato) =>
                setCierre(
                  (actual) => ({
                    ...actual,

                    resultadoObtenido:
                      dato,
                  })
                )
              }
            />

            <AreaGestion
              label="Comentarios de verificación"
              value={
                cierre.comentarioVerificacion
              }
              disabled={
                cerrado
              }
              onChange={(dato) =>
                setCierre(
                  (actual) => ({
                    ...actual,

                    comentarioVerificacion:
                      dato,
                  })
                )
              }
            />

            <div className="my-6 border-t" />

            <h3 className="font-semibold">
              Cierre del reclamo
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Estos campos son obligatorios cuando la verificación sea Eficaz.
            </p>

            <div className="mt-4">

              <InputGestion
                label="Resultado final"
                value={
                  cierre.resultadoFinal
                }
                disabled={
                  cerrado
                }
                onChange={(dato) =>
                  setCierre(
                    (actual) => ({
                      ...actual,

                      resultadoFinal:
                        dato,
                    })
                  )
                }
              />

            </div>

            <AreaGestion
              label="Comentarios de cierre"
              value={
                cierre.comentariosCierre
              }
              disabled={
                cerrado
              }
              onChange={(dato) =>
                setCierre(
                  (actual) => ({
                    ...actual,

                    comentariosCierre:
                      dato,
                  })
                )
              }
            />

            {cerrado && (

              <div className="mt-5 grid gap-4 md:grid-cols-2">

                <Dato
                  titulo="Cerrado por"
                  valor={
                    cierre.cerradoPor
                  }
                />

                <Dato
                  titulo="Fecha cierre"
                  valor={
                    cierre.fechaCierre
                  }
                />

              </div>

            )}

            {!cerrado && (

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

            )}

          </section>

        )}

        {/* =================================================
            HISTORIAL
        ================================================= */}

        <section className="rounded-2xl border bg-white p-6 shadow-sm">

          <div className="mb-4">

            <h2 className="text-lg font-semibold">
              Historial de trazabilidad
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Registro de los principales movimientos realizados sobre el reclamo.
            </p>

          </div>

          {!historial.length ? (

            <p className="text-sm text-zinc-500">
              Aún no existen movimientos registrados.
            </p>

          ) : (

            <div className="space-y-3">

              {historial
                .slice()
                .reverse()
                .map(
                  (
                    item,
                    index
                  ) => (

                    <div
                      key={`${item.fecha}-${index}`}
                      className="rounded-xl border bg-zinc-50 p-4"
                    >

                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">

                        <div>

                          <p className="text-sm font-semibold">
                            {item.accion ||
                              item.etapa}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            {item.usuario ||
                              "Usuario no informado"}
                          </p>

                        </div>

                        <span className="text-xs text-zinc-500">
                          {item.fecha}
                        </span>

                      </div>

                      {item.estadoNuevo && (

                        <div className="mt-3 text-sm">

                          <span className="text-zinc-500">
                            Estado:
                          </span>{" "}

                          {item.estadoAnterior &&
                          item.estadoAnterior !==
                            item.estadoNuevo ? (
                            <>
                              {
                                item.estadoAnterior
                              }
                              {" → "}

                              <strong>
                                {
                                  item.estadoNuevo
                                }
                              </strong>
                            </>
                          ) : (
                            <strong>
                              {
                                item.estadoNuevo
                              }
                            </strong>
                          )}

                        </div>

                      )}

                    </div>

                  )
                )}

            </div>

          )}

        </section>

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
  children: React.ReactNode;
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

function Subtitulo({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h3 className="mb-3 mt-6 border-b pb-2 text-sm font-semibold text-zinc-700">
      {children}
    </h3>
  );
}

function Dato({
  titulo,
  valor,
}: {
  titulo: string;
  valor?: string;
}) {
  return (
    <div className="rounded-xl border bg-zinc-50 p-4">

      <p className="text-xs text-zinc-500">
        {titulo}
      </p>

      <p className="mt-1 break-words text-sm font-medium">
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label>

      <span className="text-sm font-medium">
        {label}
      </span>

      <input
        type={type}
        value={value || ""}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-zinc-100"
      />

    </label>
  );
}

function AreaGestion({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="mt-4 block">

      <span className="text-sm font-medium">
        {label}
      </span>

      <textarea
        value={value || ""}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        rows={3}
        className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-zinc-100"
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
  children: React.ReactNode;
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

function EstadoBadge({
  estado,
}: {
  estado: string;
}) {
  let clases =
    "bg-zinc-100 text-zinc-700";

  if (
    estado === "Ingresado"
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
      className={`inline-flex whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${clases}`}
    >
      {estado ||
        "Sin estado"}
    </span>
  );
}