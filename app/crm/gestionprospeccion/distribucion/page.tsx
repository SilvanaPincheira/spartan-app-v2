"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/**
 * Spreadsheet de “Bases de datos” (4 hojas)
 * CSV vía gviz:
 * https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv&gid=<GID>
 */
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

/** Jefaturas que asignan */
const JEFATURAS = new Set(
  [
    "claudia.borquez@spartan.cl",
    "jorge.beltran@spartan.cl",
    "alberto.damm@spartan.cl",
    "nelson.norambuena@spartan.cl",
  ].map((x) => x.trim().toLowerCase())
);

type Row = Record<string, string>;
type JefaturaScopeRow = { email: string; prefijo: string };

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
  const s = String(raw || "");
  // soporta $ 1.234.567, 1,234,567, etc.
  const cleaned = s.replace(/[^\d]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * LeadKey temporal SOLO para UI (no es folio real CRM_DB)
 * Apps Script generará el folio correlativo real al insertar en CRM_DB.
 */
function makeLeadKey(origen: string, razon: string, mail: string, fecha: string) {
  const base = `${origen}|${razon}|${mail}|${fecha}`
    .toLowerCase()
    .replace(/\s+/g, "_")
    .slice(0, 120);
  // pseudo-id estable
  return `LEAD-${origen.replace(/\s+/g, "")}-${base.length.toString(36)}-${base.slice(0, 36)}`;
}

/**
 * Normaliza fila desde hojas externas a “estructura CRM”
 * Cabeceras actuales (WEB): Razon Social, contacto, Mail, Teléfono, Industria, Mensaje, Fecha Contacto, division, Gestion, Etapa, Monto
 */
function normalizeLeadRow(origen: string, r: Row): Row {
  const razon = pick(r, "razon_social", "razon", "empresa", "nombre_razon_social");
  const contacto = pick(r, "contacto", "nombre_contacto");
  const mail = pick(r, "mail", "correo", "email");
  const telefono = pick(r, "telefono", "teléfono", "phone");
  const industria = pick(r, "industria", "rubro");
  const mensaje = pick(r, "mensaje", "observacion", "comentario");
  const fechaContacto = pick(r, "fecha_contacto", "fecha", "created_at");
  const division = pick(r, "division", "prefijo"); // IN/FB/etc
  const etapa = pick(r, "etapa", "etapa_nombre");
  const montoRaw = pick(r, "monto", "monto_proyectado");

  const lead_key = makeLeadKey(origen, razon, mail, fechaContacto);

  return {
    // clave temporal UI
    lead_key,

    // datos que insertaremos en CRM_DB
    created_at: fechaContacto,
    origen_prospecto: origen,

    nombre_razon_social: razon,
    correo: mail,
    contacto,
    telefono,

    rubro: industria,
    observacion: mensaje,

    division, // IN/FB/HC/IND (según tu scope)

    etapa_nombre: etapa,
    monto_proyectado: String(toMontoNumber(montoRaw) || ""),

    // distribución: se muestra como pendiente (solo UI)
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
  const [assigningKey, setAssigningKey] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState<Record<string, string>>({});

  // Prefijos permitidos para esta jefatura (desde Supabase)
  const [allowedPrefijos, setAllowedPrefijos] = useState<string[]>([]);
  const [scopeErr, setScopeErr] = useState<string | null>(null);

  // modal ver mensaje
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgRow, setMsgRow] = useState<Row | null>(null);

  const isJefatura = useMemo(
    () => JEFATURAS.has(normalizeEmail(loggedEmail)),
    [loggedEmail]
  );

  /** 1) Auth */
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

  /** 2) Scope desde Supabase (email + prefijo) */
  useEffect(() => {
    if (authLoading) return;
    if (!loggedEmail) return;

    (async () => {
      try {
        setScopeErr(null);

        const { data, error } = await supabase
          .from("gerencia_prefijos")
          .select("email,prefijo")
          .eq("email", normalizeEmail(loggedEmail));

        if (error) throw error;

        const prefijos =
          (data as JefaturaScopeRow[] | null)?.map((r) => normUpper(r.prefijo)) ?? [];
        setAllowedPrefijos(prefijos);
      } catch (e: any) {
        setAllowedPrefijos([]);
        setScopeErr(e?.message || "Error leyendo prefijos (scope) en Supabase");
      }
    })();
  }, [authLoading, loggedEmail, supabase]);

  const allowedPrefijosSet = useMemo(() => {
    return new Set(allowedPrefijos.map((p) => normUpper(p)));
  }, [allowedPrefijos]);

  /** 3) Cargar hojas */
  async function reload() {
    try {
      setLoading(true);
      setErr(null);

      const results = await Promise.all(
        ORIGIN_SOURCES.map(async (src) => {
          const url = sheetCsvUrl(src.gid);
          const res = await fetch(url, { cache: "no-store" });

          if (!res.ok) {
            throw new Error(
              `No se pudo leer ${src.origen} (gid=${src.gid}) status=${res.status}`
            );
          }

          const text = await res.text();

          if (text.trim().startsWith("<")) {
            throw new Error(
              `La hoja ${src.origen} no está publicada como CSV (Google devolvió HTML). ` +
                `En Google Sheets: Archivo → Publicar en la web.`
            );
          }

          const parsed = parseCsv(text);
          return parsed.map((r) => normalizeLeadRow(src.origen, r));
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

  /** 4) Pendientes filtrados por prefijo */
  const pendientes = useMemo(() => {
    const query = q.trim().toLowerCase();

    const base = rows.filter((r) => {
      const estado = normUpper(r.estado || "");
      if (estado !== "PENDIENTE_ASIGNACION") return false;

      const pref = normUpper(r.division || r.prefijo || "");
      if (allowedPrefijosSet.size > 0 && !allowedPrefijosSet.has(pref)) return false;

      return true;
    });

    if (!query) return base;

    return base.filter((r) => {
      const haystack = [
        r.lead_key,
        r.nombre_razon_social,
        r.correo,
        r.origen_prospecto,
        r.division,
        r.etapa_nombre,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [rows, q, allowedPrefijosSet]);

  /** 5) ASIGNAR = CREAR EN CRM_DB + ASIGNAR */
  async function asignar(lead: Row) {
    const lead_key = String(lead.lead_key || "").trim();
    const asignado_a = normalizeEmail(targetEmail[lead_key] || "");
    const asignado_por = normalizeEmail(loggedEmail);

    if (!asignado_a) {
      alert("Debes ingresar el correo/login del ejecutivo a asignar.");
      return;
    }

    try {
      setAssigningKey(lead_key);

      const payload = {
        lead_key,
        origen: lead.origen_prospecto || "",

        // datos del lead
        nombre_razon_social: lead.nombre_razon_social || "",
        correo: lead.correo || "",
        telefono: lead.telefono || "",
        contacto: lead.contacto || "",
        rubro: lead.rubro || "",
        monto_proyectado: lead.monto_proyectado || "",
        etapa_nombre: lead.etapa_nombre || "",
        observacion: lead.observacion || "",

        // scope
        division: lead.division || "",

        // asignación
        asignado_a,
        asignado_por,
      };

      const resp = await fetch("/api/crm/prospectos/asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, error: "Respuesta no JSON", raw: text.slice(0, 300) };
      }

      if (!resp.ok || !data?.ok) {
        alert(
          `❌ Error asignando (crear en CRM_DB):\nstatus=${resp.status}\n${JSON.stringify(
            data,
            null,
            2
          )}`
        );
        return;
      }

      // Apps Script debería devolver folio real generado en CRM_DB
      alert(`✅ Prospecto creado en CRM_DB y asignado.\nFolio: ${data?.folio || "—"}`);

      // recargar lista leads origen (la jefatura sigue viendo leads externos)
      await reload();
    } finally {
      setAssigningKey(null);
    }
  }

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>CRM · Distribución</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  if (!isJefatura) {
    return (
      <div style={{ padding: 16, maxWidth: 900 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>
          CRM · Prospección · Distribución
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

  return (
    <div style={{ padding: 16, maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
          CRM · Prospección · Distribución de carga (Jefaturas)
        </h2>
        <div style={{ opacity: 0.75 }}>
          Jefatura: <b>{loggedEmail || "—"}</b>
        </div>
      </div>

      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
        Fuentes: <b>WEB · INOFOOD · FOOD SERVICE · REFERIDO</b>
        {" · "}
        Scope prefijos: <b>{allowedPrefijos.length ? allowedPrefijos.join(", ") : "—"}</b>
      </div>

      {scopeErr && <div style={{ marginTop: 8, color: "crimson" }}>Error scope: {scopeErr}</div>}

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar pendientes por lead_key / razón social / correo…"
          style={{
            flex: 1,
            minWidth: 260,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #d1d5db",
          }}
        />
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
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>LeadKey</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Razón Social</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Origen</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>División</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Mensaje</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Monto</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Asignar a</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}></th>
            </tr>
          </thead>

          <tbody>
            {pendientes.map((r, i) => {
              const leadKey = String(r.lead_key || "");
              const busy = assigningKey === leadKey;
              const hasMsg = String(r.observacion || "").trim().length > 0;

              return (
                <tr key={`${leadKey}_${i}`}>
                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    <b style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {leadKey || "—"}
                    </b>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{r.created_at || ""}</div>
                  </td>

                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {r.nombre_razon_social || "—"}
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{r.correo || ""}</div>
                  </td>

                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {r.origen_prospecto || "—"}
                  </td>

                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {r.division || "—"}
                  </td>

                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {hasMsg ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMsgRow(r);
                          setMsgOpen(true);
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid #d1d5db",
                          background: "white",
                          cursor: "pointer",
                        }}
                      >
                        Ver mensaje
                      </button>
                    ) : (
                      <span style={{ opacity: 0.6 }}>—</span>
                    )}
                  </td>

                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {r.monto_proyectado || "—"}
                  </td>

                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    <input
                      value={targetEmail[leadKey] || ""}
                      onChange={(e) => setTargetEmail((p) => ({ ...p, [leadKey]: e.target.value }))}
                      placeholder="ej: pia.ramirez@spartan.cl"
                      style={{
                        width: "100%",
                        minWidth: 240,
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                      }}
                    />
                  </td>

                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    <button
                      type="button"
                      onClick={() => asignar(r)}
                      disabled={busy}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #111827",
                        background: busy ? "#6b7280" : "#111827",
                        color: "white",
                        cursor: busy ? "not-allowed" : "pointer",
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
                <td colSpan={8} style={{ padding: 12, opacity: 0.7 }}>
                  No hay prospectos pendientes de asignación para tu scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Pendientes: <b>{pendientes.length}</b>
      </div>

      {/* Modal Ver Mensaje */}
      {msgOpen && (
        <div
          onClick={() => setMsgOpen(false)}
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
              width: "min(720px, 100%)",
              background: "white",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {msgRow?.nombre_razon_social || "Mensaje"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {msgRow?.correo || ""} · {msgRow?.origen_prospecto || ""} · {msgRow?.division || ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMsgOpen(false)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>

            <div style={{ marginTop: 12, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
              {String(msgRow?.observacion || "").trim() || "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
