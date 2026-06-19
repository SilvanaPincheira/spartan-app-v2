import { NextResponse } from "next/server";
import Papa from "papaparse";

const URL_NOTAS_VENTA =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2dwvhSGvvFFPBiRxUgF8Q99HkWJlyoFKLDo6Mmu4HvCH_hJtdyV_7WTrOjkUp6u0pMyAOf543M1UE/pub?output=csv";

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

function parseFechaChile(value: any) {
  const s = String(value ?? "").trim();
  if (!s) return null;

  const parts = s.split(/[\/\-]/);
  if (parts.length !== 3) return null;

  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy) return null;

  const fecha = new Date(yyyy, mm - 1, dd);
  fecha.setHours(0, 0, 0, 0);

  return fecha;
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

    const res = await fetch(URL_NOTAS_VENTA, { cache: "no-store" });

    if (!res.ok) {
      throw new Error("No se pudo obtener el CSV de notas de venta");
    }

    const text = await res.text();

    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (!parsed.meta.fields) {
      throw new Error("No se detectaron cabeceras en notas de venta");
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

    // FILTRO: últimos 3 días corridos
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const hace3Dias = new Date(hoy);
    hace3Dias.setDate(hoy.getDate() - 3);

    const rowsFiltradas = rows.filter((r) => {
      const fecha = parseFechaChile(r.fecha);
      if (!fecha) return false;

      return fecha >= hace3Dias && fecha <= hoy;
    });

    const agrupadas: Record<string, any> = {};

    for (const r of rowsFiltradas) {
      const numeroNV = r.numero_nv ?? "";
      const codigoCliente = r.codigo_cliente ?? "";
      const rut = r.rut ?? "";
      const cliente = r.cliente ?? "";
      const ejecutivo = r.ejecutivo ?? "";

      if (!numeroNV) continue;

      const claveNV = [
        numeroNV,
        codigoCliente || rut || cliente,
        ejecutivo,
      ].join("__");

      if (!agrupadas[claveNV]) {
        agrupadas[claveNV] = {
          claveNV,
          numeroNV,
          fecha: r.fecha ?? "",
          fechaEntrega: String(r.fecha_entrega ?? "").trim(),
          ordenCompraCliente: String(r.orden_compra_cliente ?? "").trim(),
          cliente,
          rut,
          codigoCliente,
          ejecutivo,
          direccion: r.direccion ?? "",
          correoEjecutivo: r.correo_ejecutivo ?? "",
          comentarios: r.comentarios ?? "",
          subtotal: toNumber(r.subtotal),
          total: toNumber(r.total),
          emailCol: r.email_col ?? "",
          estadoIntegracion: "PENDIENTE",
          lineas: [],
        };
      }

      agrupadas[claveNV].lineas.push({
        codigo: r.codigo ?? "",
        descripcion: r.descripcion ?? "",
        kg: toNumber(r.kg),
        cantidad: toNumber(r.cantidad),
        precioBase: toNumber(r.precio_base),
        descuento: toNumber(r.desc),
        precioVenta: toNumber(r.precio_venta),
        totalItem: toNumber(r.total_item),
      });
    }

    const data = Object.values(agrupadas);

    return NextResponse.json({
      ok: true,
      endpoint: "notas-venta",
      source: "google_sheets",
      filtro: "ultimos_3_dias",
      desde: hace3Dias.toISOString().slice(0, 10),
      hasta: hoy.toISOString().slice(0, 10),
      count: data.length,
      data,
    });
  } catch (err: any) {
    console.error("❌ Error /api/sap/notas-venta:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo leer Notas de Venta",
        details: err?.message || "Error inesperado",
      },
      { status: 500 }
    );
  }
}