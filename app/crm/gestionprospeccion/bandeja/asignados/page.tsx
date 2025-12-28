"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/** =========================
 *  CONFIG
 *  ========================= */
const CSV_CRM_DB_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

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

  useEffect(() => {
    reload();
  }, []);

  const assignedToMe = useMemo(() => {
    const me = norm(loggedEmail);

    // Si por alguna razón no hay login, mostramos vacío (evita filtrar mal)
    if (!me) return [];

    const base = rows.filter((r) => {
      const estado = norm(r.estado || "");
      const asignadoA = norm(r.asignado_a || "");
      return estado === "asignado" && asignadoA === me;
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

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>CRM · Bandeja · Asignados</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
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
          placeholder="Buscar por folio / razón social / correo / rubro..."
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
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Etapa</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Monto</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Asignación</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12, opacity: 0.8 }}>
                    Cargando…
                  </td>
                </tr>
              ) : assignedToMe.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12, opacity: 0.8 }}>
                    Sin registros.
                  </td>
                </tr>
              ) : (
                assignedToMe.map((r, idx) => (
                  <tr key={`${r.folio || idx}_${idx}`}>
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
                      {r.division || "—"}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
        Regla: muestra <b>estado=ASIGNADO</b> y <b>asignado_a = tu login</b>.
      </div>
    </div>
  );
}
