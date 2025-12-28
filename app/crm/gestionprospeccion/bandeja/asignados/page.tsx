"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSearchParams } from "next/navigation";

/** =========================
 *  CONFIG
 *  ========================= */
const CSV_CRM_DB_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

/** =========================
 *  Estados disponibles para gestión
 *  ========================= */
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
 *  Helpers
 *  ========================= */
function norm(s: string) {
  return (s || "").trim().toLowerCase();
}
function normU(s: string) {
  return (s || "").trim().toUpperCase().replace(/\s+/g, "_");
}

function fmtCLP(n: string) {
  const x = Number(String(n || "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(x)) return n || "—";
  return x.toLocaleString("es-CL");
}

function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
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
    lineHeight: "16px",
  };
}

function oneLine(text: string) {
  return String(text || "").replace(/\s+/g, " ").trim();
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
  const [draftNota, setDraftNota] = useState<Record<string, string>>({});
  const [savingFolio, setSavingFolio] = useState<string | null>(null);

  // modal gestión
  const [openGestion, setOpenGestion] = useState(false);
  const [gestionRow, setGestionRow] = useState<RowAny | null>(null);

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

  /** 2) Cargar datos SOLO cuando ya sepamos quién está logueado */
  useEffect(() => {
    if (authLoading) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  /** ✅ ASIGNADOS = todo lo que está asignado_a = yo (sin filtrar por estado) */
  const assignedToMe = useMemo(() => {
    const me = norm(loggedEmail);
    if (!me) return [];

    const base = rows.filter((r) => norm(r.asignado_a || "") === me);

    const s = norm(q);
    if (!s) return base;

    return base.filter((r) => {
      const blob =
        norm(r.nombre_razon_social || "") +
        " " +
        norm(r.correo || "") +
        " " +
        norm(r.telefono || "") +
        " " +
        norm(r.division || "") +
        " " +
        norm(r.rubro || "") +
        " " +
        norm(r.origen_prospecto || "") +
        " " +
        norm(r.estado || "") +
        " " +
        norm(r.observacion || "");
      return blob.includes(s);
    });
  }, [rows, loggedEmail, q]);

  // inicializa draftEstado con el estado actual cuando entra a la lista
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

  // ✅ Scroll + highlight cuando viene ?folio=
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
    }, 60);

    return () => window.clearTimeout(t);
  }, [folioParam, loading, assignedToMe.length]);

  async function guardarEstado(folio: string) {
    const estado = normU(draftEstado[folio] || "");
    if (!folio) return;

    try {
      setSavingFolio(folio);

      const resp = await fetch("/api/crm/prospectos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          folio,
          estado,
        }),
      });

      const text = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, error: "Respuesta no JSON", raw: text.slice(0, 400) };
      }

      if (!resp.ok || !data?.ok) {
        alert(`❌ Error guardando\nstatus=${resp.status}\n${JSON.stringify(data, null, 2)}`);
        return;
      }

      await reload();
    } finally {
      setSavingFolio(null);
    }
  }

  async function guardarNota(folio: string) {
    const nota = (draftNota[folio] || "").trim();
    if (!folio || !nota) return;

    try {
      setSavingFolio(folio);

      const resp = await fetch("/api/crm/prospectos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          folio,
          observacion: nota, // append con timestamp (Apps Script)
        }),
      });

      const text = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, error: "Respuesta no JSON", raw: text.slice(0, 400) };
      }

      if (!resp.ok || !data?.ok) {
        alert(`❌ Error guardando gestión\nstatus=${resp.status}\n${JSON.stringify(data, null, 2)}`);
        return;
      }

      setDraftNota((p) => ({ ...p, [folio]: "" }));
      await reload();
    } finally {
      setSavingFolio(null);
    }
  }

  function openGestionModal(r: RowAny) {
    setGestionRow(r);
    const folio = (r.folio || "").trim();
    if (folio) setDraftNota((p) => ({ ...p, [folio]: p[folio] ?? "" }));
    setOpenGestion(true);
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
    <div style={{ padding: 16, maxWidth: 1500 }}>
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

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.85 }}>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Razón social</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Contacto</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>División</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Estado</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Monto</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Asignación</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }} />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, opacity: 0.8 }}>
                    Cargando…
                  </td>
                </tr>
              ) : assignedToMe.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, opacity: 0.8 }}>
                    Sin registros.
                  </td>
                </tr>
              ) : (
                assignedToMe.map((r, i) => {
                  const folio = (r.folio || "").trim(); // se usa para update pero NO se muestra
                  const est = r.estado || "—";
                  const st = estadoBadgeStyle(est);
                  const busy = savingFolio === folio;

                  const currentDraftEstado = normU(draftEstado[folio] || normU(est) || "ASIGNADO");
                  const changedEstado = currentDraftEstado !== normU(est);

                  const isHighlighted = !!folio && highlightFolio === folio;

                  const razon = oneLine(r.nombre_razon_social || "—");
                  const rubro = oneLine(r.rubro || "");
                  const origen = oneLine(r.origen_prospecto || "");

                  const correo = oneLine(r.correo || "");
                  const tel = oneLine(r.telefono || "");

                  const asignadoAt = fmtDate(r.asignado_at || "");
                  const asignadoPor = oneLine(r.asignado_por || "");

                  return (
                    <tr
                      key={`${folio || "x"}_${i}`}
                      ref={(el) => {
                        if (folio) rowRefs.current[folio] = el;
                      }}
                      style={{
                        background: isHighlighted ? "#FEF3C7" : "transparent",
                        transition: "background 250ms ease",
                        height: 56,
                      }}
                    >
                      {/* Razón social (1 línea compacta) */}
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 800 }}>{razon}</span>
                        <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>
                          {rubro ? `· ${rubro}` : ""} {origen ? `· ${origen}` : ""}
                        </span>
                      </td>

                      {/* Contacto */}
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 600 }}>{correo || "—"}</span>
                        <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>
                          {tel ? `· ${tel}` : ""}
                        </span>
                      </td>

                      {/* División */}
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        <span style={{ ...chipStyle(), background: "#F3F4F6" }}>
                          {oneLine(r.division || "—")}
                        </span>
                      </td>

                      {/* Estado (badge + select + botones compactos) */}
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            ...chipStyle(),
                            background: st.bg,
                            color: st.color,
                            border: `1px solid ${st.border}`,
                            marginRight: 10,
                          }}
                        >
                          {normU(est) || "—"}
                        </span>

                        <select
                          value={currentDraftEstado}
                          onChange={(e) =>
                            setDraftEstado((p) => ({ ...p, [folio]: e.target.value }))
                          }
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: `1px solid ${changedEstado ? "#111827" : "#d1d5db"}`,
                            background: "white",
                            minWidth: 190,
                          }}
                        >
                          {ESTADOS_GESTION.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => guardarEstado(folio)}
                          disabled={!folio || busy}
                          style={{
                            marginLeft: 8,
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #111827",
                            background: busy ? "#6b7280" : "#111827",
                            color: "white",
                            cursor: busy ? "not-allowed" : "pointer",
                          }}
                        >
                          {busy ? "..." : "Guardar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDraftEstado((p) => ({ ...p, [folio]: normU(est) }))}
                          disabled={!folio || busy}
                          style={{
                            marginLeft: 8,
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #d1d5db",
                            background: "white",
                            cursor: busy ? "not-allowed" : "pointer",
                          }}
                        >
                          Deshacer
                        </button>
                      </td>

                      {/* Monto */}
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        {fmtCLP(r.monto_proyectado || "")}
                      </td>

                      {/* Asignación (fecha + por) */}
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 12 }}>
                          <b>{oneLine(r.asignado_a || "—")}</b>
                          <span style={{ marginLeft: 8, opacity: 0.75 }}>
                            Asignado: <b>{asignadoAt}</b>
                          </span>
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          por {asignadoPor || "—"}
                        </div>
                      </td>

                      {/* Gestión (botón abre modal) */}
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => openGestionModal(r)}
                          disabled={!folio || busy}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #d1d5db",
                            background: "white",
                            cursor: busy ? "not-allowed" : "pointer",
                          }}
                        >
                          Ver / Agregar gestión
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Observación + agregar nota */}
      {openGestion && gestionRow && (
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
          onClick={() => (savingFolio ? null : setOpenGestion(false))}
        >
          <div
            style={{
              width: "min(820px, 100%)",
              background: "white",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Gestión / Observaciones</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                <b>{gestionRow.nombre_razon_social || "—"}</b> · {gestionRow.correo || "—"} · Asignado:{" "}
                <b>{fmtDate(gestionRow.asignado_at || "")}</b>
              </div>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Historial (CRM_DB · observación)</label>
                <textarea
                  value={gestionRow.observacion || ""}
                  readOnly
                  rows={8}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: "#f9fafb",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Agregar nueva gestión (se appendea con timestamp)</label>
                <textarea
                  value={draftNota[(gestionRow.folio || "").trim()] || ""}
                  onChange={(e) =>
                    setDraftNota((p) => ({ ...p, [(gestionRow.folio || "").trim()]: e.target.value }))
                  }
                  rows={4}
                  placeholder="Escribe la gestión realizada, acuerdos, próxima acción..."
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
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
                onClick={() => setOpenGestion(false)}
                disabled={!!savingFolio}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "white",
                  cursor: savingFolio ? "not-allowed" : "pointer",
                }}
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={async () => {
                  const folio = (gestionRow.folio || "").trim();
                  if (!folio) return;
                  await guardarNota(folio);
                  // recarga modal con datos nuevos
                  const updated = rows.find((x) => String(x.folio || "").trim() === folio);
                  if (updated) setGestionRow(updated);
                }}
                disabled={!!savingFolio || !((draftNota[(gestionRow.folio || "").trim()] || "").trim())}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #111827",
                  background: savingFolio ? "#6b7280" : "#111827",
                  color: "white",
                  cursor: savingFolio ? "not-allowed" : "pointer",
                }}
              >
                {savingFolio ? "Guardando…" : "Guardar gestión"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
