"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/** =========================
 *  CONFIG
 *  ========================= */
const CSV_PIA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiXecS06_-jxv0O98PUG2jMVT-8M5HpliYZZNyoG2EdrstE0ydTATYxdnih18zwGXow6hsxCtz90vi/pub?gid=0&single=true&output=csv";

const CSV_CRM_DB_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

const PIA_OWNER_COL_NORM = "email_col";

/** =========================
 *  LISTAS FIJAS
 *  ========================= */

/**
 * ✅ ESTADOS (columna: estado)
 * Estos son los que quieres ver con colores en bandeja/asignados.
 */
const CRM_ESTADOS = [
  { value: "ASIGNADO", label: "Asignado" },
  { value: "EN_GESTION", label: "En gestión" },
  { value: "CONTACTADO", label: "Contactado" },
  { value: "REUNION", label: "Reunión" },
  { value: "LEVANTAMIENTO", label: "Levantamiento" },
  { value: "PROPUESTA", label: "Propuesta" },
  { value: "CERRADO_GANADO", label: "Cerrado ganado" },
  { value: "INSTALADO_1_OC", label: "Instalado, 1° o/c" },
  { value: "NO_GANADO", label: "No ganado" },
] as const;

/**
 * ✅ ETAPA comercial (columna: etapa_id / etapa_nombre)
 * Si quieres, puedes dejar esto igual o ajustarlo.
 * (Ojo: NO mezclar con estado)
 */
const CRM_ETAPAS = [
  { id: 1, label: "Prospecto" },
  { id: 2, label: "Calificado" },
  { id: 3, label: "Oportunidad" },
] as const;

const CRM_FECHA_CIERRE = [
  { id: 1, label: "Antes 30 días" },
  { id: 2, label: "Entre 30 y 90 días" },
  { id: 3, label: "Más de 90 días" },
] as const;

const CRM_PROB_CIERRE = [
  { id: 1, label: "Menor a 30%" },
  { id: 2, label: "Entre 30% y 50%" },
  { id: 3, label: "Entre 50 a 75%" },
  { id: 4, label: "Entre 75 a 90%" },
  { id: 5, label: "Entre mayor a 90%" },
] as const;

const CRM_DIVISIONES = [
  { value: "INDUSTRIAL", label: "Industrial" },
  { value: "FOOD", label: "Food" },
  { value: "INSTITUCIONAL", label: "Institucional" },
  { value: "HC", label: "HC" },
] as const;

/** =========================
 *  TIPOS
 *  ========================= */
type FuenteDatos = "MANUAL" | "CSV_PIA";
type Division = (typeof CRM_DIVISIONES)[number]["value"];
type RowAny = Record<string, string>;
type PiaRow = RowAny;
type CrmRow = RowAny;

type ProspectoForm = {
  fecha: string;
  folio: string;
  ejecutivoEmail: string;

  division: Division;

  nombreRazonSocial: string;
  rut: string;
  contacto: string;
  telefono: string;
  correo: string;
  direccion: string;
  rubro: string;
  montoProyectado: string;

  /** ✅ Estado real CRM_DB */
  estado: string;

  /** ✅ Etapa comercial CRM_DB */
  etapaId: number | null;

  fechaCierreId: number | null;
  probCierreId: number | null;

  origenProspecto: string;
  observacion: string;

  fuenteDatos: FuenteDatos;
  sourceId?: string;
  sourcePayload?: string;
};

/** =========================
 *  NORMALIZACIÓN HEADERS
 *  ========================= */
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

/** =========================
 *  CSV PARSER seguro
 *  ========================= */
function parseCsv(text: string): RowAny[] {
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
    const obj: RowAny = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? "").trim();
    });
    return obj;
  });
}

/** =========================
 *  HELPERS
 *  ========================= */
function nowCL(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function makeFolio(): string {
  const d = new Date();
  const year = d.getFullYear();
  return `PROS-${year}-${String(d.getTime()).slice(-6)}`;
}

function normalizeEmail(s: string) {
  return (s || "").trim().toLowerCase();
}

function normalizeRut(s: string) {
  return (s || "").replace(/\./g, "").replace(/-/g, "").trim().toLowerCase();
}

function toMontoNumber(raw: string) {
  const n = Number(String(raw || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** ✅ Si es WEB/RRSS pasa a jefatura (pendiente asignación) */
function needsAssignment(origen: string) {
  const o = (origen || "").trim().toLowerCase();
  return o === "web" || o === "rrss";
}

function makeSourceId(row: PiaRow) {
  const empresa = row.nombre_o_razon_social || "";
  const email = row.e_mail || "";
  const key = `${empresa}|${normalizeEmail(email)}`.trim().toLowerCase();
  return `pia_${key.replace(/\s+/g, "_").slice(0, 60)}_${key.length}`;
}

function makeManualSourceId(nombre: string, correo: string) {
  const key = `${(nombre || "").trim()}|${normalizeEmail(correo)}`.trim().toLowerCase();
  return `manual_${key.replace(/\s+/g, "_").slice(0, 80)}_${key.length}`;
}

function mapPiaRowToForm(row: PiaRow): Partial<ProspectoForm> {
  return {
    nombreRazonSocial: row.nombre_o_razon_social || "",
    contacto: row.contacto || "",
    correo: row.e_mail || "",
    telefono: row.telefono || "",
    direccion: row.direccion || "",
    rubro: row.cargo || "",
    montoProyectado: row.monto_prospecto || "",
  };
}

function validateForm(f: ProspectoForm) {
  const errors: Record<string, string> = {};

  if (!f.division?.trim()) errors.division = "Campo requerido";
  if (!f.nombreRazonSocial.trim()) errors.nombreRazonSocial = "Campo requerido";
  if (!f.contacto.trim()) errors.contacto = "Campo requerido";

  const email = normalizeEmail(f.correo);
  if (!email) errors.correo = "Campo requerido";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.correo = "Formato inválido";

  if (!f.direccion.trim()) errors.direccion = "Campo requerido";
  if (!f.rubro.trim()) errors.rubro = "Campo requerido";
  if (!f.montoProyectado.trim()) errors.montoProyectado = "Campo requerido";

  const montoNum = toMontoNumber(f.montoProyectado);
  if (f.montoProyectado.trim() && montoNum <= 0) errors.montoProyectado = "Monto inválido";

  if (!f.origenProspecto.trim()) errors.origenProspecto = "Campo requerido";

  // ✅ FIX: etapaId / fechaCierre / probCierre ya NO se validan con !valor (porque 0 rompe)
  if (f.etapaId == null) errors.etapaId = "Campo requerido";
  if (f.fechaCierreId == null) errors.fechaCierreId = "Campo requerido";
  if (f.probCierreId == null) errors.probCierreId = "Campo requerido";

  // estado requerido (excepto si queda pendiente asignación, igual se forzará)
  if (!String(f.estado || "").trim()) errors.estado = "Campo requerido";

  return errors;
}

/** =========================
 *  PAGE
 *  ========================= */
export default function ProspeccionPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

  // auth
  const [authLoading, setAuthLoading] = useState(true);
  const [loggedEmail, setLoggedEmail] = useState<string>("");

  // permisos BD Pía
  const [piaAllowed, setPiaAllowed] = useState(false);

  // UI fuente
  const [fuente, setFuente] = useState<FuenteDatos>("MANUAL");

  // BD Pía
  const [piaLoading, setPiaLoading] = useState(false);
  const [piaError, setPiaError] = useState<string | null>(null);
  const [piaRows, setPiaRows] = useState<PiaRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // CRM DB (lectura)
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [crmRows, setCrmRows] = useState<CrmRow[]>([]);

  // guardado
  const [saving, setSaving] = useState(false);

  // Form
  const [form, setForm] = useState<ProspectoForm>(() => ({
    fecha: nowCL(),
    folio: makeFolio(),
    ejecutivoEmail: "",
    division: "FOOD",

    nombreRazonSocial: "",
    rut: "",
    contacto: "",
    telefono: "",
    correo: "",
    direccion: "",
    rubro: "",
    montoProyectado: "",

    estado: "ASIGNADO",
    etapaId: 1,
    fechaCierreId: 2,
    probCierreId: 2,

    origenProspecto: "Manual",
    observacion: "",

    fuenteDatos: "MANUAL",
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});

  // nombres derivados
  const etapaNombre = CRM_ETAPAS.find((e) => e.id === form.etapaId)?.label ?? "";
  const fechaCierreNombre =
    CRM_FECHA_CIERRE.find((e) => e.id === form.fechaCierreId)?.label ?? "";
  const probCierreNombre =
    CRM_PROB_CIERRE.find((e) => e.id === form.probCierreId)?.label ?? "";

  /** 1) Usuario real */
  useEffect(() => {
    (async () => {
      try {
        setAuthLoading(true);
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        const email = data.user?.email ?? "";
        setLoggedEmail(email);
        setForm((prev) => ({ ...prev, ejecutivoEmail: email }));
      } catch {
        setLoggedEmail("");
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [supabase]);

  /** 2) Cargar CRM_DB (lectura) */
  async function reloadCrmDb() {
    try {
      setCrmLoading(true);
      setCrmError(null);
      const res = await fetch(CSV_CRM_DB_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Error al cargar CRM_DB CSV (${res.status})`);
      const text = await res.text();
      const rows = parseCsv(text);
      setCrmRows(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setCrmError(msg);
      setCrmRows([]);
    } finally {
      setCrmLoading(false);
    }
  }

  useEffect(() => {
    reloadCrmDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 3) Cargar CSV Pía y filtrar por EMAIL_COL */
  useEffect(() => {
    if (authLoading) return;

    if (!loggedEmail) {
      setPiaAllowed(false);
      setPiaRows([]);
      return;
    }

    (async () => {
      try {
        setPiaLoading(true);
        setPiaError(null);

        const res = await fetch(CSV_PIA_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`Error al cargar CSV (${res.status})`);

        const text = await res.text();
        const rows = parseCsv(text);

        const emailNorm = normalizeEmail(loggedEmail);

        const allowedRows = rows.filter((r) => {
          const owner = normalizeEmail(r[PIA_OWNER_COL_NORM] || "");
          return owner === emailNorm;
        });

        setPiaRows(allowedRows);
        setPiaAllowed(allowedRows.length > 0);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        setPiaError(msg);
        setPiaRows([]);
        setPiaAllowed(false);
      } finally {
        setPiaLoading(false);
      }
    })();
  }, [authLoading, loggedEmail]);

  /** 4) Si intentan elegir CSV sin permiso, vuelve a Manual */
  useEffect(() => {
    if (fuente === "CSV_PIA" && !piaAllowed) setFuente("MANUAL");
  }, [fuente, piaAllowed]);

  /** 5) Fuente -> actualiza form.fuenteDatos SIEMPRE */
  useEffect(() => {
    setForm((prev) => ({ ...prev, fuenteDatos: fuente }));
  }, [fuente]);

  /** 6) Al cambiar fuente, refresca metadatos del registro */
  useEffect(() => {
    setErrors({});
    setSelectedSourceId(null);
    setShowAll(false);

    setForm((prev) => ({
      ...prev,
      fecha: nowCL(),
      folio: makeFolio(),
      ejecutivoEmail: loggedEmail,
      fuenteDatos: fuente,

      // ✅ si viene de Pía lo tratamos como WEB (para jefatura)
      origenProspecto: fuente === "CSV_PIA" ? "WEB" : prev.origenProspecto || "Manual",

      // ✅ estado default (luego buildPayload puede forzarlo)
      estado: "ASIGNADO",

      sourceId: undefined,
      sourcePayload: undefined,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente, loggedEmail]);

  /** 7) Filtrado Pía */
  const filteredPia = useMemo(() => {
    const q = search.trim().toLowerCase();
    const limit = q ? 20 : showAll ? piaRows.length : 5;

    if (!q) return piaRows.slice(0, limit);

    const matches = piaRows.filter((r) => {
      const razon = (r.nombre_o_razon_social || "").toLowerCase();
      const email = (r.e_mail || "").toLowerCase();
      const contacto = (r.contacto || "").toLowerCase();
      const dir = (r.direccion || "").toLowerCase();
      return razon.includes(q) || email.includes(q) || contacto.includes(q) || dir.includes(q);
    });

    return matches.slice(0, limit);
  }, [piaRows, search, showAll]);

  function loadFromPiaRow(row: PiaRow) {
    const patch = mapPiaRowToForm(row);
    const sid = makeSourceId(row);

    setSelectedSourceId(sid);
    setForm((prev) => ({
      ...prev,
      ...patch,
      fuenteDatos: "CSV_PIA",
      sourceId: sid,
      sourcePayload: JSON.stringify(row),

      // ✅ se va a jefatura
      origenProspecto: "WEB",
      estado: "ASIGNADO",
    }));
  }

  /** 8) Duplicados (CRM_DB) */
  const duplicateInCrmDb = useMemo(() => {
    if (!crmRows.length) return null;

    const correo = normalizeEmail(form.correo);
    const razon = (form.nombreRazonSocial || "").trim().toLowerCase();
    const rut = normalizeRut(form.rut);

    if (!correo && !razon && !rut) return null;

    if (rut) {
      const hit = crmRows.find((r) => normalizeRut(r.rut || "") === rut);
      if (hit) return { by: "RUT", row: hit };
    }

    if (correo && razon) {
      const hit = crmRows.find((r) => {
        const c = normalizeEmail(r.correo || "");
        const n = (r.nombre_razon_social || "").trim().toLowerCase();
        return c === correo && n === razon;
      });
      if (hit) return { by: "Correo+Razón social", row: hit };
    }

    if (correo) {
      const hit = crmRows.find((r) => normalizeEmail(r.correo || "") === correo);
      if (hit) return { by: "Correo", row: hit };
    }

    return null;
  }, [crmRows, form.correo, form.nombreRazonSocial, form.rut]);

  /** 9) Payload */
  function buildPayload() {
    const monto = toMontoNumber(form.montoProyectado);

    const source_id =
      form.fuenteDatos === "CSV_PIA"
        ? form.sourceId || ""
        : makeManualSourceId(form.nombreRazonSocial, form.correo);

    const requiere = needsAssignment(form.origenProspecto);

    // ✅ si requiere asignación por jefatura, forzamos pendiente
    const estadoFinal = requiere ? "PENDIENTE_ASIGNACION" : (form.estado || "ASIGNADO");

    return {
      created_at: new Date().toISOString(),
      folio: form.folio,
      fuente: form.fuenteDatos,
      source_id,

      nombre_razon_social: form.nombreRazonSocial,
      rut: form.rut || "",
      contacto: form.contacto || "",
      telefono: form.telefono || "",
      correo: normalizeEmail(form.correo),
      direccion: form.direccion,
      rubro: form.rubro,
      monto_proyectado: monto,

      division: form.division,

      etapa_id: form.etapaId,
      etapa_nombre: etapaNombre,
      fecha_cierre_id: form.fechaCierreId,
      fecha_cierre_nombre: fechaCierreNombre,
      prob_cierre_id: form.probCierreId,
      prob_cierre_nombre: probCierreNombre,

      origen_prospecto: form.origenProspecto,
      observacion: form.observacion || "",

      ejecutivo_email: form.ejecutivoEmail,

      estado: estadoFinal,

      // ✅ asignación: si es pendiente, sin asignar
      asignado_a: requiere ? "" : form.ejecutivoEmail,
      asignado_por: requiere ? "" : form.ejecutivoEmail,
      asignado_at: requiere ? "" : new Date().toISOString(),
    };
  }

  async function onSubmit() {
    const v = validateForm(form);
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    if (duplicateInCrmDb) {
      const folioPrev = duplicateInCrmDb.row.folio || "(sin folio)";
      const estadoPrev = duplicateInCrmDb.row.estado || "(sin estado)";
      const ok = window.confirm(
        `⚠️ Posible duplicado en CRM_DB (match por ${duplicateInCrmDb.by}).\n` +
          `Folio existente: ${folioPrev}\nEstado: ${estadoPrev}\n\n` +
          `¿Quieres guardar de todas formas?`
      );
      if (!ok) return;
    }

    try {
      setSaving(true);

      const payload = buildPayload();

      const resp = await fetch("/api/crm/prospectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, error: "Respuesta no JSON", raw: text.slice(0, 300) };
      }

      if (!resp.ok || !data?.ok) {
        alert(`❌ Error guardando:\nstatus=${resp.status}\n${JSON.stringify(data, null, 2)}`);
        return;
      }

      alert(
        data.duplicated ? "⚠️ El prospecto ya existía (folio duplicado)." : "✅ Prospecto guardado en CRM_DB"
      );

      reloadCrmDb();

      setForm((p) => ({
        ...p,
        fecha: nowCL(),
        folio: makeFolio(),
        ejecutivoEmail: loggedEmail,

        nombreRazonSocial: "",
        rut: "",
        contacto: "",
        telefono: "",
        correo: "",
        direccion: "",
        rubro: "",
        montoProyectado: "",

        observacion: "",
        sourceId: undefined,
        sourcePayload: undefined,

        // defaults
        estado: "ASIGNADO",
        etapaId: 1,
        fechaCierreId: 2,
        probCierreId: 2,

        origenProspecto: fuente === "CSV_PIA" ? "WEB" : p.origenProspecto,
      }));

      setErrors({});
      setSelectedSourceId(null);
      setShowAll(false);
    } finally {
      setSaving(false);
    }
  }

  /** 10) Vista: últimos 5 creados por mí */
  const myLast5 = useMemo(() => {
    const email = normalizeEmail(loggedEmail);
    if (!email || !crmRows.length) return [];

    const mine = crmRows.filter((r) => normalizeEmail(r.ejecutivo_email || "") === email);

    const sorted = mine.slice().sort((a, b) => {
      const ta = Date.parse(a.created_at || "") || 0;
      const tb = Date.parse(b.created_at || "") || 0;
      return tb - ta;
    });

    return sorted.slice(0, 5);
  }, [crmRows, loggedEmail]);

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>CRM · Gestión de Prospección</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  const requiereAsign = needsAssignment(form.origenProspecto);

  return (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        CRM · Gestión de Prospección · Nuevo Prospecto
      </h2>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        Registro para bandeja de asignación y gestión comercial.
      </div>

      {/* CRM_DB status */}
      <div style={{ marginBottom: 12, fontSize: 12, opacity: 0.85 }}>
        <b>CRM_DB:</b>{" "}
        {crmLoading ? "Cargando..." : crmError ? `Error: ${crmError}` : `${crmRows.length} registros`}
        <button
          type="button"
          onClick={reloadCrmDb}
          style={{
            marginLeft: 10,
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "white",
            cursor: "pointer",
          }}
        >
          Recargar CRM_DB
        </button>
      </div>

      {/* Fuente de datos */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Fuente de datos</h3>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label>
            <span style={{ display: "block", fontSize: 12, marginBottom: 6 }}>Seleccionar</span>
            <select
              value={fuente}
              onChange={(e) => setFuente(e.target.value as FuenteDatos)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db", minWidth: 260 }}
            >
              <option value="MANUAL">Manual</option>
              {piaAllowed && <option value="CSV_PIA">Base Google Sheets (CSV) – BD Pía</option>}
            </select>
          </label>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f3f4f6" }}>
              <b>Fecha:</b> {form.fecha}
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f3f4f6" }}>
              <b>Folio:</b> {form.folio}
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f3f4f6" }}>
              <b>Ejecutivo:</b> {form.ejecutivoEmail || "—"}
            </div>
          </div>
        </div>

        {/* Panel BD Pía (tu panel igual; lo dejé tal cual, solo cambia origenProspecto=WEB cuando carga) */}
        {fuente === "CSV_PIA" && piaAllowed && (
          <div style={{ marginTop: 14, borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
            {/* ... (TU MISMO CÓDIGO DE TABLA BD PÍA) ... */}
            {/* Para mantener la respuesta corta, no repetí el bloque completo aquí,
                pero puedes dejar exactamente tu bloque igual.
                Lo único importante ya está en loadFromPiaRow() y origenProspecto default. */}
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              (Tu panel BD Pía va acá tal cual lo tienes)
            </div>
          </div>
        )}
      </div>

      {/* Info asignación */}
      <div style={{ marginBottom: 12, fontSize: 12, opacity: 0.85 }}>
        <b>Asignación:</b>{" "}
        {requiereAsign ? (
          <>
            Este prospecto quedará en <b>PENDIENTE_ASIGNACION</b> (solo WEB/RRSS) para que jefatura lo derive.
          </>
        ) : (
          <>
            Este prospecto quedará <b>{form.estado || "ASIGNADO"}</b> automáticamente a <b>{loggedEmail || "tu usuario"}</b>.
          </>
        )}
      </div>

      {/* Formulario */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Datos del Prospecto</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <SelectField
            label="División *"
            value={form.division}
            onChange={(v) => setForm((p) => ({ ...p, division: v as Division }))}
            error={errors.division}
            options={CRM_DIVISIONES.map((d) => ({ value: d.value, label: d.label }))}
          />

          <Field
            label="Nombre o Razón Social *"
            value={form.nombreRazonSocial}
            onChange={(v) => setForm((p) => ({ ...p, nombreRazonSocial: v }))}
            error={errors.nombreRazonSocial}
          />

          <Field
            label="Contacto *"
            value={form.contacto}
            onChange={(v) => setForm((p) => ({ ...p, contacto: v }))}
            error={errors.contacto}
          />

          <Field
            label="RUT (opcional)"
            value={form.rut}
            onChange={(v) => setForm((p) => ({ ...p, rut: v }))}
          />

          <Field
            label="Teléfono (opcional)"
            value={form.telefono}
            onChange={(v) => setForm((p) => ({ ...p, telefono: v }))}
          />

          <Field
            label="Correo *"
            value={form.correo}
            onChange={(v) => setForm((p) => ({ ...p, correo: v }))}
            error={errors.correo}
          />

          <Field
            label="Dirección *"
            value={form.direccion}
            onChange={(v) => setForm((p) => ({ ...p, direccion: v }))}
            error={errors.direccion}
          />

          <Field
            label="Rubro *"
            value={form.rubro}
            onChange={(v) => setForm((p) => ({ ...p, rubro: v }))}
            error={errors.rubro}
          />

          <Field
            label="Monto proyectado (CLP) *"
            value={form.montoProyectado}
            onChange={(v) => setForm((p) => ({ ...p, montoProyectado: v }))}
            error={errors.montoProyectado}
          />

          {/* ✅ Estado (solo si NO requiere asignación jefatura) */}
          <SelectField
            label="Estado (gestión) *"
            value={form.estado}
            onChange={(v) => setForm((p) => ({ ...p, estado: v }))}
            error={errors.estado}
            options={CRM_ESTADOS.map((o) => ({ value: o.value, label: o.label }))}
            disabled={requiereAsign}
            hint={requiereAsign ? "Se fuerza a PENDIENTE_ASIGNACION porque requiere derivación de jefatura." : undefined}
          />

          {/* ✅ Etapa comercial */}
          <SelectField
            label="Etapa comercial *"
            value={String(form.etapaId ?? "")}
            onChange={(v) => setForm((p) => ({ ...p, etapaId: Number(v) }))}
            error={errors.etapaId}
            options={CRM_ETAPAS.map((o) => ({ value: String(o.id), label: `${o.id}: ${o.label}` }))}
          />

          <SelectField
            label="Fecha Cierre *"
            value={String(form.fechaCierreId ?? "")}
            onChange={(v) => setForm((p) => ({ ...p, fechaCierreId: Number(v) }))}
            error={errors.fechaCierreId}
            options={CRM_FECHA_CIERRE.map((o) => ({ value: String(o.id), label: `${o.id}: ${o.label}` }))}
          />

          <SelectField
            label="Probabilidad Cierre *"
            value={String(form.probCierreId ?? "")}
            onChange={(v) => setForm((p) => ({ ...p, probCierreId: Number(v) }))}
            error={errors.probCierreId}
            options={CRM_PROB_CIERRE.map((o) => ({ value: String(o.id), label: `${o.id}: ${o.label}` }))}
          />

          <SelectField
            label="Origen del prospecto (comercial) *"
            value={form.origenProspecto}
            onChange={(v) => setForm((p) => ({ ...p, origenProspecto: v }))}
            error={errors.origenProspecto}
            options={[
              { value: "WEB", label: "Web" },
              { value: "RRSS", label: "RRSS" },
              { value: "FOOD SERVICE", label: "Food Service" },
              { value: "Referido", label: "Referido" },
              { value: "INOFOOD", label: "Inofood" },
              { value: "Manual", label: "Manual" },
              { value: "CONTACTO DIRECTO", label: "Contacto Directo" },
            ]}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block" }}>
            <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>Observación (opcional)</div>
            <textarea
              value={form.observacion}
              onChange={(e) => setForm((p) => ({ ...p, observacion: e.target.value }))}
              rows={4}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={() => {
              setForm((p) => ({
                ...p,
                fecha: nowCL(),
                folio: makeFolio(),
                ejecutivoEmail: loggedEmail,
                nombreRazonSocial: "",
                rut: "",
                contacto: "",
                telefono: "",
                correo: "",
                direccion: "",
                rubro: "",
                montoProyectado: "",
                observacion: "",
                sourceId: undefined,
                sourcePayload: undefined,
                estado: "ASIGNADO",
                etapaId: 1,
                fechaCierreId: 2,
                probCierreId: 2,
              }));
              setErrors({});
              setSelectedSourceId(null);
              setShowAll(false);
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "white",
              cursor: "pointer",
            }}
          >
            Limpiar
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: saving ? "#6b7280" : "#111827",
              color: "white",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.9 : 1,
            }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {/* Últimos 5 creados por mí */}
      <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Mis últimos 5 prospectos (CRM_DB)</h3>
        {crmLoading ? (
          <div style={{ opacity: 0.8 }}>Cargando…</div>
        ) : myLast5.length === 0 ? (
          <div style={{ opacity: 0.8 }}>Sin registros.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.8 }}>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Folio</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Razón Social</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>División</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Estado</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Asignado a</th>
                </tr>
              </thead>
              <tbody>
                {myLast5.map((r, idx) => (
                  <tr key={`${r.folio || idx}_${idx}`}>
                    <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{r.folio || "—"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{r.nombre_razon_social || "—"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{r.division || "—"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{r.estado || "—"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{r.asignado_a || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** =========================
 *  UI helpers
 *  ========================= */
function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>{props.label}</div>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 10,
          border: `1px solid ${props.error ? "crimson" : "#d1d5db"}`,
        }}
      />
      {props.error && (
        <div style={{ color: "crimson", fontSize: 12, marginTop: 6 }}>{props.error}</div>
      )}
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>{props.label}</div>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 10,
          border: `1px solid ${props.error ? "crimson" : "#d1d5db"}`,
          background: props.disabled ? "#f3f4f6" : "white",
          opacity: props.disabled ? 0.85 : 1,
        }}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {props.hint && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{props.hint}</div>}
      {props.error && <div style={{ color: "crimson", fontSize: 12, marginTop: 6 }}>{props.error}</div>}
    </label>
  );
}
