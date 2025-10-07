import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // URL del Apps Script desplegado (la tuya)
    const SCRIPT_URL =
      "https://script.google.com/macros/s/AKfycbw2fHVJPDMTFZK7KzdwyCEUacJLr6pREvcN7lOxPQuc6OlcppqVbyTC1FJArpnVGRoK_A/exec";

    // Enviar los datos en formato JSON al script
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.text();

    // Apps Script puede no devolver JSON puro → se fuerza
    const success = data.includes("ok") || data.includes("success");

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error("❌ Error al guardar reclamo:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

