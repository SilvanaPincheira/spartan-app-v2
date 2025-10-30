// app/api/save-to-sheets/route.ts
import { NextResponse } from "next/server";

// 👉 tu URL de Apps Script publicada como web app (con permisos "Cualquiera con el enlace")
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbw8fa8LJxAXkPox6j9Y3osDzfhuq-4XsuswsFoFc26xkJpJA-O1thDpLbw15Mu_GCw/exec";

export async function POST(req: Request) {
  try {
    // 1. Leer payload que viene desde page.tsx
    const payload = await req.json();

    // 2. Mandar al Apps Script
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // 3. Capturar respuesta cruda
    const text = await res.text();

    // 4. Intentar parsear como JSON
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      // Si no es JSON (ej: error HTML de Google)
      return NextResponse.json(
        {
          error: "Respuesta de Apps Script no es JSON",
          raw: text,
        },
        { status: 500 }
      );
    }

    // 5. Devolver JSON válido al frontend
    return NextResponse.json(json);
  } catch (err: any) {
    console.error("Error en save-to-sheets:", err);
    return NextResponse.json(
      {
        error: "Excepción en route.ts",
        message: String(err),
      },
      { status: 500 }
    );
  }
}
