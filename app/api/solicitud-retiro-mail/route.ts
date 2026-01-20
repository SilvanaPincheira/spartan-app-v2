import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const to =
      (Array.isArray(body.to) && body.to.length && body.to) ||
      (typeof body.to === "string" && body.to.trim()) ||
      // 👇 correo por defecto del área que atiende retiros
      "leonardo.vega@spartan.cl";

    const cc = body.cc
      ? Array.isArray(body.cc) ? body.cc : [String(body.cc)]
      : undefined;

    const subject =
      (typeof body.subject === "string" && body.subject.trim()) ||
      "Solicitud de Retiro – Spartan App";

    if (!body.attachment?.content || !body.attachment?.filename) {
      throw new Error("Falta adjuntar el PDF de la solicitud.");
    }

    console.log("📧 Enviando Solicitud de Retiro:", {
      to, cc, subject, hasAttachment: true,
    });

    const data = await resend.emails.send({
      from: "no-reply@spartan.cl",
      to,
      cc,
      subject,
      html: body.message || "<p>Adjunto Solicitud de Retiro en PDF</p>",
      attachments: [{
        filename: body.attachment.filename,
        content: body.attachment.content, // base64
      }],
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("❌ Error al enviar correo de Solicitud de Retiro:", error);
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
