import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function limpiarCorreo(valor: unknown): string {
  return String(valor || "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta la variable RESEND_API_KEY en Vercel.",
        },
        { status: 500 }
      );
    }

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

    const correoCliente = limpiarCorreo(toCliente);
    const correoEjecutivo = limpiarCorreo(toEjecutivo);
    const correoCc = limpiarCorreo(ccFija);
    const correoRespuesta = limpiarCorreo(replyTo);

    // Destinatarios, sin duplicados
    const to = [...new Set(
      [correoCliente, correoEjecutivo].filter(Boolean)
    )];

    const cc = correoCc ? [correoCc] : [];

    if (to.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se recibió ningún destinatario válido.",
        },
        { status: 400 }
      );
    }

    if (!html || !String(html).trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "El contenido del correo está vacío.",
        },
        { status: 400 }
      );
    }

    // Limpia cualquier prefijo data:MIME;base64,
    const formattedAttachments = Array.isArray(attachments)
      ? attachments
          .filter(
            (a: any) =>
              a &&
              String(a.filename || "").trim() &&
              String(a.content || "").trim()
          )
          .map((a: any) => ({
            filename: String(a.filename).trim(),
            content: String(a.content).replace(
              /^data:[^;]+;base64,/,
              ""
            ),
          }))
      : [];

    console.log("📧 Enviando cotización:", {
      to,
      cc,
      subject,
      replyTo: correoRespuesta || null,
      attachments: formattedAttachments.map((a: any) => a.filename),
    });

    const response = await resend.emails.send({
      from: fromName
        ? `${String(fromName).trim()} <no-reply@spartan.cl>`
        : "Spartan App <no-reply@spartan.cl>",
      to,
      cc: cc.length ? cc : undefined,
      subject: String(subject),
      html: String(html),
      replyTo: correoRespuesta || undefined,
      attachments: formattedAttachments.length
        ? formattedAttachments
        : undefined,
    });

    // Resend puede devolver error sin lanzar excepción
    if (response.error) {
      console.error("❌ Resend rechazó el correo:", response.error);

      return NextResponse.json(
        {
          ok: false,
          error:
            response.error.message ||
            "Resend rechazó el envío del correo.",
          details: response.error,
        },
        { status: 500 }
      );
    }

    if (!response.data?.id) {
      console.error("❌ Resend no entregó un ID:", response);

      return NextResponse.json(
        {
          ok: false,
          error: "Resend no confirmó el envío del correo.",
        },
        { status: 500 }
      );
    }

    console.log("✅ Correo enviado correctamente:", {
      id: response.data.id,
      adjuntos: formattedAttachments.length,
    });

    return NextResponse.json({
      ok: true,
      id: response.data.id,
    });
  } catch (err: any) {
    console.error("❌ Error en /api/send-cotizacion:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Error al enviar correo.",
      },
      { status: 500 }
    );
  }
}