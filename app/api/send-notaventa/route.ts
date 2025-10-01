// app/api/send-notaventa/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Siempre SAC como destinatario
    const to = "silvana.pincheira@spartan.cl";

    // CC: correo del ejecutivo (si viene en el body)
    const cc = body.cc || body.emailEjecutivo || "";

    const subject =
      (typeof body.subject === "string" && body.subject.trim()) ||
      "Nota de Venta – Spartan App";

    if (!body.attachment) {
      throw new Error("❌ Falta adjuntar el PDF de la Nota de Venta.");
    }
    // 🔹 LOG para confirmar destinatarios
    console.log("📧 Enviando Nota de Venta:", {
      to,
      cc,
      subject,
      hasAttachment: !!body.attachment,
    });

    // Email con PDF adjunto
    const data = await resend.emails.send({
      from: "no-reply@spartan.cl", // remitente validado en Resend
      to,                          // siempre SAC
      cc: cc ? [cc] : undefined,   // copia al ejecutivo si existe
      subject,
      html: body.message || "<p>Adjunto Nota de Venta en PDF</p>",
      attachments: [
        {
          filename: body.attachment.filename,
          content: body.attachment.content, // base64 del PDF generado en page.tsx
        },
      ],
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("❌ Error al enviar correo de Nota de Venta:", error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
