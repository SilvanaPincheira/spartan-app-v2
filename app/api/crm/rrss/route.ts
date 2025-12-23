// app/api/crm/rrss/route.ts
import { NextResponse } from "next/server";

const RRSS_APPS_SCRIPT_URL = process.env.CRM_RRSS_APPS_SCRIPT_URL;

type Action = "CREATE" | "LIST" | "MARK_IMPORTED" | "UPDATE_STATUS";

function asString(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export async function POST(req: Request) {
  try {
    if (!RRSS_APPS_SCRIPT_URL) {
      return NextResponse.json(
        { ok: false, error: "Falta env CRM_RRSS_APPS_SCRIPT_URL en Vercel/.env" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = asString(body?.action || "LIST").trim().toUpperCase() as Action;

    // ------------------------------
    // Validaciones mínimas por acción
    // ------------------------------
    if (action === "CREATE") {
      const nombre = asString(body?.nombre_razon_social).trim();
      const correo = asString(body?.correo).trim();
      const telefono = asString(body?.telefono).trim();
      if (!nombre) {
        return NextResponse.json(
          { ok: false, error: "nombre_razon_social requerido" },
          { status: 400 }
        );
      }
      if (!correo && !telefono) {
        return NextResponse.json(
          { ok: false, error: "Debe venir correo o telefono" },
          { status: 400 }
        );
      }
    }

    if (action === "LIST") {
      // opcionales: estado_lead, limit, offset
      // sin validación estricta
    }

    if (action === "MARK_IMPORTED") {
      const sourceId = asString(body?.source_id).trim();
      const crmFolio = asString(body?.crm_folio).trim();
      if (!sourceId) {
        return NextResponse.json(
          { ok: false, error: "source_id requerido" },
          { status: 400 }
        );
      }
      if (!crmFolio) {
        return NextResponse.json(
          { ok: false, error: "crm_folio requerido" },
          { status: 400 }
        );
      }
    }

    if (action === "UPDATE_STATUS") {
      const sourceId = asString(body?.source_id).trim();
      const estado = asString(body?.estado_lead).trim();
      if (!sourceId) {
        return NextResponse.json(
          { ok: false, error: "source_id requerido" },
          { status: 400 }
        );
      }
      if (!estado) {
        return NextResponse.json(
          { ok: false, error: "estado_lead requerido" },
          { status: 400 }
        );
      }
    }

    // ------------------------------
    // Proxy a Apps Script
    // ------------------------------
    const resp = await fetch(RRSS_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, action }),
      cache: "no-store",
    });

    const text = await resp.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: "Respuesta no JSON desde Apps Script", raw: text.slice(0, 500) };
    }

    if (!resp.ok || data?.ok === false) {
      return NextResponse.json(
        { ok: false, error: data?.error || `RRSS_BD error (${resp.status})`, raw: data?.raw },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
