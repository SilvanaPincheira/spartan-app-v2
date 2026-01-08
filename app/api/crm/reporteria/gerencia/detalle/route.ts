import { NextResponse } from "next/server";

/* =========================
   CONFIG
   ========================= */

// CRM_DB (prospectos)
const CRM_DB_CSV =
  process.env.CRM_DB_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

// HOJA EJECUTIVOS (jerarquía)
const EJECUTIVOS_CSV =
  process.env.EJECUTIVOS_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1esuJvNYKb5vxOOJSfemBHYOasEb4YvjTMM52NXTvmPWIs6phGHha7ZMt_yv-fw7G3-rPUI4UGBZW/pub?gid=0&single=true&output=csv";

// gerente general
const GERENTE_GENERAL = "jorge.beltran@spartan.cl";

/* =========================
   HELPERS
   ========================= */
function normalize(s = "") {
  return s.trim().toLowerCase();
}

/* =========================
   CSV PARSER ROBUSTO
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
    h.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, "_")
  );

  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? "").trim();
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

    /* =========================
       1️⃣ Cargar hoja EJECUTIVOS
       ========================= */
    const execResp = await fetch(EJECUTIVOS_CSV, { cache: "no-store" });
    if (!execResp.ok) {
      throw new Error(`Error leyendo Ejecutivos (${execResp.status})`);
    }

    const ejecutivosCsv = await execResp.text();
    const ejecutivosRows = parseCSV(ejecutivosCsv);

    const ejecutivos = ejecutivosRows.map((r) => ({
      email: normalize(r.email),
      gerencia: normalize(r.gerencia),
      supervisor: normalize(r.supervisor),
      division: (r.division || "").toUpperCase(),
    }));

    /* =========================
       2️⃣ Determinar ejecutivos visibles
       ========================= */
    let allowedExecutives: string[];

    if (viewerEmail === GERENTE_GENERAL) {
      // 👑 gerente general ve todo
      allowedExecutives = ejecutivos.map((e) => e.email);
    } else {
      allowedExecutives = ejecutivos
        .filter(
          (e) =>
            e.gerencia === viewerEmail ||
            e.supervisor === viewerEmail
        )
        .map((e) => e.email);
    }

    if (allowedExecutives.length === 0) {
      return NextResponse.json({
        ok: true,
        rows: [],
      });
    }

    /* =========================
       3️⃣ Cargar CRM_DB
       ========================= */
    const crmResp = await fetch(CRM_DB_CSV, { cache: "no-store" });
    if (!crmResp.ok) {
      throw new Error(`Error leyendo CRM_DB (${crmResp.status})`);
    }

    const crmCsv = await crmResp.text();
    const crmRows = parseCSV(crmCsv);

    /* =========================
       4️⃣ Normalizar y filtrar prospectos
       ========================= */
    const data = crmRows
      .map((r) => ({
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
        division: (r.division || "").toUpperCase(),
      }))
      .filter((r) => {
        if (!r.ejecutivo_email) return false;
        return allowedExecutives.includes(r.ejecutivo_email);
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
