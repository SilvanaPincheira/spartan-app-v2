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

function groupCount(items: Row[], key: (r: Row) => string) {
  const m = new Map<string, number>();
  for (const r of items) {
    const k = (key(r) || "—").trim() || "—";
    m.set(k, (m.get(k) || 0) + 1);
  }
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

export default function CRMReporteriaPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggedEmail, setLoggedEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

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

  const total = rows.length;

  const porEstado = useMemo(
    () => groupCount(rows, (r) => (r.estado || "").toUpperCase() || "—"),
    [rows]
  );
  const porEtapa = useMemo(
    () => groupCount(rows, (r) => r.etapa_nombre || "—"),
    [rows]
  );
  const porOrigen = useMemo(
    () => groupCount(rows, (r) => r.origen_prospecto || "—"),
    [rows]
  );
  const porEjecutivo = useMemo(
    () => groupCount(rows, (r) => r.asignado_a || "SIN_ASIGNAR"),
    [rows]
  );

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>CRM · Reportería</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
          CRM · Prospección · Reportería
        </h2>
        <div style={{ opacity: 0.75 }}>
          Login: <b>{loggedEmail || "—"}</b>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ padding: "10px 12px", borderRadius: 12, background: "#f3f4f6" }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Total prospectos</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{total}</div>
        </div>

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
            marginLeft: "auto",
          }}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {err && <div style={{ marginTop: 10, color: "crimson" }}>Error: {err}</div>}

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SummaryTable title="Por Estado" data={porEstado} />
        <SummaryTable title="Por Etapa" data={porEtapa} />
        <SummaryTable title="Por Origen" data={porOrigen} />
        <SummaryTable title="Por Ejecutivo (asignado_a)" data={porEjecutivo} />
      </div>

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.75 }}>
        Nota: “SIN_ASIGNAR” = prospectos aún en cola (pendientes).
      </div>
    </div>
  );
}

function SummaryTable(props: { title: string; data: { label: string; value: number }[] }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: 12, fontWeight: 800 }}>{props.title}</div>
      <div style={{ borderTop: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {props.data.slice(0, 12).map((it) => (
              <tr key={it.label}>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>{it.label}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
                  <b>{it.value}</b>
                </td>
              </tr>
            ))}
            {props.data.length === 0 && (
              <tr>
                <td style={{ padding: 10, opacity: 0.7 }}>Sin datos</td>
                <td style={{ padding: 10 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
