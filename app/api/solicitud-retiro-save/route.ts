// app/api/solicitud-retiro-save/route.ts
import { NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL_RETIRO; // <-- ponla en env

export async function POST(req: Request) {
  try {
    if (!APPS_SCRIPT_URL) {
      throw new Error("Falta APPS_SCRIPT_URL_RETIRO en variables de entorno.");
    }

    // 1) Leer body
    const body = await req.json();
    const destinoSheetUrl = body?.destinoSheetUrl as string;
    const payload = body?.payload;

    if (!destinoSheetUrl || typeof destinoSheetUrl !== "string") {
      return NextResponse.json(
        { ok: false, error: "destinoSheetUrl inválido o faltante." },
        { status: 400 }
      );
    }
    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { ok: false, error: "payload inválido o faltante." },
        { status: 400 }
      );
    }

    // 2) Timeout por si Apps Script se cuelga
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 20000); // 20s

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinoSheetUrl, payload }),
      signal: ac.signal,
    }).finally(() => clearTimeout(t));

    const raw = await res.text();

    // 3) Si no es 2xx, devolver detalle
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status, statusText: res.statusText, raw },
        { status: 502 }
      );
    }

    // 4) Intentar parsear JSON
    try {
      const json = JSON.parse(raw);
      return NextResponse.json(json);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Respuesta de Apps Script no es JSON", raw },
        { status: 500 }
      );
    }
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? "Timeout al llamar Apps Script (20s)."
        : String(err?.message || err);
    console.error("Error en solicitud-retiro-save:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
