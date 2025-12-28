import { NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.CRM_APPS_SCRIPT_URL;

/**
 * POST /api/crm/prospectos/asignar
 * Body:
 * {
 *   lead_key: string,
 *   origen: "WEB"|"INOFOOD"|"FOOD SERVICE"|"REFERIDO",
 *   nombre_razon_social: string,
 *   correo: string,
 *   telefono?: string,
 *   contacto?: string,
 *   rubro?: string,
 *   monto_proyectado?: string,
 *   etapa_nombre?: string,
 *   observacion?: string,
 *   division?: string,        // IN/FB/etc
 *   asignado_a: string,
 *   asignado_por: string
 * }
 *
 * Este endpoint NO actualiza la hoja origen.
 * Debe CREAR el registro real en CRM_DB (prospectos) con folio correlativo y asignarlo.
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

    const lead_key = String(body?.lead_key || "").trim();
    const origen = String(body?.origen || "").trim(); // WEB/INOFOOD/...
    const asignado_a = String(body?.asignado_a || "").trim().toLowerCase();
    const asignado_por = String(body?.asignado_por || "").trim().toLowerCase();

    if (!lead_key) return NextResponse.json({ ok: false, error: "lead_key es obligatorio" }, { status: 400 });
    if (!origen) return NextResponse.json({ ok: false, error: "origen es obligatorio" }, { status: 400 });
    if (!asignado_a) return NextResponse.json({ ok: false, error: "asignado_a es obligatorio" }, { status: 400 });
    if (!asignado_por) return NextResponse.json({ ok: false, error: "asignado_por es obligatorio" }, { status: 400 });

    // Payload orientado a cabeceras CRM_DB (lo que Apps Script insertará)
    const payload = {
      action: "CREAR_Y_ASIGNAR", // 👈 NUEVO ACTION en Apps Script
      lead_key,
      origen_prospecto: origen,

      nombre_razon_social: String(body?.nombre_razon_social || "").trim(),
      correo: String(body?.correo || "").trim(),
      telefono: String(body?.telefono || "").trim(),
      direccion: String(body?.direccion || "").trim(), // puede venir vacío en leads externos
      rubro: String(body?.rubro || "").trim(),

      monto_proyectado: String(body?.monto_proyectado || "").trim(),
      etapa_nombre: String(body?.etapa_nombre || "").trim(),
      observacion: String(body?.observacion || "").trim(),

      // para tracking (si quieres guardarlo en una columna "fuente" o "source_id")
      fuente: origen,
      source_id: lead_key,

      // asignación
      asignado_a,
      asignado_por,

      // scope auxiliar (si lo quieres guardar)
      division: String(body?.division || "").trim(),
    };

    const resp = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

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

    // Apps Script debe devolver folio real creado en CRM_DB (correlativo)
    return NextResponse.json({ ok: true, folio: data?.folio || null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
