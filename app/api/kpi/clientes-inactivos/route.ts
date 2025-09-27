// app/api/kpi/clientes-inactivos/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { sheetUrl } = await req.json();

    // Reemplazar por tu Apps Script WebApp que entrega el CSV
    const res = await fetch(sheetUrl);
    if (!res.ok) throw new Error("Error leyendo Google Sheets");

    const text = await res.text();
    return NextResponse.json({ ok: true, csv: text });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
