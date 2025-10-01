// lib/notaventa.ts
import { generarPdfNotaVenta } from "@/lib/utils/pdf-notaventa";
import { logoBase64 } from "../logo64";


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
    // 1. Guardar en Sheets
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

    const resSave = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/save-to-sheets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resSave.ok) throw new Error("Error al guardar en Google Sheets");

    // 2. Generar PDF
    const { base64, filename } = generarPdfNotaVenta(data);

    // 3. Enviar por correo
    const destinatarios = [
      data.emailEjecutivo,
      "silvana.pincheira@spartan.cl", // o los que tú definas
    ];

    const resMail = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/send-notaventa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: destinatarios,
        subject: `Nota de Venta ${data.numeroNV}`,
        message: `<p>Nota de venta generada para cliente ${data.cliente.nombre}</p>`,
        attachment: {
          filename,
          content: base64,
        },
      }),
    });

    if (!resMail.ok) throw new Error("Error al enviar correo");

    return { ok: true, message: "✅ Guardado y correo enviado" };
  } catch (err: any) {
    console.error("❌ Error en guardarYEnviarNotaVenta:", err);
    return { ok: false, message: err?.message || "Error inesperado" };
  }
}
