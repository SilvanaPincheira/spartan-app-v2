"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/** =========================
 *  CONSTANTES
 *  ========================= */
const CRM_DIVISIONES = [
  { value: "INDUSTRIAL", label: "Industrial" },
  { value: "FOOD", label: "Food" },
  { value: "INSTITUCIONAL", label: "Institucional" },
  { value: "HC", label: "HC" },
] as const;

type Division = (typeof CRM_DIVISIONES)[number]["value"];

/** =========================
 *  TIPOS
 *  ========================= */
type RrssRow = Record<string, any> & {
  source_id?: string; // ID único del lead (recomendado)
  created_at?: string;

  nombre_razon_social?: string;
  nombre?: string;
  empresa?: string;

  correo?: string;
  email?: string;
  telefono?: string;

  mensaje?: string;
  observacion?: string;

  canal?: string; // IG / FB / Web / etc
  origen?: string; // RRSS / Web

  estado_lead?: string; // NUEVO / CONTACTADO / etc
  imported?: boolean; // si tu AppsScript lo guarda
  imported_at?: string;
  imported_by?: string;
  crm_folio?: string; // folio creado en CRM (si ya se importó)
};

/** =========================
 *  HELPERS
 *  ========================= */
function asStr(v: any) {
  return v == null ? "" : String(v);
}
function norm(v: any) {
  return asStr(v).trim().toLowerCase();
}
function normalizeEmail(s: string) {
  return (s || "").trim().toLowerCase();
}
function toMontoNumber(raw: string) {
  const n = Number(String(raw || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function makeFolio(): string {
  const d = new Date();
  const year = d.getFullYear();
  return `PROS-${year}-${String(d.getTime()).slice(-6)}`;
}
function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function pickSourceId(r: RrssRow, idx: number) {
  return asStr(r.source_id || r.id || r.lead_id || `rrss_${idx}`).trim();
}
function pickNombre(r: RrssRow) {
  return (
    asStr(r.nombre_razon_social).trim() ||
    asStr(r.empresa).trim() ||
    asStr(r.nombre).trim() ||
    "(sin nombre)"
  );
}
function pickCorreo(r: RrssRow) {
  return asStr(r.correo || r.email).trim();
}
function pickTelefono(r: RrssRow) {
  return asStr(r.telefono).trim();
}
function pickMensaje(r: RrssRow) {
  return asStr(r.mensaje || r.observacion).trim();
}
function pickOrigenComercial(r: RrssRow) {
  // Para CRM: RRSS o Web (si viene)
  const origen = norm(r.origen);
  const canal = norm(r.canal);
  if (origen.includes("web") || canal.includes("web")) return "Web";
  return "RRSS";
}
function pickEstadoLead(r: RrssRow) {
  return asStr(r.estado_lead).trim() || "NUEVO";
}
function isImported(r: RrssRow) {
  // soporta varias formas
  if (r.imported === true) return true;
  if (asStr(r.crm_folio).trim()) return true;
  const st = norm(r.estado_lead);
  if (st === "importado") return true;
  return false;
}

/** =========================
 *  PAGE
 *  ========================= */
export default function BandejaRrssPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

  // auth
  const [authLoading, setAuthLoading] = useState(true);
  const [loggedEmail, setLoggedEmail] = useState("");

  // data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RrssRow[]>([]);
  const [q, setQ] = useState("");

  // import
  const [importingSourceId, setImportingSourceId] = useState<string | null>(null);

  // filtros / defaults
  const [defaultDivision, setDefaultDivision] = useState<Division>("FOOD");
  const [showImported, setShowImported] = useState(false);

  /** 1) Usuario */
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

  /** 2) LIST desde /api/crm/rrss (POST action=LIST) */
  async function reload() {
    try {
      setLoading(true);
      setError(null);

      const resp = await fetch("/api/crm/rrss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "LIST",
          // opcionales si tu AppsScript los soporta:
          // estado_lead: "NUEVO",
          // limit: 200,
          // offset: 0,
        }),
      });

      const text = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, error: "Respuesta no JSON", raw: text.slice(0, 500) };
      }

      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || `RRSS LIST error (${resp.status})`);
      }

      const list = (data.rows || data.data || []) as any[];
      setRows(list as RrssRow[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 3) Filtrado */
  const filtered = useMemo(() => {
    const s = norm(q);
    if (!s) return rows;

    return rows.filter((r) => {
      const t =
        norm(pickNombre(r)) +
        " " +
        norm(pickCorreo(r)) +
        " " +
        norm(pickTelefono(r)) +
        " " +
        norm(pickMensaje(r)) +
        " " +
        norm(r.canal) +
        " " +
        norm(r.origen) +
        " " +
        norm(r.estado_lead) +
        " " +
        norm(r.crm_folio);
      return t.includes(s);
    });
  }, [rows, q]);

  const pending = useMemo(() => filtered.filter((r) => !isImported(r)), [filtered]);
  const imported = useMemo(() => filtered.filter((r) => isImported(r)), [filtered]);

  const visible = showImported ? imported : pending;

  /** 4) Importar: crea prospecto en CRM_DB + MARK_IMPORTED en RRSS_DB */
  async function importarAcrm(lead: RrssRow, idx: number) {
    const source_id = pickSourceId(lead, idx);
    if (!source_id) {
      alert("❌ Este lead no tiene source_id. Debes asignarle uno en RRSS_DB.");
      return;
    }

    try {
      setImportingSourceId(source_id);

      // 4.1 crear prospecto en CRM_DB (tu API ya existe)
      const folio = makeFolio();

      // Ojo: estos campos deben calzar con tu Apps Script de prospectos
      const payloadProspecto = {
        created_at: new Date().toISOString(),
        folio,
        fuente: "RRSS", // ✅ queda registrado que viene de RRSS
        source_id,

        nombre_razon_social: pickNombre(lead),
        rut: "",
        telefono: pickTelefono(lead),
        correo: normalizeEmail(pickCorreo(lead)),
        direccion: asStr(lead.direccion).trim() || "",
        rubro: asStr(lead.rubro).trim() || "",

        monto_proyectado: toMontoNumber(asStr(lead.monto_proyectado || "")) || 100000, // si no viene, deja uno mínimo o 0
        division: defaultDivision,

        etapa_id: 1,
        etapa_nombre: "Contactado",
        fecha_cierre_id: 2,
        fecha_cierre_nombre: "Entre 30 y 90 días",
        prob_cierre_id: 2,
        prob_cierre_nombre: "Entre 30% y 50%",

        origen_prospecto: pickOrigenComercial(lead), // RRSS o Web
        observacion: pickMensaje(lead),

        ejecutivo_email: "", // ✅ aquí NO lo asignas; queda pendiente de asignación por jefatura
        estado: "PENDIENTE_ASIGNACION",
        asignado_a: "",
        asignado_por: "",
        asignado_at: "",
      };

      // Validación mínima para no romper tu /api/crm/prospectos (requiere correo o dirección, etc)
      if (!payloadProspecto.correo && !payloadProspecto.telefono) {
        alert("❌ El lead no tiene correo ni teléfono. Completa al menos uno en RRSS_DB.");
        return;
      }
      if (!payloadProspecto.direccion) {
        // tu API prospectos exige dirección en tu primera fase
        // puedes cambiar esto si decides que RRSS permita vacío
        alert("❌ Falta dirección. En RRSS_DB debes traer dirección o relajar validación en prospectos.");
        return;
      }
      if (!payloadProspecto.rubro) {
        alert("❌ Falta rubro. En RRSS_DB debes traer rubro o relajar validación en prospectos.");
        return;
      }

      const respPros = await fetch("/api/crm/prospectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadProspecto),
      });

      const textPros = await respPros.text();
      let dataPros: any = null;
      try {
        dataPros = JSON.parse(textPros);
      } catch {
        dataPros = { ok: false, error: "Respuesta no JSON", raw: textPros.slice(0, 500) };
      }

      if (!respPros.ok || !dataPros?.ok) {
        alert(`❌ Error creando prospecto:\nstatus=${respPros.status}\n${JSON.stringify(dataPros, null, 2)}`);
        return;
      }

      // 4.2 marcar importado en RRSS_DB (tu action MARK_IMPORTED)
      const respMark = await fetch("/api/crm/rrss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "MARK_IMPORTED",
          source_id,
          crm_folio: folio,
          // opcional si lo soporta tu AppsScript:
          imported_by: loggedEmail || "",
        }),
      });

      const textMark = await respMark.text();
      let dataMark: any = null;
      try {
        dataMark = JSON.parse(textMark);
      } catch {
        dataMark = { ok: false, error: "Respuesta no JSON", raw: textMark.slice(0, 500) };
      }

      if (!respMark.ok || !dataMark?.ok) {
        alert(
          `⚠️ Prospecto creado, pero NO se pudo marcar importado en RRSS_DB.\n` +
            `status=${respMark.status}\n${JSON.stringify(dataMark, null, 2)}`
        );
        // igual refrescamos; tu CRM ya quedó bien
        await reload();
        return;
      }

      alert("✅ Importado: creado en CRM_DB y marcado como importado en RRSS_DB.");
      await reload();
    } finally {
      setImportingSourceId(null);
    }
  }

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>CRM · Bandeja RRSS</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando usuario…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        CRM · Bandeja RRSS (Leads externos)
      </h2>
      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        Usuario: <b>{loggedEmail || "—"}</b>
      </div>

      {/* Barra */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre / correo / teléfono / mensaje / canal / estado..."
          style={{
            flex: 1,
            minWidth: 320,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #d1d5db",
          }}
        />

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>División por defecto al importar:</span>
          <select
            value={defaultDivision}
            onChange={(e) => setDefaultDivision(e.target.value as Division)}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "white",
            }}
          >
            {CRM_DIVISIONES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={showImported}
            onChange={(e) => setShowImported(e.target.checked)}
          />
          <span style={{ fontSize: 12, opacity: 0.85 }}>
            Ver importados ({imported.length})
          </span>
        </label>

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
          {loading ? "Actualizando..." : "Actualizar"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.85 }}>
          Pendientes: <b>{pending.length}</b>
        </div>
      </div>

      {error && (
        <div
          style={{
            border: "1px solid #ef4444",
            background: "#fef2f2",
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <b style={{ color: "#b91c1c" }}>Error:</b> {error}
        </div>
      )}

      {/* Tabla */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
          <b>{showImported ? "Importados" : "Pendientes por importar"}</b>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            {showImported
              ? "Leads ya importados a CRM_DB (según RRSS_DB)."
              : "Estos leads vienen desde RRSS/Web. Importar = crear prospecto en CRM_DB y marcar importado."}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.85 }}>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Fecha</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Nombre / Empresa</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Correo</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Teléfono</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Canal</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Estado lead</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>CRM folio</th>
                <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }} />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 12, opacity: 0.8 }}>
                    Cargando…
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 12, opacity: 0.8 }}>
                    Sin resultados.
                  </td>
                </tr>
              ) : (
                visible.map((r, idx) => {
                  const sid = pickSourceId(r, idx);
                  const busy = importingSourceId === sid;
                  const importedFlag = isImported(r);

                  return (
                    <tr key={`${sid}_${idx}`}>
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        {fmtDate(r.created_at)}
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                        <b>{pickNombre(r)}</b>
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                          {pickMensaje(r) ? pickMensaje(r).slice(0, 120) + (pickMensaje(r).length > 120 ? "…" : "") : "—"}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                          source_id: <code>{sid}</code>
                        </div>
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>{pickCorreo(r) || "—"}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>{pickTelefono(r) || "—"}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>{asStr(r.canal || r.origen || "RRSS")}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>{pickEstadoLead(r)}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                        {asStr(r.crm_folio).trim() || "—"}
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        {!importedFlag ? (
                          <button
                            type="button"
                            onClick={() => {
                              const ok = window.confirm(
                                `¿Importar este lead a CRM?\n\n` +
                                  `Nombre: ${pickNombre(r)}\n` +
                                  `Correo: ${pickCorreo(r) || "—"}\n` +
                                  `Tel: ${pickTelefono(r) || "—"}\n` +
                                  `División: ${defaultDivision}\n\n` +
                                  `IMPORTANTE: para tu fase 1, el lead debe traer dirección y rubro.`
                              );
                              if (!ok) return;
                              importarAcrm(r, idx);
                            }}
                            disabled={!!importingSourceId}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #111827",
                              background: busy ? "#6b7280" : "#111827",
                              color: "white",
                              cursor: importingSourceId ? "not-allowed" : "pointer",
                            }}
                          >
                            {busy ? "Importando..." : "Importar a CRM"}
                          </button>
                        ) : (
                          <div style={{ fontSize: 12, opacity: 0.8 }}>
                            ✅ Importado
                            {r.imported_at && (
                              <>
                                <br />
                                <span style={{ fontSize: 11, opacity: 0.7 }}>{fmtDate(r.imported_at)}</span>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota fase 1 */}
      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
        Nota: En esta fase, tu endpoint de prospectos exige <b>dirección</b> y <b>rubro</b>. Si RRSS no los trae,
        puedes (A) agregarlos en RRSS_DB como columnas, (B) poner defaults en Apps Script RRSS, o (C) relajar validación
        en /api/crm/prospectos.
      </div>
    </div>
  );
}
