import { NextResponse } from "next/server";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx3496FQT05mD92gwYFxDHtmfx_JnftyzJumWXDt_kWX3s-ysVVdgwCI8D2igk9uHvP/exec"; // ← reemplaza con tu URL de Apps Script F&B

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    const json = JSON.parse(text);

    return NextResponse.json(json);
  } catch (err: any) {
    console.error("❌ Error guardando Cotización F&B:", err);
    return NextResponse.json(
      { error: "Error interno", message: String(err) },
      { status: 500 }
    );
  }
}
