// app/api/send-notaventa/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const to =
      (typeof body.to === "string" && body.to.trim()) ||
      "silvana.pincheira@spartan.cl";
    const subject =
      (typeof body.subject === "string" && body.subject.trim()) ||
      "Nota de Venta – Spartan App";

    if (!body.attachment) {
      throw new Error("❌ Falta adjuntar el PDF de la Nota de Venta.");
    }

    // 🔹 Email con PDF adjunto
    const data = await resend.emails.send({
      from: "silvana.pincheira@spartan.cl", // remitente validado
      to,
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
    console.error("❌ Error al enviar correo de Nota de Venta:", JSON.stringify(error, null, 2));
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
