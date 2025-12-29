"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* =========================
   CONFIG
========================= */
const CSV_CRM_DB_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

/* =========================
   CSV helpers
========================= */
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
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? "").trim();
    });
    return obj;
  });
}

/* =========================
   Utils
========================= */
const norm = (s?: string) => (s || "").trim().toLowerCase();

function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("es-CL");
}

function normEstadoKey(s?: string) {
  return (s || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Histórico desde CONTACTADO en adelante */
function isHistoricoEstado(estadoRaw: string) {
  const e = normEstadoKey(estadoRaw);

  const HIST_KEYS = new Set([
    "CONTACTADO",
    "REUNION",
    "LEVANTAMIENTO",
    "PROPUESTA",
    "CERRADO_GANADO",
    "NO_GANADO",
    "CERRADO_PERDIDO",
  ]);

  // "Instalado, 1° o/c" variantes
  if (e.includes("INSTALADO") && (e.includes("1") || e.includes("OC") || e.includes("O_C"))) {
    return true;
  }

  return HIST_KEYS.has(e);
}

function pickEmailRow(r: RowAny) {
  // prioridad: asignado_a (gestion) > ejecutivo_email (origen)
  return norm(r.asignado_a || r.ejecutivo_email || "");
}

/* =========================
   PAGE
========================= */
export default function BandejaHistoricoPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [loggedEmail, setLoggedEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  const [rows, setRows] = useState<RowAny[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch(CSV_CRM_DB_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`No se pudo leer CRM_DB (HTTP ${res.status})`);

      const text = await res.text();
      setRows(parseCsv(text));
    } catch (e: any) {
      setRows([]);
      setErr(e?.message || "Error cargando CRM_DB");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /** Histórico:
   * 1) Solo lo del usuario logueado (asignado_a o ejecutivo_email)
   * 2) Solo desde CONTACTADO en adelante
   * 3) Filtro por búsqueda
   */
  const historico = useMemo(() => {
    const q = search.trim().toLowerCase();
    const me = norm(loggedEmail);

    return rows
      .filter((r) => {
        // ✅ Solo lo del logueado
        const owner = pickEmailRow(r);
        if (!me || owner !== me) return false;

        // ✅ Solo desde CONTACTADO en adelante
        if (!isHistoricoEstado(r.estado || "")) return false;

        if (!q) return true;

        return (
          (r.folio || "").toLowerCase().includes(q) ||
          (r.nombre_razon_social || "").toLowerCase().includes(q) ||
          (r.correo || "").toLowerCase().includes(q) ||
          (r.asignado_a || "").toLowerCase().includes(q) ||
          (r.ejecutivo_email || "").toLowerCase().includes(q)
        );
      })
      // ✅ orden: más reciente primero (updated_at > asignado_at > created_at)
      .sort((a, b) => {
        const da = Date.parse(a.updated_at || a.asignado_at || a.created_at || "") || 0;
        const db = Date.parse(b.updated_at || b.asignado_at || b.created_at || "") || 0;
        return db - da;
      });
  }, [rows, search, loggedEmail]);

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>CRM · Bandeja · Histórico</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  if (!loggedEmail) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>CRM · Bandeja · Histórico</h2>
        <div style={{ marginTop: 10, color: "crimson" }}>No autenticado.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>CRM · Bandeja · Histórico</h2>

      <div style={{ marginTop: 6, marginBottom: 12, opacity: 0.8 }}>
        Prospectos ya gestionados (solo lectura) · Login: <b>{loggedEmail}</b>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por folio, empresa, correo…"
          style={{
            padding: 10,
            width: "100%",
            maxWidth: 420,
            borderRadius: 10,
            border: "1px solid #d1d5db",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>

        {err && <div style={{ color: "crimson", fontSize: 13 }}>Error: {err}</div>}
      </div>

      {loading ? (
        <div>Cargando histórico…</div>
      ) : historico.length === 0 ? (
        <div style={{ opacity: 0.7 }}>No hay registros históricos para tu usuario.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ fontSize: 12, opacity: 0.8, textAlign: "left" }}>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Folio</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Razón Social</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>División</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Ejecutivo</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Estado</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Fecha gestión</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((r, idx) => (
                <tr key={`${r.folio || idx}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: 10 }}>{r.folio || "—"}</td>
                  <td style={{ padding: 10, fontWeight: 700 }}>{r.nombre_razon_social || "—"}</td>
                  <td style={{ padding: 10 }}>{r.division || "—"}</td>
                  <td style={{ padding: 10 }}>{r.asignado_a || r.ejecutivo_email || "—"}</td>
                  <td style={{ padding: 10 }}>
                    <b>{(r.estado || "—").toUpperCase()}</b>
                  </td>
                  <td style={{ padding: 10 }}>{fmtDate(r.updated_at || r.asignado_at || r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
