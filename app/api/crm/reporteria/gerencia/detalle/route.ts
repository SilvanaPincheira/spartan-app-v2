import { NextResponse } from "next/server";

/* =========================
   CONFIG
   ========================= */

// CRM_DB
const CRM_DB_CSV =
  process.env.CRM_DB_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

// HOJA EJECUTIVOS
const EJECUTIVOS_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1esuJvNYKb5vxOOJSfemBHYOasEb4YvjTMM52NXTvmPWIs6phGHha7ZMt_yv-fw7G3-rPUI4UGBZW/pub?gid=0&single=true&output=csv";

// gerente general
const GERENTE_GENERAL = "jorge.beltran@spartan.cl";

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

    /* =========================
       1️⃣ Cargar EJECUTIVOS
       ========================= */
    const execResp = await fetch(EJECUTIVOS_CSV, { cache: "no-store" });
    if (!execResp.ok) {
      throw new Error(`Error leyendo hoja Ejecutivos (${execResp.status})`);
    }

    const execCsv = await execResp.text();
    const ejecutivosRaw = parseCSV(execCsv);

    const ejecutivos = ejecutivosRaw.map((e) => ({
      email: normalize(e.email),
      division: (e.division || "").toUpperCase(),
    }));

    /* =========================
       2️⃣ Determinar ejecutivos visibles
       ========================= */
    let allowedExecutives: string[];

    if (viewerEmail === GERENTE_GENERAL) {
      // Jorge ve todo
      allowedExecutives = ejecutivos.map((e) => e.email);
    } else {
      // divisiones del viewer
      const viewerDivs = ejecutivos
        .filter((e) => e.email === viewerEmail)
        .map((e) => e.division);

      if (viewerDivs.length === 0) {
        // no encontrado en hoja → no ve nada
        return NextResponse.json({ ok: true, rows: [] });
      }

      allowedExecutives = ejecutivos
        .filter((e) => viewerDivs.includes(e.division))
        .map((e) => e.email);
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
       4️⃣ Map + filtro final
       ========================= */
    const data = crmRows
      .map((r) => {
        const ejecutivo = normalize(r.asignado_a || r.ejecutivo_email || "");

        return {
          folio: r.folio || "",
          nombre_razon_social: r.nombre_razon_social || "",
          ejecutivo_email: ejecutivo,
          estado: (r.estado || "").trim(),
          etapa_nombre: r.etapa_nombre || "",
          monto_proyectado: Number(r.monto_proyectado || 0),
          updated_at:
            r.updated_at ||
            r.asignado_at ||
            r.created_at ||
            "",
        };
      })
      .filter((r) => r.ejecutivo_email && allowedExecutives.includes(r.ejecutivo_email));

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
