"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* =========================
   CONFIG JEFATURAS (igual que resumen)
   ========================= */
const JEFATURAS = new Set(
  [
    "claudia.borquez@spartan.cl",
    "jorge.beltran@spartan.cl",
    "alberto.damm@spartan.cl",
    "nelson.norambuena@spartan.cl",
    "carlos.avendano@spartan.cl",
    "hernan.lopez@spartan.cl",
  ].map((x) => x.trim().toLowerCase())
);

const JEFATURA_SCOPE_PREFIJOS: Record<string, string[]> = {
  "claudia.borquez@spartan.cl": ["IN", "FB"],
  "jorge.beltran@spartan.cl": ["FB", "IN", "HC", "IND", "BSC", "IND_HL"],
  "alberto.damm@spartan.cl": ["IND", "BSC", "IND_HL"],
  "nelson.norambuena@spartan.cl": ["BSC"],
  "carlos.avendano@spartan.cl": ["HC"],
  "hernan.lopez@spartan.cl": ["IND_HL"],
};

function normalizeEmail(s: string) {
  return (s || "").trim().toLowerCase();
}

function daysBetween(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "—";
  const diff = Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
  return diff;
}

/* =========================
   TYPES
   ========================= */
type RowDetalle = {
  folio: string;
  nombre_razon_social: string;
  ejecutivo_email: string;
  estado: string;
  etapa_nombre: string;
  monto_proyectado: number;
  updated_at?: string;
};

type ApiResp = {
  ok: boolean;
  error?: string;
  rows?: RowDetalle[];
};

/* =========================
   PAGE
   ========================= */
export default function CRMReporteriaGerenciaDetallePage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [authLoading, setAuthLoading] = useState(true);
  const [loggedEmail, setLoggedEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<RowDetalle[]>([]);

  // filtros
  const [ejecutivo, setEjecutivo] = useState("");
  const [estado, setEstado] = useState("");
  const [onlyStale, setOnlyStale] = useState(false);

  /* =========================
     AUTH
     ========================= */
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

  const isJefatura = useMemo(
    () => JEFATURAS.has(normalizeEmail(loggedEmail)),
    [loggedEmail]
  );

  const allowedDivs = useMemo(() => {
    const email = normalizeEmail(loggedEmail);
    return (JEFATURA_SCOPE_PREFIJOS[email] || []).map((x) => x.toUpperCase());
  }, [loggedEmail]);

  /* =========================
     LOAD DATA
     ========================= */
  async function reload() {
    try {
      setLoading(true);
      setErr(null);

      const qs = new URLSearchParams();
      qs.set("viewerEmail", loggedEmail);
      qs.set("includeAssigned", "1");

      const resp = await fetch(
        `/api/crm/reporteria/gerencia/detalle?${qs.toString()}`,
        { cache: "no-store" }
      );

      const json = (await resp.json()) as ApiResp;
      if (!resp.ok || !json.ok) {
        setErr(json.error || `Error HTTP ${resp.status}`);
        setRows([]);
        return;
      }

      setRows(json.rows || []);
    } catch (e: any) {
      setErr(e?.message || "Error cargando reportería detalle");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && isJefatura) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isJefatura]);

  /* =========================
     FILTERED VIEW
     ========================= */
  const filtered = useMemo(() => {
    let base = rows;

    if (ejecutivo) {
      base = base.filter((r) => r.ejecutivo_email === ejecutivo);
    }
    if (estado) {
      base = base.filter((r) => r.estado === estado);
    }
    if (onlyStale) {
      base = base.filter((r) => {
        const d = daysBetween(r.updated_at);
        return typeof d === "number" && d >= 7;
      });
    }
    return base;
  }, [rows, ejecutivo, estado, onlyStale]);

  const ejecutivoOptions = useMemo(() => {
    const uniq = Array.from(new Set(rows.map((r) => r.ejecutivo_email).filter(Boolean)));
    return ["", ...uniq];
  }, [rows]);

  const estadoOptions = useMemo(() => {
    const uniq = Array.from(new Set(rows.map((r) => r.estado).filter(Boolean)));
    return ["", ...uniq];
  }, [rows]);

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontWeight: 900 }}>CRM · Reportería Detalle</h2>
        <div style={{ opacity: 0.7 }}>Cargando usuario…</div>
      </div>
    );
  }

  if (!isJefatura) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontWeight: 900 }}>CRM · Reportería Detalle</h2>
        <div style={{ color: "crimson" }}>No tienes permisos para este módulo.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1400 }}>
      <h2 style={{ fontSize: 22, fontWeight: 900 }}>CRM · Reportería en Detalle</h2>
      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
        Jefatura: <b>{loggedEmail}</b> · Scope:{" "}
        <b>{allowedDivs.length ? allowedDivs.join(", ") : "TODOS"}</b>
      </div>

      {/* filtros */}
      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select value={ejecutivo} onChange={(e) => setEjecutivo(e.target.value)}>
          {ejecutivoOptions.map((x) => (
            <option key={x || "ALL"} value={x}>
              {x || "Todos los ejecutivos"}
            </option>
          ))}
        </select>

        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          {estadoOptions.map((x) => (
            <option key={x || "ALL"} value={x}>
              {x || "Todos los estados"}
            </option>
          ))}
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={onlyStale}
            onChange={(e) => setOnlyStale(e.target.checked)}
          />
          <span style={{ fontSize: 13, fontWeight: 800 }}>
            Sin gestión ≥ 7 días
          </span>
        </label>

        <button onClick={reload} disabled={loading}>
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {err && <div style={{ marginTop: 10, color: "crimson" }}>{err}</div>}

      {/* tabla */}
      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", opacity: 0.8 }}>
              <th>Ejecutivo</th>
              <th>Razón social</th>
              <th>Estado</th>
              <th>Etapa</th>
              <th>Monto</th>
              <th>Última gestión</th>
              <th>Días</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>
                  Sin registros.
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr key={`${r.folio}_${i}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td>{r.ejecutivo_email}</td>
                  <td style={{ fontWeight: 900 }}>{r.nombre_razon_social}</td>
                  <td>{r.estado}</td>
                  <td>{r.etapa_nombre}</td>
                  <td>
                    {r.monto_proyectado
                      ? r.monto_proyectado.toLocaleString("es-CL")
                      : "—"}
                  </td>
                  <td>{r.updated_at ? new Date(r.updated_at).toLocaleDateString("es-CL") : "—"}</td>
                  <td style={{ fontWeight: 900 }}>{daysBetween(r.updated_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
