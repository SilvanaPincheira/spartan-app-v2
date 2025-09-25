import { NextResponse } from "next/server";
import Papa from "papaparse";

export async function GET() {
  try {
    const url =
      "https://docs.google.com/spreadsheets/d/19eeYuT7mhR-zoJ8oOsK6ZIm3YOOS9s_uklz2G7beIFI/gviz/tq?tqx=out:csv&sheet=Hoja1";

    const res = await fetch(url);
    const text = await res.text();

    // Parsear CSV con soporte de comillas y saltos de línea
    const parsed = Papa.parse(text, {
      header: true, // usa la primera fila como cabecera
      skipEmptyLines: true,
    });

    // Normalizar cabeceras
    const normalize = (val: string) =>
      val
        ?.toLowerCase()
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^\w_]/g, "");

    const headers = parsed.meta.fields?.map(normalize) || [];
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const originalKey = parsed.meta.fields?.[i] || "";
        obj[h] = row[originalKey] ?? "";
      });
      return obj;
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Error leyendo hoja:", err);
    return NextResponse.json(
      { error: "Error en servidor" },
      { status: 500 }
    );
  }
}
