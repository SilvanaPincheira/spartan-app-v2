export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

function normalize(val: string) {
  return val
    ?.toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "");
}

export async function GET(req: Request) {
  try {
    // 1️⃣ Usuario autenticado
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const email = user?.email?.toLowerCase().trim() ?? "";
    console.log("👤 Usuario email:", email);

    // 2️⃣ URL pública de tu hoja Metas
    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQeg3EGhKOHiA9cRDqPioN5oaHZUOpDxB1olx-H6jkUIdBnyRvgEBJwe3IQeb3N7e9rnsQy4UnOQlk1/pub?gid=1307997110&single=true&output=csv";

    // 3️⃣ Descargar CSV
    const res = await fetch(url);
    if (!res.ok) {
      console.error("❌ Error al leer hoja:", await res.text());
      return NextResponse.json({ error: "No se pudo leer la hoja" }, { status: 500 });
    }

    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    // 4️⃣ Normalizar cabeceras
    const headers = parsed.meta.fields?.map(normalize) || [];
    console.log("📝 Headers detectados:", headers);

    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const originalKey = parsed.meta.fields?.[i] || "";
        obj[h] = row[originalKey] ?? "";
      });
      return obj;
    });

    console.log("📊 Primeras filas:", data.slice(0, 3));

    // 5️⃣ Filtrar SOLO filas con email del usuario
    const filtered = data.filter((row) => {
      const rowEmail = (row["email_col"] ?? row["EMAIL_COL"] ?? "")
        .toString()
        .trim()
        .toLowerCase();
      console.log("➡️ Comparando fila:", `"${rowEmail}"`, "con usuario:", email);
      return rowEmail && rowEmail === email;
    });

    console.log("✅ Filas totales:", data.length, "→ Filtradas:", filtered.length);

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error("🔥 Error en API Metas:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
