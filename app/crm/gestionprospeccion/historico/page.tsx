"use client";

import React, { useEffect, useMemo, useState } from "react";

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

/* =========================
   PAGE
========================= */
export default function BandejaHistoricoPage() {
  const [rows, setRows] = useState<RowAny[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(CSV_CRM_DB_URL, { cache: "no-store" });
    const text = await res.text();
    setRows(parseCsv(text));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  /** Histórico = todo lo que NO esté ASIGNADO */
  const historico = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      if (norm(r.estado) === "asignado") return false;

      if (!q) return true;

      return (
        (r.folio || "").toLowerCase().includes(q) ||
        (r.nombre_razon_social || "").toLowerCase().includes(q) ||
        (r.correo || "").toLowerCase().includes(q) ||
        (r.ejecutivo_email || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>
        CRM · Bandeja · Histórico
      </h2>

      <div style={{ marginBottom: 12, opacity: 0.8 }}>
        Prospectos ya gestionados (solo lectura)
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por folio, empresa, correo, ejecutivo…"
          style={{
            padding: 10,
            width: "100%",
            maxWidth: 420,
            borderRadius: 10,
            border: "1px solid #d1d5db",
          }}
        />
      </div>

      {loading ? (
        <div>Cargando histórico…</div>
      ) : historico.length === 0 ? (
        <div style={{ opacity: 0.7 }}>No hay registros históricos.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ fontSize: 12, opacity: 0.8 }}>
                <th>Folio</th>
                <th>Razón Social</th>
                <th>División</th>
                <th>Ejecutivo</th>
                <th>Estado</th>
                <th>Fecha asignación</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((r, idx) => (
                <tr key={`${r.folio || idx}`}>
                  <td>{r.folio || "—"}</td>
                  <td>{r.nombre_razon_social || "—"}</td>
                  <td>{r.division || "—"}</td>
                  <td>{r.asignado_a || r.ejecutivo_email || "—"}</td>
                  <td>
                    <b>{r.estado || "—"}</b>
                  </td>
                  <td>{fmtDate(r.asignado_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
