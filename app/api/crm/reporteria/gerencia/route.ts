import { NextResponse } from "next/server";

const CSV_CRM_DB_URL =
  process.env.CRM_CRM_DB_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

/** ✅ BD_WEB (Sheet directo) */
const SHEET_ID = "1xHT48r3asID6PCrgXTCpjbwujdnu6E7aev29BHq7U9w";
const WEB_GID = "0";

function sheetCsvUrl(gid: string) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

/** =========================
 * ✅ ACL JEFATURAS (SERVER)
 * ========================= */
const JEFATURAS = new Set(
  [
    "claudia.borquez@spartan.cl",
    "jorge.beltran@spartan.cl",
    "alberto.damm@spartan.cl",
    "nelson.norambuena@spartan.cl",
    "carlos.avendano@spartan.cl",
  ].map((x) => x.trim().toLowerCase())
);

const JEFATURA_SCOPE_PREFIJOS: Record<string, string[]> = {
  "claudia.borquez@spartan.cl": ["IN", "FB"],
  "jorge.beltran@spartan.cl": ["FB", "IN", "HC", "IND"], // gerente general: ve todo
  "alberto.damm@spartan.cl": ["IND"],
  "nelson.norambuena@spartan.cl": ["BSC"],
  "carlos.avendano@spartan.cl": ["HC"],
};

function lowerEmail(s: string) {
  return (s || "").trim().toLowerCase();
}

function getScope(viewerEmailRaw: string) {
  const viewerEmail = lowerEmail(viewerEmailRaw);
  const isJefatura = JEFATURAS.has(viewerEmail);
  const canSeeAll = viewerEmail === "jorge.beltran@spartan.cl";
  const allowedDivs = (JEFATURA_SCOPE_PREFIJOS[viewerEmail] || []).map((x) => String(x).toUpperCase());
  return { viewerEmail, isJefatura, canSeeAll, allowedDivs };
}

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

/** =========================
 * ✅ Folio determinístico (WEB)
 * ========================= */
function makeFolio(origen: string, razon: string, mail: string, fecha: string) {
  const base = `${origen}|${razon}|${mail}|${fecha}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  const short = hash.toString(36).slice(0, 8);
  return `LEAD-${origen.replace(/\s+/g, "")}-${short}`;
}

function normalizeLeadRowWeb(r: Row): { folio: string; division: string } {
  const origen = "WEB";
  const razon = pick(r, "razon_social", "razon", "empresa", "nombre_razon_social");
  const mail = pick(r, "mail", "correo", "email", "e_mail");
  const fechaContacto = pick(r, "fecha_contacto", "fecha", "created_at");
  const division = (pick(r, "division", "prefijo") || "").trim().toUpperCase();

  const folio = pick(r, "folio") || makeFolio(origen, razon, mail, fechaContacto);
  return { folio: (folio || "").trim(), division: division || "—" };
}

/** =========================
 * ✅ Buckets: prob y fecha cierre
 * ========================= */
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    // ⚠️ lo que pide el front (se valida contra scope)
    const requestedDivision = (searchParams.get("division") || "").trim().toUpperCase();

    const ejecutivo = (searchParams.get("ejecutivo") || "").trim().toLowerCase();
    const origen = (searchParams.get("origen") || "").trim().toUpperCase();

    const onlyAssigned = searchParams.get("onlyAssigned") === "1";
    const onlyClosed = searchParams.get("onlyClosed") === "1";
    const includeAssigned = searchParams.get("includeAssigned") !== "0";

    // ✅ scope server (obligatorio)
    const scope = getScope(searchParams.get("viewerEmail") || "");
    if (!scope.isJefatura) {
      return NextResponse.json({ ok: false, error: "Sin permisos (solo jefaturas)." }, { status: 403 });
    }

    // ✅ división efectiva
    // - Jorge: puede ver todo, puede filtrar si quiere
    // - otros: solo scope; si pidieron una división fuera del scope, se ignora (queda "")
    const divisionEffective =
      scope.canSeeAll
        ? requestedDivision
        : requestedDivision && scope.allowedDivs.includes(requestedDivision)
          ? requestedDivision
          : "";

    const dFrom = from ? parseIsoDate(from) : null;
    const dTo = to ? parseIsoDate(to) : null;

    /** 1) CRM_DB */
    const res = await fetch(CSV_CRM_DB_URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `No se pudo leer CRM_DB (${res.status})` }, { status: 500 });
    }
    const text = await res.text();
    const rows = parseCsv(text);

    // index por folio (para comparar con WEB)
    const crmByFolio: Record<string, { estadoKey: string; asignadoA: string; division: string }> = {};
    for (const r of rows) {
      const folio = (pick(r, "folio") || "").trim();
      if (!folio) continue;
      crmByFolio[folio] = {
        estadoKey: normalizeEstadoToKey(pick(r, "estado")),
        asignadoA: lowerEmail(pick(r, "asignado_a")),
        division: (pick(r, "division") || "").trim().toUpperCase(),
      };
    }

    /** 2) Filtrar CRM_DB con SCOPE */
    const filtered = rows.filter((r) => {
      const created = parseIsoDate(pick(r, "created_at"));

      if (dFrom && (!created || created < dFrom)) return false;
      if (dTo && (!created || created > dTo)) return false;

      const div = (pick(r, "division") || "").trim().toUpperCase();

      // ✅ scope (si no es Jorge)
      if (!scope.canSeeAll) {
        if (scope.allowedDivs.length && !scope.allowedDivs.includes(div)) return false;
      }

      // ✅ filtro por division puntual (si aplica)
      if (divisionEffective && div !== divisionEffective) return false;

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

    /** 3) Agregaciones CRM_DB */
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

    for (const r of filtered) {
      total++;

      const estadoKey = normalizeEstadoToKey(pick(r, "estado"));
      countByEstado[estadoKey] = (countByEstado[estadoKey] || 0) + 1;

      const org = (pick(r, "origen_prospecto") || "—").trim().toUpperCase();
      countByOrigen[org] = (countByOrigen[org] || 0) + 1;

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

    /** 4) ✅ Pendientes desde BD_WEB (con SCOPE) */
    const resWeb = await fetch(sheetCsvUrl(WEB_GID), { cache: "no-store" });
    if (!resWeb.ok) {
      return NextResponse.json(
        { ok: false, error: `No se pudo leer BD_WEB (gid=0) status=${resWeb.status}` },
        { status: 500 }
      );
    }

    const textWeb = await resWeb.text();
    if (textWeb.trim().startsWith("<")) {
      return NextResponse.json(
        { ok: false, error: "BD_WEB no devuelve CSV (Google devolvió HTML). Revisa permisos del sheet." },
        { status: 500 }
      );
    }

    const webRows = parseCsv(textWeb);

    let pendientesWeb = 0;
    const pendientesWebByDivision: Record<string, number> = {};

    for (const wr of webRows) {
      const { folio, division: divWeb } = normalizeLeadRowWeb(wr);
      if (!folio) continue;

      // ✅ scope (si no es Jorge)
      if (!scope.canSeeAll) {
        if (scope.allowedDivs.length && !scope.allowedDivs.includes(divWeb)) continue;
      }

      // ✅ filtro por division puntual si aplica
      if (divisionEffective && divWeb !== divisionEffective) continue;

      const crm = crmByFolio[folio];

      const isPending = !crm || (crm.estadoKey === "PENDIENTE_ASIGNACION" && !crm.asignadoA);
      if (isPending) {
        pendientesWeb += 1;
        pendientesWebByDivision[divWeb] = (pendientesWebByDivision[divWeb] || 0) + 1;
      }
    }

    /** 5) Series */
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
      scope: {
        viewerEmail: scope.viewerEmail,
        canSeeAll: scope.canSeeAll,
        allowedDivs: scope.allowedDivs,
        requestedDivision,
        divisionApplied: divisionEffective,
      },
      filters: { from, to, division: divisionEffective, ejecutivo, origen, onlyAssigned, onlyClosed, includeAssigned },
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
        estados: estadoSeries, // ✅ para tabla mini de etapas
        origenes: origenSeries,
        ejecutivos: ejecutivoSeries,
        fechaCierre: fechaCierreSeries,
        probCierre: probCierreSeries,
        pendientesWebPorDivision,
      },
      debug: {
        webRows: webRows.length,
        crmRows: rows.length,
        fechaCierreBuckets: Object.keys(countByFechaCierre).length,
        probCierreBuckets: Object.keys(countByProbCierre).length,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
