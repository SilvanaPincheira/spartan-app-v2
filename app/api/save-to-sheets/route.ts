// app/api/save-to-sheets/route.ts
import { NextResponse } from "next/server";

// ⚙️ URL de tu Apps Script publicado como Web App
// (asegúrate que tenga permisos "Cualquiera, incluso anónimo")
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxgTyjJavJdg30Z_EYOkcSVhWhgFdLYwWIVt-d9SEcwrCK5NbtjW4Aqa5cAlI2Ocmk0/exec";

export async function POST(req: Request) {
  try {
    // 1️⃣ Leer el cuerpo que envía la página de cotización
    const body = await req.json();

    // 2️⃣ Extraer el campo 'datos' (array con las filas)
    const datos = body.datos || [];

    // 3️⃣ Enviar al Apps Script en el formato correcto { datos: [...] }
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datos }),
    });

    // 4️⃣ Leer respuesta
    const text = await res.text();

    // 5️⃣ Intentar parsear como JSON
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Respuesta de Apps Script no es JSON", raw: text },
        { status: 500 }
      );
    }

    // 6️⃣ Devolver respuesta válida al frontend
    return NextResponse.json(json);
  } catch (err: any) {
    console.error("❌ Error en save-to-sheets:", err);
    return NextResponse.json(
      { error: "Error interno", message: String(err) },
      { status: 500 }
    );
  }
}

