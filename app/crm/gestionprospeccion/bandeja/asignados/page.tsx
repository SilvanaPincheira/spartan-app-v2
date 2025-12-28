"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/** =========================
 *  CONFIG
 *  ========================= */
const CSV_CRM_DB_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

/** =========================
 *  Estados disponibles para gestión
 *  (deben calzar con lo que guardas en CRM_DB)
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
  if (e === "REUNION" || e === "REUNIÓN") return { bg: "#EDE9FE", color: "#5B21B6", border: "#DDD6FE" };
  if (e === "LEVANTAMIENTO") return { bg: "#FDF2F8", color: "#9D174D", border: "#FBCFE8" };
  if (e === "PROPUESTA") return { bg: "#FFEDD5", color: "#9A3412", border: "#FED7AA" };
  if (e === "CERRADO_GANADO" || e === "CERRADO_GANADO") return { bg: "#BBF7D0", color: "#14532D", border: "#86EFAC" };
  if (e === "INSTALADO_1OC") return { bg: "#DCFCE7", color: "#166534", border: "#86EFAC" };
  if (e === "NO_GANADO" || e === "NO_GANADO") return { bg: "#FEE2E2", color: "#7F1D1D", border: "#FECACA" };
  return { bg: "#F3F4F6", color: "#374151", border: "#E5E7EB" };
}

function chipStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700 as const,
    border: "1px solid #e5e7eb",
    whiteSpace: "nowrap" as const,
  };
}

/** =========================
 *  PAGE
 *  ========================= */
export default function BandejaAsignadosPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

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

  const assignedToMe = useMemo(() => {
    const me = norm(loggedEmail);
    if (!me) return [];

    // Ejecutivo ve ASIGNADO + EN_GESTION (puedes sumar más si quieres)
    const allowedEstados = new Set(["ASIGNADO", "EN_GESTION"]);

    const base = rows.filter((r) => {
      const asignadoA = norm(r.asignado_a || "");
      return asignadoA === me;
    });
    

    const s = norm(q);
    if (!s) return base;

    return base.filter((r) => {
      const blob =
        norm(r.folio || "") +
        " " +
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
        norm(r.etapa_nombre || "") +
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
        if (next[folio] == null) {
          next[folio] = normU(r.estado || "") || "ASIGNADO";
        }
      }
      return next;
    });
  }, [assignedToMe]);

  async function guardarGestion(folio: string) {
    const estado = normU(draftEstado[folio] || "");
    const nota = (draftNota[folio] || "").trim();

    if (!folio) return;

    try {
      setSavingFolio(folio);

      const resp = await fetch("/api/crm/prospectos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          folio,
          estado, // "ASIGNADO" | "EN_GESTION" | ...
          observacion: nota || undefined, // Apps Script hace append con timestamp
          // ejecutivo_email opcional (tu route puede setearlo)
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

      // limpia nota draft si guardó
      setDraftNota((p) => ({ ...p, [folio]: "" }));

      await reload();
    } finally {
      setSavingFolio(null);
    }
  }

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>CRM · Bandeja · Asignados</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1400 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
        CRM · Bandeja · Asignados
      </h2>
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
          placeholder="Buscar por folio / razón social / correo / rubro / mensaje..."
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
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Folio</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Razón social</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>División</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Estado</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Etapa</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Monto</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Asignación</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Gestión</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 12, opacity: 0.8 }}>
                    Cargando…
                  </td>
                </tr>
              ) : assignedToMe.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 12, opacity: 0.8 }}>
                    Sin registros.
                  </td>
                </tr>
              ) : (
                assignedToMe.map((r, i) => {
                  const folio = (r.folio || "").trim();
                  const est = r.estado || "—";
                  const st = estadoBadgeStyle(est);

                  const busy = savingFolio === folio;

                  const currentDraftEstado = normU(draftEstado[folio] || normU(est) || "ASIGNADO");
                  const changedEstado = currentDraftEstado !== normU(est);

                  return (
                    <tr key={`${folio || "x"}_${i}`}>
                      <td
                        style={{
                          padding: 10,
                          borderBottom: "1px solid #f3f4f6",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <b>{r.folio || "—"}</b>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{fmtDate(r.created_at)}</div>
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                        {r.nombre_razon_social || "—"}
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                          {r.correo || "—"} · {r.telefono || "—"}
                        </div>
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                        <span style={{ ...chipStyle(), background: "#F3F4F6" }}>
                          {r.division || "—"}
                        </span>
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
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
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                        {r.etapa_nombre || "—"}
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                        {fmtCLP(r.monto_proyectado || "")}
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                        <div style={{ fontSize: 12 }}>
                          <b>{r.asignado_a || "—"}</b>
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          por {r.asignado_por || "—"} · {fmtDate(r.asignado_at)}
                        </div>
                      </td>

                      {/* ✅ Gestión */}
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", minWidth: 320 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <select
                            value={currentDraftEstado}
                            onChange={(e) =>
                              setDraftEstado((p) => ({ ...p, [folio]: e.target.value }))
                            }
                            style={{
                              padding: 10,
                              borderRadius: 10,
                              border: `1px solid ${changedEstado ? "#111827" : "#d1d5db"}`,
                              background: "white",
                              minWidth: 180,
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
                            onClick={() => guardarGestion(folio)}
                            disabled={!folio || busy}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 10,
                              border: "1px solid #111827",
                              background: busy ? "#6b7280" : "#111827",
                              color: "white",
                              cursor: busy ? "not-allowed" : "pointer",
                            }}
                          >
                            {busy ? "Guardando…" : "Guardar"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDraftEstado((p) => ({ ...p, [folio]: normU(est) }));
                              setDraftNota((p) => ({ ...p, [folio]: "" }));
                            }}
                            disabled={!folio || busy}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 10,
                              border: "1px solid #d1d5db",
                              background: "white",
                              cursor: busy ? "not-allowed" : "pointer",
                            }}
                          >
                            Deshacer
                          </button>
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <textarea
                            value={draftNota[folio] || ""}
                            onChange={(e) =>
                              setDraftNota((p) => ({ ...p, [folio]: e.target.value }))
                            }
                            rows={2}
                            placeholder="Agregar nota (se agrega al historial en Observación)…"
                            style={{
                              width: "100%",
                              padding: 10,
                              borderRadius: 10,
                              border: "1px solid #d1d5db",
                            }}
                          />
                        </div>

                        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
                          Esto llama a <b>/api/crm/prospectos/update</b> y actualiza CRM_DB (Apps Script).
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

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
        Regla: muestra <b>estado ∈ (ASIGNADO, EN_GESTION)</b> y <b>asignado_a = tu login</b>.
        <br />
        Tip: apenas empieces a gestionarlo, cámbialo a <b>EN_GESTION</b> para que se vea el avance.
      </div>
    </div>
  );
}
