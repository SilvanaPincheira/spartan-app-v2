// app/api/crm/reporteria/gerencia/route.ts
import { NextResponse } from "next/server";

/** =========================
 *  CRM_DB
 *  ========================= */
const CSV_CRM_DB_URL =
  process.env.CRM_CRM_DB_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

/** =========================
 *  Ejecutivos (Sheet)
 *  =========================
 * Cabeceras: nombre | email | zona | gerencia | supervisor | cargo | division
 */
const EJECUTIVOS_SHEET_ID =
  process.env.CRM_EJECUTIVOS_SHEET_ID || "1VwCOaGlF7uXJH8wbPX6V81gLm3PMAonaG6Ts-_ye6rY";
const EJECUTIVOS_GID = process.env.CRM_EJECUTIVOS_GID || "0";

function gsheetCsvUrl(sheetId: string, gid: string) {
  // gviz/tq funciona con sheets normales (sin publicar)
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

/** =========================
 *  Seguridad: scopes jefaturas
 *  (API debe ENFORZAR, no confiar solo en el page)
 *  ========================= */
const JEFATURA_SCOPE_PREFIJOS: Record<string, string[]> = {
  "claudia.borquez@spartan.cl": ["IN", "FB"],
  "jorge.beltran@spartan.cl": ["FB", "IN", "HC", "IND"], // gerente general (igual bypass total)
  "alberto.damm@spartan.cl": ["IND"],
  "nelson.norambuena@spartan.cl": ["BSC"],
  "carlos.avendano@spartan.cl": ["HC"],
};

const GERENTE_GENERAL = "jorge.beltran@spartan.cl";

/** =========================
 *  CSV helpers
 *  ========================= */
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

function lowerEmail(s: string) {
  return (s || "").trim().toLowerCase();
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

/** =========================
 *  Estados / labels
 *  ========================= */
const ESTADOS_ORDER = [
  "PENDIENTE_ASIGNACION",
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
  PENDIENTE_ASIGNACION: "Pendiente asignación",
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

  if (n === "PENDIENTE_ASIGNACION") return "PENDIENTE_ASIGNACION";
  if (n === "EN_GESTION") return "EN_GESTION";
  if (n === "CERRADO_GANADO") return "CERRADO_GANADO";
  if (n === "NO_GANADO" || n === "CERRADO_PERDIDO") return "NO_GANADO";
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

/** =========================
 *  Probabilidad (forecast)
 *  ========================= */
function parseProbFactor(probNombre: string, estadoKey: string) {
  if (estadoKey === "CERRADO_GANADO") return 1;
  if (estadoKey === "NO_GANADO") return 0;

  const matches = String(probNombre || "").match(/(\d+)\s*%/g);
  if (!matches || matches.length === 0) return 0;

  const values = matches
    .map((x) => Number(String(x).replace(/[^\d]/g, "")))
    .filter((n) => Number.isFinite(n));

  if (!values.length) return 0;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.max(0, Math.min(1, avg / 100));
}

/** =========================
 *  Buckets (tablas)
 *  ========================= */
function bucketProb(probNombre: string) {
  const raw = (probNombre || "").trim();
  if (!raw) return "Sin dato";

  const nums =
    raw
      .match(/\d+/g)
      ?.map((x) => Number(x))
      .filter((n) => Number.isFinite(n)) || [];

  if (nums.length >= 2) return `Entre ${nums[0]}% y ${nums[1]}%`;
  if (nums.length === 1) return `${nums[0]}%`;

  return raw;
}

function bucketFechaCierre(nombre: string) {
  const s = (nombre || "").trim();
  return s ? s : "Sin dato";
}

function seriesFromCountMap(m: Record<string, number>) {
  return Object.entries(m)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** =========================
 *  Ejecutivos map: email -> division
 *  ========================= */
async function loadEjecutivosDivisionMap() {
  const url = gsheetCsvUrl(EJECUTIVOS_SHEET_ID, EJECUTIVOS_GID);
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`No se pudo leer Sheet Ejecutivos (status=${res.status}). Revisa permisos.`);
  }

  const text = await res.text();
  if (text.trim().startsWith("<")) {
    throw new Error("Sheet Ejecutivos no devolvió CSV (Google devolvió HTML). Revisa permisos del sheet.");
  }

  const rows = parseCsv(text);

  // email -> division
  const map: Record<string, string> = {};
  for (const r of rows) {
    const email = lowerEmail(pick(r, "email", "correo", "mail"));
    const division = (pick(r, "division") || "").trim().toUpperCase();
    if (email) map[email] = division || "—";
  }

  return { map, total: rows.length };
}

/** =========================
 *  División del prospecto = división del EJECUTIVO (regla)
 *  ========================= */
function getDivisionFromRow(r: Row, execDivisionMap: Record<string, string>) {
  const execEmail = lowerEmail(pick(r, "ejecutivo_email", "asignado_a", "ejecutivo", "owner"));
  const mapDiv = execEmail ? (execDivisionMap[execEmail] || "").trim().toUpperCase() : "";
  if (mapDiv) return mapDiv;

  // fallback (por si viene, pero NO es fuente de verdad)
  const legacy = (pick(r, "division") || "").trim().toUpperCase();
  return legacy || "—";
}

function getFuenteKey(r: Row) {
  // en tu sheet aparece "fuente" (MANUAL, WEB, CSV_PIA, etc.)
  const f = normUpper(pick(r, "fuente", "origen_prospecto"));
  return f || "—";
}

/** =========================
 *  GET
 *  ========================= */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    // este "division" ya NO filtra por columna division del prospecto,
    // filtra por "división del ejecutivo" (desde Sheet Ejecutivos)
    const divisionFilter = (searchParams.get("division") || "").trim().toUpperCase();

    const ejecutivo = lowerEmail(searchParams.get("ejecutivo") || "");
    const origen = (searchParams.get("origen") || "").trim().toUpperCase();

    const onlyAssigned = searchParams.get("onlyAssigned") === "1";
    const onlyClosed = searchParams.get("onlyClosed") === "1";
    const includeAssigned = searchParams.get("includeAssigned") !== "0";

    // seguridad: viewerEmail define scope real en API
    const viewerEmail = lowerEmail(searchParams.get("viewerEmail") || "");

    // rangos
    const dFrom = from ? parseIsoDate(from) : null;
    const dTo = to ? parseIsoDate(to) : null;

    // 1) cargar Ejecutivos -> división
    const { map: execDivisionMap, total: ejecutivosRows } = await loadEjecutivosDivisionMap();

    // 2) definir allowed divisions por jefatura
    const isGerenteGeneral = viewerEmail === GERENTE_GENERAL;
    const allowedDivs = isGerenteGeneral ? [] : (JEFATURA_SCOPE_PREFIJOS[viewerEmail] || []).map((x) => x.toUpperCase());

    // 3) leer CRM_DB
    const res = await fetch(CSV_CRM_DB_URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `No se pudo leer CRM_DB (${res.status})` }, { status: 500 });
    }

    const text = await res.text();
    const rows = parseCsv(text);

    // 4) filtrar CRM_DB (con scope por división del ejecutivo)
    const filtered = rows.filter((r) => {
      const created = parseIsoDate(pick(r, "created_at"));
      if (dFrom && (!created || created < dFrom)) return false;
      if (dTo && (!created || created > dTo)) return false;

      // filtrar por ejecutivo explícito (si viene)
      const ej = lowerEmail(pick(r, "ejecutivo_email", "asignado_a", "ejecutivo"));
      if (ejecutivo && ej !== ejecutivo) return false;

      // filtrar por origen (si viene)
      const org = (pick(r, "origen_prospecto") || "").trim().toUpperCase();
      if (origen && org !== origen) return false;

      // estado rules
      const estadoKey = normalizeEstadoToKey(pick(r, "estado"));
      const isAssigned = estadoKey === "ASIGNADO" || !!pick(r, "asignado_a");
      const isClosed = estadoKey === "CERRADO_GANADO" || estadoKey === "NO_GANADO";

      if (!includeAssigned && isAssigned) return false;
      if (onlyAssigned && !isAssigned) return false;
      if (onlyClosed && !isClosed) return false;

      // ✅ scope real: división del ejecutivo
      const divExec = getDivisionFromRow(r, execDivisionMap);

      // filtro por selector "División" del page (ya es div del ejecutivo)
      if (divisionFilter && divExec !== divisionFilter) return false;

      // si NO es gerente general, aplicar allowedDivs
      if (allowedDivs.length > 0) {
        // si no encontramos división, por seguridad NO lo mostramos
        if (!divExec || divExec === "—") return false;
        if (!allowedDivs.includes(divExec)) return false;
      }

      return true;
    });

    // 5) agregaciones
    let total = 0;
    let asignados = 0;
    let contactados = 0;
    let cerradosGanado = 0;
    let noGanado = 0;

    let pipelineMonto = 0;
    let forecastMonto = 0;

    const countByEstado: Record<string, number> = {};
    const countByOrigen: Record<string, number> = {};

    const countByFechaCierre: Record<string, number> = {};
    const countByProbCierre: Record<string, number> = {};

    const byEjecutivo: Record<
      string,
      { ejecutivo: string; count: number; pipeline: number; forecast: number; ganados: number; noGanados: number }
    > = {};

    // ✅ Por asignar (WEB) desde CRM_DB
    // regla: fuente=WEB y (sin asignado_a OR estado=PENDIENTE_ASIGNACION)
    let pendientesWeb = 0;
    const pendientesWebByDivision: Record<string, number> = {};

    for (const r of filtered) {
      total++;

      const estadoKey = normalizeEstadoToKey(pick(r, "estado"));
      countByEstado[estadoKey] = (countByEstado[estadoKey] || 0) + 1;

      const org = (pick(r, "origen_prospecto") || "—").trim().toUpperCase();
      countByOrigen[org] = (countByOrigen[org] || 0) + 1;

      // tablas
      const fechaNombre = bucketFechaCierre(pick(r, "fecha_cierre_nombre"));
      countByFechaCierre[fechaNombre] = (countByFechaCierre[fechaNombre] || 0) + 1;

      const probNombreBucket = bucketProb(pick(r, "prob_cierre_nombre"));
      countByProbCierre[probNombreBucket] = (countByProbCierre[probNombreBucket] || 0) + 1;

      const monto = toMontoNumber(pick(r, "monto_proyectado"));
      const factor = parseProbFactor(pick(r, "prob_cierre_nombre"), estadoKey);
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

      const ej = lowerEmail(pick(r, "ejecutivo_email", "asignado_a")) || "—";
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

      // ✅ pendientes web por división (división del ejecutivo)
      const fuenteKey = getFuenteKey(r);
      const asignadoA = lowerEmail(pick(r, "asignado_a"));
      const divExec = getDivisionFromRow(r, execDivisionMap);

      const isPendienteWeb =
        fuenteKey === "WEB" && (estadoKey === "PENDIENTE_ASIGNACION" || !asignadoA);

      if (isPendienteWeb) {
        pendientesWeb += 1;
        const kDiv = divExec || "—";
        pendientesWebByDivision[kDiv] = (pendientesWebByDivision[kDiv] || 0) + 1;
      }
    }

    // 6) series (lo que consume el page)
    const estadoSeries = ESTADOS_ORDER.map((k) => ({
      key: k,
      name: ESTADOS_LABEL[k] || k,
      value: countByEstado[k] || 0,
    }));

    const origenSeries = seriesFromCountMap(countByOrigen);

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

    const fechaCierreSeries = seriesFromCountMap(countByFechaCierre);
    const probCierreSeries = seriesFromCountMap(countByProbCierre);
    const pendientesWebPorDivision = seriesFromCountMap(pendientesWebByDivision);

    return NextResponse.json({
      ok: true,
      filters: {
        from,
        to,
        division: divisionFilter,
        ejecutivo,
        origen,
        onlyAssigned,
        onlyClosed,
        includeAssigned,
        viewerEmail,
        allowedDivs: isGerenteGeneral ? "ALL" : allowedDivs,
      },
      kpis: {
        total,
        asignados,
        contactados,
        cerradosGanado,
        noGanado,
        pipelineMonto: Math.round(pipelineMonto),
        forecastMonto: Math.round(forecastMonto),
        pendientesWeb,
      },
      charts: {
        // mini tabla etapas
        estados: estadoSeries,

        // opcional por si lo usas después
        origenes: origenSeries,

        // chart principal
        ejecutivos: ejecutivoSeries,

        // tablas
        fechaCierre: fechaCierreSeries,
        probCierre: probCierreSeries,

        // por asignar (web) desde CRM_DB
        pendientesWebPorDivision,
      },
      debug: {
        crmRows: rows.length,
        filteredRows: filtered.length,
        ejecutivosSheetRows: ejecutivosRows,
        pendientesWeb,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
