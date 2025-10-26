import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Tu Google Apps Script que maneja lectura/escritura
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwPlJLaUZLzcM1jBBJBa9gvzQvS8EicsxSaDMDWSkFntiJhMdlnzNkBi40tl7dcJ-zXoA/exec"; // ⚠️ reemplaza con tu URL real

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const reclamoId = String(form.get("id") || "");
    const mensaje = String(form.get("mensaje") || "");
    const archivo = form.get("archivo") as File | null;

    if (!reclamoId) throw new Error("ID de reclamo no especificado.");

    // === 1️⃣ Consultar Google Sheets por el correo del reclamo ===
    const resLookup = await fetch(`${SCRIPT_URL}?action=getReclamo&id=${reclamoId}`);
    const reclamoData = await resLookup.json();

    if (!reclamoData?.correo) {
      throw new Error("No se encontró el correo del ejecutivo en el reclamo.");
    }

    const correoEjecutivo = reclamoData.correo;

    // === 2️⃣ Marcar como respondido en Sheets ===
    await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateStatus", id: reclamoId }),
    });

    // === 3️⃣ Preparar adjunto si hay ===
    let attachments: any[] = [];
    if (archivo) {
      const buffer = Buffer.from(await archivo.arrayBuffer());
      attachments.push({
        filename: archivo.name,
        content: buffer.toString("base64"),
      });
    }

    // === 4️⃣ Enviar correo al ejecutivo ===
    await resend.emails.send({
      from: "Spartan Reclamos <notificaciones@spartan.cl>",
      to: correoEjecutivo,
      replyTo: "alexandra.morales@spartan.cl",
      subject: `Reclamo ${reclamoId} respondido`,
      html: `
        <p>Estimado(a),</p>
        <p>El reclamo <b>${reclamoId}</b> ha sido respondido por el área de Control de Calidad.</p>
        <p><b>Comentario:</b><br>${mensaje}</p>
        <hr>
        <p style="font-size:12px;color:#777">Este mensaje fue generado automáticamente por Spartan App.</p>
      `,
      attachments,
    });

    console.log(`📤 Reclamo ${reclamoId} respondido y correo enviado a ${correoEjecutivo}`);


    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ Error en responder:", err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
