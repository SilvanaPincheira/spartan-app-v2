// app/api/metas/route.ts
import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQeg3EGhKOHiA9cRDqPioN5oaHZUOpDxB1olx-H6jkUIdBnyRvgEBJwe3IQeb3N7e9rnsQy4UnOQlk1/gviz/tq?tqx=out:csv&sheet=Tabla_1";

    const res = await fetch(url);
    if (!res.ok) throw new Error("No se pudo leer Google Sheets");

    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    const normalize = (val: string) =>
      val?.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^\w_]/g, "");

    const headers = parsed.meta.fields?.map(normalize) || [];
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const orig = parsed.meta.fields?.[i] || "";
        obj[h] = row[orig] ?? "";
      });
      return obj;
    });

    const emailCol = headers.find((h) => h.includes("email"));
    const userEmail = user.email?.trim().toLowerCase();

    const filtered = emailCol
      ? data.filter((row) => row[emailCol]?.trim().toLowerCase() === userEmail)
      : [];

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error("Error leyendo hoja Metas:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
