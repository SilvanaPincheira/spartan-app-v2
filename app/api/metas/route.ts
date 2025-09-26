// app/api/metas/route.ts
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

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const email = user.email?.toLowerCase() ?? "";

    // URL correcto convertido a CSV + gid de la pestaña
    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQeg3EGhKOHiA9cRDqPioN5oaHZUOpDxB1olx-H6jkUIdBnyRvgEBJwe3IQeb3N7e9rnsQy4UnOQlk1/pub?gid=1307997110&single=true&output=csv";

    const res = await fetch(url);
    if (!res.ok) {
      console.error("Error leyendo Metas:", await res.text());
      return NextResponse.json({ error: "No se pudo leer Metas" }, { status: 500 });
    }

    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    const headers = parsed.meta.fields?.map(normalize) || [];
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const orig = parsed.meta.fields?.[i] || "";
        obj[h] = row[orig] ?? "";
      });
      return obj;
    });

    // Debug: ver qué emails se están leyendo
    console.log("📋 Metas - emails leídos:", data.map(r => r["email_col"]).slice(0, 20));
    console.log("👤 Usuario:", email);

    const filtered = data.filter(
      (row) => row["email_col"]?.toString().trim().toLowerCase() === email
    );

    return NextResponse.json({ data: filtered });
  } catch (err: any) {
    console.error("🔥 Error en /api/metas:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
