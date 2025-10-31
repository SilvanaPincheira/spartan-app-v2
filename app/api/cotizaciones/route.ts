import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// 📊 URL pública actualizada (de tu hoja “Historial cotizaciones IND”)
const URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS_TD9sDzySN_-lkYQ159iIIQzU4ruzRuDJhLFfIgGDTc7NZm1w-Km8-BNwc_mS9-ZAq7oYyeTGuhhS/pub?gid=0&single=true&output=csv";

// Normalizador para cabeceras
function normalize(val: string) {
  return val
    ?.toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, ""); // elimina paréntesis y símbolos
}

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const email = user.email?.toLowerCase().trim() ?? "";

    // 🔹 Leer CSV publicado desde Google Sheets
    const res = await fetch(URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo obtener la hoja de cotizaciones");

    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    if (!parsed.meta.fields)
      throw new Error("No se detectaron cabeceras en el archivo CSV");

    const headers = parsed.meta.fields.map(normalize);

    // 🔹 Mapear las filas con cabeceras normalizadas
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const original = parsed.meta.fields?.[i] ?? "";
        obj[h] = (row[original] ?? "").toString().trim();
      });
      return obj;
    });

    // 🔹 Filtrar por ejecutivo (si lo deseas)
    const filtered = data.filter(
      (row) => row["email_ejecutivo"]?.toLowerCase().trim() === email
    );

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
