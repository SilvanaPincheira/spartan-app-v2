import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      subject = "Cotización Spartan de Chile",
      html,
      toCliente,
      toEjecutivo,
      ccFija,
      replyTo,
      fromName,
      attachments = [],
    } = body;

    // === Validar adjuntos ===
    const formattedAttachments = Array.isArray(attachments)
      ? attachments.map((a: any) => ({
          filename: a.filename,
          // ⚠️ El Resend necesita base64 limpio, sin el "data:application/pdf;base64,"
          content: (a.content || "").replace(/^data:application\/pdf;base64,/, ""),
        }))
      : [];

    // === Destinatarios ===
    const to: string[] = [];
    if (toCliente) to.push(toCliente);
    if (toEjecutivo && !to.includes(toEjecutivo)) to.push(toEjecutivo);

    const cc: string[] = [];
    if (ccFija) cc.push(ccFija);

    // === Enviar correo ===
    const response = await resend.emails.send({
      from: fromName
        ? `${fromName} <no-reply@spartan.cl>`
        : "Spartan App <no-reply@spartan.cl>",
      to,
      cc,
      subject,
      html,
      replyTo,
      attachments: formattedAttachments.length ? formattedAttachments : undefined,
    });

    console.log("✅ Correo enviado correctamente con adjuntos:", formattedAttachments.length);

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
