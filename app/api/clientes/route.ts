import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTHJGESD71DkWv2kZWuYhuVMOPVKMp5S4eclXT7J7Yy9OUOIvh8mpdpGUNXCM5_XuPrThaoCefkPvzm/pub?output=csv";

// Función para normalizar cabeceras
function normalize(val: string) {
  return val?.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^\w_]/g, "");
}

export async function GET() {
  try {
    // 1️⃣ Obtener usuario logueado desde Supabase Auth
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const email = user.email?.toLowerCase().trim() ?? "";

    // 2️⃣ Descargar el CSV público desde Google Sheets
    const res = await fetch(URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo obtener el archivo CSV");

    const text = await res.text();

    // 3️⃣ Parsear el CSV
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    if (!parsed.meta.fields)
      throw new Error("No se detectaron cabeceras en el archivo CSV");

    const headers = parsed.meta.fields.map(normalize);

    // 4️⃣ Crear objetos normalizados por fila
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const original = parsed.meta.fields?.[i] ?? "";
        obj[h] = (row[original] ?? "").toString().trim();
      });
      return obj;
    });

    // 5️⃣ Filtrar por el EMAIL_COL del usuario logueado
    const filtered = data.filter((row) => {
      const emailCol = row["email_col"]?.toLowerCase().trim();
      return emailCol && emailCol === email;
    });

    // 6️⃣ Respuesta JSON
    return NextResponse.json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  } catch (err: any) {
    console.error("Error /api/clientes:", err);
    return NextResponse.json(
      { error: "No se pudo leer Clientes", details: err.message },
      { status: 500 }
    );
  }
}
