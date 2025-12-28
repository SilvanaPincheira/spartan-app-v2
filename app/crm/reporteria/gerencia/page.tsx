"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";

const JEFATURAS = new Set(
  [
    "claudia.borquez@spartan.cl",
    "jorge.beltran@spartan.cl",
    "alberto.damm@spartan.cl",
    "nelson.norambuena@spartan.cl",
  ].map((x) => x.trim().toLowerCase())
);

const JEFATURA_SCOPE_PREFIJOS: Record<string, string[]> = {
  "claudia.borquez@spartan.cl": ["IN", "FB"],
  "jorge.beltran@spartan.cl": ["FB", "IN", "HC", "IND"],
  "alberto.damm@spartan.cl": ["IND"],
  "nelson.norambuena@spartan.cl": ["HC"],
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

function inputStyle() {
  return {
    padding: 10,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    background: "white",
  } as const;
}

function cardStyle() {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "white",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    padding: 14,
  } as const;
}

type ApiData = {
  ok: boolean;
  error?: string;
  kpis?: {
    total: number;
    asignados: number;
    contactados: number;
    cerradosGanado: number;
    noGanado: number;
    pipelineMonto: number;
    forecastMonto: number;
  };
  charts?: {
    estados: { key: string; name: string; value: number }[];
    origenes: { name: string; value: number }[];
    ejecutivos: {
      ejecutivo: string;
      count: number;
      pipeline: number;
      forecast: number;
      ganados: number;
      noGanados: number;
    }[];
  };
};

export default function CRMReporteriaGerenciaPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [authLoading, setAuthLoading] = useState(true);
  const [loggedEmail, setLoggedEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiData | null>(null);

  // filtros
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState("");
  const [division, setDivision] = useState("");
  const [ejecutivo, setEjecutivo] = useState("");
  const [origen, setOrigen] = useState("");

  const [onlyAssigned, setOnlyAssigned] = useState(false);
  const [onlyClosed, setOnlyClosed] = useState(false);

  const isJefatura = useMemo(
    () => JEFATURAS.has(normalizeEmail(loggedEmail)),
    [loggedEmail]
  );

  const allowedDivs = useMemo(() => {
    const email = normalizeEmail(loggedEmail);
    return (JEFATURA_SCOPE_PREFIJOS[email] || []).map((x) => x.toUpperCase());
  }, [loggedEmail]);

  const divisionOptions = useMemo(() => ["", ...allowedDivs], [allowedDivs]);

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

  const ejecutivoOptions = useMemo(() => {
    const arr = data?.charts?.ejecutivos?.map((x) => x.ejecutivo).filter(Boolean) || [];
    const uniq = Array.from(new Set(arr)).sort();
    return ["", ...uniq];
  }, [data]);

  const origenOptions = useMemo(() => {
    const arr = data?.charts?.origenes?.map((x) => x.name).filter(Boolean) || [];
    const uniq = Array.from(new Set(arr)).sort();
    return ["", ...uniq];
  }, [data]);

  async function reload() {
    try {
      setLoading(true);
      setErr(null);

      const qs = new URLSearchParams();
      if (from) qs.set("from", new Date(from).toISOString());
      if (to) qs.set("to", new Date(`${to}T23:59:59.999`).toISOString());

      if (division) qs.set("division", division);
      if (ejecutivo) qs.set("ejecutivo", ejecutivo);
      if (origen) qs.set("origen", origen);

      if (onlyAssigned) qs.set("onlyAssigned", "1");
      if (onlyClosed) qs.set("onlyClosed", "1");

      qs.set("includeAssigned", "1");

      const resp = await fetch(`/api/crm/reporteria/gerencia?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = (await resp.json()) as ApiData;

      if (!resp.ok || !json.ok) {
        setData(null);
        setErr(json.error || `Error HTTP ${resp.status}`);
        return;
      }

      setData(json);
    } catch (e: any) {
      setData(null);
      setErr(e?.message || "Error cargando reportería");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && isJefatura) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isJefatura]);

  const funnelData = useMemo(() => data?.charts?.estados || [], [data]);
  const pieOrigenData = useMemo(() => data?.charts?.origenes || [], [data]);

  const barEjecutivos = useMemo(() => {
    const arr = data?.charts?.ejecutivos || [];
    return arr.slice(0, 12);
  }, [data]);

  // ✅ FIX: tick con rotación como función (TypeScript-friendly)
  const xTickRotated = useMemo(() => {
    return (props: any) => {
      const { x, y, payload } = props || {};
      const value = payload?.value ?? "";
      return (
        <g transform={`translate(${x},${y})`}>
          <text
            x={0}
            y={0}
            dy={16}
            textAnchor="end"
            transform="rotate(-20)"
            fontSize={11}
            fill="#374151"
          >
            {String(value)}
          </text>
        </g>
      );
    };
  }, []);

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>
          CRM · Reportería (Gerencia)
        </h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  if (!isJefatura) {
    return (
      <div style={{ padding: 16, maxWidth: 900 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          CRM · Reportería (Gerencia)
        </h2>
        <div style={{ marginTop: 10, color: "crimson" }}>
          No tienes permisos para este módulo (solo jefaturas).
        </div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>
          Login detectado: <b>{loggedEmail || "—"}</b>
        </div>
      </div>
    );
  }

  const k = data?.kpis;

  return (
    <div style={{ padding: 16, maxWidth: 1400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            CRM · Reportería (Gerencia)
          </h2>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            Jefatura: <b>{loggedEmail || "—"}</b> {" · "}
            Scope: <b>{allowedDivs.length ? allowedDivs.join(", ") : "TODOS"}</b>
          </div>
        </div>

        <button
          type="button"
          onClick={reload}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {/* filtros */}
      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Desde</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle()} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Hasta</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle()} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>División</div>
          <select value={division} onChange={(e) => setDivision(e.target.value)} style={inputStyle()}>
            {divisionOptions.map((d) => (
              <option key={d || "ALL"} value={d}>
                {d ? d : "Todas (scope)"}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 260 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Ejecutivo</div>
          <select value={ejecutivo} onChange={(e) => setEjecutivo(e.target.value)} style={inputStyle()}>
            {ejecutivoOptions.map((x) => (
              <option key={x || "ALL"} value={x}>
                {x ? x : "Todos"}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Origen</div>
          <select value={origen} onChange={(e) => setOrigen(e.target.value)} style={inputStyle()}>
            {origenOptions.map((x) => (
              <option key={x || "ALL"} value={x}>
                {x ? x : "Todos"}
              </option>
            ))}
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 22, cursor: "pointer" }}>
          <input type="checkbox" checked={onlyAssigned} onChange={(e) => setOnlyAssigned(e.target.checked)} />
          <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.9 }}>Solo asignados</span>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 22, cursor: "pointer" }}>
          <input type="checkbox" checked={onlyClosed} onChange={(e) => setOnlyClosed(e.target.checked)} />
          <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.9 }}>Solo cerrados</span>
        </label>

        <button
          type="button"
          onClick={reload}
          disabled={loading}
          style={{
            marginLeft: "auto",
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #111827",
            background: "#111827",
            color: "white",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Aplicar filtros
        </button>
      </div>

      {err && <div style={{ marginTop: 10, color: "crimson", fontSize: 13 }}>Error: {err}</div>}

      {/* KPIs */}
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(6, minmax(160px, 1fr))",
        }}
      >
        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>Leads</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{k?.total ?? "—"}</div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>Asignados</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{k?.asignados ?? "—"}</div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>Contactados</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{k?.contactados ?? "—"}</div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>Pipeline</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{moneyCLP(k?.pipelineMonto ?? 0)}</div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>Forecast</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{moneyCLP(k?.forecastMonto ?? 0)}</div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>Cerrados</div>
          <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>✅ {k?.cerradosGanado ?? 0}</div>
            <div style={{ fontSize: 18, fontWeight: 900, opacity: 0.75 }}>❌ {k?.noGanado ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(12, 1fr)" }}>
        <div style={{ ...cardStyle(), gridColumn: "span 6" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Embudo por estado</div>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ ...cardStyle(), gridColumn: "span 6" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Origen (torta)</div>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie data={pieOrigenData} dataKey="value" nameKey="name" outerRadius={110} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ ...cardStyle(), gridColumn: "span 12" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Pipeline por ejecutivo (Top 12)</div>

          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <BarChart data={barEjecutivos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="ejecutivo"
                  interval={0}
                  height={90}
                  tick={xTickRotated} // ✅ FIX
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="pipeline" name="Pipeline" />
                <Bar dataKey="forecast" name="Forecast" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 10, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.8 }}>
                  <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Ejecutivo</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>#</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Pipeline</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Forecast</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>✅</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>❌</th>
                </tr>
              </thead>
              <tbody>
                {(data?.charts?.ejecutivos || []).slice(0, 20).map((x) => (
                  <tr key={x.ejecutivo || Math.random()} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 10, fontWeight: 800 }}>{x.ejecutivo || "—"}</td>
                    <td style={{ padding: 10 }}>{x.count}</td>
                    <td style={{ padding: 10 }}>{moneyCLP(x.pipeline)}</td>
                    <td style={{ padding: 10 }}>{moneyCLP(x.forecast)}</td>
                    <td style={{ padding: 10 }}>{x.ganados}</td>
                    <td style={{ padding: 10 }}>{x.noGanados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Fuente: <b>CRM_DB</b> (prospectos)
      </div>
    </div>
  );
}
