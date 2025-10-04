// app/api/send-notaventa/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Destinatarios
    const to: string[] = ["sac@spartan.cl"]; // <-- cambia si corresponde
    const cc: string[] | undefined =
      body.cc
        ? (Array.isArray(body.cc) ? body.cc : [String(body.cc)]).filter(Boolean)
        : (body.emailEjecutivo ? [String(body.emailEjecutivo)] : undefined);

    const subject: string =
      (typeof body.subject === "string" && body.subject.trim()) ||
      "Nota de Venta – Spartan One";

    // Adjuntos: soporta 'attachments' (array) o 'attachment' (uno solo)
    const attachments =
      Array.isArray(body.attachments) && body.attachments.length
        ? body.attachments
        : body.attachment
        ? [body.attachment]
        : [];

    if (!attachments.length) {
      throw new Error("Falta adjuntar el PDF de la Nota de Venta.");
    }
    for (const a of attachments) {
      if (!a?.filename || !a?.content) {
        throw new Error("Adjunto inválido: se requiere 'filename' y 'content' (base64).");
      }
    }

    // (opcional) límite de tamaño total
    const totalMB = attachments.reduce((s: number, a: any) => s + (a.content.length * 3) / 4 / 1048576, 0);
    if (totalMB > 4.5) {
      throw new Error(`Adjuntos muy pesados (${totalMB.toFixed(2)} MB).`);
    }

    console.log("📧 Enviando Nota de Venta:", {
      to, cc, subject,
      atts: attachments.map((a: any) => a.filename),
      totalMB: totalMB.toFixed(2),
    });

    const data = await resend.emails.send({
      from: "no-reply@spartan.cl",       // dominio/verificado en Resend
      to,
      cc,
      subject,
      html: body.message || "<p>Adjunto Nota de Venta en PDF</p>",
      attachments: attachments.map((a: any) => ({
        filename: a.filename,
        content: a.content, // base64 sin "data:..."
      })),
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("❌ Error al enviar correo de Nota de Venta:", err);
    return NextResponse.json(
      { success: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
