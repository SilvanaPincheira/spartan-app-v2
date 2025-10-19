import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

/**
 * Envía por correo el reclamo generado con PDF adjunto.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      to = "alexandra.morales@spartan.cl",
      subject = "🧾 Nuevo Reclamo — Spartan App",
      body: htmlBody,
      cliente,
      ejecutivo,
      correo,
      attachments = [], // ✅ nuevo: puede incluir varios
    } = body;

    if (!attachments.length) throw new Error("No se encontraron adjuntos para enviar.");

    // Generar cuerpo HTML
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111;">
        <h2 style="color:#1f4ed8">🧾 Nuevo Reclamo — Spartan App</h2>
        <p>Se ha recibido un nuevo reclamo generado automáticamente desde el formulario.</p>
        <p><strong>Cliente:</strong> ${cliente || "—"}<br>
        <strong>Ejecutivo:</strong> ${ejecutivo || "—"}<br>
        <strong>Correo:</strong> ${correo || "—"}</p>
        <p>Se adjunta el documento PDF con el detalle del reclamo ${
          attachments.length > 1 ? "y los archivos adicionales." : "."
        }</p>
        <p style="color:#6b7280;font-size:12px;margin-top:20px">
          Enviado automáticamente por <b>Spartan App</b>.
        </p>
      </div>
    `;

    // ✅ Envío
    const data = await resend.emails.send({
      from: "silvana.pincheira@spartan.cl",
      to,
      subject,
      html,
      attachments, // 👈 ahora soporta múltiples adjuntos base64
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("❌ Error enviando reclamo:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
