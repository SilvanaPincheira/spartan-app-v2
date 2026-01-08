import { NextResponse } from "next/server";

/* =========================
   CONFIG
   ========================= */

// URL CSV CRM_DB (la misma que usas en otros módulos)
const CRM_DB_CSV =
  process.env.CRM_DB_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

// mismas reglas que frontend
const JEFATURA_SCOPE_PREFIJOS: Record<string, string[]> = {
  "claudia.borquez@spartan.cl": ["IN", "FB"],
  "jorge.beltran@spartan.cl": ["FB", "IN", "HC", "IND", "BSC", "IND_HL"],
  "alberto.damm@spartan.cl": ["IND", "BSC", "IND_HL"],
  "nelson.norambuena@spartan.cl": ["BSC"],
  "carlos.avendano@spartan.cl": ["HC"],
  "hernan.lopez@spartan.cl": ["IND_HL"],
};

function normalize(s = "") {
  return s.trim().toLowerCase();
}

/* =========================
   CSV PARSER SIMPLE
   ========================= */
function parseCSV(text: string): Record<string, string>[] {
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = header.split(",").map((h) => h.trim());

  return lines.map((line) => {
    const cols = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] || "").trim();
    });
    return row;
  });
}

/* =========================
   GET
   ========================= */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const viewerEmail = normalize(searchParams.get("viewerEmail") || "");

    if (!viewerEmail) {
      return NextResponse.json(
        { ok: false, error: "viewerEmail requerido" },
        { status: 400 }
      );
    }

    const scope = JEFATURA_SCOPE_PREFIJOS[viewerEmail];

    if (!scope) {
      return NextResponse.json(
        { ok: false, error: "No autorizado (no es jefatura)" },
        { status: 403 }
      );
    }

    // 1️⃣ Descargar CRM_DB
    const resp = await fetch(CRM_DB_CSV, { cache: "no-store" });
    if (!resp.ok) {
      throw new Error(`Error leyendo CRM_DB (${resp.status})`);
    }

    const csv = await resp.text();
    const rows = parseCSV(csv);

    // 2️⃣ Normalizar y filtrar por scope
    const data = rows
      .map((r) => ({
        folio: r.folio,
        nombre_razon_social: r.nombre_razon_social,
        ejecutivo_email: normalize(r.asignado_a),
        estado: r.estado,
        etapa_nombre: r.etapa,
        monto_proyectado: Number(r.monto_proyectado || 0),
        updated_at: r.updated_at || r.fecha_actualizacion || "",
        division: (r.division || "").toUpperCase(),
      }))
      .filter((r) => {
        // solo prospectos asignados
        if (!r.ejecutivo_email) return false;

        // filtrar por scope de jefatura
        return scope.some((pref) => r.division?.startsWith(pref));
      });

    return NextResponse.json({
      ok: true,
      rows: data,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Error interno",
      },
      { status: 500 }
    );
  }
}
