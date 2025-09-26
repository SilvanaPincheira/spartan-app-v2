export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // 1️⃣ Usuario logeado
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2️⃣ Descargar CSV de la hoja Metas
    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQeg3EGhKOHiA9cRDqPioN5oaHZUOpDxB1olx-H6jkUIdBnyRvgEBJwe3IQeb3N7e9rnsQy4UnOQlk1/gviz/tq?tqx=out:csv&sheet=Hoja6"; 
    // 👆 Usa el nombre exacto de la pestaña (Hoja6) o el gid si prefieres

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "No se pudo leer Google Sheets" }, { status: 500 });
    }
    const text = await res.text();

    // 3️⃣ Parsear CSV
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    // 4️⃣ Normalizar cabeceras
    const normalize = (val: string) =>
      val?.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^\w_]/g, "");
    const headers = parsed.meta.fields?.map(normalize) || [];

    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const originalKey = parsed.meta.fields?.[i] || "";
        obj[h] = row[originalKey] ?? "";
      });
      return obj;
    });

    // 5️⃣ Filtrar por EMAIL_COL
    const filtered = data.filter((row) => {
      const rowEmail = row["email_col"]?.toString().trim().toLowerCase();
      return rowEmail && rowEmail === user.email?.toLowerCase();
    });

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error("🔥 Error en API Metas:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
