import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { to, subject, html, attachments, reclamoId } = await req.json();

    if (!to || !subject || !html || !reclamoId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios en la solicitud." },
        { status: 400 }
      );
    }

    // ✅ 1. Enviar correo con adjunto
    const result = await resend.emails.send({
      from: "Spartan App <no-reply@spartan.cl>",
      to,
      subject,
      html,
      attachments: attachments?.length ? attachments : [],
      cc: ["calidad@spartan.cl"],
      replyTo: "calidad@spartan.cl", // ✅ nombre correcto
    });

    if (result.error) throw new Error(result.error.message);

    // ✅ 2. Registrar como “Respondido” en Google Sheets (sin detalle)
    const SCRIPT_URL =
      "https://script.google.com/macros/s/AKfycbwPlJLaUZLzcM1jBBJBa9gvzQvS8EicsxSaDMDWSkFntiJhMdlnzNkBi40tl7dcJ-zXoA/exec"; // tu script de reclamos
    await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateStatus",
        id: reclamoId,
        estado: "Respondido",
        fecha: new Date().toLocaleString("es-CL"),
      }),
    });

    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error("❌ Error en send-reclamo-feedback:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

