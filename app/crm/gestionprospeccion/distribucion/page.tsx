"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const SHEET_ID = "1xHT48r3asID6PCrgXTCpjbwujdnu6E7aev29BHq7U9w";

const ORIGIN_SOURCES = [
  { origen: "WEB", gid: "0" },
  { origen: "INOFOOD", gid: "1247405361" },
  { origen: "FOOD SERVICE", gid: "1702589412" },
  { origen: "REFERIDO", gid: "1953693689" },
] as const;

function sheetCsvUrl(gid: string) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

/** ✅ CRM_DB (Sheet “prospectos” publicado como CSV) */
const CSV_CRM_DB_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6D9j1ZjygWJKRXLV22AMb2oMYKVQWlly1KdAIKRm9jBAOIvIxNd9jqhEi2Zc-7LnjLe2wfhKrfsEW/pub?gid=0&single=true&output=csv";

/** Jefaturas que asignan */
const JEFATURAS = new Set(
  [
    "claudia.borquez@spartan.cl",
    "jorge.beltran@spartan.cl",
    "alberto.damm@spartan.cl",
    "nelson.norambuena@spartan.cl",
  ].map((x) => x.trim().toLowerCase())
);

/** ✅ Scope fijo por jefatura (SIN Supabase) */
const JEFATURA_SCOPE_PREFIJOS: Record<string, string[]> = {
  "claudia.borquez@spartan.cl": ["IN", "FB"],
  "jorge.beltran@spartan.cl": ["FB", "IN", "HC", "IND"], // ajusta
  "alberto.damm@spartan.cl": ["IND"],
  "nelson.norambuena@spartan.cl": ["HC"], // ajusta
};

type Row = Record<string, string>;

/** =========================
 *  CSV helpers
 *  ========================= */
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
function normUpper(s: string) {
  return (s || "").trim().toUpperCase();
}
function normLower(s: string) {
  return (s || "").trim().toLowerCase();
}

function pick(r: Row, ...keys: string[]) {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function toMontoNumber(raw: string) {
  const n = Number(String(raw || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function makeFolio(origen: string, razon: string, mail: string, fecha: string) {
  // folio determinístico “corto y bonito”
  const base = `${origen}|${razon}|${mail}|${fecha}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  const short = hash.toString(36).slice(0, 8);
  return `LEAD-${origen.replace(/\s+/g, "")}-${short}`;
}

function normalizeLeadRow(origen: string, r: Row): Row {
  const razon = pick(r, "razon_social", "razon", "empresa", "nombre_razon_social");
  const contacto = pick(r, "contacto", "nombre_contacto");
  const mail = pick(r, "mail", "correo", "email", "e_mail");
  const telefono = pick(r, "telefono", "phone");
  const industria = pick(r, "industria", "rubro");
  const mensaje = pick(r, "mensaje", "observacion", "comentario");
  const fechaContacto = pick(r, "fecha_contacto", "fecha", "created_at");
  const division = pick(r, "division", "prefijo");
  const etapa = pick(r, "etapa", "etapa_nombre");
  const montoRaw = pick(r, "monto", "monto_proyectado");

  const folio = pick(r, "folio") || makeFolio(origen, razon, mail, fechaContacto);

  return {
    folio,
    created_at: fechaContacto,
    origen_prospecto: origen,

    nombre_razon_social: razon,
    correo: mail,
    contacto,
    telefono,

    rubro: industria,
    observacion: mensaje,

    division,

    etapa_nombre: etapa,
    monto_proyectado: String(toMontoNumber(montoRaw) || montoRaw || ""),

    // fuente siempre “pendiente” desde las hojas
    estado: "PENDIENTE_ASIGNACION",
    asignado_a: "",
    asignado_por: "",
    asignado_at: "",
  };
}

/** =========================
 *  UI helpers
 *  ========================= */
function badgeStyle(bg: string) {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: bg,
    border: "1px solid rgba(17,24,39,0.08)",
    whiteSpace: "nowrap" as const,
  };
}

function moneyCLP(raw: string) {
  const n = toMontoNumber(raw);
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

/** =========================
 *  Page
 *  ========================= */
export default function CRMDistribucionPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggedEmail, setLoggedEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);

  // ✅ CRM_DB: folio -> estado / asignado_a
  const [crmIndex, setCrmIndex] = useState<Record<string, string>>({});
  const [crmAsignadoA, setCrmAsignadoA] = useState<Record<string, string>>({});

  const [q, setQ] = useState("");
  const [assigningFolio, setAssigningFolio] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState<Record<string, string>>({});

  // modal mensaje
  const [openMsg, setOpenMsg] = useState<{ title: string; body: string } | null>(null);

  const isJefatura = useMemo(() => JEFATURAS.has(normalizeEmail(loggedEmail)), [loggedEmail]);

  /** ✅ scope fijo por email */
  const allowedPrefijos = useMemo(() => {
    const email = normalizeEmail(loggedEmail);
    const p = JEFATURA_SCOPE_PREFIJOS[email] || [];
    return p.map(normUpper);
  }, [loggedEmail]);

  const allowedPrefijosSet = useMemo(() => new Set(allowedPrefijos), [allowedPrefijos]);

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

      // 1) CRM_DB index (estado + asignado_a)
      const resDb = await fetch(CSV_CRM_DB_URL, { cache: "no-store" });
      if (!resDb.ok) throw new Error(`No se pudo leer CRM_DB (${resDb.status})`);
      const textDb = await resDb.text();
      const dbRows = parseCsv(textDb);

      const idxEstado: Record<string, string> = {};
      const idxAsign: Record<string, string> = {};

      for (const r of dbRows) {
        const f = (r.folio || "").trim();
        if (!f) continue;
        idxEstado[f] = normUpper(r.estado || "");
        idxAsign[f] = normalizeEmail(r.asignado_a || "");
      }

      setCrmIndex(idxEstado);
      setCrmAsignadoA(idxAsign);

      // 2) 4 hojas (leads)
      const results = await Promise.all(
        ORIGIN_SOURCES.map(async (src) => {
          const url = sheetCsvUrl(src.gid);
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) {
            throw new Error(`No se pudo leer ${src.origen} (gid=${src.gid}) status=${res.status}`);
          }
          const text = await res.text();
          if (text.trim().startsWith("<")) {
            throw new Error(`La hoja ${src.origen} no está publicada para CSV (Google devolvió HTML).`);
          }
          const parsed = parseCsv(text);
          return parsed.map((r) => normalizeLeadRow(src.origen, r));
        })
      );

      setRows(results.flat());
    } catch (e: any) {
      setErr(e?.message || "Error leyendo hojas/CRM_DB");
      setRows([]);
      setCrmIndex({});
      setCrmAsignadoA({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // ✅ ahora “pendientes” incluye también los que ya están ASIGNADO en CRM_DB,
  // pero los vamos a mostrar BLOQUEADOS.
  const pendientes = useMemo(() => {
    const query = q.trim().toLowerCase();

    const base = rows.filter((r) => {
      const folio = (r.folio || "").trim();
      if (!folio) return false;

      // seguridad: la fuente siempre debe ser “pendiente” (desde hojas)
      const estado = normUpper(r.estado || "");
      if (estado !== "PENDIENTE_ASIGNACION") return false;

      const pref = normUpper(r.division || r.prefijo || "");
      if (allowedPrefijosSet.size > 0 && !allowedPrefijosSet.has(pref)) return false;

      return true;
    });

    if (!query) return base;

    return base.filter((r) => {
      const haystack = [
        r.folio,
        r.nombre_razon_social,
        r.correo,
        r.origen_prospecto,
        r.division,
        r.observacion,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, q, allowedPrefijosSet]);

  async function asignar(folio: string, lead: Row) {
    const asignado_a = normalizeEmail(targetEmail[folio] || "");
    const asignado_por = normalizeEmail(loggedEmail);

    if (!asignado_a) {
      alert("Debes ingresar el correo/login del ejecutivo a asignar.");
      return;
    }

    try {
      setAssigningFolio(folio);

      const resp = await fetch("/api/crm/prospectos/asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folio, asignado_a, asignado_por, lead }),
      });

      const text = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, error: "Respuesta no JSON", raw: text.slice(0, 300) };
      }

      if (!resp.ok || !data?.ok) {
        alert(`❌ Error asignando:\nstatus=${resp.status}\n${JSON.stringify(data, null, 2)}`);
        return;
      }

      // ✅ refrescar: quedará marcado como ASIGNADO en crmIndex/crmAsignadoA
      await reload();
    } finally {
      setAssigningFolio(null);
    }
  }

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>CRM · Distribución</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  if (!isJefatura) {
    return (
      <div style={{ padding: 16, maxWidth: 900 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>CRM · Prospección · Distribución</h2>
        <div style={{ marginTop: 10, color: "crimson" }}>
          No tienes permisos para este módulo (solo jefaturas).
        </div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>
          Login detectado: <b>{loggedEmail || "—"}</b>
        </div>
      </div>
    );
  }

  // ✅ ordenar: primero no asignados, luego asignados (bloqueados)
  const pendientesOrdenados = useMemo(() => {
    const arr = pendientes.slice();
    arr.sort((a, b) => {
      const fa = (a.folio || "").trim();
      const fb = (b.folio || "").trim();
      const aAssigned = !!(crmAsignadoA[fa] || "");
      const bAssigned = !!(crmAsignadoA[fb] || "");
      return Number(aAssigned) - Number(bAssigned);
    });
    return arr;
  }, [pendientes, crmAsignadoA]);

  return (
    <div style={{ padding: 16, maxWidth: 1250 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            CRM · Prospección · Distribución de carga (Jefaturas)
          </h2>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            Jefatura: <b>{loggedEmail || "—"}</b>
            {" · "}
            Fuentes: <b>WEB · INOFOOD · FOOD SERVICE · REFERIDO</b>
            {" · "}
            Scope: <b>{allowedPrefijos.length ? allowedPrefijos.join(", ") : "TODOS"}</b>
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
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por folio / razón social / correo / mensaje…"
          style={{
            flex: 1,
            minWidth: 280,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        />
      </div>

      {err && (
        <div style={{ marginTop: 10, color: "crimson", fontSize: 13 }}>Error: {err}</div>
      )}

      <div
        style={{
          marginTop: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          background: "white",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.85, background: "#fafafa" }}>
              <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>Folio</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>Razón Social</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>Origen</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>División</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>Mensaje</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>Monto</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>Asignar a</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }} />
            </tr>
          </thead>

          <tbody>
            {pendientesOrdenados.map((r, i) => {
              const folio = (r.folio || "").trim();
              const busy = assigningFolio === folio;

              const dbEstado = normUpper(crmIndex[folio] || "");
              const dbAsignado = (crmAsignadoA[folio] || "").trim();
              const yaAsignado = dbEstado === "ASIGNADO" || dbEstado === "AUTORIZADO" || !!dbAsignado;

              return (
                <tr
                  key={`${folio}_${i}`}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    opacity: yaAsignado ? 0.82 : 1,
                  }}
                >
                  <td style={{ padding: 12, verticalAlign: "top" }}>
                    <div style={{ fontWeight: 800 }}>{folio || "—"}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      {r.created_at || "—"}
                    </div>
                  </td>

                  <td style={{ padding: 12, verticalAlign: "top" }}>
                    <div style={{ fontWeight: 800 }}>{r.nombre_razon_social || "—"}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      {r.correo || "—"}
                    </div>
                  </td>

                  <td style={{ padding: 12, verticalAlign: "top" }}>
                    <span style={badgeStyle("rgba(59,130,246,0.12)")}>
                      {r.origen_prospecto || "—"}
                    </span>
                  </td>

                  <td style={{ padding: 12, verticalAlign: "top" }}>
                    <span style={badgeStyle("rgba(16,185,129,0.12)")}>{r.division || "—"}</span>
                  </td>

                  <td style={{ padding: 12, verticalAlign: "top" }}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMsg({
                          title: `${r.nombre_razon_social || "Prospecto"} · ${r.origen_prospecto || ""}`,
                          body: r.observacion || "— (sin mensaje)",
                        })
                      }
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        background: "white",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Ver mensaje
                    </button>
                  </td>

                  <td style={{ padding: 12, verticalAlign: "top" }}>
                    <div style={{ fontWeight: 800 }}>{moneyCLP(r.monto_proyectado || "")}</div>
                  </td>

                  <td style={{ padding: 12, verticalAlign: "top" }}>
                    {yaAsignado ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>
                          Asignado
                        </div>
                        <div
                          style={{
                            width: "100%",
                            minWidth: 240,
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid rgba(17,24,39,0.10)",
                            background: "rgba(16,185,129,0.12)",
                            fontWeight: 800,
                          }}
                          title="Ya está asignado en CRM_DB"
                        >
                          {dbAsignado || "—"}
                        </div>
                      </div>
                    ) : (
                      <input
                        value={targetEmail[folio] || ""}
                        onChange={(e) => setTargetEmail((p) => ({ ...p, [folio]: e.target.value }))}
                        placeholder="ej: pia.ramirez@spartan.cl"
                        style={{
                          width: "100%",
                          minWidth: 240,
                          padding: 10,
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    )}
                  </td>

                  <td style={{ padding: 12, verticalAlign: "top" }}>
                    <button
                      type="button"
                      onClick={() => asignar(folio, r)}
                      disabled={busy || yaAsignado}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #111827",
                        background: yaAsignado ? "#9ca3af" : busy ? "#6b7280" : "#111827",
                        color: "white",
                        fontWeight: 800,
                        cursor: busy || yaAsignado ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {yaAsignado ? "Asignado" : busy ? "Asignando…" : "Asignar"}
                    </button>
                  </td>
                </tr>
              );
            })}

            {!loading && pendientesOrdenados.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 14, opacity: 0.7 }}>
                  No hay prospectos pendientes de asignación.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Registros visibles: <b>{pendientesOrdenados.length}</b> (los ya asignados quedan bloqueados)
      </div>

      {/* Modal mensaje */}
      {openMsg && (
        <div
          onClick={() => setOpenMsg(null)}
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
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(780px, 100%)",
              background: "white",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 14,
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 900 }}>{openMsg.title}</div>
              <button
                type="button"
                onClick={() => setOpenMsg(null)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Cerrar
              </button>
            </div>
            <div style={{ padding: 14, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
              {openMsg.body}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
