"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSearchParams } from "next/navigation";
import ModalActualizarFicha from './ModalActualizarFicha';
import ModalGestionObservacion from "../../../../components/crm/ModalGestionObservacion";




/** =========================
 *  CONFIG
 *  ========================= */
const CSV_CRM_DB_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

const ESTADOS_GESTION = [
  { value: "ASIGNADO", label: "Asignado" },
  { value: "EN_GESTION", label: "En gestión" },
  { value: "CONTACTADO", label: "Contactado" },
  { value: "REUNION", label: "Reunión" },
  { value: "LEVANTAMIENTO", label: "Levantamiento" },
  { value: "PROPUESTA", label: "Propuesta" },
  { value: "CERRADO_GANADO", label: "Cerrado ganado" },
  { value: "INSTALADO_1OC", label: "Instalado, 1° O/C" },
  { value: "NO_GANADO", label: "No ganado" },
] as const;

const ETAPAS = [
  { id: "1", nombre: "Contactado" },
  { id: "2", nombre: "Reunión" },
  { id: "3", nombre: "Levantamiento" },
  { id: "4", nombre: "Propuesta" },
] as const;

const FECHA_CIERRE = [
  { id: "1", nombre: "Antes 30 días" },
  { id: "2", nombre: "Entre 30 y 90 días" },
  { id: "3", nombre: "Más de 90 días" },
] as const;

const PROB_CIERRE = [
  { id: "1", nombre: "Menor a 30%" },
  { id: "2", nombre: "Entre 30% y 50%" },
  { id: "3", nombre: "Entre 75% a 90%" },
] as const;

/** =========================
 *  CSV Helpers
 *  ========================= */
type RowAny = Record<string, string>;

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
    headers.forEach((h, idx) => (obj[h] = (cells[idx] ?? "").trim()));
    return obj;
  });
}

/** =========================
 *  Helpers UI
 *  ========================= */
function norm(s: string) {
  return (s || "").trim().toLowerCase();
}
function normU(s: string) {
  return (s || "").trim().toUpperCase().replace(/\s+/g, "_");
}

function estadoBadgeStyle(estadoRaw: string) {
  const e = normU(estadoRaw);
  if (e === "ASIGNADO") return { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" };
  if (e === "EN_GESTION") return { bg: "#FEF9C3", color: "#854D0E", border: "#FDE68A" };
  if (e === "CONTACTADO") return { bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" };
  if (e === "REUNION") return { bg: "#EDE9FE", color: "#5B21B6", border: "#DDD6FE" };
  if (e === "LEVANTAMIENTO") return { bg: "#FDF2F8", color: "#9D174D", border: "#FBCFE8" };
  if (e === "PROPUESTA") return { bg: "#FFEDD5", color: "#9A3412", border: "#FED7AA" };
  if (e === "CERRADO_GANADO") return { bg: "#BBF7D0", color: "#14532D", border: "#86EFAC" };
  if (e === "INSTALADO_1OC") return { bg: "#DCFCE7", color: "#166534", border: "#86EFAC" };
  if (e === "NO_GANADO") return { bg: "#FEE2E2", color: "#7F1D1D", border: "#FECACA" };
  return { bg: "#F3F4F6", color: "#374151", border: "#E5E7EB" };
}

function chipStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800 as const,
    border: "1px solid #e5e7eb",
    whiteSpace: "nowrap" as const,
  };
}

/** =========================
 *  Validación: mínimos para CONTACTADO
 *  ========================= */
const REQUIRED_CONTACTADO: Array<{ key: string; label: string }> = [
  { key: "nombre_razon_social", label: "Razón social" },
  { key: "rut", label: "RUT" },
  { key: "telefono", label: "Teléfono" },
  { key: "correo", label: "Correo" },
  { key: "direccion", label: "Dirección" },
  { key: "rubro", label: "Rubro" },
  { key: "monto_proyectado", label: "Monto proyectado" },
  { key: "etapa_id", label: "Etapa (ID)" },
  { key: "etapa_nombre", label: "Etapa (Nombre)" },
  { key: "fecha_cierre_id", label: "Fecha cierre (ID)" },
  { key: "fecha_cierre_nombre", label: "Fecha cierre (Nombre)" },
  { key: "prob_cierre_id", label: "Prob. cierre (ID)" },
  { key: "prob_cierre_nombre", label: "Prob. cierre (Nombre)" },
  { key: "origen_prospecto", label: "Origen prospecto" },
  { key: "ejecutivo_email", label: "Ejecutivo email" },
  { key: "asignado_a", label: "Asignado a" },
  { key: "asignado_por", label: "Asignado por" },
];

function missingContactadoFields(r: RowAny) {
  const missing: Array<{ key: string; label: string }> = [];
  for (const f of REQUIRED_CONTACTADO) {
    const v = (r?.[f.key] ?? "").trim();
    if (!v) missing.push(f);
  }
  return missing;
}

/** =========================
 *  PAGE
 *  ========================= */
export default function BandejaAsignadosPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const searchParams = useSearchParams();

  const [authLoading, setAuthLoading] = useState(true);
  const [loggedEmail, setLoggedEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<RowAny[]>([]);
  const [q, setQ] = useState("");

  // drafts por folio
  const [draftEstado, setDraftEstado] = useState<Record<string, string>>({});
  const [savingFolio, setSavingFolio] = useState<string | null>(null);

  // modal gestión (observación)
  const [openObs, setOpenObs] = useState(false);
  const [obsFolio, setObsFolio] = useState<string | null>(null);
  const [obsText, setObsText] = useState("");
  const [obsHistory, setObsHistory] = useState("");


  // modal completar ficha
  const [openFicha, setOpenFicha] = useState(false);
  const [fichaFolio, setFichaFolio] = useState<string | null>(null);
  const [ficha, setFicha] = useState<Record<string, string>>({});
  const [fichaMissing, setFichaMissing] = useState<Array<{ key: string; label: string }>>([]);

  // modal nuevo para actualizar ficha directamente
const [modalOpen, setModalOpen] = useState(false);
const [prospectoActivo, setProspectoActivo] = useState<RowAny | null>(null);


  // ✅ scroll/highlight
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [highlightFolio, setHighlightFolio] = useState<string | null>(null);
  const folioParam = (searchParams.get("folio") || "").trim();

  async function reload() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(CSV_CRM_DB_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Error al cargar CRM_DB CSV (${res.status})`);
      const text = await res.text();
      setRows(parseCsv(text));
    } catch (e: any) {
      setError(e?.message || "Error desconocido");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  /** 1) Auth */
  useEffect(() => {
    (async () => {
      try {
        setAuthLoading(true);
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        setLoggedEmail(data.user?.email ?? "");
      } catch {
        setLoggedEmail("");
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [supabase]);

  /** 2) Cargar datos */
  useEffect(() => {
    if (authLoading) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  /** Vista: solo asignados al ejecutivo */
  const assignedToMe = useMemo(() => {
    const me = norm(loggedEmail);
    if (!me) return [];

    const base = rows.filter((r) => norm(r.asignado_a || "") === me);

    const s = norm(q);
    if (!s) return base;

    return base.filter((r) => {
      const blob = norm(r.nombre_razon_social || "") + " " + norm(r.correo || "") + " " + norm(r.rubro || "") + " " + norm(r.observacion || "");
      return blob.includes(s);
    });
  }, [rows, loggedEmail, q]);

  // init draftEstado
  useEffect(() => {
    if (!assignedToMe.length) return;
    setDraftEstado((prev) => {
      const next = { ...prev };
      for (const r of assignedToMe) {
        const folio = (r.folio || "").trim();
        if (!folio) continue;
        if (next[folio] == null) next[folio] = normU(r.estado || "") || "ASIGNADO";
      }
      return next;
    });
  }, [assignedToMe]);

  // Scroll highlight ?folio=
  useEffect(() => {
    if (!folioParam) return;
    if (loading) return;

    const t = window.setTimeout(() => {
      const el = rowRefs.current[folioParam];
      if (el) {
        setHighlightFolio(folioParam);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => {
          setHighlightFolio((cur) => (cur === folioParam ? null : cur));
        }, 4500);
      }
    }, 50);

    return () => window.clearTimeout(t);
  }, [folioParam, loading, assignedToMe.length]);

  async function openGestionObs(r: RowAny) {
    const folio = (r.folio || "").trim();
    if (!folio) return;
  
    // 👉 abrir modal inmediatamente (UX rápida)
    setObsFolio(folio);
    setObsHistory(r.observacion || "");
    setObsText("");
    setOpenObs(true);
  
    // 🔴➡️⚪ marcar como leído
    if (r.obs_jefatura_flag === "TRUE" && r.obs_jefatura_vista !== "TRUE") {
      try {
        await postUpdate({
          folio,
          obs_jefatura_vista: "TRUE", // 👈 EN MAYÚSCULA
          updated_by: loggedEmail,
        });
  
        await reload(); // refresca tabla y quita punto rojo
      } catch (err) {
        console.error("Error marcando obs_jefatura_vista", err);
      }
    }
  }
  
  
  

  function openCompletarFicha(r: RowAny) {
    const folio = (r.folio || "").trim();
    const missing = missingContactadoFields({
      ...r,
      ejecutivo_email: (r.ejecutivo_email || "").trim() || loggedEmail,
    });

    setFichaFolio(folio);
    setFichaMissing(missing);

    setFicha({
      rut: r.rut || "",
      telefono: r.telefono || "",
      correo: r.correo || "",
      direccion: r.direccion || "",
      rubro: r.rubro || "",
      monto_proyectado: r.monto_proyectado || "",
      etapa_id: r.etapa_id || "1",
      etapa_nombre: r.etapa_nombre || "Contactado",
      fecha_cierre_id: r.fecha_cierre_id || "1",
      fecha_cierre_nombre: r.fecha_cierre_nombre || "Antes 30 días",
      prob_cierre_id: r.prob_cierre_id || "1",
      prob_cierre_nombre: r.prob_cierre_nombre || "Menor a 30%",
      origen_prospecto: r.origen_prospecto || r.fuente || "",
      ejecutivo_email: (r.ejecutivo_email || "").trim() || loggedEmail,
      asignado_a: r.asignado_a || loggedEmail,
      asignado_por: r.asignado_por || "",
      nombre_razon_social: r.nombre_razon_social || "",
    });

    setOpenFicha(true);
  }

  function abrirModalActualizar(r: RowAny) {
    setProspectoActivo(r);
    setModalOpen(true);
  }
  

  async function postUpdate(payload: any) {
    const resp = await fetch("/api/crm/prospectos/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: "Respuesta no JSON", raw: text.slice(0, 400) };
    }

    if (!resp.ok || !data?.ok) {
      throw new Error(`status=${resp.status}\n${JSON.stringify(data, null, 2)}`);
    }
    return data;
  }

  async function guardarEstado(folio: string) {
    const estado = normU(draftEstado[folio] || "");
    if (!folio) return;

    const row = assignedToMe.find((r) => (r.folio || "").trim() === folio);
    if (!row) return;

    if (estado === "CONTACTADO") {
      const merged = {
        ...row,
        ejecutivo_email: (row.ejecutivo_email || "").trim() || loggedEmail,
        estado: "CONTACTADO",
      };
      const missing = missingContactadoFields(merged);

      if (missing.length) {
        openCompletarFicha(merged);
        return;
      }
    }

    try {
      setSavingFolio(folio);
      await postUpdate({ folio, estado, updated_by: loggedEmail });
      await reload();
    } catch (e: any) {
      alert(`❌ Error guardando\n${e?.message || e}`);
    } finally {
      setSavingFolio(null);
    }
  }

  async function guardarObs() {
    if (!obsFolio) return;
    const nota = obsText.trim();
    if (!nota) {
      setOpenObs(false);
      return;
    }

    try {
      setSavingFolio(obsFolio);
      await postUpdate({ folio: obsFolio, observacion: nota, updated_by: loggedEmail });
      setOpenObs(false);
      setObsFolio(null);
      setObsText("");
      await reload();
    } catch (e: any) {
      alert(`❌ Error guardando gestión\n${e?.message || e}`);
    } finally {
      setSavingFolio(null);
    }
  }

  async function guardarFichaYContactado() {
    if (!fichaFolio) return;

    const etapa = ETAPAS.find((x) => x.id === (ficha.etapa_id || "1"));
    const fecha = FECHA_CIERRE.find((x) => x.id === (ficha.fecha_cierre_id || "1"));
    const prob = PROB_CIERRE.find((x) => x.id === (ficha.prob_cierre_id || "1"));

    const payload = {
      folio: fichaFolio,
      estado: "CONTACTADO",
      updated_by: loggedEmail,

      nombre_razon_social: ficha.nombre_razon_social,
      rut: ficha.rut,
      telefono: ficha.telefono,
      correo: ficha.correo,
      direccion: ficha.direccion,
      rubro: ficha.rubro,
      monto_proyectado: ficha.monto_proyectado,

      etapa_id: ficha.etapa_id,
      etapa_nombre: etapa?.nombre || ficha.etapa_nombre,

      fecha_cierre_id: ficha.fecha_cierre_id,
      fecha_cierre_nombre: fecha?.nombre || ficha.fecha_cierre_nombre,

      prob_cierre_id: ficha.prob_cierre_id,
      prob_cierre_nombre: prob?.nombre || ficha.prob_cierre_nombre,

      origen_prospecto: ficha.origen_prospecto,
      ejecutivo_email: (ficha.ejecutivo_email || "").trim() || loggedEmail,
      asignado_a: ficha.asignado_a || loggedEmail,
      asignado_por: ficha.asignado_por || "",
    };

    const missing = missingContactadoFields(payload as any);
    if (missing.length) {
      alert(`Faltan campos: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }

    try {
      setSavingFolio(fichaFolio);
      await postUpdate(payload);
      setOpenFicha(false);
      setFichaFolio(null);
      setFicha({});
      setFichaMissing([]);
      await reload();
    } catch (e: any) {
      alert(`❌ Error guardando ficha\n${e?.message || e}`);
    } finally {
      setSavingFolio(null);
    }
  }

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>CRM · Asignados</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200 }}>
      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>CRM · Asignados</h2>
      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        Usuario: <b>{loggedEmail || "—"}</b>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por razón social / correo / rubro / mensaje..."
          style={{
            flex: 1,
            minWidth: 320,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #d1d5db",
          }}
        />

        <button
          type="button"
          onClick={reload}
          disabled={loading}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "white",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.85 }}>
          Total: <b>{assignedToMe.length}</b>
        </div>
      </div>

      {error && (
        <div
          style={{
            border: "1px solid #ef4444",
            background: "#fef2f2",
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <b style={{ color: "#b91c1c" }}>Error:</b> {error}
        </div>
      )}

      {/* Tabla ultra compacta */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.85 }}>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Razón social</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Contacto</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Estado</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: 12, opacity: 0.8 }}>
                    Cargando…
                  </td>
                </tr>
              ) : assignedToMe.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 12, opacity: 0.8 }}>
                    Sin registros.
                  </td>
                </tr>
              ) : (
                assignedToMe.map((r, i) => {
                  const folio = (r.folio || "").trim();
                  const busy = savingFolio === folio;

                  const est = r.estado || "—";
                  const st = estadoBadgeStyle(est);

                  const draft = normU(draftEstado[folio] || normU(est) || "ASIGNADO");
                  const changed = draft !== normU(est);

                  const isHighlighted = !!folio && highlightFolio === folio;

                  return (
                    <tr
                      key={`${folio || "x"}_${i}`}
                      ref={(el) => {
                        if (folio) rowRefs.current[folio] = el;
                      }}
                      style={{
                        background: isHighlighted ? "#FEF3C7" : "transparent",
                        transition: "background 250ms ease",
                      }}
                    >
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ fontWeight: 900, fontSize: 15, lineHeight: "18px" }}>
      {r.nombre_razon_social || "—"}
    </div>
  </div>
</td>


                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{r.correo || "—"}</div>
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", minWidth: 360 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap" }}>
                          <span
                            style={{
                              ...chipStyle(),
                              background: st.bg,
                              color: st.color,
                              border: `1px solid ${st.border}`,
                            }}
                          >
                            {normU(est) || "—"}
                          </span>

                          <select
                            value={draft}
                            onChange={(e) => setDraftEstado((p) => ({ ...p, [folio]: e.target.value }))}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: `1px solid ${changed ? "#111827" : "#d1d5db"}`,
                              background: "white",
                              minWidth: 200,
                              height: 36,
                            }}
                          >
                            {ESTADOS_GESTION.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => guardarEstado(folio)}
                            disabled={!folio || busy}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #111827",
                              background: busy ? "#6b7280" : "#111827",
                              color: "white",
                              cursor: busy ? "not-allowed" : "pointer",
                              height: 36,
                            }}
                          >
                            {busy ? "Guardando…" : "Guardar"}
                          </button>

                          <button
                            type="button"
                            onClick={() => setDraftEstado((p) => ({ ...p, [folio]: normU(est) }))}
                            disabled={!folio || busy}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #d1d5db",
                              background: "white",
                              cursor: busy ? "not-allowed" : "pointer",
                              height: 36,
                            }}
                          >
                            Deshacer
                          </button>

                          <button
  type="button"
  onClick={() => openGestionObs(r)}
  disabled={!folio || busy}
  style={{
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "white",
    cursor: busy ? "not-allowed" : "pointer",
    height: 36,
    display: "flex",
    alignItems: "center",
    gap: 6,
  }}
>
  <span>Ver gestión</span>

  {/* 🔴 Punto rojo: mensaje de jefatura pendiente */}
  {r.obs_jefatura_flag === "TRUE" &&
    r.obs_jefatura_vista !== "TRUE" && (
      <span
        title="Tienes un mensaje de jefatura"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "#ef4444",
          display: "inline-block",
        }}
      />
    )}
</button>


                          

                          <button
  type="button"
  onClick={() => openCompletarFicha(r)}
  disabled={!folio || busy}
  style={{
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #f59e0b",
    background: "#FEF3C7",
    cursor: busy ? "not-allowed" : "pointer",
    fontWeight: 900,
    height: 36,
  }}
>
  Completar ficha
</button>

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Observación */}
      {openObs && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setOpenObs(false)}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              background: "white",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Gestión / Observación</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                Folio: <b>{obsFolio}</b>
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
  <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Historial</div>

  <div
    style={{
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: 10,
      background: "#fafafa",
      maxHeight: 220,
      overflowY: "auto",
      whiteSpace: "pre-wrap",
      fontSize: 12,
      lineHeight: "18px",
    }}
  >
    {obsHistory?.trim() ? obsHistory : "— Sin historial —"}
  </div>
</div>


            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <textarea
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
                rows={6}
                placeholder="Escribe una nueva gestión (se agrega al historial)…"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  resize: "vertical",
                }}
              />
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                *No se sobreescribe el historial: Apps Script hace <b>append</b> con timestamp.
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setOpenObs(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={guardarObs}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Completar ficha (sin bloque "faltantes") */}
      {openFicha && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setOpenFicha(false)}
        >
          <div
            style={{
              width: "min(860px, 100%)",
              background: "white",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Completar ficha (para CONTACTADO)</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                Folio: <b>{fichaFolio}</b>
              </div>
            </div>

            <div style={{ padding: 14, 
              display: "grid", 
              gap: 12,
              maxHeight: "70vh",
              overflowY: "auto",
              }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Razón social</label>
                  <input
                    value={ficha.nombre_razon_social || ""}
                    onChange={(e) => setFicha((p) => ({ ...p, nombre_razon_social: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>RUT</label>
                  <input
                    value={ficha.rut || ""}
                    onChange={(e) => setFicha((p) => ({ ...p, rut: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Teléfono</label>
                  <input
                    value={ficha.telefono || ""}
                    onChange={(e) => setFicha((p) => ({ ...p, telefono: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Correo</label>
                  <input
                    value={ficha.correo || ""}
                    onChange={(e) => setFicha((p) => ({ ...p, correo: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Dirección</label>
                  <input
                    value={ficha.direccion || ""}
                    onChange={(e) => setFicha((p) => ({ ...p, direccion: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Rubro</label>
                  <input
                    value={ficha.rubro || ""}
                    onChange={(e) => setFicha((p) => ({ ...p, rubro: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Monto proyectado</label>
                  <input
                    value={ficha.monto_proyectado || ""}
                    onChange={(e) => setFicha((p) => ({ ...p, monto_proyectado: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Etapa</label>
                  <select
                    value={ficha.etapa_id || "1"}
                    onChange={(e) => setFicha((p) => ({ ...p, etapa_id: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  >
                    {ETAPAS.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Fecha cierre</label>
                  <select
                    value={ficha.fecha_cierre_id || "1"}
                    onChange={(e) => setFicha((p) => ({ ...p, fecha_cierre_id: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  >
                    {FECHA_CIERRE.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Prob. cierre</label>
                  <select
                    value={ficha.prob_cierre_id || "1"}
                    onChange={(e) => setFicha((p) => ({ ...p, prob_cierre_id: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  >
                    {PROB_CIERRE.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Origen prospecto</label>
                  <input
                    value={ficha.origen_prospecto || ""}
                    onChange={(e) => setFicha((p) => ({ ...p, origen_prospecto: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Ejecutivo email</label>
                  <input
                    value={ficha.ejecutivo_email || ""}
                    onChange={(e) => setFicha((p) => ({ ...p, ejecutivo_email: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Asignado a</label>
                  <input
                    value={ficha.asignado_a || ""}
                    onChange={(e) => setFicha((p) => ({ ...p, asignado_a: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Asignado por</label>
                  <input
                    value={ficha.asignado_por || ""}
                    onChange={(e) => setFicha((p) => ({ ...p, asignado_por: e.target.value }))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setOpenFicha(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={guardarFichaYContactado}
                disabled={!fichaFolio || savingFolio === fichaFolio}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #111827",
                  background: savingFolio === fichaFolio ? "#6b7280" : "#111827",
                  color: "white",
                  cursor: savingFolio === fichaFolio ? "not-allowed" : "pointer",
                  fontWeight: 900,
                }}
              >
                {savingFolio === fichaFolio ? "Guardando…" : "Guardar y pasar a CONTACTADO"}
              </button>
            </div>
          </div>
        </div>


      )}
      {modalOpen && prospectoActivo?.folio && (
  <ModalActualizarFicha
    abierto={modalOpen}
    prospecto={{
      folio: prospectoActivo.folio,
      nombre_razon_social: prospectoActivo.nombre_razon_social || "",
      rut: prospectoActivo.rut || "",
      contacto: prospectoActivo.contacto || "",
      telefono: prospectoActivo.telefono || "",
      correo: prospectoActivo.correo || "",
      direccion: prospectoActivo.direccion || "",
      rubro: prospectoActivo.rubro || "",
      monto_proyectado: prospectoActivo.monto_proyectado || "",
      fecha_cierre: prospectoActivo.fecha_cierre_id || "",
      probabilidad_cierre: prospectoActivo.prob_cierre_id || "",
      etapa: prospectoActivo.etapa_nombre || "",
      observacion: prospectoActivo.observacion || "",
    }}
    loggedEmail={loggedEmail}
    onCerrar={() => {
      setModalOpen(false);
      setProspectoActivo(null);
    }}
    onGuardado={() => {
      reload(); // refresca tabla con datos nuevos
    }}
  />
)}


    </div>
  );
}
