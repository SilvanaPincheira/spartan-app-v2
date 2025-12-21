import { NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.CRM_APPS_SCRIPT_URL;

/**
 * POST /api/crm/asignar
 * Body:
 * {
 *   folio: string,
 *   asignado_a: string,     // email/login del ejecutivo
 *   asignado_por: string    // email/login de jefatura
 * }
 */
export async function POST(req: Request) {
  try {
    if (!APPS_SCRIPT_URL) {
      return NextResponse.json(
        { ok: false, error: "Falta env CRM_APPS_SCRIPT_URL en Vercel" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const folio = String(body?.folio || "").trim();
    const asignado_a = String(body?.asignado_a || "").trim().toLowerCase();
    const asignado_por = String(body?.asignado_por || "").trim().toLowerCase();

    if (!folio) {
      return NextResponse.json(
        { ok: false, error: "folio es obligatorio" },
        { status: 400 }
      );
    }
    if (!asignado_a) {
      return NextResponse.json(
        { ok: false, error: "asignado_a es obligatorio" },
        { status: 400 }
      );
    }
    if (!asignado_por) {
      return NextResponse.json(
        { ok: false, error: "asignado_por es obligatorio" },
        { status: 400 }
      );
    }

    // 🔒 Llamamos Apps Script desde el backend (evita CORS)
    const resp = await fetch(APPS_SCRIPT_URL, {
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

    // Manejo robusto (Apps Script puede devolver texto)
    const text = await resp.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: "Respuesta no JSON desde Apps Script", raw: text.slice(0, 300) };
    }

    if (!resp.ok || !data?.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || `Sheets error (${resp.status})`, raw: data?.raw },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
