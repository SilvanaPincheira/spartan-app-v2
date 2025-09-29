import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { to, cliente, fecha, items, total } = await req.json();

    // HTML dinámico de la Nota de Venta
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color:#0056b3;">Nota de Venta - Spartan App</h2>
        <p>Cliente: <strong>${cliente}</strong></p>
        <p>Fecha: <strong>${fecha}</strong></p>
        <table style="border-collapse: collapse; width: 100%; margin-top: 10px;">
          <thead>
            <tr>
              <th style="border:1px solid #ddd; padding:8px;">Código</th>
              <th style="border:1px solid #ddd; padding:8px;">Descripción</th>
              <th style="border:1px solid #ddd; padding:8px;">Cantidad</th>
              <th style="border:1px solid #ddd; padding:8px;">Precio</th>
              <th style="border:1px solid #ddd; padding:8px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((i: any) => `
              <tr>
                <td style="border:1px solid #ddd; padding:8px;">${i.codigo}</td>
                <td style="border:1px solid #ddd; padding:8px;">${i.descripcion}</td>
                <td style="border:1px solid #ddd; padding:8px; text-align:center;">${i.cantidad}</td>
                <td style="border:1px solid #ddd; padding:8px; text-align:right;">$${i.precio}</td>
                <td style="border:1px solid #ddd; padding:8px; text-align:right;">$${i.total}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <p style="margin-top:20px; font-weight:bold; font-size:16px;">
          Total: $${total}
        </p>
      </div>
    `;

    // Enviar correo (sin PDF adjunto)
    const data = await resend.emails.send({
      from: "sac@spartan.cl",
      to,
      subject: "Nota de venta Spartan App",
      html,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error al enviar correo:", error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
