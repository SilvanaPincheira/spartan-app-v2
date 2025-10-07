// app/api/save-reclamo/route.ts
import { NextResponse } from "next/server";

/**
 * Recibe los datos del formulario de Reclamos (desde /ventas/reclamos/page.tsx)
 * y los reenvía al WebApp de Google Apps Script que guarda en tu hoja "Reclamos".
 */
export async function POST(req: Request) {
  try {
    // Leer datos enviados desde el formulario
    const body = await req.json();

    // URL del WebApp que apunta a tu Apps Script publicado como “Cualquiera con el enlace”
    const SHEET_WEBAPP_URL = process.env.SHEET_RECLAMOS_WEBAPP_URL!;
    if (!SHEET_WEBAPP_URL) {
      throw new Error("⚠️ Falta SHEET_RECLAMOS_WEBAPP_URL en .env.local o en Vercel");
    }

    // Enviar los datos al Apps Script (tu endpoint de Google Sheets)
    const res = await fetch(SHEET_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Validar respuesta
    if (!res.ok) {
      const text = await res.text();
      console.error("Error respuesta Sheets:", text);
      throw new Error(`Error al guardar en Google Sheets (HTTP ${res.status})`);
    }

    // Confirmar éxito al frontend
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("❌ Error guardando reclamo:", e);
    return NextResponse.json(
      { success: false, error: e.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
