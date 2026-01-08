import { NextResponse } from "next/server";

/* =========================
   CONFIG
   ========================= */

// URL CSV CRM_DB
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
   CSV PARSER ROBUSTO
   (respeta comillas, comas y textos largos)
   ========================= */
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur = "";
  let inQuotes = false;
  let row: string[] = [];

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      pushCell();
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      pushCell();
      pushRow();
      continue;
    }

    cur += ch;
  }

  pushCell();
  pushRow();

  if (rows.length < 2) return [];

  const headers = rows[0].map((h) =>
    h
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
  );

  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? "").trim();
    });
    return obj;
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

    /* =========================
       1️⃣ Descargar CRM_DB
       ========================= */
    const resp = await fetch(CRM_DB_CSV, { cache: "no-store" });
    if (!resp.ok) {
      throw new Error(`Error leyendo CRM_DB (${resp.status})`);
    }

    const csv = await resp.text();
    const rows = parseCSV(csv);

    /* =========================
       2️⃣ Normalizar + filtrar
       ========================= */
    const data = rows
      .map((r) => {
        const division = (r.division || "").toUpperCase();

        return {
          folio: r.folio || "",
          nombre_razon_social: r.nombre_razon_social || "",
          ejecutivo_email: normalize(r.asignado_a || r.ejecutivo_email || ""),
          estado: (r.estado || "").trim(),
          etapa_nombre: r.etapa_nombre || "",
          monto_proyectado: Number(r.monto_proyectado || 0),
          updated_at:
            r.updated_at ||
            r.asignado_at ||
            r.created_at ||
            "",
          division,
        };
      })
      .filter((r) => {
        // debe tener ejecutivo asignado
        if (!r.ejecutivo_email) return false;

        // si no tiene división, se muestra igual
        if (!r.division) return true;

        // si tiene división, validar contra scope de jefatura
        return scope.some((pref) => r.division.startsWith(pref));
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
