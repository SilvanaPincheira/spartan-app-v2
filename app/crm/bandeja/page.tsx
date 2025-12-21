"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/** =========================
 *  CONFIG
 *  ========================= */
const CSV_CRM_DB_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

/** =========================
 *  TYPES
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

function normalizeEmail(s: string) {
  return (s || "").trim().toLowerCase();
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
      // si no filtra asignado, igual es bandeja: mostramos asignados + pendientes del propio ejecutivo
      base = base.filter(
        (r) =>
          normalizeEmail(r.asignado_a) === email ||
          normalizeEmail(r.ejecutivo_email) === email
      );
    }

    if (!query) return base;

    return base.filter((r) => {
      const folio = (r.folio || "").toLowerCase();
      const nombre = (r.nombre_razon_social || "").toLowerCase();
      const correo = (r.correo || "").toLowerCase();
      const rubro = (r.rubro || "").toLowerCase();
      return (
        folio.includes(query) ||
        nombre.includes(query) ||
        correo.includes(query) ||
        rubro.includes(query)
      );
    });
  }, [rows, loggedEmail, q, onlyAssigned]);

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
          <span style={{ fontSize: 13, opacity: 0.85 }}>
            Solo asignados a mí
          </span>
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
                  {r.estado || "—"}
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
              </tr>
            ))}

            {!loading && myItems.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>
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
    </div>
  );
}
