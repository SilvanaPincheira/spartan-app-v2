"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const CSV_CRM_DB_URL =
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

function normalizeEmail(s: string) {
  return (s || "").trim().toLowerCase();
}

function normU(s: string) {
  return (s || "").trim().toUpperCase();
}

function badgeStyle(estadoRaw: string) {
  const e = normU(estadoRaw);
  if (e === "ASIGNADO") return { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" };
  if (e === "EN_GESTION") return { bg: "#FEF9C3", color: "#854D0E", border: "#FDE68A" };
  if (e === "CONTACTADO") return { bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" };
  if (e === "NO_GANADO") return { bg: "#FEE2E2", color: "#7F1D1D", border: "#FECACA" };
  if (e === "CERRADO_GANADO") return { bg: "#BBF7D0", color: "#14532D", border: "#86EFAC" };
  return { bg: "#F3F4F6", color: "#374151", border: "#E5E7EB" };
}

function Chip({ text }: { text: string }) {
  const st = badgeStyle(text);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: st.bg,
        color: st.color,
        border: `1px solid ${st.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {normU(text) || "—"}
    </span>
  );
}

export default function CRMProspeccionBandejaPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [authLoading, setAuthLoading] = useState(true);
  const [loggedEmail, setLoggedEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const [q, setQ] = useState("");
  const [onlyAssigned, setOnlyAssigned] = useState(true);

  // Modal gestión
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const [formEstado, setFormEstado] = useState("");
  const [formEtapaNombre, setFormEtapaNombre] = useState("");
  const [formObs, setFormObs] = useState("");

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

  async function reload() {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch(CSV_CRM_DB_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`No se pudo leer CRM_DB (${res.status})`);
      const text = await res.text();
      setRows(parseCsv(text));
    } catch (e: any) {
      setErr(e?.message || "Error leyendo CRM_DB");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const myItems = useMemo(() => {
    const email = normalizeEmail(loggedEmail);
    const query = q.trim().toLowerCase();

    let base = rows;

    if (onlyAssigned) {
      base = base.filter((r) => normalizeEmail(r.asignado_a) === email);
    } else {
      base = base.filter(
        (r) =>
          normalizeEmail(r.asignado_a) === email ||
          normalizeEmail(r.ejecutivo_email) === email
      );
    }

    if (!query) return base;

    return base.filter((r) => {
      const blob = [
        r.folio,
        r.nombre_razon_social,
        r.correo,
        r.rubro,
        r.origen_prospecto,
        r.estado,
        r.etapa_nombre,
      ]
        .join(" ")
        .toLowerCase();

      return blob.includes(query);
    });
  }, [rows, loggedEmail, q, onlyAssigned]);

  function openGestion(r: Row) {
    setSelected(r);
    setFormEstado(r.estado || "ASIGNADO");
    setFormEtapaNombre(r.etapa_nombre || "");
    setFormObs(r.observacion || "");
    setOpen(true);
  }

  async function saveGestion() {
    if (!selected?.folio) return;

    try {
      setSaving(true);

      const resp = await fetch("/api/crm/prospectos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folio: selected.folio,
          estado: formEstado,
          // si no manejas etapa_id, igual puedes actualizar solo etapa_nombre
          etapa_nombre: formEtapaNombre,
          observacion: formObs,
          actualizado_por: loggedEmail,
        }),
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

      setOpen(false);
      setSelected(null);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>CRM · Bandeja</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
          CRM · Prospección · Bandeja (Ejecutivo)
        </h2>
        <div style={{ opacity: 0.75 }}>
          Login: <b>{loggedEmail || "—"}</b>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por folio / razón social / correo / rubro…"
          style={{
            flex: 1,
            minWidth: 260,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #d1d5db",
          }}
        />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={onlyAssigned}
            onChange={(e) => setOnlyAssigned(e.target.checked)}
          />
          <span style={{ fontSize: 13, opacity: 0.85 }}>Solo asignados a mí</span>
        </label>
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
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {err && <div style={{ marginTop: 10, color: "crimson" }}>Error: {err}</div>}

      <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.8 }}>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Folio</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Razón Social</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Etapa</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Estado</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Asignado a</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Origen</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Monto</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }} />
            </tr>
          </thead>
          <tbody>
            {myItems.map((r, i) => (
              <tr key={`${r.folio || "x"}_${i}`}>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                  <b>{r.folio || "—"}</b>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{r.created_at || ""}</div>
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                  {r.nombre_razon_social || "—"}
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{r.correo || ""}</div>
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                  {r.etapa_nombre || "—"}
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                  <Chip text={r.estado || ""} />
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                  {r.asignado_a || "—"}
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                  {r.origen_prospecto || "—"}
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                  {r.monto_proyectado || "—"}
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                  <button
                    type="button"
                    onClick={() => openGestion(r)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #111827",
                      background: "#111827",
                      color: "white",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Gestionar
                  </button>
                </td>
              </tr>
            ))}

            {!loading && myItems.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 12, opacity: 0.7 }}>
                  No hay registros para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Mostrando <b>{myItems.length}</b> registros.
      </div>

      {/* MODAL */}
      {open && selected && (
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
          onClick={() => (!saving ? setOpen(false) : null)}
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
              <div style={{ fontSize: 16, fontWeight: 900 }}>Gestionar prospecto</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                <b>{selected.folio}</b> · {selected.nombre_razon_social || "—"} · {selected.correo || "—"}
              </div>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Estado</label>
                <select
                  value={formEstado}
                  onChange={(e) => setFormEstado(e.target.value)}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                  }}
                >
                  <option value="ASIGNADO">ASIGNADO</option>
                  <option value="EN_GESTION">EN_GESTION</option>
                  <option value="CONTACTADO">CONTACTADO</option>
                  <option value="REUNION">REUNION</option>
                  <option value="PROPUESTA">PROPUESTA</option>
                  <option value="CERRADO_GANADO">CERRADO_GANADO</option>
                  <option value="NO_GANADO">NO_GANADO</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Etapa (texto)</label>
                <input
                  value={formEtapaNombre}
                  onChange={(e) => setFormEtapaNombre(e.target.value)}
                  placeholder="Ej: Primer contacto / Cotización / Visita..."
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Observación / Gestión</label>
                <textarea
                  value={formObs}
                  onChange={(e) => setFormObs(e.target.value)}
                  rows={6}
                  placeholder="Registra llamada, correo, acuerdos, próxima acción..."
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    resize: "vertical",
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
                onClick={() => setOpen(false)}
                disabled={saving}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "white",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={saveGestion}
                disabled={saving}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #111827",
                  background: saving ? "#6b7280" : "#111827",
                  color: "white",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
