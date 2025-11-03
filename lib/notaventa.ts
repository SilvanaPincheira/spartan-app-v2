// lib/notaventa.ts
import { generarPdfNotaVenta } from "@/lib/utils/pdf-notaventa";

export async function guardarYEnviarNotaVenta(data: {
  numeroNV: string;
  fecha: string;
  cliente: {
    nombre: string;
    rut: string;
    codigo: string;
    ejecutivo: string;
    direccion: string;
    comuna: string;
  };
  productos: {
    codigo: string;
    descripcion: string;
    kilos: number;
    cantidad: number;
    precioBase: number;
    precioVenta: number;
    precioPresentacion: number;
    total: number;
  }[];
  comentarios: string;
  emailEjecutivo: string;
}) {
  try {
    // 0️⃣ Base URL segura (soporta Vercel y localhost)
    const baseUrl =
      process.env.NEXT_PUBLIC_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    // 1️⃣ Guardar en Google Sheets vía Apps Script
    const payload = data.productos.map((p) => ({
      ...p,
      numeroNV: data.numeroNV,
      fecha: data.fecha,
      cliente: data.cliente.nombre,
      rut: data.cliente.rut,
      codigoCliente: data.cliente.codigo,
      ejecutivo: data.cliente.ejecutivo,
      direccion: data.cliente.direccion,
      comuna: data.cliente.comuna,
      comentarios: data.comentarios,
      totalItem: p.total,
    }));

    const resSave = await fetch(`${baseUrl}/api/save-to-sheets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resSave.ok) {
      const text = await resSave.text();
      throw new Error(
        `Error al guardar en Google Sheets (${resSave.status}): ${text}`
      );
    }

    // 2️⃣ Generar PDF de la Nota de Venta
    const { base64, filename } = generarPdfNotaVenta(data);

    // 3️⃣ Enviar por correo (SAC + Ejecutivo)
    const destinatarios = [
      "sac@spartan.cl",
      ...(data.emailEjecutivo ? [data.emailEjecutivo] : []),
    ];

    const resMail = await fetch(`${baseUrl}/api/send-notaventa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: destinatarios,
        subject: `Nota de Venta ${data.numeroNV}`,
        message: `<p>Nota de venta generada para cliente <b>${data.cliente.nombre}</b>.</p>`,
        attachment: {
          filename,
          content: base64,
        },
        fromName: `${data.cliente.ejecutivo || "Spartan"} — ${data.numeroNV}`,
      }),
    });

    if (!resMail.ok) {
      const text = await resMail.text();
      throw new Error(
        `Error al enviar correo (${resMail.status}): ${text}`
      );
    }

    return { ok: true, message: "✅ Guardado en Sheets y correo enviado" };
  } catch (err: any) {
    console.error("❌ Error en guardarYEnviarNotaVenta:", err);
    return { ok: false, message: err?.message || "Error inesperado" };
  }
}

