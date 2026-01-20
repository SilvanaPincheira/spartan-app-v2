// app/api/crm/prospectos/update/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const APPS_SCRIPT_URL = process.env.CRM_APPS_SCRIPT_URL;

// OJO: este CSV debe ser el publicado del CRM_DB
const CSV_CRM_DB_URL =
  process.env.CRM_CSV_CRM_DB_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

/** Jefaturas que pueden actualizar cualquier registro */
const JEFATURAS = new Set(
  [
    "claudia.borquez@spartan.cl",
    "jorge.beltran@spartan.cl",
    "alberto.damm@spartan.cl",
    "nelson.norambuena@spartan.cl",
  ].map((x) => x.trim().toLowerCase())
);

/** ---------------- CSV helpers ---------------- */
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

function normEmail(s: string) {
  return (s || "").trim().toLowerCase();
}

function pick(obj: any, ...keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/** --------------- Normalización de estados --------------- */
function normalizeEstado(input: string) {
  const s = String(input || "").trim();
  if (!s) return "";

  const x = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  const map: Record<string, string> = {
    "PENDIENTE ASIGNACION": "PENDIENTE_ASIGNACION",
    "PENDIENTE_ASIGNACION": "PENDIENTE_ASIGNACION",
    "ASIGNADO": "ASIGNADO",
    "EN GESTION": "EN_GESTION",
    "EN_GESTION": "EN_GESTION",
    "CONTACTADO": "CONTACTADO",
    "REUNION": "REUNION",
    "REUNIÓN": "REUNION",
    "LEVANTAMIENTO": "LEVANTAMIENTO",
    "PROPUESTA": "PROPUESTA",
    "CERRADO GANADO": "CERRADO_GANADO",
    "CERRADO_GANADO": "CERRADO_GANADO",
    "INSTALADO, 1° O/C": "INSTALADO_1OC",
    "INSTALADO 1° O/C": "INSTALADO_1OC",
    "INSTALADO 1OC": "INSTALADO_1OC",
    "INSTALADO_1OC": "INSTALADO_1OC",
    "NO GANADO": "NO_GANADO",
    "NO_GANADO": "NO_GANADO",
  };

  return map[x] || x.replace(/\s+/g, "_");
}

/** --------------- Estado -> Etapa automática --------------- */
/**
 * Si UI manda solo estado, aquí podemos autocompletar etapa_id/etapa_nombre.
 * (Si UI manda etapa explícita, se respeta lo que mandó UI).
 */
const ESTADO_TO_ETAPA: Record<string, { etapa_id: number; etapa_nombre: string }> = {
  ASIGNADO: { etapa_id: 0, etapa_nombre: "Asignado" },
  EN_GESTION: { etapa_id: 1, etapa_nombre: "En gestión" },
  CONTACTADO: { etapa_id: 2, etapa_nombre: "Contactado" },
  REUNION: { etapa_id: 3, etapa_nombre: "Reunión" },
  LEVANTAMIENTO: { etapa_id: 4, etapa_nombre: "Levantamiento" },
  PROPUESTA: { etapa_id: 5, etapa_nombre: "Propuesta" },
  CERRADO_GANADO: { etapa_id: 6, etapa_nombre: "Cerrado ganado" },
  INSTALADO_1OC: { etapa_id: 7, etapa_nombre: "Instalado, 1° o/c" },
  NO_GANADO: { etapa_id: 8, etapa_nombre: "No ganado" },
};

/** --------------- GET CRM_DB row by folio --------------- */
async function fetchCrmDbByFolio(folio: string) {
  const res = await fetch(CSV_CRM_DB_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo leer CRM_DB CSV (${res.status})`);
  const text = await res.text();
  const rows = parseCsv(text);

  const f = String(folio || "").trim();
  const hit = rows.find((r) => String(r.folio || "").trim() === f);
  return { rows, hit };
}

/** --------------- helpers --------------- */
function toIntOrEmpty(v: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? String(Math.trunc(n)) : "";
}

export async function POST(req: Request) {
  try {
    if (!APPS_SCRIPT_URL) {
      return NextResponse.json(
        { ok: false, error: "Falta CRM_APPS_SCRIPT_URL" },
        { status: 500 }
      );
    }

    /** 0) Auth */
    const supabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      return NextResponse.json(
        { ok: false, error: `Auth error: ${authErr.message}` },
        { status: 401 }
      );
    }

    const loggedEmail = normEmail(authData.user?.email || "");
    if (!loggedEmail) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    /** 1) Body */
    const body = await req.json().catch(() => null);
    const folio = pick(body, "folio");
    if (!folio) {
      return NextResponse.json({ ok: false, error: "Folio requerido" }, { status: 400 });
    }

    const estadoIn = pick(body, "estado");
    const estado = normalizeEstado(estadoIn);

    const etapa_id = toIntOrEmpty(pick(body, "etapa_id"));
    const etapa_nombre = pick(body, "etapa_nombre");
    const observacion = pick(body, "observacion");
    const ejecutivo_email =
      normEmail(pick(body, "ejecutivo_email")) || loggedEmail;

    /** 🔹 NUEVO: campos de ficha */
    const fichaFields: Record<string, string> = {
      nombre_razon_social: pick(body, "nombre_razon_social"),
      rut: pick(body, "rut"),
      contacto: pick(body, "contacto"),
      telefono: pick(body, "telefono"),
      correo: pick(body, "correo"),
      direccion: pick(body, "direccion"),
      rubro: pick(body, "rubro"),
      monto_proyectado: pick(body, "monto_proyectado"),
    };

    /** 2) Autocompletar etapa si viene estado */
    let autoEtapaId = etapa_id;
    let autoEtapaNombre = etapa_nombre;

    if (estado && !autoEtapaId && !autoEtapaNombre) {
      const m = ESTADO_TO_ETAPA[estado];
      if (m) {
        autoEtapaId = String(m.etapa_id);
        autoEtapaNombre = m.etapa_nombre;
      }
    }

    /** 3) Validar que exista algo para actualizar */
    const hasFichaChanges = Object.values(fichaFields).some(Boolean);

    if (
      !estado &&
      !autoEtapaId &&
      !autoEtapaNombre &&
      !observacion &&
      !hasFichaChanges
    ) {
      return NextResponse.json(
        { ok: false, error: "Nada que actualizar" },
        { status: 400 }
      );
    }

    /** 4) Validar permisos (MISMO COMPORTAMIENTO ANTERIOR) */
    let current: Row | null = null;
    try {
      const { hit } = await fetchCrmDbByFolio(folio);
      current = hit || null;

      if (!current) {
        return NextResponse.json(
          { ok: false, error: "Folio no existe en CRM_DB" },
          { status: 404 }
        );
      }

      const asignadoA = normEmail(current.asignado_a || "");
      const isJefatura = JEFATURAS.has(loggedEmail);

      if (asignadoA && asignadoA !== loggedEmail && !isJefatura) {
        return NextResponse.json(
          { ok: false, error: "Sin permiso para actualizar este prospecto" },
          { status: 403 }
        );
      }
    } catch {
      // no bloqueamos si falla CSV
    }

    /** 5) Payload FINAL a Apps Script */
    const payload: any = {
      action: "UPDATE",
      folio,
      ejecutivo_email,
    };

    if (estado) payload.estado = estado;
    if (autoEtapaId) payload.etapa_id = autoEtapaId;
    if (autoEtapaNombre) payload.etapa_nombre = autoEtapaNombre;
    if (observacion) payload.observacion = observacion;

    // ✅ Si quien escribe es jefatura y viene observación, marcar "mensaje pendiente"
if (observacion && JEFATURAS.has(loggedEmail)) {
  payload.obs_jefatura_flag = "TRUE";
  payload.obs_jefatura_vista = "FALSE";
  payload.obs_jefatura_by = loggedEmail;
}



    // 🔹 ficha (solo lo que venga)
    Object.entries(fichaFields).forEach(([k, v]) => {
      if (v) payload[k] = v;
    });

    /** 6) Enviar a Apps Script */
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: "Respuesta no JSON", raw: text.slice(0, 400) };
    }

    if (!resp.ok || !data?.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || "Error Apps Script", debug: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, folio, updated: payload });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error desconocido" },
      { status: 500 }
    );
  }
}
