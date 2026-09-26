"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* =========================================================
   TIPOS
========================================================= */

type FormReclamo = {
  ejecutivo: string;
  ejecutivoEmail: string;

  cliente: string;
  rut: string;
  contactoCliente: string;
  correo: string;

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

  adjuntos: File[];
};

/* =========================================================
   CLASIFICACIONES / MOTIVOS
========================================================= */

const MOTIVOS_POR_CLASIFICACION: Record<string, string[]> = {
  "Calidad del producto": [
    "Apariencia/color fuera de especificación",
    "Olor anormal",
    "Separación de fases",
    "Sedimentación",
    "Viscosidad",
    "pH",
    "Concentración",
    "Espuma",
    "Problema de desempeño",
    "Presencia de partículas",
    "Contaminación",
    "Producto diferente al solicitado",
    "Producto vencido",
    "Otro",
  ],

  "Envase / presentación": [
    "Envase roto",
    "Fuga / filtración",
    "Tapa defectuosa",
    "Sello de seguridad",
    "Etiqueta incorrecta",
    "Etiqueta deteriorada",
    "Envase deformado",
    "Presentación incorrecta",
    "Peso / volumen incompleto",
    "Otro",
  ],

  "Transporte interno": [
    "Derrame",
    "Golpe",
    "Envase dañado",
    "Producto contaminado",
    "Producto extraviado",
    "Error de preparación",
    "Error de despacho interno",
    "Otro",
  ],

  "Transporte externo": [
    "Derrame",
    "Envase dañado",
    "Entrega incompleta",
    "Pérdida",
    "Retraso",
    "Mala manipulación",
    "Condiciones inadecuadas de transporte",
    "Otro",
  ],

  "Despacho / logística": [
    "Producto equivocado",
    "Cantidad incorrecta",
    "Presentación incorrecta",
    "Pedido incompleto",
    "Documentación faltante",
    "Entrega fuera de plazo",
    "Otro",
  ],

  "Finalidad de uso / desempeño": [
    "Producto no adecuado para la aplicación",
    "Limpieza insuficiente",
    "Desinfección insuficiente",
    "Exceso de espuma",
    "Falta de espuma",
    "Problemas de enjuague",
    "Compatibilidad con superficie/material",
    "Problema de dosificación",
    "Problema de temperatura",
    "Problema de tiempo de contacto",
    "Problema asociado al procedimiento de uso",
    "Otro",
  ],

  "Asesoría / información técnica": [
    "Instrucciones insuficientes",
    "Dosificación incorrectamente informada",
    "Error en ficha técnica",
    "Error de etiquetado",
    "Información de seguridad",
    "Capacitación insuficiente",
    "Recomendación técnica incorrecta",
    "Otro",
  ],

  Comercial: [
    "Producto distinto al cotizado",
    "Condición comercial",
    "Error en orden de compra",
    "Error documental",
    "Otro",
  ],
};

const ACCIONES_INMEDIATAS = [
  "Retención del lote",
  "Suspensión temporal de uso",
  "Retiro de producto",
  "Reposición",
  "Envío de muestra",
  "Visita técnica",
  "Cambio de producto",
  "Capacitación",
  "Sin acción inmediata",
  "Otra",
];

const PROCESOS = [
  "CIP",
  "OPC",
  "Espuma",
  "Inmersión",
  "Lavandería",
  "Lavado manual",
  "Desinfección",
  "Otro",
];

/* =========================================================
   FORMULARIO VACÍO
========================================================= */

function crearFormularioInicial(): FormReclamo {
  return {
    ejecutivo: "",
    ejecutivoEmail: "",

    cliente: "",
    rut: "",
    contactoCliente: "",
    correo: "",

    producto: "",
    presentacion: "",
    cantidadAfectada: "",
    unidadCantidad: "",
    lote: "",
    fechaElaboracion: "",

    clasificacion: "",
    motivo: "",

    descripcion: "",

    accionesInmediatas: [],
    accionInmediataDetalle: "",

    aplicacion: "",
    proceso: "",
    dilucion: "",
    dosis: "",
    temperatura: "",
    tiempoAccion: "",
    superficie: "",
    equipoDosificacion: "",
    productoAnterior: "",
    cambioProcedimiento: "",
    cambioProcedimientoDetalle: "",

    adjuntos: [],
  };
}

/* =========================================================
   HELPERS
========================================================= */

async function archivoABase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   PAGE
========================================================= */

export default function ReclamosPage() {
  const [form, setForm] =
    useState<FormReclamo>(crearFormularioInicial());

  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const supabase = createClientComponentClient();

  /* =======================================================
     USUARIO LOGUEADO
  ======================================================= */

  useEffect(() => {
    async function cargarUsuario() {
      const { data } = await supabase.auth.getUser();

      if (!data?.user) return;

      const email =
        data.user.email || "";

      const nombre =
        data.user.user_metadata?.nombre ||
        data.user.user_metadata?.full_name ||
        email.split("@")[0];

      setForm((prev) => ({
        ...prev,
        ejecutivo: nombre,
        ejecutivoEmail: email,
      }));
    }

    cargarUsuario();
  }, []);

  /* =======================================================
     MOTIVOS
  ======================================================= */

  const motivosDisponibles =
    useMemo(
      () =>
        MOTIVOS_POR_CLASIFICACION[
          form.clasificacion
        ] || [],
      [form.clasificacion]
    );

  const mostrarAntecedentesTecnicos =
    [
      "Calidad del producto",
      "Finalidad de uso / desempeño",
      "Asesoría / información técnica",
    ].includes(form.clasificacion);

  /* =======================================================
     CHANGE
  ======================================================= */

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLTextAreaElement |
      HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function cambiarClasificacion(
    e: React.ChangeEvent<HTMLSelectElement>
  ) {
    const clasificacion = e.target.value;

    setForm((prev) => ({
      ...prev,
      clasificacion,
      motivo: "",
    }));
  }

  function cambiarAdjuntos(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const archivos =
      Array.from(e.target.files || []);

    setForm((prev) => ({
      ...prev,
      adjuntos: archivos,
    }));
  }

  function toggleAccionInmediata(
    accion: string
  ) {
    setForm((prev) => {
      const existe =
        prev.accionesInmediatas.includes(
          accion
        );

      return {
        ...prev,

        accionesInmediatas:
          existe
            ? prev.accionesInmediatas.filter(
                (item) => item !== accion
              )
            : [
                ...prev.accionesInmediatas,
                accion,
              ],
      };
    });
  }

  /* =======================================================
     GENERAR PDF
  ======================================================= */

  async function generarPdf(
    numeroReclamo?: string
  ) {
    const { jsPDF } =
      await import("jspdf");

    const doc =
      new jsPDF({
        unit: "pt",
        format: "a4",
      });

    const AZUL:
      [number, number, number] =
      [31, 78, 216];

    const GRIS:
      [number, number, number] =
      [245, 245, 245];

    const W =
      doc.internal.pageSize.getWidth();

    const H =
      doc.internal.pageSize.getHeight();

    const M = 40;

    let y = 85;

    function revisarPagina(
      alturaNecesaria = 30
    ) {
      if (
        y + alturaNecesaria >
        H - 45
      ) {
        doc.addPage();
        y = 50;
      }
    }

    function tituloSeccion(
      titulo: string
    ) {
      revisarPagina(45);

      doc.setFillColor(...GRIS);

      doc.rect(
        M,
        y,
        W - 2 * M,
        25,
        "F"
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(11);

      doc.text(
        titulo,
        M + 8,
        y + 17
      );

      y += 38;
    }

    function linea(
      etiqueta: string,
      valor: string
    ) {
      if (!valor) return;

      const ancho =
        W - 2 * M - 150;

      const lineas =
        doc.splitTextToSize(
          valor,
          ancho
        );

      const alto =
        Math.max(
          20,
          lineas.length * 12 + 8
        );

      revisarPagina(alto);

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(9);

      doc.text(
        `${etiqueta}:`,
        M,
        y + 10
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(
        lineas,
        M + 150,
        y + 10
      );

      y += alto;
    }

    /* HEADER */

    doc.setFillColor(...AZUL);

    doc.rect(
      0,
      0,
      W,
      70,
      "F"
    );

    doc.setTextColor(
      255,
      255,
      255
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(16);

    doc.text(
      "Formulario de Reclamos — Spartan",
      M,
      34
    );

    doc.setFontSize(10);

    doc.text(
      numeroReclamo
        ? `Reclamo N° ${numeroReclamo}`
        : "Nuevo reclamo",
      M,
      52
    );

    doc.setTextColor(
      0,
      0,
      0
    );

    /* DATOS GENERALES */

    tituloSeccion(
      "1. Antecedentes del reclamo"
    );

    linea(
      "Estado",
      "Ingresado"
    );

    linea(
      "Ejecutivo",
      form.ejecutivo
    );

    linea(
      "Cliente",
      form.cliente
    );

    linea(
      "RUT",
      form.rut
    );

    linea(
      "Contacto cliente",
      form.contactoCliente
    );

    linea(
      "Correo contacto",
      form.correo
    );

    /* PRODUCTO */

    tituloSeccion(
      "2. Producto afectado"
    );

    linea(
      "Producto",
      form.producto
    );

    linea(
      "Presentación",
      form.presentacion
    );

    linea(
      "Cantidad afectada",
      `${form.cantidadAfectada} ${form.unidadCantidad}`
    );

    linea(
      "Lote",
      form.lote
    );

    linea(
      "Fecha elaboración",
      form.fechaElaboracion
    );

    /* CLASIFICACIÓN */

    tituloSeccion(
      "3. Clasificación"
    );

    linea(
      "Clasificación",
      form.clasificacion
    );

    linea(
      "Motivo",
      form.motivo
    );

    linea(
      "Descripción",
      form.descripcion
    );

    /* ACCIÓN INMEDIATA */

    tituloSeccion(
      "4. Acciones inmediatas"
    );

    linea(
      "Acciones",
      form.accionesInmediatas.join(
        ", "
      )
    );

    linea(
      "Detalle",
      form.accionInmediataDetalle
    );

    /* DATOS TÉCNICOS */

    if (
      mostrarAntecedentesTecnicos
    ) {
      tituloSeccion(
        "5. Antecedentes técnicos"
      );

      linea(
        "Aplicación realizada",
        form.aplicacion
      );

      linea(
        "Proceso",
        form.proceso
      );

      linea(
        "Dilución / concentración",
        form.dilucion
      );

      linea(
        "Dosificación",
        form.dosis
      );

      linea(
        "Temperatura",
        form.temperatura
      );

      linea(
        "Tiempo contacto",
        form.tiempoAccion
      );

      linea(
        "Superficie",
        form.superficie
      );

      linea(
        "Equipo dosificación",
        form.equipoDosificacion
      );

      linea(
        "Producto anterior",
        form.productoAnterior
      );

      linea(
        "Cambio procedimiento",
        form.cambioProcedimiento
      );

      linea(
        "Detalle cambio",
        form.cambioProcedimientoDetalle
      );
    }

    /* EVIDENCIAS */

    tituloSeccion(
      "6. Evidencias"
    );

    linea(
      "Archivos adjuntos",
      form.adjuntos.length
        ? form.adjuntos
            .map(
              (archivo) =>
                archivo.name
            )
            .join(", ")
        : "Sin archivos adjuntos"
    );

    return {
      pdfBase64:
        doc
          .output(
            "datauristring"
          )
          .split(",")[1],

      filename:
        `Reclamo_${
          numeroReclamo ||
          form.cliente ||
          "Nuevo"
        }.pdf`,
    };
  }

  /* =======================================================
     GUARDAR
  ======================================================= */

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (enviando) return;

    if (
      !form.cliente ||
      !form.rut ||
      !form.producto ||
      !form.presentacion ||
      !form.cantidadAfectada ||
      !form.clasificacion ||
      !form.motivo ||
      !form.descripcion
    ) {
      alert(
        "Completa los campos obligatorios."
      );

      return;
    }

    try {
      setEnviando(true);
      setOk(false);
      setMensaje(
        "Guardando reclamo..."
      );

      /*
       * No enviamos objetos File
       * directamente en JSON.
       */
      const payloadGuardar = {
        ...form,

        adjuntos: undefined,

        evidencias:
          form.adjuntos.map(
            (archivo) =>
              archivo.name
          ),

        estado:
          "Ingresado",

        fechaIngreso:
          new Date().toISOString(),
      };

      /* GUARDAR */

      const saveRes =
        await fetch(
          "/api/save-reclamo",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payloadGuardar
              ),
          }
        );

      const saveData =
        await saveRes
          .json()
          .catch(() => ({}));

      if (!saveRes.ok) {
        throw new Error(
          saveData.error ||
          "No se pudo guardar el reclamo."
        );
      }

      /*
       * Admitimos distintas respuestas
       * mientras ajustamos backend.
       */
      const numeroReclamo =
        String(
          saveData.numeroReclamo ||
          saveData.id ||
          saveData.reclamoId ||
          ""
        );

      setMensaje(
        "Generando documentación..."
      );

      /* PDF */

      const {
        pdfBase64,
        filename,
      } =
        await generarPdf(
          numeroReclamo
        );

      /* ADJUNTOS */

      const attachments: {
        filename: string;
        content: string;
      }[] = [
        {
          filename,
          content:
            pdfBase64,
        },
      ];

      for (
        const archivo
        of form.adjuntos
      ) {
        const contenido =
          await archivoABase64(
            archivo
          );

        attachments.push({
          filename:
            archivo.name,

          content:
            contenido,
        });
      }

      /* CORREO */

      setMensaje(
        "Enviando notificación..."
      );

      const emailRes =
        await fetch(
          "/api/send-reclamo",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                subject:
                  `🧾 Nuevo Reclamo${
                    numeroReclamo
                      ? ` ${numeroReclamo}`
                      : ""
                  } — ${form.cliente}`,

                body:
                  "Se ha recibido un nuevo reclamo y quedó registrado con estado Ingresado.",

                to:
                  "alexandra.morales@spartan.cl",

                attachments,
              }),
          }
        );

      const emailData =
        await emailRes
          .json()
          .catch(() => ({}));

      if (
        !emailRes.ok ||
        !(
          emailData.success ||
          emailData.ok
        )
      ) {
        throw new Error(
          emailData.error ||
          "El reclamo se guardó, pero no se pudo enviar la notificación."
        );
      }

      setOk(true);

      setMensaje(
        numeroReclamo
          ? `Reclamo ${numeroReclamo} ingresado correctamente.`
          : "Reclamo ingresado correctamente."
      );

      /*
       * Conservamos el ejecutivo conectado.
       */
      setForm((actual) => ({
        ...crearFormularioInicial(),

        ejecutivo:
          actual.ejecutivo,

        ejecutivoEmail:
          actual.ejecutivoEmail,
      }));

    } catch (error) {
      console.error(
        "Error Reclamos:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "No fue posible procesar el reclamo."
      );

    } finally {
      setEnviando(false);
    }
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900">

      <div className="mx-auto max-w-6xl">

        <div className="mb-6">

          <p className="text-sm font-semibold text-blue-600">
            Gestión de Reclamos
          </p>

          <h1 className="text-2xl font-bold">
            Nuevo Reclamo
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Registra los antecedentes conocidos del reclamo.
            La investigación y determinación de causa será realizada posteriormente por el área responsable.
          </p>

        </div>

        {mensaje && (
          <div
            className={`mb-5 rounded-xl border p-4 text-sm ${
              ok
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {mensaje}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* ===============================
              1 ANTECEDENTES
          =============================== */}

          <Seccion
            numero="1"
            titulo="Antecedentes del reclamo"
          >

            <div className="grid gap-4 md:grid-cols-2">

              <Campo
                label="Ejecutivo de ventas"
                name="ejecutivo"
                value={form.ejecutivo}
                onChange={handleChange}
                required
                readOnly
              />

              <Campo
                label="Cliente / Razón social"
                name="cliente"
                value={form.cliente}
                onChange={handleChange}
                required
              />

              <Campo
                label="RUT cliente"
                name="rut"
                value={form.rut}
                onChange={handleChange}
                required
              />

              <Campo
                label="Contacto cliente"
                name="contactoCliente"
                value={form.contactoCliente}
                onChange={handleChange}
              />

              <Campo
                label="Correo contacto"
                name="correo"
                value={form.correo}
                onChange={handleChange}
                type="email"
              />

            </div>

          </Seccion>

          {/* ===============================
              2 PRODUCTO
          =============================== */}

          <Seccion
            numero="2"
            titulo="Producto afectado"
          >

            <div className="grid gap-4 md:grid-cols-3">

              <Campo
                label="Producto"
                name="producto"
                value={form.producto}
                onChange={handleChange}
                required
              />

              <Campo
                label="Presentación de venta"
                name="presentacion"
                value={form.presentacion}
                onChange={handleChange}
                required
              />

              <Campo
                label="Lote"
                name="lote"
                value={form.lote}
                onChange={handleChange}
              />

              <Campo
                label="Cantidad afectada"
                name="cantidadAfectada"
                value={form.cantidadAfectada}
                onChange={handleChange}
                required
                type="number"
              />

              <Campo
                label="Unidad"
                name="unidadCantidad"
                value={form.unidadCantidad}
                onChange={handleChange}
                required
                placeholder="Ej.: unidades, litros, kg"
              />

              <Campo
                label="Fecha de elaboración"
                name="fechaElaboracion"
                value={form.fechaElaboracion}
                onChange={handleChange}
                type="date"
              />

            </div>

          </Seccion>

          {/* ===============================
              3 CLASIFICACIÓN
          =============================== */}

          <Seccion
            numero="3"
            titulo="Clasificación del reclamo"
          >

            <div className="grid gap-4 md:grid-cols-2">

              <label>

                <span className="text-sm font-medium">
                  Clasificación *
                </span>

                <select
                  value={form.clasificacion}
                  onChange={cambiarClasificacion}
                  required
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option value="">
                    Seleccione...
                  </option>

                  {Object.keys(
                    MOTIVOS_POR_CLASIFICACION
                  ).map(
                    (clasificacion) => (
                      <option
                        key={
                          clasificacion
                        }
                        value={
                          clasificacion
                        }
                      >
                        {
                          clasificacion
                        }
                      </option>
                    )
                  )}

                </select>

              </label>

              <label>

                <span className="text-sm font-medium">
                  Motivo *
                </span>

                <select
                  name="motivo"
                  value={form.motivo}
                  onChange={handleChange}
                  required
                  disabled={
                    !form.clasificacion
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-zinc-100"
                >
                  <option value="">
                    Seleccione...
                  </option>

                  {motivosDisponibles.map(
                    (motivo) => (
                      <option
                        key={motivo}
                        value={motivo}
                      >
                        {motivo}
                      </option>
                    )
                  )}

                </select>

              </label>

            </div>

            <label className="mt-4 block">

              <span className="text-sm font-medium">
                Descripción del reclamo *
              </span>

              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                rows={5}
                required
                placeholder="Indique qué ocurrió, cuándo, dónde y cuál fue la consecuencia."
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />

            </label>

          </Seccion>

          {/* ===============================
              4 ACCIONES INMEDIATAS
          =============================== */}

          <Seccion
            numero="4"
            titulo="Acciones inmediatas"
          >

            <p className="mb-3 text-sm text-zinc-500">
              Puedes seleccionar más de una acción.
            </p>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">

              {ACCIONES_INMEDIATAS.map(
                (accion) => (

                  <label
                    key={accion}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border bg-zinc-50 px-3 py-2 text-sm"
                  >

                    <input
                      type="checkbox"
                      checked={
                        form.accionesInmediatas.includes(
                          accion
                        )
                      }
                      onChange={() =>
                        toggleAccionInmediata(
                          accion
                        )
                      }
                    />

                    {accion}

                  </label>

                )
              )}

            </div>

            <label className="mt-4 block">

              <span className="text-sm font-medium">
                Observaciones / detalle de la acción inmediata
              </span>

              <textarea
                name="accionInmediataDetalle"
                value={
                  form.accionInmediataDetalle
                }
                onChange={handleChange}
                rows={3}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />

            </label>

          </Seccion>

          {/* ===============================
              5 DATOS TÉCNICOS
          =============================== */}

          {mostrarAntecedentesTecnicos && (

            <Seccion
              numero="5"
              titulo="Antecedentes técnicos"
            >

              <div className="grid gap-4 md:grid-cols-2">

                <Campo
                  label="Aplicación realizada"
                  name="aplicacion"
                  value={form.aplicacion}
                  onChange={handleChange}
                />

                <label>

                  <span className="text-sm font-medium">
                    Proceso
                  </span>

                  <select
                    name="proceso"
                    value={form.proceso}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  >

                    <option value="">
                      Seleccione...
                    </option>

                    {PROCESOS.map(
                      (proceso) => (
                        <option
                          key={proceso}
                          value={proceso}
                        >
                          {proceso}
                        </option>
                      )
                    )}

                  </select>

                </label>

                <Campo
                  label="Dilución / concentración utilizada"
                  name="dilucion"
                  value={form.dilucion}
                  onChange={handleChange}
                />

                <Campo
                  label="Dosificación"
                  name="dosis"
                  value={form.dosis}
                  onChange={handleChange}
                />

                <Campo
                  label="Temperatura de aplicación"
                  name="temperatura"
                  value={form.temperatura}
                  onChange={handleChange}
                />

                <Campo
                  label="Tiempo de contacto"
                  name="tiempoAccion"
                  value={form.tiempoAccion}
                  onChange={handleChange}
                />

                <Campo
                  label="Superficie / material tratado"
                  name="superficie"
                  value={form.superficie}
                  onChange={handleChange}
                />

                <Campo
                  label="Equipo de dosificación utilizado"
                  name="equipoDosificacion"
                  value={form.equipoDosificacion}
                  onChange={handleChange}
                />

                <Campo
                  label="Producto utilizado anteriormente"
                  name="productoAnterior"
                  value={form.productoAnterior}
                  onChange={handleChange}
                />

                <label>

                  <span className="text-sm font-medium">
                    ¿Hubo cambio reciente de procedimiento?
                  </span>

                  <select
                    name="cambioProcedimiento"
                    value={
                      form.cambioProcedimiento
                    }
                    onChange={handleChange}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  >

                    <option value="">
                      Seleccione...
                    </option>

                    <option value="Sí">
                      Sí
                    </option>

                    <option value="No">
                      No
                    </option>

                  </select>

                </label>

              </div>

              {form.cambioProcedimiento ===
                "Sí" && (

                <label className="mt-4 block">

                  <span className="text-sm font-medium">
                    Descripción del cambio
                  </span>

                  <textarea
                    name="cambioProcedimientoDetalle"
                    value={
                      form.cambioProcedimientoDetalle
                    }
                    onChange={handleChange}
                    rows={3}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />

                </label>

              )}

            </Seccion>

          )}

          {/* ===============================
              EVIDENCIAS
          =============================== */}

          <Seccion
            numero={
              mostrarAntecedentesTecnicos
                ? "6"
                : "5"
            }
            titulo="Evidencias"
          >

            <label className="block">

              <span className="text-sm font-medium">
                Adjuntar fotografías, videos, PDF, guías, informes u otros documentos
              </span>

              <input
                type="file"
                multiple
                onChange={
                  cambiarAdjuntos
                }
                className="mt-2 block w-full text-sm"
              />

            </label>

            {form.adjuntos.length >
              0 && (

              <div className="mt-3 rounded-lg border bg-zinc-50 p-3">

                <p className="mb-2 text-xs font-semibold text-zinc-600">
                  Archivos seleccionados
                </p>

                {form.adjuntos.map(
                  (archivo) => (

                    <div
                      key={`${archivo.name}-${archivo.size}`}
                      className="text-sm text-zinc-700"
                    >
                      • {archivo.name}
                    </div>

                  )
                )}

              </div>

            )}

          </Seccion>

          {/* ===============================
              ENVIAR
          =============================== */}

          <div className="flex justify-end">

            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-[#2B6CFF] px-6 py-3 font-semibold text-white hover:bg-[#1F4ED8] disabled:bg-zinc-400"
            >

              {enviando
                ? "Procesando..."
                : "Enviar Reclamo"}

            </button>

          </div>

        </form>

      </div>

    </div>
  );
}

/* =========================================================
   COMPONENTES
========================================================= */

function Seccion({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">

      <h2 className="mb-4 text-lg font-semibold text-[#2B6CFF]">
        {numero}. {titulo}
      </h2>

      {children}

    </section>
  );
}

function Campo({
  label,
  name,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder = "",
  readOnly = false,
}: {
  label: string;
  name: string;
  value: string;

  onChange:
    (
      e: React.ChangeEvent<HTMLInputElement>
    ) => void;

  required?: boolean;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <label>

      <span className="text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </span>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`mt-1 w-full rounded-lg border px-3 py-2 ${
          readOnly
            ? "bg-zinc-100"
            : "bg-white"
        }`}
      />

    </label>
  );
}