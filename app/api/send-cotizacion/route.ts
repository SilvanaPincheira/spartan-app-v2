import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const to: string[] = [];
    if (body.toCliente) to.push(body.toCliente);
    if (body.toEjecutivo && !to.includes(body.toEjecutivo))
      to.push(body.toEjecutivo);

    const cc: string[] = [];
    if (body.ccFija) cc.push(body.ccFija);

    const subject: string =
      (typeof body.subject === "string" && body.subject.trim()) ||
      "Cotización Spartan de Chile";

    const attachments =
      Array.isArray(body.attachments) && body.attachments.length
        ? body.attachments.map((a: any) => ({
            filename: a.filename,
            content: a.content,
          }))
        : undefined;

    const response = await resend.emails.send({
      from: body.fromName
        ? `${body.fromName} <no-reply@spartan.cl>`
        : "Spartan App <no-reply@spartan.cl>",
      to,
      cc,
      subject,
      html: body.html,
      replyTo: body.replyTo, // 👈 CORRECTO (no reply_to)
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
