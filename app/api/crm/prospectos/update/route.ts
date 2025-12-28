import { NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.CRM_APPS_SCRIPT_URL;

export async function POST(req: Request) {
  try {
    if (!APPS_SCRIPT_URL) {
      return NextResponse.json(
        { ok: false, error: "Falta CRM_APPS_SCRIPT_URL" },
        { status: 500 }
      );
    }

    const body = await req.json();

    if (!body?.folio) {
      return NextResponse.json(
        { ok: false, error: "Folio requerido" },
        { status: 400 }
      );
    }

    const resp = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "UPDATE",
        folio: body.folio,

        // opcionales
        estado: body.estado,
        etapa_id: body.etapa_id,
        etapa_nombre: body.etapa_nombre,
        observacion: body.observacion,
        ejecutivo_email: body.ejecutivo_email,
      }),
    });

    const text = await resp.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: text };
    }

    if (!resp.ok || !data?.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || "Error UPDATE CRM_DB" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}
