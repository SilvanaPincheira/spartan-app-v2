import { NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.CRM_APPS_SCRIPT_URL;

export async function POST(req: Request) {
  try {
    if (!APPS_SCRIPT_URL) {
      return NextResponse.json(
        { ok: false, error: "Falta env CRM_APPS_SCRIPT_URL en Vercel/.env" },
        { status: 500 }
      );
    }

    const body = await req.json();

    // Validación mínima
    if (!body?.folio) {
      return NextResponse.json({ ok: false, error: "Folio requerido" }, { status: 400 });
    }
    if (!body?.nombre_razon_social || !body?.correo || !body?.direccion) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios (razón social, correo, dirección)" },
        { status: 400 }
      );
    }

    const resp = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await resp.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: text };
    }

    if (!resp.ok || data?.ok === false) {
      return NextResponse.json(
        { ok: false, error: data?.error || `Sheets error (${resp.status})` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, duplicated: !!data?.duplicated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
