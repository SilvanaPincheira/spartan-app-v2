// app/api/send-email/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// --- helper: arma el HTML de la evaluación de negocios ---
function buildEvaluacionHTML(payload: any) {
  const {
    cliente = "",
    rut = "",
    ejecutivo = "",
    fecha = "",
    viable = null,
    score = null,
    comentarios = "",
    indicadores = [] as Array<{ label: string; valor: string | number }>,
  } = payload || {};

  const chip = (ok: boolean | null) =>
    ok === null
      ? `<span style="background:#9ca3af;color:#fff;padding:2px 8px;border-radius:9999px;font-size:12px">Sin evaluar</span>`
      : ok
      ? `<span style="background:#059669;color:#fff;padding:2px 8px;border-radius:9999px;font-size:12px">Viable</span>`
      : `<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:9999px;font-size:12px">No viable</span>`;

  const indicadoresRows = (indicadores || [])
    .map(
      (i: { label: string; valor: string | number }) =>
        `<tr><td style="border:1px solid #e5e7eb;padding:8px">${i.label ?? ""}</td><td style="border:1px solid #e5e7eb;padding:8px;text-align:right">${i.valor ?? ""}</td></tr>`
    )
    .join("");

  return `
  <div style="font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#111827">
    <div style="max-width:720px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="margin:0 0 12px 0;font-size:20px;color:#111827">Evaluación de negocio – Spartan App</h2>
      <p style="margin:0 0 16px 0;color:#6b7280">Resumen automático de la evaluación.</p>

      <table style="width:100%;border-collapse:collapse;margin-top:8px">
        <tr>
          <td style="padding:6px 0;color:#6b7280">Cliente</td>
          <td style="padding:6px 0;text-align:right"><strong>${cliente}</strong></td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280">RUT</td>
          <td style="padding:6px 0;text-align:right">${rut}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280">Ejecutivo</td>
          <td style="padding:6px 0;text-align:right">${ejecutivo}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280">Fecha</td>
          <td style="padding:6px 0;text-align:right">${fecha}</td>
        </tr>
      </table>

      <div style="display:flex;gap:12px;align-items:center;margin:18px 0">
        <div>${chip(viable)}</div>
        ${
          score !== null && score !== undefined
            ? `<div style="background:#eef2ff;color:#3730a3;padding:2px 8px;border-radius:9999px;font-size:12px">Score: <strong>${score}</strong></div>`
            : ""
        }
      </div>

      ${
        indicadoresRows
          ? `
        <h3 style="margin:12px 0 6px 0;font-size:16px;color:#111827">Indicadores</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr>
              <th style="text-align:left;border:1px solid #e5e7eb;background:#f9fafb;padding:8px">Indicador</th>
              <th style="text-align:right;border:1px solid #e5e7eb;background:#f9fafb;padding:8px">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${indicadoresRows}
          </tbody>
        </table>`
          : ""
      }

      <h3 style="margin:18px 0 6px 0;font-size:16px;color:#111827">Comentarios</h3>
      <div style="white-space:pre-wrap;border:1px solid #e5e7eb;background:#fafafa;border-radius:8px;padding:12px">
        ${comentarios || "—"}
      </div>

      <p style="margin-top:20px;color:#6b7280;font-size:12px">Enviado automáticamente por Spartan App.</p>
    </div>
  </div>`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const to =
      (typeof body.to === "string" && body.to.trim()) ||
      "silvana.pincheira@spartan.cl";
    const subject =
      (typeof body.subject === "string" && body.subject.trim()) ||
      "Evaluación de negocio – Spartan App";

    // 🔹 Caso 1: Nota de Venta → email con PDF adjunto
    if (body.attachment) {
      const data = await resend.emails.send({
        from: "silvana.pincheira@spartan.cl", // remitente validado en Resend
        to,
        subject,
        html: body.message || "<p>Adjunto Nota de Venta en PDF</p>",
        attachments: [
          {
            filename: body.attachment.filename,
            content: body.attachment.content, // Base64 del PDF
          },
        ],
      });
      return NextResponse.json({ success: true, data });
    }

    // 🔹 Caso 2: Evaluación de Negocios → HTML formateado
    const html = buildEvaluacionHTML(body);
    const data = await resend.emails.send({
      from: "silvana.pincheira@spartan.cl",
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("❌ Error al enviar correo:", JSON.stringify(error, null, 2));
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
