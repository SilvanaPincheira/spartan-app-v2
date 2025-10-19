import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 🧭 Destinatarios principales
    const to: string[] = [];
    if (body.toCliente) to.push(body.toCliente);
    if (body.toEjecutivo && !to.includes(body.toEjecutivo))
      to.push(body.toEjecutivo);

    // 🧭 Copia (CC)
    const cc: string[] = [];
    if (body.ccFija) cc.push(body.ccFija);

    // 🧾 Asunto
    const subject: string =
      (typeof body.subject === "string" && body.subject.trim()) ||
      "Cotización Spartan de Chile";

    // 📎 Adjuntos (PDF + archivo(s) opcionales)
    let attachments: { filename: string; content: string }[] = [];

    if (Array.isArray(body.attachments) && body.attachments.length > 0) {
      attachments = body.attachments
        .filter((a: any) => a?.content && a?.filename)
        .map((a: any) => ({
          filename: a.filename,
          content: a.content,
        }));
    }

    if (!attachments.length) {
      console.warn("⚠️ Envío sin adjuntos. Revisar si es intencional.");
    }

    // 📨 Enviar correo
    const response = await resend.emails.send({
      from: body.fromName
        ? `${body.fromName} <no-reply@spartan.cl>`
        : "Spartan App <no-reply@spartan.cl>",
      to,
      cc,
      subject,
      html:
        body.html ||
        `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#111;">
          <h2 style="color:#1f4ed8">📄 Nueva Cotización — Spartan App</h2>
          <p>Se ha generado una nueva cotización desde la plataforma Spartan.</p>
          <p><strong>Cliente:</strong> ${body.cliente || "—"}<br>
          <strong>Ejecutivo:</strong> ${body.ejecutivo || "—"}<br>
          <strong>Correo Ejecutivo:</strong> ${body.correoEjecutivo || "—"}</p>
          <p>Se adjunta el documento PDF con el detalle ${
            attachments.length > 1 ? "y archivo(s) adicional(es)." : "."
          }</p>
          <p style="color:#6b7280;font-size:12px;margin-top:20px">
            Enviado automáticamente por <b>Spartan App</b>.
          </p>
        </div>
      `,
      replyTo: body.replyTo,
      attachments,
    });

    return NextResponse.json({
      ok: true,
      id: response.data?.id || null,
    });
  } catch (err: any) {
    console.error("❌ Error en /api/send-cotizacion:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al enviar correo" },
      { status: 500 }
    );
  }
}
