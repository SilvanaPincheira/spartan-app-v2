import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    // ✅ Obtener usuario logueado
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userEmail = user?.email || "usuario@spartan.cl";
    const displayName = user?.user_metadata?.full_name || userEmail;

    const data = await req.json();

    // ✅ Destinatarios
    const to = [
      "sac@spartan.cl",
      "horacio.pavez@spartan.cl",
      "silvana.pincheira@spartan.cl",
    ];

    // ✅ Asunto dinámico con nombre o correo del ejecutivo
    const subject = `📥 Nueva Ficha de Cliente – ${displayName}`;

    // ✅ Tabla completa como la del Apps Script
    const tabla = `
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial, sans-serif;font-size:12px;width:100%;">
        <tr><td><b>Razón Social</b></td><td>${data.razonSocial || ""}</td></tr>
        <tr><td><b>RUT</b></td><td>${data.rut || ""}</td></tr>
        <tr><td><b>Nombre Fantasía</b></td><td>${data.nombreFantasia || ""}</td></tr>
        <tr><td><b>Giro</b></td><td>${data.giro || ""}</td></tr>
        <tr><td><b>Dirección</b></td><td>${data.direccion || ""}</td></tr>
        <tr><td><b>Comuna</b></td><td>${data.comuna || ""}</td></tr>
        <tr><td><b>Región</b></td><td>${data.region || ""}</td></tr>
        <tr><td><b>Teléfono</b></td><td>${data.telefono || ""}</td></tr>
        <tr><td><b>Email</b></td><td>${data.email || ""}</td></tr>
        <tr><td><b>Contacto Comercial</b></td><td>${data.contactoComercial} (${data.emailComercial || ""}, ${data.telefonoComercial || ""})</td></tr>
        <tr><td><b>Recepción Pedidos</b></td><td>${data.contactoRecepcion} (${data.emailRecepcion || ""}, ${data.telefonoRecepcion || ""})</td></tr>
        <tr><td><b>Pagos</b></td><td>${data.contactoPagos} (${data.emailPagos || ""}, ${data.telefonoPagos || ""})</td></tr>
        <tr><td><b>Dirección de Despacho</b></td><td>${data.direccionDespacho || ""}</td></tr>
        <tr><td><b>Ciudad</b></td><td>${data.ciudad || ""}</td></tr>
        <tr><td><b>Tipo Documento</b></td><td>${data.tipoDocumento || ""}</td></tr>
        <tr><td><b>Rubro</b></td><td>${data.rubro || ""}</td></tr>
        <tr><td><b>Condición de Pago</b></td><td>${data.condicionPago || ""}</td></tr>
        <tr><td><b>Cobrador Asignado</b></td><td>${data.cobrador || ""}</td></tr>
        <tr><td><b>Análisis Crédito</b></td><td>${data.analisisCredito || ""}</td></tr>
        <tr><td><b>Comentarios</b></td><td>${data.comentarios || ""}</td></tr>
      </table>
    `;

    // ✅ Cuerpo HTML completo
    const bodyHtml = `
      <h2>Ficha de Cliente pendiente de aprobación</h2>
      <p><b>Ingresado por:</b> ${displayName} (${userEmail})</p>
      <p>Se ha creado una nueva ficha de cliente en la hoja <b>clientesnuevos</b>.</p>
      ${tabla}
      <p>👉 Revisar hoja: 
        <a href="https://docs.google.com/spreadsheets/d/1yWLu-zSUUX0GjDKhRBGj6xOzZYUd901JoECa9hyEtF8/edit#gid=0" target="_blank">
          clientesnuevos
        </a>
      </p>
      <p style="font-size:12px;color:#777">
        Enviado automáticamente desde <b>Spartan One</b> – Clientes Nuevos
      </p>
    `;

    // 🚀 Enviar el correo
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
