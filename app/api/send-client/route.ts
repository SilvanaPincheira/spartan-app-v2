import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    // 🧠 Obtener usuario logueado desde Supabase
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userEmail = user?.email || "usuario@spartan.cl";
    const displayName = user?.user_metadata?.full_name || "";

    const data = await req.json();

    // 🧩 Destinatarios internos
    const to = [
      "sac@spartan.cl",
      "cobranzas@spartan.cl",
      "silvana.pincheira@spartan.cl",
    ];

    // 📌 Asunto con nombre o email del ejecutivo
    const subject = `🆕 Nueva Ficha de Cliente – ${displayName || userEmail}`;

    // 💌 Cuerpo del correo
    const bodyHtml = `
      <h2>Ficha de Cliente pendiente de aprobación</h2>
      <p><b>Ingresado por:</b> ${displayName || userEmail}</p>
      <p><b>Razón Social:</b> ${data.razonSocial}</p>
      <p><b>RUT:</b> ${data.rut}</p>
      <p><b>Nombre de Fantasía:</b> ${data.nombreFantasia}</p>
      <p><b>Giro:</b> ${data.giro}</p>
      <p><b>Contacto Comercial:</b> ${data.contactoComercial} (${data.emailComercial})</p>
      <p><b>Condición de Pago:</b> ${data.condicionPago}</p>
      <p><b>Comentarios:</b> ${data.comentarios || "(sin comentarios)"}</p>
      <hr />
      <p style="font-size:12px;color:#777">
        Enviado automáticamente desde <b>Spartan One</b> – Clientes Nuevos
      </p>
    `;

    // 🚀 Enviar correo con Resend
    const { data: result, error } = await resend.emails.send({
      from: "Spartan One <no-reply@spartan.cl>",
      to,
      subject,
      html: bodyHtml,
    });

    if (error) {
      console.error("❌ Error al enviar correo:", error);
      return NextResponse.json({ ok: false, error: error.message });
    }

    return NextResponse.json({ ok: true, id: result?.id });
  } catch (error: any) {
    console.error("🔥 Error general en send-client:", error);
    return NextResponse.json({ ok: false, error: error.message });
  }
}
