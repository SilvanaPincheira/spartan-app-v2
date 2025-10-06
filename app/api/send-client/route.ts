// app/api/send-client/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const to = ["cobranzas@spartan.cl", "sac@spartan.cl"];
    const subject = `🆕 Nuevo Cliente Ingresado: ${data.razonSocial || "Sin nombre"}`;

    const bodyHtml = `
      <h2>Nuevo Cliente Registrado</h2>
      <p><b>Razón Social:</b> ${data.razonSocial}</p>
      <p><b>RUT:</b> ${data.rut}</p>
      <p><b>Nombre de Fantasía:</b> ${data.nombreFantasia}</p>
      <p><b>Contacto Comercial:</b> ${data.contactoComercial} (${data.emailComercial || "Sin email"})</p>
      <p><b>Condición de Pago:</b> ${data.condicionPago}</p>
      <p><b>Comentarios:</b> ${data.comentarios || "(sin comentarios)"}</p>
      <hr />
      <p style="font-size:12px;color:#777">
        Enviado automáticamente desde <b>Spartan App</b> (Clientes Nuevos)
      </p>
    `;

    // 👇 Versión correcta del SDK Resend
    const { data: result, error } = await resend.emails.send({
      from: "Spartan App <no-reply@spartan.cl>",
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
    console.error("❌ Error general:", error);
    return NextResponse.json({ ok: false, error: error.message });
  }
}
