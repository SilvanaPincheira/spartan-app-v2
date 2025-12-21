import { NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.CRM_APPS_SCRIPT_URL;

export async function POST(req: Request) {
  try {
    if (!APPS_SCRIPT_URL) {
      return NextResponse.json(
        { ok: false, error: "Falta env CRM_APPS_SCRIPT_URL" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { folio, autorizado_por } = body;

    if (!folio || !autorizado_por) {
      return NextResponse.json(
        { ok: false, error: "folio y autorizado_por son obligatorios" },
        { status: 400 }
      );
    }

    const resp = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "AUTORIZAR",
        folio,
        autorizado_por,
      }),
    });

    const text = await resp.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Respuesta inválida de Apps Script" },
        { status: 500 }
      );
    }

    if (!data.ok) {
      return NextResponse.json(
        { ok: false, error: data.error || "No se pudo autorizar" },
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
