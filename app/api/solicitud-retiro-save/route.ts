// app/api/solicitud-retiro-save/route.ts
import { NextResponse } from "next/server";

// 👉 tu URL de Apps Script publicada como web app (con permisos "Cualquiera con el enlace")
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxAEuzhsp_AsI4wjw5rtIcCEJzUZzHCmKtcevjZnoZl8ZMyAWvhvNA38Ht8Lz3KEIWmjw/exec";

export async function POST(req: Request) {
  try {
    // 1. Leer body { destinoSheetUrl, payload }
    const { destinoSheetUrl, payload } = await req.json();

    // 2. Mandar al Apps Script con destino + payload
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinoSheetUrl, payload }),
    });

    // 3. Capturar respuesta cruda
    const text = await res.text();

    // 4. Intentar parsear como JSON
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Respuesta de Apps Script no es JSON", raw: text },
        { status: 500 }
      );
    }

    // 5. Devolver JSON válido al frontend
    return NextResponse.json(json);
  } catch (err: any) {
    console.error("Error en solicitud-retiro-save:", err);
    return NextResponse.json(
      { error: "Excepción en route.ts", message: String(err) },
      { status: 500 }
    );
  }
}
