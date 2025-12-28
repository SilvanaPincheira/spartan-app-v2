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

const JEFATURAS = new Set(
  [
    "claudia.borquez@spartan.cl",
    "jorge.beltran@spartan.cl",
    "alberto.damm@spartan.cl",
    "nelson.norambuena@spartan.cl",
  ].map((x) => x.trim().toLowerCase())
);

type Row = Record<string, string>;
type ScopeRow = { email: string; prefijo: string };

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

// folio “lindo” estable
function makeFolio(origen: string, razon: string, mail: string, fecha: string) {
  const base = `${origen}|${razon}|${mail}|${fecha}`.toLowerCase().replace(/\s+/g, "_");
  // hash simple pero estable (no crypt): largo+slice
  const hash = base.length.toString(36) + "-" + base.slice(0, 30);
  return `LEAD-${origen.replace(/\s+/g, "")}-${hash}`;
}

function normalizeLeadRow(origen: string, r: Row): Row {
  // Cabeceras reales tuyas (normalizadas):
  // razon_social, contacto, mail, telefono, industria, mensaje, fecha_contacto, division, etapa, monto

  const razon = pick(r, "razon_social", "razon", "empresa", "nombre_razon_social");
  const contacto = pick(r, "contacto");
  const mail = pick(r, "mail", "correo", "email");
  const telefono = pick(r, "telefono");
  const industria = pick(r, "industria", "rubro");
  const mensaje = pick(r, "mensaje", "observacion", "comentario");
  const fechaContacto = pick(r, "fecha_contacto", "fecha", "created_at");
  const division = pick(r, "division", "prefijo"); // IN / FB / HC / IND
  const etapa = pick(r, "etapa", "etapa_nombre");
  const montoRaw = pick(r, "monto", "monto_proyectado");

  const folio = pick(r, "folio") || makeFolio(origen, razon, mail, fechaContacto);

  return {
    // Interno:
    lead_key: folio,

    // Campos “CRM_DB-like”:
    folio,
    created_at: fechaContacto,
    origen_prospecto: origen,

    nombre_razon_social: razon,
    correo: mail,
    telefono,
    rubro: industria,

    // este mensaje lo enviaremos a CRM_DB como observacion
    observacion: mensaje,

    division: division,

    etapa_nombre: etapa || "",

    monto_proyectado: String(toMontoNumber(montoRaw) || montoRaw || ""),

    // distribución
    estado: "PENDIENTE_ASIGNACION",
    asignado_a: "",
    asignado_por: "",
    asignado_at: "",
  };
}

export default function CRMDistribucionPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggedEmail, setLoggedEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  const [assigningFolio, setAssigningFolio] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState<Record<string, string>>({});

  const [allowedPrefijos, setAllowedPrefijos] = useState<string[]>([]);
  const [scopeErr, setScopeErr] = useState<string | null>(null);

  // Modal mensaje
  const [openMsg, setOpenMsg] = useState<{ title: string; body: string } | null>(null);

  const isJefatura = useMemo(
    () => JEFATURAS.has(normalizeEmail(loggedEmail)),
    [loggedEmail]
  );

  // ✅ fallback si supabase scope falla (para no “romper” el módulo)
  const FALLBACK_SCOPE: Record<string, string[]> = {
    "claudia.borquez@spartan.cl": ["IN", "FB"],
    "jorge.beltran@spartan.cl": ["IN", "FB", "HC", "IND"],
    "alberto.damm@spartan.cl": ["IND"],
    "nelson.norambuena@spartan.cl": ["HC"],
  };

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

  // Scope desde Supabase
  useEffect(() => {
    if (authLoading) return;
    if (!loggedEmail) return;

    (async () => {
      try {
        setScopeErr(null);

        // 👇 CAMBIA ESTE NOMBRE por tu tabla real.
        // En tu screenshot se ve una tabla con columnas: id, email, prefijo
        // Si se llama distinto (ej: "jefatura_prefijos"), ponlo aquí.
        const SCOPE_TABLE = "jefatura_prefijos"; // <-- AJUSTA

        const { data, error } = await supabase
          .from(SCOPE_TABLE)
          .select("email,prefijo")
          .eq("email", normalizeEmail(loggedEmail));

        if (error) throw error;

        const prefijos = (data as ScopeRow[] | null)?.map((r) => normUpper(r.prefijo)) ?? [];
        setAllowedPrefijos(prefijos.length ? prefijos : FALLBACK_SCOPE[normalizeEmail(loggedEmail)] || []);
      } catch (e: any) {
        setScopeErr(e?.message || "Error leyendo prefijos (scope) en Supabase");
        setAllowedPrefijos(FALLBACK_SCOPE[normalizeEmail(loggedEmail)] || []);
      }
    })();
  }, [authLoading, loggedEmail, supabase]);

  const allowedPrefijosSet = useMemo(
    () => new Set(allowedPrefijos.map((p) => normUpper(p))),
    [allowedPrefijos]
  );

  async function reload() {
    try {
      setLoading(true);
      setErr(null);

      const results = await Promise.all(
        ORIGIN_SOURCES.map(async (src) => {
          const url = sheetCsvUrl(src.gid);
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error(`No se pudo leer ${src.origen} (gid=${src.gid}) status=${res.status}`);
          const text = await res.text();

          if (text.trim().startsWith("<")) {
            throw new Error(
              `La hoja ${src.origen} no está publicada como CSV (Google devolvió HTML). ` +
                `En Google Sheets: Archivo → Publicar en la web`
            );
          }

          return parseCsv(text).map((r) => normalizeLeadRow(src.origen, r));
        })
      );

      setRows(results.flat());
    } catch (e: any) {
      setErr(e?.message || "Error leyendo hojas");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const pendientes = useMemo(() => {
    const query = q.trim().toLowerCase();

    const base = rows
      .filter((r) => {
        const estado = normUpper(r.estado || "");
        if (estado !== "PENDIENTE_ASIGNACION") return false;

        const asignadoA = normLower(r.asignado_a || "");
        if (asignadoA) return false;

        const pref = normUpper(r.division || "");
        if (allowedPrefijosSet.size > 0 && pref && !allowedPrefijosSet.has(pref)) return false;

        return true;
      })
      // ordena por fecha (si viene)
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

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

  async function asignar(row: Row) {
    const folio = String(row.folio || "").trim();
    const asignado_a = normalizeEmail(targetEmail[folio] || "");
    const asignado_por = normalizeEmail(loggedEmail);

    if (!folio) {
      alert("❌ No se puede asignar: falta folio en el lead.");
      return;
    }
    if (!asignado_a) {
      alert("Debes ingresar el correo/login del ejecutivo a asignar.");
      return;
    }

    try {
      setAssigningFolio(folio);

      const resp = await fetch("/api/crm/prospectos/asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ mandamos el lead completo para que el backend haga CREATE en CRM_DB
        body: JSON.stringify({
          lead: row,
          folio,
          asignado_a,
          asignado_por,
        }),
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

      alert("✅ Prospecto asignado y creado en CRM_DB.");
      await reload();
    } finally {
      setAssigningFolio(null);
    }
  }

  if (authLoading) {
    return (
      <div style={{ padding: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>CRM · Distribución</div>
        <div style={{ marginTop: 10, opacity: 0.7 }}>Cargando usuario…</div>
      </div>
    );
  }

  if (!isJefatura) {
    return (
      <div style={{ padding: 18, maxWidth: 900 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>CRM · Prospección · Distribución</div>
        <div style={{ marginTop: 10, color: "crimson" }}>
          No tienes permisos para este módulo (solo jefaturas).
        </div>
        <div style={{ marginTop: 8, opacity: 0.85 }}>
          Login detectado: <b>{loggedEmail || "—"}</b>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 18, maxWidth: 1250 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.2 }}>
            CRM · Prospección · Distribución de carga (Jefaturas)
          </div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            Jefatura: <b>{loggedEmail || "—"}</b>
            {" · "}Fuentes: <b>WEB · INOFOOD · FOOD SERVICE · REFERIDO</b>
            {" · "}Scope prefijos: <b>{allowedPrefijos.length ? allowedPrefijos.join(", ") : "—"}</b>
          </div>
          {scopeErr && (
            <div style={{ marginTop: 8, color: "crimson", fontSize: 13 }}>
              Error scope: {scopeErr} (usando fallback)
            </div>
          )}
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
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            fontWeight: 700,
          }}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por razón social / correo / división / mensaje…"
          style={{
            flex: 1,
            minWidth: 320,
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            outline: "none",
          }}
        />
      </div>

      {err && <div style={{ marginTop: 10, color: "crimson" }}>Error: {err}</div>}

      <div
        style={{
          marginTop: 14,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          overflow: "hidden",
          background: "white",
          boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.75, background: "#fafafa" }}>
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>#</th>
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Razón Social</th>
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Origen</th>
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>División</th>
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Mensaje</th>
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Monto</th>
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Asignar a</th>
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }} />
            </tr>
          </thead>
          <tbody>
            {pendientes.map((r, idx) => {
              const folio = r.folio || "";
              const busy = assigningFolio === folio;

              return (
                <tr key={`${folio}_${idx}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6", width: 40, fontWeight: 800 }}>
                    {idx + 1}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ fontWeight: 900 }}>{r.nombre_razon_social || "—"}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{r.correo || ""}</div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{r.created_at || ""}</div>
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6", fontWeight: 800 }}>
                    {r.origen_prospecto || "—"}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6", fontWeight: 800 }}>
                    {r.division || "—"}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                    <button
                      type="button"
                      onClick={() => setOpenMsg({ title: r.nombre_razon_social || "Mensaje", body: r.observacion || "—" })}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        background: "white",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      Ver mensaje
                    </button>
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                    {r.monto_proyectado ? (
                      <span style={{ fontWeight: 900 }}>{r.monto_proyectado}</span>
                    ) : (
                      <span style={{ opacity: 0.6 }}>—</span>
                    )}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                    <input
                      value={targetEmail[folio] || ""}
                      onChange={(e) => setTargetEmail((p) => ({ ...p, [folio]: e.target.value }))}
                      placeholder="ej: pia.ramirez@spartan.cl"
                      style={{
                        width: "100%",
                        minWidth: 220,
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: "1px solid #e5e7eb",
                        outline: "none",
                      }}
                    />
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                    <button
                      type="button"
                      onClick={() => asignar(r)}
                      disabled={busy}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 14,
                        border: "1px solid #111827",
                        background: busy ? "#6b7280" : "#111827",
                        color: "white",
                        cursor: busy ? "not-allowed" : "pointer",
                        fontWeight: 900,
                      }}
                    >
                      {busy ? "Asignando…" : "Asignar"}
                    </button>
                  </td>
                </tr>
              );
            })}

            {!loading && pendientes.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 14, opacity: 0.7 }}>
                  No hay prospectos pendientes para tu scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Pendientes: <b>{pendientes.length}</b>
      </div>

      {/* Modal mensaje */}
      {openMsg && (
        <div
          onClick={() => setOpenMsg(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,0.55)",
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
              width: "min(720px, 100%)",
              background: "white",
              borderRadius: 18,
              border: "1px solid #e5e7eb",
              boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{openMsg.title}</div>
              <button
                type="button"
                onClick={() => setOpenMsg(null)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Cerrar
              </button>
            </div>
            <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.45, fontSize: 14, opacity: 0.95 }}>
              {openMsg.body || "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
