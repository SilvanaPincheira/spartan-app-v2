import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// URL pública de la hoja "Cotizaciones"
const URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTHJGESD71DkWv2kZWuYhuVMOPVKMp5S4eclXT7J7Yy9OUOIvh8mpdpGUNXCM5_XuPrThaoCefkPvzm/pub?gid=1191931814&single=true&output=csv";

// Función para normalizar cabeceras
function normalize(val: string) {
  return val?.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^\w_]/g, "");
}

export async function GET() {
  try {
    // 1️⃣ Obtener usuario autenticado desde Supabase
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const email = user.email?.toLowerCase().trim() ?? "";

    // 2️⃣ Leer CSV publicado desde Google Sheets
    const res = await fetch(URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo obtener la hoja Cotizaciones");

    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    if (!parsed.meta.fields)
      throw new Error("No se detectaron cabeceras en el archivo CSV");

    const headers = parsed.meta.fields.map(normalize);

    // 3️⃣ Convertir filas normalizadas
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const original = parsed.meta.fields?.[i] ?? "";
        obj[h] = (row[original] ?? "").toString().trim();
      });
      return obj;
    });

    // 4️⃣ Filtrar por Email Ejecutivo (campo en tu hoja)
    const filtered = data.filter(
      (row) => row["email_ejecutivo"]?.toLowerCase().trim() === email
    );

    // 5️⃣ Respuesta final
    return NextResponse.json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  } catch (err: any) {
    console.error("Error /api/cotizaciones:", err);
    return NextResponse.json(
      { error: "No se pudo leer Cotizaciones", details: err.message },
      { status: 500 }
    );
  }
}
