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

function moneyCLP(n: number) {
  if (!n) return "—";
  try {
    return n.toLocaleString("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    });
  } catch {
    return String(n);
  }
}

function daysBetween(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
}

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

/* =========================
   UI helpers
   ========================= */
function cardStyle() {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "white",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    padding: 14,
  } as const;
}

function inputStyle() {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    background: "white",
    outline: "none",
  } as const;
}

function btnStyle(primary?: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: primary ? "1px solid #111827" : "1px solid #e5e7eb",
    background: primary ? "#111827" : "white",
    color: primary ? "white" : "#111827",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  } as const;
}

function badge(bg: string, color = "#111827") {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    background: bg,
    color,
    border: "1px solid rgba(17,24,39,0.08)",
    whiteSpace: "nowrap" as const,
  };
}

function estadoBadgeStyle(estadoRaw: string) {
  const e = (estadoRaw || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (e === "ASIGNADO") return { bg: "#E0F2FE", color: "#0369A1" };
  if (e === "EN_GESTION") return { bg: "#FEF9C3", color: "#854D0E" };
  if (e === "CONTACTADO") return { bg: "#DCFCE7", color: "#166534" };
  if (e === "REUNION") return { bg: "#EDE9FE", color: "#5B21B6" };
  if (e === "LEVANTAMIENTO") return { bg: "#FDF2F8", color: "#9D174D" };
  if (e === "PROPUESTA") return { bg: "#FFEDD5", color: "#9A3412" };
  if (e === "CERRADO_GANADO") return { bg: "#BBF7D0", color: "#14532D" };
  if (e === "INSTALADO_1OC" || e === "INSTALADO_1_O_C") return { bg: "#DCFCE7", color: "#166534" };
  if (e === "NO_GANADO") return { bg: "#FEE2E2", color: "#7F1D1D" };
  return { bg: "#F3F4F6", color: "#374151" };
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
   SORT
   ========================= */
type SortKey = "ejecutivo" | "razon" | "estado" | "etapa" | "monto" | "updated_at" | "dias";
type SortDir = "asc" | "desc";

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
  const [q, setQ] = useState("");

  // sort
  const [sortKey, setSortKey] = useState<SortKey>("dias");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const isJefatura = useMemo(() => JEFATURAS.has(normalizeEmail(loggedEmail)), [loggedEmail]);

  const allowedDivs = useMemo(() => {
    const email = normalizeEmail(loggedEmail);
    return (JEFATURA_SCOPE_PREFIJOS[email] || []).map((x) => x.toUpperCase());
  }, [loggedEmail]);

  /* =========================
     LOAD DATA (robusto ante HTML)
     ========================= */
  async function reload() {
    try {
      setLoading(true);
      setErr(null);

      const qs = new URLSearchParams();
      qs.set("viewerEmail", loggedEmail);
      qs.set("includeAssigned", "1");

      const resp = await fetch(`/api/crm/reporteria/gerencia/detalle?${qs.toString()}`, {
        cache: "no-store",
      });

      // 👇 IMPORTANTE: primero leemos texto para capturar HTML/errores
      const raw = await resp.text();
      let json: ApiResp | null = null;

      try {
        json = JSON.parse(raw);
      } catch {
        // típico: HTML de 404/500 -> "<!DOCTYPE ..."
        const preview = raw?.slice(0, 220)?.replace(/\s+/g, " ") || "";
        throw new Error(
          `Respuesta no JSON (posible 404/500). HTTP ${resp.status}. Preview: ${preview}`
        );
      }

      if (!resp.ok || !json?.ok) {
        setErr(json?.error || `Error HTTP ${resp.status}`);
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
    if (!authLoading && isJefatura && loggedEmail) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isJefatura, loggedEmail]);

  /* =========================
     OPTIONS
     ========================= */
  const ejecutivoOptions = useMemo(() => {
    const uniq = Array.from(new Set(rows.map((r) => r.ejecutivo_email).filter(Boolean))).sort();
    return ["", ...uniq];
  }, [rows]);

  const estadoOptions = useMemo(() => {
    const uniq = Array.from(new Set(rows.map((r) => r.estado).filter(Boolean))).sort();
    return ["", ...uniq];
  }, [rows]);

  /* =========================
     FILTERED + SEARCH
     ========================= */
  const filtered = useMemo(() => {
    let base = rows;

    if (ejecutivo) base = base.filter((r) => r.ejecutivo_email === ejecutivo);
    if (estado) base = base.filter((r) => r.estado === estado);

    if (onlyStale) {
      base = base.filter((r) => {
        const d = daysBetween(r.updated_at);
        return typeof d === "number" && d >= 7;
      });
    }

    const s = norm(q);
    if (s) {
      base = base.filter((r) => {
        const blob =
          norm(r.folio) +
          " " +
          norm(r.nombre_razon_social) +
          " " +
          norm(r.ejecutivo_email) +
          " " +
          norm(r.estado) +
          " " +
          norm(r.etapa_nombre);
        return blob.includes(s);
      });
    }

    return base;
  }, [rows, ejecutivo, estado, onlyStale, q]);

  /* =========================
     SORTED
     ========================= */
  const sorted = useMemo(() => {
    const arr = [...filtered];

    const getVal = (r: RowDetalle) => {
      switch (sortKey) {
        case "ejecutivo":
          return r.ejecutivo_email || "";
        case "razon":
          return r.nombre_razon_social || "";
        case "estado":
          return r.estado || "";
        case "etapa":
          return r.etapa_nombre || "";
        case "monto":
          return Number(r.monto_proyectado || 0);
        case "updated_at":
          return r.updated_at ? new Date(r.updated_at).getTime() : 0;
        case "dias": {
          const d = daysBetween(r.updated_at);
          return typeof d === "number" ? d : -1;
        }
        default:
          return "";
      }
    };

    arr.sort((a, b) => {
      const va: any = getVal(a);
      const vb: any = getVal(b);

      // numbers
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }

      // strings
      const sa = String(va ?? "");
      const sb = String(vb ?? "");
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });

    return arr;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    setSortKey((cur) => {
      if (cur !== k) {
        setSortDir("desc");
        return k;
      }
      // mismo key -> alterna dir
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return cur;
    });
  }

  /* =========================
     KPIs rápidos
     ========================= */
  const kpis = useMemo(() => {
    const total = filtered.length;
    const stale = filtered.filter((r) => {
      const d = daysBetween(r.updated_at);
      return typeof d === "number" && d >= 7;
    }).length;

    const monto = filtered.reduce((acc, r) => acc + (Number(r.monto_proyectado) || 0), 0);

    return { total, stale, monto };
  }, [filtered]);

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontWeight: 900, margin: 0 }}>CRM · Reportería en Detalle</h2>
        <div style={{ opacity: 0.7, marginTop: 8 }}>Cargando usuario…</div>
      </div>
    );
  }

  if (!isJefatura) {
    return (
      <div style={{ padding: 16, maxWidth: 900 }}>
        <h2 style={{ fontWeight: 900, margin: 0 }}>CRM · Reportería en Detalle</h2>
        <div style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>
          No tienes permisos para este módulo (solo jefaturas).
        </div>
        <div style={{ marginTop: 8, opacity: 0.85 }}>
          Login detectado: <b>{loggedEmail || "—"}</b>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1500 }}>
      {/* Header + acciones */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>CRM · Reportería en Detalle</h2>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
            Jefatura: <b>{loggedEmail}</b> {" · "} Scope:{" "}
            <b>{allowedDivs.length ? allowedDivs.join(", ") : "TODOS"}</b>
          </div>
        </div>

        <button type="button" onClick={reload} disabled={loading} style={btnStyle(true)}>
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {/* KPIs */}
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(3, minmax(220px, 1fr))",
        }}
      >
        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Registros (filtrados)</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900 }}>{kpis.total}</div>
          <div style={{ marginTop: 8 }}>
            <span style={badge("rgba(37,99,235,0.12)")}>Vista interactiva</span>
          </div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Sin gestión ≥ 7 días</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900 }}>{kpis.stale}</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Consejo: marca el checkbox para enfocarte solo en estos.
          </div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Monto total (filtrado)</div>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900 }}>{moneyCLP(kpis.monto)}</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Depende de <b>monto_proyectado</b>.
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div
        style={{
          marginTop: 12,
          ...cardStyle(),
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar: razón social, ejecutivo, estado, etapa o folio…"
          style={{ ...inputStyle(), minWidth: 320, flex: 1 }}
        />

        <select value={ejecutivo} onChange={(e) => setEjecutivo(e.target.value)} style={inputStyle()}>
          {ejecutivoOptions.map((x) => (
            <option key={x || "ALL"} value={x}>
              {x || "Todos los ejecutivos"}
            </option>
          ))}
        </select>

        <select value={estado} onChange={(e) => setEstado(e.target.value)} style={inputStyle()}>
          {estadoOptions.map((x) => (
            <option key={x || "ALL"} value={x}>
              {x || "Todos los estados"}
            </option>
          ))}
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={onlyStale} onChange={(e) => setOnlyStale(e.target.checked)} />
          <span style={{ fontSize: 13, fontWeight: 900, opacity: 0.9 }}>Sin gestión ≥ 7 días</span>
        </label>

        <button
          type="button"
          onClick={() => {
            setEjecutivo("");
            setEstado("");
            setOnlyStale(false);
            setQ("");
          }}
          style={btnStyle(false)}
        >
          Limpiar
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 10, ...cardStyle(), borderColor: "#ef4444", background: "#fef2f2" }}>
          <div style={{ fontWeight: 900, color: "#b91c1c" }}>Error al cargar</div>
          <div style={{ marginTop: 6, fontSize: 12, whiteSpace: "pre-wrap" }}>{err}</div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            Si el preview muestra <b>&lt;!DOCTYPE</b>, el endpoint está devolviendo HTML (404/500). Revisa que exista
            `/api/crm/reporteria/gerencia/detalle` en producción y que responda JSON.
          </div>
        </div>
      )}

      {/* Tabla */}
      <div style={{ marginTop: 14, ...cardStyle(), padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", maxHeight: "68vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  background: "#fafafa",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                <th
                  style={{ padding: 12, borderBottom: "1px solid #e5e7eb", cursor: "pointer" }}
                  onClick={() => toggleSort("ejecutivo")}
                  title="Ordenar por ejecutivo"
                >
                  Ejecutivo {sortKey === "ejecutivo" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>

                <th
                  style={{ padding: 12, borderBottom: "1px solid #e5e7eb", cursor: "pointer" }}
                  onClick={() => toggleSort("razon")}
                  title="Ordenar por razón social"
                >
                  Razón social {sortKey === "razon" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>

                <th
                  style={{ padding: 12, borderBottom: "1px solid #e5e7eb", cursor: "pointer" }}
                  onClick={() => toggleSort("estado")}
                  title="Ordenar por estado"
                >
                  Estado {sortKey === "estado" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>

                <th
                  style={{ padding: 12, borderBottom: "1px solid #e5e7eb", cursor: "pointer" }}
                  onClick={() => toggleSort("etapa")}
                  title="Ordenar por etapa"
                >
                  Etapa {sortKey === "etapa" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>

                <th
                  style={{ padding: 12, borderBottom: "1px solid #e5e7eb", cursor: "pointer", textAlign: "right" }}
                  onClick={() => toggleSort("monto")}
                  title="Ordenar por monto"
                >
                  Monto {sortKey === "monto" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>

                <th
                  style={{ padding: 12, borderBottom: "1px solid #e5e7eb", cursor: "pointer" }}
                  onClick={() => toggleSort("updated_at")}
                  title="Ordenar por última gestión"
                >
                  Última gestión {sortKey === "updated_at" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>

                <th
                  style={{ padding: 12, borderBottom: "1px solid #e5e7eb", cursor: "pointer", textAlign: "right" }}
                  onClick={() => toggleSort("dias")}
                  title="Ordenar por días sin gestión"
                >
                  Días {sortKey === "dias" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 14, opacity: 0.75 }}>
                    Cargando…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 14, opacity: 0.75 }}>
                    Sin registros.
                  </td>
                </tr>
              ) : (
                sorted.map((r, i) => {
                  const zebra = i % 2 === 0 ? "white" : "#fcfcfc";
                  const est = estadoBadgeStyle(r.estado);
                  const dias = daysBetween(r.updated_at);

                  const diasBadge =
                    typeof dias === "number"
                      ? dias >= 14
                        ? badge("rgba(239,68,68,0.18)", "#7F1D1D")
                        : dias >= 7
                        ? badge("rgba(245,158,11,0.18)", "#92400E")
                        : badge("rgba(16,185,129,0.14)", "#065F46")
                      : badge("rgba(148,163,184,0.22)", "#334155");

                  return (
                    <tr
                      key={`${r.folio || "x"}_${i}`}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        background: zebra,
                      }}
                    >
                      <td style={{ padding: 12, fontWeight: 900 }}>{r.ejecutivo_email || "—"}</td>

                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 900 }}>{r.nombre_razon_social || "—"}</div>
                        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                          Folio: <b>{r.folio || "—"}</b>
                        </div>
                      </td>

                      <td style={{ padding: 12 }}>
                        <span style={badge(est.bg, est.color)}>{r.estado || "—"}</span>
                      </td>

                      <td style={{ padding: 12 }}>{r.etapa_nombre || "—"}</td>

                      <td style={{ padding: 12, textAlign: "right", fontWeight: 900 }}>
                        {r.monto_proyectado ? moneyCLP(Number(r.monto_proyectado)) : "—"}
                      </td>

                      <td style={{ padding: 12 }}>
                        {r.updated_at ? new Date(r.updated_at).toLocaleString("es-CL") : "—"}
                      </td>

                      <td style={{ padding: 12, textAlign: "right" }}>
                        <span style={diasBadge}>{typeof dias === "number" ? `${dias} d` : "—"}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Tip: haz click en los títulos de la tabla para ordenar. Fuente: <b>CRM_DB</b> + permisos por <b>viewerEmail</b>.
      </div>
    </div>
  );
}

