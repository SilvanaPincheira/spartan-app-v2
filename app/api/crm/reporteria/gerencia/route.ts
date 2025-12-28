import { NextResponse } from "next/server";

const CSV_CRM_DB_URL =
  process.env.CRM_CRM_DB_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

type Row = Record<string, string>;

function normalizeHeader(h: string) {
  return (h || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let cur = "";
  let inQuotes = false;
  let row: string[] = [];

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };
  const pushRow = () => {
    if (row.some((c) => c.trim() !== "")) rows.push(row);
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
  const headers = rows[0].map(normalizeHeader);

  return rows.slice(1).map((cells) => {
    const obj: Row = {};
    headers.forEach((h, idx) => (obj[h] = (cells[idx] ?? "").trim()));
    return obj;
  });
}

function pick(r: Row, ...keys: string[]) {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function normUpper(s: string) {
  return (s || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function toMontoNumber(raw: string) {
  const n = Number(String(raw || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseIsoDate(s: string) {
  const t = Date.parse(s || "");
  return Number.isFinite(t) ? new Date(t) : null;
}

function parseProbFactor(probNombre: string, estadoKey: string) {
  if (estadoKey === "CERRADO_GANADO") return 1;
  if (estadoKey === "NO_GANADO" || estadoKey === "CERRADO_PERDIDO") return 0;

  const matches = String(probNombre || "").match(/(\d+)\s*%/g);
  if (!matches || matches.length === 0) return 0;

  const values = matches
    .map((x) => Number(String(x).replace(/[^\d]/g, "")))
    .filter((n) => Number.isFinite(n));

  if (!values.length) return 0;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.max(0, Math.min(1, avg / 100));
}

const ESTADOS_ORDER = [
  "ASIGNADO",
  "EN_GESTION",
  "CONTACTADO",
  "REUNION",
  "LEVANTAMIENTO",
  "PROPUESTA",
  "INSTALADO_1_O_C",
  "CERRADO_GANADO",
  "NO_GANADO",
] as const;

const ESTADOS_LABEL: Record<string, string> = {
  ASIGNADO: "Asignado",
  EN_GESTION: "En gestión",
  CONTACTADO: "Contactado",
  REUNION: "Reunión",
  LEVANTAMIENTO: "Levantamiento",
  PROPUESTA: "Propuesta",
  INSTALADO_1_O_C: "Instalado, 1° o/c",
  CERRADO_GANADO: "Cerrado ganado",
  NO_GANADO: "No ganado",
};

function normalizeEstadoToKey(estadoRaw: string) {
  const n = normUpper(estadoRaw);

  if (n === "EN_GESTION") return "EN_GESTION";
  if (n === "CERRADO_GANADO") return "CERRADO_GANADO";
  if (n === "NO_GANADO") return "NO_GANADO";
  if (n === "REUNION") return "REUNION";
  if (n === "LEVANTAMIENTO") return "LEVANTAMIENTO";
  if (n === "PROPUESTA") return "PROPUESTA";
  if (n === "CONTACTADO") return "CONTACTADO";
  if (n === "ASIGNADO") return "ASIGNADO";

  if (n.includes("INSTALADO") && (n.includes("1") || n.includes("O_C") || n.includes("OC"))) {
    return "INSTALADO_1_O_C";
  }

  return n || "ASIGNADO";
}

function countKey(raw: string) {
  const s = String(raw || "").trim();
  return s ? s : "—";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const division = searchParams.get("division") || "";
    const ejecutivo = (searchParams.get("ejecutivo") || "").trim().toLowerCase();
    const origen = (searchParams.get("origen") || "").trim().toUpperCase();

    const onlyAssigned = searchParams.get("onlyAssigned") === "1";
    const onlyClosed = searchParams.get("onlyClosed") === "1";
    const includeAssigned = searchParams.get("includeAssigned") !== "0";

    const dFrom = from ? parseIsoDate(from) : null;
    const dTo = to ? parseIsoDate(to) : null;

    const res = await fetch(CSV_CRM_DB_URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `No se pudo leer CRM_DB (${res.status})` },
        { status: 500 }
      );
    }

    const text = await res.text();
    const rows = parseCsv(text);

    const filtered = rows.filter((r) => {
      const created = parseIsoDate(pick(r, "created_at"));

      if (dFrom && (!created || created < dFrom)) return false;
      if (dTo && (!created || created > dTo)) return false;

      const div = (pick(r, "division") || "").trim().toUpperCase();
      if (division && div !== division.toUpperCase()) return false;

      const ej = (pick(r, "asignado_a", "ejecutivo_email") || "").trim().toLowerCase();
      if (ejecutivo && ej !== ejecutivo) return false;

      const org = (pick(r, "origen_prospecto") || "").trim().toUpperCase();
      if (origen && org !== origen) return false;

      const estadoKey = normalizeEstadoToKey(pick(r, "estado"));
      const isAssigned = estadoKey === "ASIGNADO" || !!pick(r, "asignado_a");
      const isClosed = estadoKey === "CERRADO_GANADO" || estadoKey === "NO_GANADO";

      if (!includeAssigned && isAssigned) return false;
      if (onlyAssigned && !isAssigned) return false;
      if (onlyClosed && !isClosed) return false;

      return true;
    });

    let total = 0;
    let asignados = 0;
    let contactados = 0;
    let cerradosGanado = 0;
    let noGanado = 0;

    let pipelineMonto = 0;
    let forecastMonto = 0;

    const countByEstado: Record<string, number> = {};
    const countByOrigen: Record<string, number> = {};

    // ✅ NUEVO: tablas para reporteria
    const countByFechaCierre: Record<string, number> = {};
    const countByProbCierre: Record<string, number> = {};

    const byEjecutivo: Record<
      string,
      { ejecutivo: string; count: number; pipeline: number; forecast: number; ganados: number; noGanados: number }
    > = {};

    for (const r of filtered) {
      total++;

      const estadoKey = normalizeEstadoToKey(pick(r, "estado"));
      countByEstado[estadoKey] = (countByEstado[estadoKey] || 0) + 1;

      const org = countKey((pick(r, "origen_prospecto") || "").trim().toUpperCase());
      countByOrigen[org] = (countByOrigen[org] || 0) + 1;

      // ✅ NUEVO: fecha/prob cierre por nombre (categorías)
      const fechaCierreNombre = countKey(pick(r, "fecha_cierre_nombre"));
      countByFechaCierre[fechaCierreNombre] = (countByFechaCierre[fechaCierreNombre] || 0) + 1;

      const probCierreNombre = countKey(pick(r, "prob_cierre_nombre"));
      countByProbCierre[probCierreNombre] = (countByProbCierre[probCierreNombre] || 0) + 1;

      const monto = toMontoNumber(pick(r, "monto_proyectado"));
      const factor = parseProbFactor(probCierreNombre, estadoKey);
      const forecast = monto * factor;

      const isClosed = estadoKey === "CERRADO_GANADO" || estadoKey === "NO_GANADO";
      if (!isClosed) {
        pipelineMonto += monto;
        forecastMonto += forecast;
      }

      if (estadoKey === "ASIGNADO" || pick(r, "asignado_a")) asignados++;
      if (estadoKey === "CONTACTADO") contactados++;
      if (estadoKey === "CERRADO_GANADO") cerradosGanado++;
      if (estadoKey === "NO_GANADO") noGanado++;

      const ej = (pick(r, "asignado_a", "ejecutivo_email") || "—").trim().toLowerCase();
      if (!byEjecutivo[ej]) {
        byEjecutivo[ej] = { ejecutivo: ej, count: 0, pipeline: 0, forecast: 0, ganados: 0, noGanados: 0 };
      }

      byEjecutivo[ej].count += 1;
      if (!isClosed) {
        byEjecutivo[ej].pipeline += monto;
        byEjecutivo[ej].forecast += forecast;
      } else {
        if (estadoKey === "CERRADO_GANADO") byEjecutivo[ej].ganados += 1;
        if (estadoKey === "NO_GANADO") byEjecutivo[ej].noGanados += 1;
      }
    }

    const estadoSeries = ESTADOS_ORDER.map((k) => ({
      key: k,
      name: ESTADOS_LABEL[k] || k,
      value: countByEstado[k] || 0,
    }));

    const origenSeries = Object.entries(countByOrigen)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const ejecutivoSeries = Object.values(byEjecutivo)
      .map((x) => ({
        ejecutivo: x.ejecutivo,
        count: x.count,
        pipeline: Math.round(x.pipeline),
        forecast: Math.round(x.forecast),
        ganados: x.ganados,
        noGanados: x.noGanados,
      }))
      .sort((a, b) => b.pipeline - a.pipeline);

    // ✅ NUEVO: series para tablas (fecha cierre / prob cierre)
    const fechaCierreSeries = Object.entries(countByFechaCierre)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const probCierreSeries = Object.entries(countByProbCierre)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return NextResponse.json({
      ok: true,
      filters: { from, to, division, ejecutivo, origen, onlyAssigned, onlyClosed, includeAssigned },
      kpis: {
        total,
        asignados,
        contactados,
        cerradosGanado,
        noGanado,
        pipelineMonto: Math.round(pipelineMonto),
        forecastMonto: Math.round(forecastMonto),
      },
      charts: {
        estados: estadoSeries,
        origenes: origenSeries,
        ejecutivos: ejecutivoSeries,

        // ✅ NUEVO
        fechaCierre: fechaCierreSeries,
        probCierre: probCierreSeries,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
