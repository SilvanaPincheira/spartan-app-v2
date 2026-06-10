import { NextResponse } from "next/server";
import Papa from "papaparse";

const URL_PRODUCTOS =
  "https://docs.google.com/spreadsheets/d/1UXVAxwzg-Kh7AWCPnPbxbEpzXnRPR2pDBKrRUFNZKZo/export?format=csv&gid=0";

function normalize(val: string) {
  return val
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "");
}

function toNumber(value: any) {
  const limpio = String(value ?? "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

function validarApiKey(req: Request) {
  const apiKey = req.headers.get("x-api-key")?.trim();
  const expected = process.env.SPARTANONE_API_KEY?.trim();

  return apiKey === expected;
}

export async function GET(req: Request) {
  try {
    if (!validarApiKey(req)) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const res = await fetch(URL_PRODUCTOS, { cache: "no-store" });

    if (!res.ok) {
      throw new Error("No se pudo obtener el CSV de productos");
    }

    const text = await res.text();

    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (!parsed.meta.fields) {
      throw new Error("No se detectaron cabeceras en productos");
    }

    const headers = parsed.meta.fields.map(normalize);

    const rows = (parsed.data as any[]).map((row) => {
      const obj: any = {};

      headers.forEach((h, i) => {
        const original = parsed.meta.fields?.[i] ?? "";
        obj[h] = (row[original] ?? "").toString().trim();
      });

      return obj;
    });

    const data = rows.map((r) => ({
      code: r.code ?? "",
      name: r.name ?? "",
      priceList: toNumber(r.price_list),
      cost: toNumber(r.cost),
      kilos: toNumber(r.kilos),

      preciosRegion: {
        regionMetropolitana: toNumber(r.region_metropolitana),
        arica: toNumber(r.arica),
        iquique: toNumber(r.iquique),
        antofagasta: toNumber(r.antofagasta),
        atacama: toNumber(r.atacama),
        coquimbo: toNumber(r.coquimbo),
        valparaiso: toNumber(r.valparaiso),
        ohiggins: toNumber(r.ohiggins),
        maule: toNumber(r.maule),
        biobio: toNumber(r.biobio),
        araucania: toNumber(r.araucania),
        losRios: toNumber(r.los_rios),
        losLagos: toNumber(r.los_lagos),
        chiloe: toNumber(r.chiloe),
      },
    }));

    return NextResponse.json({
      ok: true,
      endpoint: "productos",
      source: "google_sheets",
      count: data.length,
      data,
    });
  } catch (err: any) {
    console.error("❌ Error GET /api/sap/productos:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo leer Productos",
        details: err.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    if (!validarApiKey(req)) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    if (!process.env.SAP_SYNC_PRODUCTOS_APPS_SCRIPT_URL) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta variable SAP_SYNC_PRODUCTOS_APPS_SCRIPT_URL",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const data = Array.isArray(body) ? body : [body];

    if (data.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No se recibieron productos" },
        { status: 400 }
      );
    }

    const res = await fetch(process.env.SAP_SYNC_PRODUCTOS_APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tipo: "productos",
        accion: "nuevo",
        data,
      }),
    });

    const resultText = await res.text();

    let result: any;

    try {
      result = JSON.parse(resultText);
    } catch {
      result = {
        ok: false,
        raw: resultText,
      };
    }

    if (!res.ok || result?.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          endpoint: "productos",
          error: "No se pudo registrar diferencial de productos",
          result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      endpoint: "productos",
      source: "sap_sync_productos",
      accion: "nuevo",
      registros: result.registros ?? data.length,
      result,
    });
  } catch (err: any) {
    console.error("❌ Error POST /api/sap/productos:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "Error al recibir productos desde SAP",
        details: err?.message || "Error inesperado",
      },
      { status: 500 }
    );
  }
}