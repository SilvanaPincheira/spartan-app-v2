"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const JEFATURAS = new Set(
  [
    "claudia.borquez@spartan.cl",
    "jorge.beltran@spartan.cl",
    "alberto.damm@spartan.cl",
    "nelson.norambuena@spartan.cl",
    "carlos.avendano@spartan.cl",
  ].map((x) => x.trim().toLowerCase())
);

const JEFATURA_SCOPE_PREFIJOS: Record<string, string[]> = {
  "claudia.borquez@spartan.cl": ["IN", "FB"],
  "jorge.beltran@spartan.cl": ["FB", "IN", "HC", "IND"], // gerente general
  "alberto.damm@spartan.cl": ["IND"],
  "nelson.norambuena@spartan.cl": ["BSC"],
  "carlos.avendano@spartan.cl": ["HC"],
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

function badge(bg: string) {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    background: bg,
    border: "1px solid rgba(17,24,39,0.08)",
    whiteSpace: "nowrap" as const,
  };
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
    pendientesWeb?: number;
  };
  charts?: {
    ejecutivos: {
      ejecutivo: string;
      count: number;
      pipeline: number;
      forecast: number;
      ganados: number;
      noGanados: number;
    }[];
    fechaCierre?: { name: string; value: number }[];
    probCierre?: { name: string; value: number }[];
    pendientesWebPorDivision?: { name: string; value: number }[];
    estados?: { key: string; name: string; value: number }[]; // ✅ NUEVO: para tabla mini
  };
};

function formatLabel(s: string) {
  if (!s) return "—";
  if (s.includes("@")) return s;
  return s;
}

function TablePro({
  title,
  subtitle,
  rows,
  valueLabel = "Cantidad",
  valueSuffix,
  accent = "rgba(37,99,235,0.12)",
}: {
  title: string;
  subtitle: string;
  rows: { name: string; value: number }[];
  valueLabel?: string;
  valueSuffix?: string;
  accent?: string;
}) {
  const max = Math.max(1, ...(rows || []).map((r) => r.value || 0));

  return (
    <div style={cardStyle()}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{subtitle}</div>
      </div>

      {(rows || []).length === 0 ? (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Sin datos para mostrar (falta que la API devuelva este bloque o no hay
          registros con ese filtro).
        </div>
      ) : (
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.75 }}>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Categoría</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb", width: 140 }}>
                  {valueLabel}
                </th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb", width: 220 }}>
                  Peso
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((r, idx) => {
                const pct = Math.round(((r.value || 0) / max) * 100);
                return (
                  <tr key={`${r.name}_${idx}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 10, fontWeight: 900 }}>
                      <span style={badge(accent)}>{formatLabel(r.name)}</span>
                    </td>

                    <td style={{ padding: 10, fontWeight: 900 }}>
                      {r.value}
                      {valueSuffix ? ` ${valueSuffix}` : ""}
                    </td>

                    <td style={{ padding: 10 }}>
                      <div
                        style={{
                          height: 10,
                          width: "100%",
                          background: "rgba(17,24,39,0.06)",
                          borderRadius: 999,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: "rgba(37,99,235,0.85)",
                          }}
                        />
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>{pct}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 12 && (
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.65 }}>
              Mostrando 12 de {rows.length} categorías.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
TablePro.displayName = "TablePro";

/** ✅ Tabla compacta de etapas (para el espacio en blanco) */
function EtapasMiniTable({
  rows,
}: {
  rows: { key: string; name: string; value: number }[];
}) {
  const colorByKey: Record<string, string> = {
    PENDIENTE_ASIGNACION: "rgba(148,163,184,0.25)",
    ASIGNADO: "rgba(37,99,235,0.18)",
    EN_GESTION: "rgba(59,130,246,0.18)",
    CONTACTADO: "rgba(16,185,129,0.18)",
    REUNION: "rgba(14,165,233,0.18)",
    LEVANTAMIENTO: "rgba(168,85,247,0.18)",
    PROPUESTA: "rgba(245,158,11,0.22)",
    INSTALADO_1_O_C: "rgba(34,197,94,0.22)",
    CERRADO_GANADO: "rgba(34,197,94,0.35)",
    NO_GANADO: "rgba(239,68,68,0.25)",
  };

  const filtered = (rows || []).filter((r) => (r?.value ?? 0) > 0);

  return (
    <div style={cardStyle()}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Etapas del pipeline</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Snapshot</div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>Sin datos para mostrar.</div>
      ) : (
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.75 }}>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Etapa</th>
                <th
                  style={{
                    padding: 10,
                    borderBottom: "1px solid #e5e7eb",
                    width: 120,
                    textAlign: "right",
                  }}
                >
                  Cantidad
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 10).map((r, idx) => (
                <tr key={`${r.key}_${idx}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: 10, fontWeight: 900 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontWeight: 900,
                        background: colorByKey[r.key] || "rgba(203,213,225,0.25)",
                        border: "1px solid rgba(17,24,39,0.08)",
                      }}
                    >
                      {r.name}
                    </span>
                  </td>
                  <td style={{ padding: 10, textAlign: "right", fontWeight: 900 }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 10 && (
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.65 }}>
              Mostrando 10 de {filtered.length} etapas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
EtapasMiniTable.displayName = "EtapasMiniTable";

export default function CRMReporteriaGerenciaPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [authLoading, setAuthLoading] = useState(true);
  const [loggedEmail, setLoggedEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiData | null>(null);

  // filtros
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [division, setDivision] = useState("");
  const [ejecutivo, setEjecutivo] = useState("");

  const [onlyAssigned, setOnlyAssigned] = useState(false);
  const [onlyClosed, setOnlyClosed] = useState(false);

  const isJefatura = useMemo(() => JEFATURAS.has(normalizeEmail(loggedEmail)), [loggedEmail]);

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

  async function reload() {
    try {
      setLoading(true);
      setErr(null);

      const qs = new URLSearchParams();
      if (from) qs.set("from", new Date(from).toISOString());
      if (to) qs.set("to", new Date(`${to}T23:59:59.999`).toISOString());

      if (division) qs.set("division", division);
      if (ejecutivo) qs.set("ejecutivo", ejecutivo);

      if (onlyAssigned) qs.set("onlyAssigned", "1");
      if (onlyClosed) qs.set("onlyClosed", "1");

      qs.set("includeAssigned", "1");

      // ✅ Jorge ve todo
      qs.set("viewerEmail", loggedEmail);

      const resp = await fetch(`/api/crm/reporteria/gerencia?${qs.toString()}`, { cache: "no-store" });
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

  const k = data?.kpis;

  const barEjecutivos = useMemo(() => {
    const arr = data?.charts?.ejecutivos || [];
    return arr.slice(0, 12);
  }, [data]);

  const pendientesWebByDiv = useMemo(() => data?.charts?.pendientesWebPorDivision || [], [data]);
  const fechaCierre = useMemo(() => data?.charts?.fechaCierre || [], [data]);
  const probCierre = useMemo(() => data?.charts?.probCierre || [], [data]);

  // ✅ para la tabla mini
  const etapas = useMemo(() => data?.charts?.estados || [], [data]);

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>CRM · Reportería (Gerencia)</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  if (!isJefatura) {
    return (
      <div style={{ padding: 16, maxWidth: 900 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>CRM · Reportería (Gerencia)</h2>
        <div style={{ marginTop: 10, color: "crimson" }}>No tienes permisos para este módulo (solo jefaturas).</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>
          Login detectado: <b>{loggedEmail || "—"}</b>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>CRM · Reportería (Gerencia)</h2>
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
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Desde</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle()} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Hasta</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle()} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>División</div>
          <select value={division} onChange={(e) => setDivision(e.target.value)} style={inputStyle()}>
            {divisionOptions.map((d) => (
              <option key={d || "ALL"} value={d}>
                {d ? d : "Todas (scope)"}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 260 }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Ejecutivo</div>
          <select value={ejecutivo} onChange={(e) => setEjecutivo(e.target.value)} style={inputStyle()}>
            {ejecutivoOptions.map((x) => (
              <option key={x || "ALL"} value={x}>
                {x ? x : "Todos"}
              </option>
            ))}
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 22, cursor: "pointer" }}>
          <input type="checkbox" checked={onlyAssigned} onChange={(e) => setOnlyAssigned(e.target.checked)} />
          <span style={{ fontSize: 13, fontWeight: 900, opacity: 0.9 }}>Solo asignados</span>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 22, cursor: "pointer" }}>
          <input type="checkbox" checked={onlyClosed} onChange={(e) => setOnlyClosed(e.target.checked)} />
          <span style={{ fontSize: 13, fontWeight: 900, opacity: 0.9 }}>Solo cerrados</span>
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
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Leads (CRM_DB)</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{k?.total ?? "—"}</div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Por asignar (WEB)</div>
          <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "baseline" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{k?.pendientesWeb ?? "—"}</div>
            <span style={badge("rgba(37,99,235,0.12)")}>pendientes</span>
          </div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Asignados</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{k?.asignados ?? "—"}</div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Contactados</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{k?.contactados ?? "—"}</div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Pipeline</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{moneyCLP(k?.pipelineMonto ?? 0)}</div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Forecast</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{moneyCLP(k?.forecastMonto ?? 0)}</div>
        </div>
      </div>

      {/* Gráfico + Tablas pro */}
      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(12, 1fr)" }}>
        <div style={{ ...cardStyle(), gridColumn: "span 12" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Pipeline por ejecutivo (Top 12)</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Barras (sin rotación de texto)</div>
          </div>

          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <BarChart data={barEjecutivos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ejecutivo" interval={0} height={70} tick={{ fontSize: 11 }} />
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
                {(data?.charts?.ejecutivos || []).slice(0, 20).map((x, i) => (
                  <tr key={`${x.ejecutivo || "—"}_${i}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 10, fontWeight: 900 }}>{x.ejecutivo || "—"}</td>
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

        <div style={{ gridColumn: "span 6" }}>
          <TablePro
            title="Por asignar (WEB)"
            subtitle="Conteo por división"
            rows={pendientesWebByDiv}
            accent="rgba(37,99,235,0.12)"
          />
        </div>

        <div style={{ gridColumn: "span 6" }}>
          <TablePro
            title="Fecha de cierre"
            subtitle="Conteo por rango/plazo"
            rows={fechaCierre}
            accent="rgba(16,185,129,0.12)"
          />
        </div>

        <div style={{ gridColumn: "span 6" }}>
          <TablePro
            title="Probabilidad de cierre"
            subtitle="Conteo por tramo %"
            rows={probCierre}
            accent="rgba(245,158,11,0.16)"
          />
        </div>

        {/* ✅ NUEVO: ocupa el espacio en blanco */}
        <div style={{ gridColumn: "span 6" }}>
          <EtapasMiniTable rows={etapas} />
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Fuente: <b>CRM_DB</b> (prospectos) + <b>BD_WEB</b> (pendientes por asignar)
      </div>
    </div>
  );
}
