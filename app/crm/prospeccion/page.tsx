"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/** =========================
 *  CONFIG
 *  ========================= */
const CSV_PIA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiXecS06_-jxv0O98PUG2jMVT-8M5HpliYZZNyoG2EdrstE0ydTATYxdnih18zwGXow6hsxCtz90vi/pub?gid=0&single=true&output=csv";

const PIA_OWNER_COL_NORM = "email_col"; // normalizado desde EMAIL_COL

/** =========================
 *  LISTAS FIJAS
 *  ========================= */
const CRM_ETAPAS = [
  { id: 1, label: "Contactado" },
  { id: 2, label: "Reunión" },
  { id: 3, label: "Levantamiento" },
  { id: 4, label: "Propuesta" },
  { id: 5, label: "Cerrado ganado" },
  { id: 6, label: "Instalado, 1° o/c" },
  { id: 7, label: "No ganado" },
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

/** =========================
 *  TIPOS
 *  ========================= */
type FuenteDatos = "MANUAL" | "CSV_PIA";
type PiaRow = Record<string, string>;

type ProspectoForm = {
  fecha: string;
  folio: string;
  ejecutivoEmail: string;

  nombreRazonSocial: string;
  rut: string;
  telefono: string;
  correo: string;
  direccion: string;
  rubro: string;
  montoProyectado: string;

  etapaId: number;
  fechaCierreId: number;
  probCierreId: number;

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
function parseCsv(text: string): PiaRow[] {
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
    const obj: PiaRow = {};
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

function makeSourceId(row: PiaRow) {
  const empresa = row.nombre_o_razon_social || "";
  const email = row.e_mail || "";
  const key = `${empresa}|${normalizeEmail(email)}`.trim().toLowerCase();
  return `pia_${key.replace(/\s+/g, "_").slice(0, 60)}_${key.length}`;
}

function mapPiaRowToForm(row: PiaRow): Partial<ProspectoForm> {
  return {
    nombreRazonSocial: row.nombre_o_razon_social || "",
    correo: row.e_mail || "",
    telefono: row.telefono || "",
    direccion: row.direccion || "",
    rubro: row.cargo || "",
    montoProyectado: row.monto_prospecto || "",
  };
}

function validateForm(f: ProspectoForm) {
  const errors: Record<string, string> = {};
  if (!f.nombreRazonSocial.trim()) errors.nombreRazonSocial = "Campo requerido";

  const email = normalizeEmail(f.correo);
  if (!email) errors.correo = "Campo requerido";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.correo = "Formato de correo inválido";
  }

  if (!f.direccion.trim()) errors.direccion = "Campo requerido";
  if (!f.rubro.trim()) errors.rubro = "Campo requerido";
  if (!f.montoProyectado.trim()) errors.montoProyectado = "Campo requerido";

  const montoNum = Number(String(f.montoProyectado).replace(/[^\d]/g, ""));
  if (f.montoProyectado.trim() && (!Number.isFinite(montoNum) || montoNum <= 0)) {
    errors.montoProyectado = "Monto inválido";
  }

  if (!f.origenProspecto.trim()) errors.origenProspecto = "Campo requerido";
  if (!f.etapaId) errors.etapaId = "Campo requerido";
  if (!f.fechaCierreId) errors.fechaCierreId = "Campo requerido";
  if (!f.probCierreId) errors.probCierreId = "Campo requerido";
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

  // mostrar 5 o todos
  const [showAll, setShowAll] = useState(false);

  // guardado
  const [saving, setSaving] = useState(false);

  // Form
  const [form, setForm] = useState<ProspectoForm>(() => ({
    fecha: nowCL(),
    folio: makeFolio(),
    ejecutivoEmail: "",

    nombreRazonSocial: "",
    rut: "",
    telefono: "",
    correo: "",
    direccion: "",
    rubro: "",
    montoProyectado: "",

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

  /** 2) Cargar CSV y filtrar por email_col */
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

  /** 3) Si intentan elegir CSV sin permiso, vuelve a Manual */
  useEffect(() => {
    if (fuente === "CSV_PIA" && !piaAllowed) setFuente("MANUAL");
  }, [fuente, piaAllowed]);

  /** 4) Fuente -> actualiza form.fuenteDatos SIEMPRE */
  useEffect(() => {
    setForm((prev) => ({ ...prev, fuenteDatos: fuente }));
  }, [fuente]);

  /** 5) Al cambiar fuente, refresca metadatos del registro */
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
      origenProspecto: fuente === "CSV_PIA" ? "RRSS" : prev.origenProspecto || "Manual",
      sourceId: undefined,
      sourcePayload: undefined,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente]);

  /** 6) Filtrado + límite (5 por defecto, botón mostrar todos)
   *  - sin búsqueda: 5 o todos
   *  - con búsqueda: max 20
   */
  const filteredPia = useMemo(() => {
    const q = search.trim().toLowerCase();
    const limit = q ? 20 : showAll ? piaRows.length : 5;

    if (!q) return piaRows.slice(0, limit);

    const matches = piaRows.filter((r) => {
      const razon = (r.nombre_o_razon_social || "").toLowerCase();
      const email = (r.e_mail || "").toLowerCase();
      const contacto = (r.contacto || "").toLowerCase();
      const dir = (r.direccion || "").toLowerCase();
      return (
        razon.includes(q) ||
        email.includes(q) ||
        contacto.includes(q) ||
        dir.includes(q)
      );
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
    }));
  }

  // ✅ helper: build payload siempre igual
  function buildPayload() {
    const monto = Number(String(form.montoProyectado).replace(/[^\d]/g, ""));
    return {
      created_at: new Date().toISOString(),
      folio: form.folio,
      fuente: form.fuenteDatos, // ✅ MANUAL o CSV_PIA
      source_id: form.sourceId || "",
      source_payload: form.sourcePayload || "", // ✅ (no está en headers, pero no molesta)

      nombre_razon_social: form.nombreRazonSocial,
      rut: form.rut,
      telefono: form.telefono,
      correo: normalizeEmail(form.correo),
      direccion: form.direccion,
      rubro: form.rubro,
      monto_proyectado: monto,

      etapa_id: form.etapaId,
      etapa_nombre: etapaNombre,
      fecha_cierre_id: form.fechaCierreId,
      fecha_cierre_nombre: fechaCierreNombre,
      prob_cierre_id: form.probCierreId,
      prob_cierre_nombre: probCierreNombre,

      origen_prospecto: form.origenProspecto,
      observacion: form.observacion,

      ejecutivo_email: form.ejecutivoEmail,
      estado: "PENDIENTE_ASIGNACION",
      asignado_a: "",
      asignado_por: "",
      asignado_at: "",
    };
  }

  async function onSubmit() {
    const v = validateForm(form);
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    try {
      setSaving(true);

      // ✅ SIEMPRE guardamos por el API interno (evita CORS)
      const payload = buildPayload();

      const resp = await fetch("/api/crm/prospectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // ✅ Manejo robusto de respuesta (puede venir texto)
      const text = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, error: "Respuesta no JSON", raw: text.slice(0, 300) };
      }

      if (!resp.ok || !data?.ok) {
        alert(
          `❌ Error guardando:\nstatus=${resp.status}\n${JSON.stringify(data, null, 2)}`
        );
        return;
      }

      alert(
        data.duplicated
          ? "⚠️ El prospecto ya existía (folio duplicado)."
          : "✅ Prospecto guardado en CRM_DB"
      );

      // ✅ Limpieza: mantiene fuente y ejecutivo
      setForm((p) => ({
        ...p,
        fecha: nowCL(),
        folio: makeFolio(),
        ejecutivoEmail: loggedEmail,

        nombreRazonSocial: "",
        rut: "",
        telefono: "",
        correo: "",
        direccion: "",
        rubro: "",
        montoProyectado: "",

        observacion: "",
        sourceId: undefined,
        sourcePayload: undefined,
      }));
      setErrors({});
      setSelectedSourceId(null);
      setShowAll(false);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>CRM · Gestión de Prospección</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        CRM · Gestión de Prospección · Nuevo Prospecto
      </h2>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        Registro para bandeja de asignación y gestión comercial.
      </div>

      {/* Fuente de datos */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
          Fuente de datos
        </h3>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label>
            <span style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
              Seleccionar
            </span>
            <select
              value={fuente}
              onChange={(e) => setFuente(e.target.value as FuenteDatos)}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid #d1d5db",
                minWidth: 260,
              }}
            >
              <option value="MANUAL">Manual</option>
              {piaAllowed && (
                <option value="CSV_PIA">Base Google Sheets (CSV) – BD Pía</option>
              )}
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

        {/* Panel BD Pía */}
        {fuente === "CSV_PIA" && piaAllowed && (
          <div style={{ marginTop: 14, borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ flex: 1, minWidth: 260 }}>
                <span style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
                  Buscar en BD (razón social, email, contacto, dirección)
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ej: klap / @gmail / región..."
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                  }}
                />
              </label>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ opacity: 0.8 }}>
                  {piaLoading ? "Cargando BD..." : `${piaRows.length} registros disponibles`}
                </div>

                {!piaLoading && piaRows.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    {showAll ? "Mostrar menos" : "Mostrar todos"}
                  </button>
                )}
              </div>
            </div>

            {piaError && <div style={{ color: "crimson", marginTop: 8 }}>Error: {piaError}</div>}

            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.8 }}>
                    <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Razón Social</th>
                    <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Contacto</th>
                    <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>E-mail</th>
                    <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Dirección</th>
                    <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPia.map((r, idx) => {
                    const razon = r.nombre_o_razon_social || "";
                    const contacto = r.contacto || "";
                    const email = r.e_mail || "";
                    const direccion = r.direccion || "";
                    const sid = makeSourceId(r);
                    const isSel = selectedSourceId === sid;

                    return (
                      <tr key={`${sid}_${idx}`} style={{ background: isSel ? "#eef2ff" : "transparent" }}>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{razon}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{contacto}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{email}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{direccion}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                          <button
                            type="button"
                            onClick={() => loadFromPiaRow(r)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #d1d5db",
                              background: "white",
                              cursor: "pointer",
                            }}
                          >
                            Cargar
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {!piaLoading && filteredPia.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 10, opacity: 0.7 }}>
                        Sin resultados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              Visible solo si <b>EMAIL_COL</b> coincide con tu login: <b>{loggedEmail}</b>.
              {!search.trim() && <> (Mostrando {showAll ? "todos" : "5"}).</>}
              {search.trim() && <> (Búsqueda muestra máx. 20 resultados).</>}
            </div>
          </div>
        )}
      </div>

      {/* Formulario */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Datos del Prospecto</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field
            label="Nombre o Razón Social *"
            value={form.nombreRazonSocial}
            onChange={(v) => setForm((p) => ({ ...p, nombreRazonSocial: v }))}
            error={errors.nombreRazonSocial}
          />
          <Field
            label="RUT (opcional)"
            value={form.rut}
            onChange={(v) => setForm((p) => ({ ...p, rut: v }))}
            placeholder="12.345.678-9"
          />
          <Field
            label="Teléfono (opcional)"
            value={form.telefono}
            onChange={(v) => setForm((p) => ({ ...p, telefono: v }))}
            placeholder="+56 9 xxxx xxxx"
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
            placeholder="Ej: 1500000"
          />

          <SelectField
            label="Etapa *"
            value={String(form.etapaId)}
            onChange={(v) => setForm((p) => ({ ...p, etapaId: Number(v) }))}
            error={errors.etapaId}
            options={CRM_ETAPAS.map((o) => ({ value: String(o.id), label: `${o.id}: ${o.label}` }))}
          />

          <SelectField
            label="Fecha Cierre *"
            value={String(form.fechaCierreId)}
            onChange={(v) => setForm((p) => ({ ...p, fechaCierreId: Number(v) }))}
            error={errors.fechaCierreId}
            options={CRM_FECHA_CIERRE.map((o) => ({ value: String(o.id), label: `${o.id}: ${o.label}` }))}
          />

          <SelectField
            label="Probabilidad Cierre *"
            value={String(form.probCierreId)}
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
              { value: "RRSS", label: "RRSS" },
              { value: "Ferias", label: "Ferias" },
              { value: "Referido", label: "Referido" },
              { value: "Web", label: "Web" },
              { value: "Manual", label: "Manual" },
              { value: "Otro", label: "Otro" },
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
                telefono: "",
                correo: "",
                direccion: "",
                rubro: "",
                montoProyectado: "",
                observacion: "",
                sourceId: undefined,
                sourcePayload: undefined,
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
            {saving ? "Guardando..." : "Guardar (pendiente asignación)"}
          </button>
        </div>
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
      {props.error && <div style={{ color: "crimson", fontSize: 12, marginTop: 6 }}>{props.error}</div>}
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>{props.label}</div>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 10,
          border: `1px solid ${props.error ? "crimson" : "#d1d5db"}`,
          background: "white",
        }}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {props.error && <div style={{ color: "crimson", fontSize: 12, marginTop: 6 }}>{props.error}</div>}
    </label>
  );
}
