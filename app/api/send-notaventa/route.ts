// app/api/send-notaventa/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = new Resend(resendApiKey);

type AttachmentIn = { filename: string; content: string };

type SendNotaVentaBody = {
  subject?: string;
  message?: string;                 // HTML
  to?: string | string[];           // opcional (por defecto SAC)
  cc?: string | string[];           // opcional (si no, cae en emailEjecutivo)
  emailEjecutivo?: string;          // CC y replyTo de respaldo
  attachments?: AttachmentIn[];     // múltiples adjuntos
  attachment?: AttachmentIn;        // adjunto único (compat)
  replyTo?: string | string[];      // “Responder a”
  fromName?: string;                // nombre mostrado en “From”
};

// normaliza a array de emails o undefined
function normEmails(v: unknown): string[] | undefined {
  if (!v && v !== "") return undefined;
  if (Array.isArray(v)) {
    const out = v.map(String).map((s) => s.trim()).filter(Boolean);
    return out.length ? out : undefined;
  }
  const s = String(v).trim();
  return s ? [s] : undefined;
}

export async function POST(req: Request) {
  try {
    if (!resendApiKey) {
      throw new Error("Falta RESEND_API_KEY en variables de entorno.");
    }

    const body = (await req.json()) as SendNotaVentaBody;

    // Destinatarios
    const to = normEmails(body.to) ?? ["sac@spartan.cl"];
    const cc =
      normEmails(body.cc) ??
      (body.emailEjecutivo ? [String(body.emailEjecutivo)] : undefined);

    // Reply-To (preferimos explícito; si no, ejecutivo)
    const replyTo =
      normEmails(body.replyTo) ??
      (body.emailEjecutivo ? [String(body.emailEjecutivo)] : undefined);

    // Asunto y nombre visible en From
    const subject =
      typeof body.subject === "string" && body.subject.trim()
        ? body.subject.trim()
        : "Nota de Venta – Spartan One";

    const fromName =
      typeof body.fromName === "string" && body.fromName.trim()
        ? body.fromName.trim()
        : "Spartan One";

    const html =
      typeof body.message === "string" && body.message.trim()
        ? body.message
        : "<p>Adjunto Nota de Venta en PDF.</p>";

    // Adjuntos: soporta 'attachments' (array) o 'attachment' (uno solo)
    const attachments: AttachmentIn[] =
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
        throw new Error(
          "Adjunto inválido: se requiere 'filename' y 'content' (base64)."
        );
      }
    }

    // Límite de tamaño total (~4.5 MB)
    const totalMB =
      attachments.reduce((s, a) => s + (a.content.length * 3) / 4 / 1048576, 0) || 0;
    if (totalMB > 4.5) {
      throw new Error(`Adjuntos muy pesados (${totalMB.toFixed(2)} MB).`);
    }

    console.log("📧 Enviando Nota de Venta", {
      to,
      cc,
      replyTo,
      subject,
      from: `${fromName} <no-reply@spartan.cl>`,
      atts: attachments.map((a) => a.filename),
      totalMB: totalMB.toFixed(2),
    });

    const data = await resend.emails.send({
      from: `${fromName} <no-reply@spartan.cl>`, // dominio verificado en Resend
      to,
      cc,
      replyTo,                                    // 👈 camelCase correcto
      subject,
      html,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content, // base64 sin data:...
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
