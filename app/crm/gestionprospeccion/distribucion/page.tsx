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
  const base = `${origen}|${razon}|${mail}|${fecha}`.toLowerCase().replace(/\s+/g, "_");
  const hash = base.length.toString(36) + "_" + base.slice(0, 40);
  return `LEAD-${origen.replace(/\s+/g, "")}-${hash}`;
}

/**
 * Normaliza fila desde tus hojas (WEB/INOFOOD/FOOD SERVICE/REFERIDO)
 * Cabeceras esperadas (normalizadas):
 * razon_social, contacto, mail, telefono, industria, mensaje, fecha_contacto, division, etapa, monto
 */
function normalizeLeadRow(origen: string, r: Row): Row {
  const razon = pick(r, "razon_social", "razon", "empresa", "nombre_razon_social", "nombre_o_razon_social");
  const contacto = pick(r, "contacto", "nombre_contacto");
  const mail = pick(r, "mail", "correo", "email", "e_mail");
  const telefono = pick(r, "telefono", "teléfono", "phone");
  const industria = pick(r, "industria", "rubro");
  const mensaje = pick(r, "mensaje", "observacion", "comentario");
  const fechaContacto = pick(r, "fecha_contacto", "fecha", "created_at");
  const division = pick(r, "division", "prefijo"); // 👈 en tus hojas viene "division" (IN/FB/etc)
  const etapa = pick(r, "etapa", "etapa_nombre");
  const montoRaw = pick(r, "monto", "monto_proyectado");

  const folio = pick(r, "folio") || makeFolio(origen, razon, mail, fechaContacto);

  return {
    // claves “CRM-like” para la tabla
    folio,
    created_at: fechaContacto,
    origen_prospecto: origen,

    nombre_razon_social: razon,
    correo: mail,
    contacto,
    telefono,

    rubro: industria,
    observacion: mensaje,

    division, // IN / FB / HC / IND

    etapa_nombre: etapa,
    monto_proyectado: String(toMontoNumber(montoRaw) || montoRaw || ""),

    // distribución: siempre pendiente
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

  // Prefijos permitidos para esta jefatura (desde Supabase)
  const [allowedPrefijos, setAllowedPrefijos] = useState<string[]>([]);
  const [scopeErr, setScopeErr] = useState<string | null>(null);

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

  /** 3) Set de prefijos permitidos */
  const allowedPrefijosSet = useMemo(() => {
    return new Set(allowedPrefijos.map((p) => normUpper(p)));
  }, [allowedPrefijos]);

  /** 4) Cargar 4 hojas y normalizar */
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

          // Si Google devuelve HTML, la hoja NO está publicada como CSV
          if (text.trim().startsWith("<")) {
            throw new Error(
              `La hoja ${src.origen} no está publicada para CSV (Google devolvió HTML). ` +
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

  /** 5) Pendientes filtrados */
  const pendientes = useMemo(() => {
    const query = q.trim().toLowerCase();

    const base = rows.filter((r) => {
      // siempre pendiente (pero lo dejamos por seguridad)
      const estado = normUpper(r.estado || "");
      if (estado !== "PENDIENTE_ASIGNACION") return false;

      // no asignados
      const asignadoA = normLower(r.asignado_a || "");
      if (asignadoA) return false;

      // ✅ FILTRO POR PREFIJO/DIVISIÓN
      // En tus hojas la columna se llama "division" y trae IN/FB/HC/IND
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
        r.etapa_nombre,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [rows, q, allowedPrefijosSet]);

  async function asignar(folio: string) {
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
        body: JSON.stringify({ folio, asignado_a, asignado_por }),
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

      alert("✅ Prospecto asignado.");
      await reload();
    } finally {
      setAssigningFolio(null);
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
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>CRM · Prospección · Distribución</h2>
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
          placeholder="Buscar pendientes (WEB/INOFOOD/FOOD SERVICE/REFERIDO) por folio / razón social / correo…"
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
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Folio</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Razón Social</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Origen</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>División/Prefijo</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Etapa</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Monto</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Asignar a (email/login)</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}></th>
            </tr>
          </thead>
          <tbody>
            {pendientes.map((r, i) => {
              const folio = r.folio || "";
              const busy = assigningFolio === folio;

              return (
                <tr key={`${folio}_${i}`}>
                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    <b>{folio || "—"}</b>
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
                    {r.etapa_nombre || "—"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    {r.monto_proyectado || "—"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                    <input
                      value={targetEmail[folio] || ""}
                      onChange={(e) => setTargetEmail((p) => ({ ...p, [folio]: e.target.value }))}
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
                      onClick={() => asignar(folio)}
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
    </div>
  );
}
