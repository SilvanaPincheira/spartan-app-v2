import { NextResponse } from "next/server";
import Papa from "papaparse";

const URL_PRECIOS =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTgqYFCO_ZwRNBs46pb_mgZud4pofl18GetbAmAR4_AkQq9IHkh5X67ge7eCD5Kwh-jYL5pEVV0iToa/pub?gid=331408478&single=true&output=csv";

function normalize(val: string) {
  return val
    ?.toLowerCase()
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
  return (
    req.headers.get("x-api-key") ===
    process.env.SPARTANONE_API_KEY
  );
}

export async function GET(req: Request) {
  try {
    if (!validarApiKey(req)) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const res = await fetch(URL_PRECIOS, {
      cache: "no-store",
    });

    const text = await res.text();

    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    const headers =
      parsed.meta.fields?.map(normalize) ?? [];

    const rows = (parsed.data as any[]).map((row) => {
      const obj: any = {};

      headers.forEach((h, i) => {
        const original = parsed.meta.fields?.[i] ?? "";
        obj[h] = row[original];
      });

      return obj;
    });

    const data = rows.map((r) => ({
      codigoSN: r.codigo_sn ?? "",
      itemCode: r.numero_de_articulo ?? "",
      descripcion: r.descripcion_del_articulo ?? "",
      precioEspecial: toNumber(r.precio_especial),
      comision: toNumber(r.comision),
      precioCosto: toNumber(r.precio_costo),
      margen: r.margen ?? "",
      fechaVencimiento: r.fecha_vencimiento ?? "",
      ejecutivo: r.ejecutivo ?? "",
      nombreSN: r.nombre_sn ?? "",
      precioLista: toNumber(r.precio_lista),
    }));

    return NextResponse.json({
      ok: true,
      endpoint: "precios-especiales",
      source: "google_sheets",
      count: data.length,
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
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

    const body = await req.json();

    const res = await fetch(
      process.env.SAP_SYNC_PRECIOS_APPS_SCRIPT_URL!,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipo: "precios_especiales",
          accion: "nuevo",
          data: [body],
        }),
      }
    );

    const result = await res.json();

    return NextResponse.json({
      ok: true,
      endpoint: "precios-especiales",
      source: "sap_sync_precios",
      accion: "nuevo",
      registros: 1,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo registrar diferencial",
        details: err.message,
      },
      { status: 500 }
    );
  }
}