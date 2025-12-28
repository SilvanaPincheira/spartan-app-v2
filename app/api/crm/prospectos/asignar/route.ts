import { NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.CRM_APPS_SCRIPT_URL;

function normEmail(x: any) {
  return String(x || "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    if (!APPS_SCRIPT_URL) {
      return NextResponse.json(
        { ok: false, error: "Falta env CRM_APPS_SCRIPT_URL en Vercel/.env" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const lead = body?.lead || {};

    // ✅ folio viene del body o del lead (para evitar “Folio requerido”)
    const folio = String(body?.folio || lead?.folio || "").trim();

    const asignado_a = normEmail(body?.asignado_a);
    const asignado_por = normEmail(body?.asignado_por);

    if (!folio) {
      return NextResponse.json(
        { ok: false, error: "Folio requerido (no viene ni en body.folio ni en body.lead.folio)" },
        { status: 400 }
      );
    }
    if (!asignado_a) return NextResponse.json({ ok: false, error: "asignado_a requerido" }, { status: 400 });
    if (!asignado_por) return NextResponse.json({ ok: false, error: "asignado_por requerido" }, { status: 400 });

    // 1) CREATE en CRM_DB (si existe, Apps Script devuelve duplicated=true)
    const createPayload = {
      action: "CREATE",

      // trazabilidad
      created_at: lead.created_at || new Date().toISOString(),
      folio,

      // ✅ fuente/origen real
      fuente: lead.origen_prospecto || lead.fuente || "BD",
      // ✅ id estable (si no viene source_id)
      source_id: lead.source_id || lead.lead_key || folio,

      // datos principales
      nombre_razon_social: lead.nombre_razon_social || "",
      rut: lead.rut || "",
      telefono: lead.telefono || "",
      correo: lead.correo || "",
      direccion: lead.direccion || "", // en hojas puede no venir
      rubro: lead.rubro || "",
      monto_proyectado: lead.monto_proyectado || "",

      // tu hoja trae IN/FB/HC/IND
      division: lead.division || "",

      etapa_id: lead.etapa_id || "",
      etapa_nombre: lead.etapa_nombre || "",

      fecha_cierre_id: lead.fecha_cierre_id || "",
      fecha_cierre_nombre: lead.fecha_cierre_nombre || "",

      prob_cierre_id: lead.prob_cierre_id || "",
      prob_cierre_nombre: lead.prob_cierre_nombre || "",

      origen_prospecto: lead.origen_prospecto || "",
      observacion: lead.observacion || "",

      ejecutivo_email: lead.ejecutivo_email || "",

      // estado inicial (el Apps Script igual lo defaultea)
      estado: "PENDIENTE_ASIGNACION",
      asignado_a: "",
      asignado_por: "",
      asignado_at: "",
    };

    const respCreate = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(createPayload),
    });

    const textCreate = await respCreate.text();
    let dataCreate: any;
    try {
      dataCreate = JSON.parse(textCreate);
    } catch {
      dataCreate = { ok: false, error: "Respuesta no JSON (CREATE)", raw: textCreate.slice(0, 300) };
    }

    if (!respCreate.ok || dataCreate?.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          error: dataCreate?.error || `Sheets error (CREATE ${respCreate.status})`,
          raw: dataCreate?.raw,
          debug: { folio, fuente: createPayload.fuente },
        },
        { status: 500 }
      );
    }

    // 2) ASIGNAR
    const respAssign = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "ASIGNAR",
        folio,
        asignado_a,
        asignado_por,
      }),
    });

    const textAssign = await respAssign.text();
    let dataAssign: any;
    try {
      dataAssign = JSON.parse(textAssign);
    } catch {
      dataAssign = { ok: false, error: "Respuesta no JSON (ASIGNAR)", raw: textAssign.slice(0, 300) };
    }

    if (!respAssign.ok || !dataAssign?.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: dataAssign?.error || `Sheets error (ASIGNAR ${respAssign.status})`,
          raw: dataAssign?.raw,
          debug: { folio, asignado_a, asignado_por },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, duplicated: !!dataCreate?.duplicated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
