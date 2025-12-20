"use client";

import React, { useEffect, useMemo, useState } from "react";

/** =========================
 *  CONFIG
 *  ========================= */
const CSV_PIA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiXecS06_-jxv0O98PUG2jMVT-8M5HpliYZZNyoG2EdrstE0ydTATYxdnih18zwGXow6hsxCtz90vi/pub?gid=0&single=true&output=csv";

/** =========================
 *  LISTAS FIJAS (tus 3 listas)
 *  ========================= */
const CRM_ETAPAS = [
  { id: 1, label: "Contactado" },
  { id: 2, label: "Reunión" },
  { id: 3, label: "Levantamiento" },
  { id: 4, label: "Propuesta" },
  { id: 5, label: "Cerrado ganado" },
  { id: 6, label: "Instalado, 1° o/c" },
  { id: 7, label: "No ganado" },
] as const;

const CRM_FECHA_CIERRE = [
  { id: 1, label: "Antes 30 días" },
  { id: 2, label: "Entre 30 y 90 días" },
  { id: 3, label: "Más de 90 días" },
] as const;

const CRM_PROB_CIERRE = [
  { id: 1, label: "Menor a 30%" },
  { id: 2, label: "Entre 30% y 50%" },
  { id: 3, label: "Entre 50 a 75%" },
  { id: 4, label: "Entre 75 a 90%" },
  { id: 5, label: "Entre mayor a 90%" },
] as const;

/** =========================
 *  TIPOS
 *  ========================= */
type FuenteDatos = "MANUAL" | "CSV_PIA";

type PiaRow = Record<string, string>;

type ProspectoForm = {
  // automáticos
  fecha: string;
  folio: string;
  ejecutivoEmail: string;

  // datos
  nombreRazonSocial: string;
  rut: string;
  telefono: string;
  correo: string;
  direccion: string;
  rubro: string;
  montoProyectado: string; // string para input, convertir al guardar

  // selects fijos
  etapaId: number;
  fechaCierreId: number;
  probCierreId: number;

  // marketing/comercial
  origenProspecto: string; // RRSS / Ferias / Referido / Web / Manual / Otro
  observacion: string;

  // trazabilidad fuente
  fuenteDatos: FuenteDatos;
  sourceId?: string;
  sourcePayload?: string;
};

/** =========================
 *  CSV PARSER seguro (comas dentro de comillas)
 *  ========================= */
function parseCsv(text: string): PiaRow[] {
  const rows: string[][] = [];
  let cur = "";
  let inQuotes = false;
  let row: string[] = [];

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };
  const pushRow = () => {
    // ignora filas totalmente vacías
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && next === '"') {
      // comillas escapadas
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
      // maneja CRLF
      if (ch === "\r" && next === "\n") i++;
      pushCell();
      pushRow();
      continue;
    }
    cur += ch;
  }
  // flush final
  pushCell();
  pushRow();

  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const data = rows.slice(1);

  return data.map((cells) => {
    const obj: PiaRow = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? "").trim();
    });
    return obj;
  });
}

/** =========================
 *  HELPERS
 *  ========================= */
function nowCL(): string {
  const d = new Date();
  // ISO local simple (sin libs)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function makeFolio(): string {
  // MVP: timestamp. Luego puedes usar contador central.
  const d = new Date();
  const year = d.getFullYear();
  return `PROS-${year}-${String(d.getTime()).slice(-6)}`;
}

function normalizeEmail(s: string) {
  return (s || "").trim().toLowerCase();
}

// genera un id estable desde datos base (para trazabilidad/duplicados MVP)
function makeSourceId(row: PiaRow) {
  const empresa =
    row["Empresa"] || row["RAZON SOCIAL"] || row["Razon Social"] || row["empresa"] || "";
  const email =
    row["Email"] || row["Correo"] || row["correo"] || row["E-mail"] || "";
  const key = `${empresa}|${normalizeEmail(email)}`.trim().toLowerCase();
  // hash simple sin crypto (MVP): replace espacios + length
  return `pia_${key.replace(/\s+/g, "_").slice(0, 60)}_${key.length}`;
}

/**
 * Mapea una fila de la BD Pía hacia campos del formulario.
 * Ajusta los nombres de columnas según tu sheet real (si difiere, lo corregimos).
 */
function mapPiaRowToForm(row: PiaRow): Partial<ProspectoForm> {
  const empresa =
    row["Empresa"] ||
    row["RAZON SOCIAL"] ||
    row["Razon Social"] ||
    row["empresa"] ||
    "";

  const email =
    row["Email"] || row["Correo"] || row["correo"] || row["E-mail"] || "";

  const nombre = row["Nombre"] || row["NOMBRE"] || "";
  const apellido = row["Apellido"] || row["APELLIDO"] || "";
  const contacto = `${nombre} ${apellido}`.trim();

  const telefono =
    row["Telefono"] || row["Teléfono"] || row["Fono"] || row["fono"] || "";

  const direccion =
    row["Direccion"] || row["Dirección"] || row["direccion"] || "";

  // si en tu sheet hay Región/País lo dejamos en observación o payload
  const rubro = row["Rubro"] || row["rubro"] || "";

  return {
    nombreRazonSocial: empresa || contacto, // si no hay empresa, cae a contacto
    correo: email,
    telefono,
    direccion,
    rubro,
  };
}

/** =========================
 *  VALIDACIÓN MVP
 *  ========================= */
function validateForm(f: ProspectoForm) {
  const errors: Record<string, string> = {};
  if (!f.nombreRazonSocial.trim()) errors.nombreRazonSocial = "Campo requerido";
  if (!normalizeEmail(f.correo)) errors.correo = "Campo requerido";
  if (normalizeEmail(f.correo) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(f.correo)))
    errors.correo = "Formato de correo inválido";
  if (!f.direccion.trim()) errors.direccion = "Campo requerido";
  if (!f.rubro.trim()) errors.rubro = "Campo requerido";
  if (!f.montoProyectado.trim()) errors.montoProyectado = "Campo requerido";
  const montoNum = Number(String(f.montoProyectado).replace(/[^\d]/g, ""));
  if (f.montoProyectado.trim() && (!Number.isFinite(montoNum) || montoNum <= 0))
    errors.montoProyectado = "Monto inválido";
  if (!f.origenProspecto.trim()) errors.origenProspecto = "Campo requerido";
  if (!f.etapaId) errors.etapaId = "Campo requerido";
  if (!f.fechaCierreId) errors.fechaCierreId = "Campo requerido";
  if (!f.probCierreId) errors.probCierreId = "Campo requerido";
  return errors;
}

/** =========================
 *  PAGE
 *  ========================= */
export default function ProspeccionPage() {
  // Simulación de login (reemplaza por tu auth real)
  const loggedEmail = "eduardo.rios@spartan.cl";

  const [fuente, setFuente] = useState<FuenteDatos>("MANUAL");

  // BD Pía
  const [piaLoading, setPiaLoading] = useState(false);
  const [piaError, setPiaError] = useState<string | null>(null);
  const [piaRows, setPiaRows] = useState<PiaRow[]>([]);
  const [search, setSearch] = useState("");

  // Form
  const [form, setForm] = useState<ProspectoForm>(() => ({
    fecha: nowCL(),
    folio: makeFolio(),
    ejecutivoEmail: loggedEmail,

    nombreRazonSocial: "",
    rut: "",
    telefono: "",
    correo: "",
    direccion: "",
    rubro: "",
    montoProyectado: "",

    etapaId: 1,
    fechaCierreId: 2,
    probCierreId: 2,

    origenProspecto: "Manual",
    observacion: "",

    fuenteDatos: "MANUAL",
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  // Al cambiar fuente, resetea lo necesario
  useEffect(() => {
    setErrors({});
    setSelectedSourceId(null);

    if (fuente === "MANUAL") {
      setForm((prev) => ({
        ...prev,
        fecha: nowCL(),
        folio: makeFolio(),
        ejecutivoEmail: loggedEmail,
        fuenteDatos: "MANUAL",
        sourceId: undefined,
        sourcePayload: undefined,
        // no borro todo por si cambió de idea; si quieres limpiar completo, lo hacemos
      }));
      return;
    }

    // CSV_PIA
    setForm((prev) => ({
      ...prev,
      fecha: nowCL(),
      folio: makeFolio(),
      ejecutivoEmail: loggedEmail,
      fuenteDatos: "CSV_PIA",
      origenProspecto: "RRSS", // puedes dejarlo vacío si prefieres
    }));

    // carga CSV si no está cargado
    if (piaRows.length === 0) {
      (async () => {
        try {
          setPiaLoading(true);
          setPiaError(null);
          const res = await fetch(CSV_PIA_URL, { cache: "no-store" });
          if (!res.ok) throw new Error(`Error al cargar CSV (${res.status})`);
          const text = await res.text();
          const rows = parseCsv(text);
          setPiaRows(rows);
        } catch (e: any) {
          setPiaError(e?.message ?? "Error desconocido");
        } finally {
          setPiaLoading(false);
        }
      })();
    }
  }, [fuente]);

  const filteredPia = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return piaRows.slice(0, 20);

    const matches = piaRows.filter((r) => {
      const empresa = (r["Empresa"] || r["Razon Social"] || r["RAZON SOCIAL"] || "").toLowerCase();
      const email = (r["Email"] || r["Correo"] || "").toLowerCase();
      const nombre = (r["Nombre"] || "").toLowerCase();
      const apellido = (r["Apellido"] || "").toLowerCase();
      return (
        empresa.includes(q) ||
        email.includes(q) ||
        nombre.includes(q) ||
        apellido.includes(q)
      );
    });

    return matches.slice(0, 20);
  }, [piaRows, search]);

  const etapaNombre = useMemo(
    () => CRM_ETAPAS.find((e) => e.id === form.etapaId)?.label ?? "",
    [form.etapaId]
  );
  const fechaCierreNombre = useMemo(
    () => CRM_FECHA_CIERRE.find((e) => e.id === form.fechaCierreId)?.label ?? "",
    [form.fechaCierreId]
  );
  const probCierreNombre = useMemo(
    () => CRM_PROB_CIERRE.find((e) => e.id === form.probCierreId)?.label ?? "",
    [form.probCierreId]
  );

  function loadFromPiaRow(row: PiaRow) {
    const patch = mapPiaRowToForm(row);
    const sid = makeSourceId(row);

    setSelectedSourceId(sid);
    setForm((prev) => ({
      ...prev,
      ...patch,
      fuenteDatos: "CSV_PIA",
      sourceId: sid,
      sourcePayload: JSON.stringify(row), // auditoría
      // recomendación: no tocar monto/rubro si no vienen
    }));
  }

  async function onSubmit() {
    const v = validateForm(form);
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    const payload = {
      ...form,
      // normalizados para guardar
      correo: normalizeEmail(form.correo),
      montoProyectado: Number(String(form.montoProyectado).replace(/[^\d]/g, "")),
      etapaNombre,
      fechaCierreNombre,
      probCierreNombre,
      estado: "PENDIENTE_ASIGNACION",
    };

    console.log("✅ payload listo para guardar:", payload);

    // Aquí conectas tu endpoint (Apps Script / API):
    // await fetch("/api/crm/prospectos", { method:"POST", headers:{...}, body: JSON.stringify(payload) })

    alert("Prospecto listo (payload en consola). Conecta el endpoint de guardado y quedará 100% operativo.");
  }

  /** =========================
   *  UI simple (puedes reemplazar por tus componentes)
   *  ========================= */
  return (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        CRM · Gestión de Prospección · Nuevo Prospecto
      </h2>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        Registro para bandeja de asignación y gestión comercial.
      </div>

      {/* Paso 1: Fuente */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Fuente de datos</h3>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label>
            <span style={{ display: "block", fontSize: 12, marginBottom: 6 }}>Seleccionar</span>
            <select
              value={fuente}
              onChange={(e) => setFuente(e.target.value as FuenteDatos)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db", minWidth: 260 }}
            >
              <option value="MANUAL">Manual</option>
              <option value="CSV_PIA">Base Google Sheets (CSV) – BD Pía</option>
            </select>
          </label>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f3f4f6" }}>
              <b>Fecha:</b> {form.fecha}
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f3f4f6" }}>
              <b>Folio:</b> {form.folio}
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f3f4f6" }}>
              <b>Ejecutivo:</b> {form.ejecutivoEmail}
            </div>
          </div>
        </div>

        {/* Panel BD */}
        {fuente === "CSV_PIA" && (
          <div style={{ marginTop: 14, borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ flex: 1, minWidth: 260 }}>
                <span style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
                  Buscar en BD (empresa, email, nombre)
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ej: vinett / @gmail / Bakery..."
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
                />
              </label>

              <div style={{ opacity: 0.8 }}>
                {piaLoading ? "Cargando BD..." : `${piaRows.length} registros cargados`}
              </div>
            </div>

            {piaError && <div style={{ color: "crimson", marginTop: 8 }}>Error: {piaError}</div>}

            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.8 }}>
                    <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Empresa</th>
                    <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Contacto</th>
                    <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Email</th>
                    <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Región</th>
                    <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPia.map((r, idx) => {
                    const empresa = r["Empresa"] || r["Razon Social"] || r["RAZON SOCIAL"] || "";
                    const nombre = r["Nombre"] || "";
                    const apellido = r["Apellido"] || "";
                    const email = r["Email"] || r["Correo"] || "";
                    const region = r["Región"] || r["Region"] || r["REGION"] || "";
                    const sid = makeSourceId(r);
                    const isSel = selectedSourceId === sid;

                    return (
                      <tr key={`${sid}_${idx}`} style={{ background: isSel ? "#eef2ff" : "transparent" }}>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{empresa}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{`${nombre} ${apellido}`.trim()}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{email}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{region}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                          <button
                            onClick={() => loadFromPiaRow(r)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #d1d5db",
                              background: "white",
                              cursor: "pointer",
                            }}
                          >
                            Cargar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!piaLoading && filteredPia.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 10, opacity: 0.7 }}>
                        Sin resultados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              Tip: Si tu BD no tiene columnas “Empresa/Email/Nombre/Apellido” con esos nombres exactos, dime los encabezados y ajusto el mapeo.
            </div>
          </div>
        )}
      </div>

      {/* Paso 2: Formulario */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Datos del Prospecto</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field
            label="Nombre o Razón Social *"
            value={form.nombreRazonSocial}
            onChange={(v) => setForm((p) => ({ ...p, nombreRazonSocial: v }))}
            error={errors.nombreRazonSocial}
          />
          <Field
            label="RUT (opcional)"
            value={form.rut}
            onChange={(v) => setForm((p) => ({ ...p, rut: v }))}
            placeholder="12.345.678-9"
          />
          <Field
            label="Teléfono (opcional)"
            value={form.telefono}
            onChange={(v) => setForm((p) => ({ ...p, telefono: v }))}
            placeholder="+56 9 xxxx xxxx"
          />
          <Field
            label="Correo *"
            value={form.correo}
            onChange={(v) => setForm((p) => ({ ...p, correo: v }))}
            error={errors.correo}
          />
          <Field
            label="Dirección *"
            value={form.direccion}
            onChange={(v) => setForm((p) => ({ ...p, direccion: v }))}
            error={errors.direccion}
          />
          <Field
            label="Rubro *"
            value={form.rubro}
            onChange={(v) => setForm((p) => ({ ...p, rubro: v }))}
            error={errors.rubro}
            placeholder="Ej: Food Service / Industrial / etc."
          />
          <Field
            label="Monto proyectado (CLP) *"
            value={form.montoProyectado}
            onChange={(v) => setForm((p) => ({ ...p, montoProyectado: v }))}
            error={errors.montoProyectado}
            placeholder="Ej: 1500000"
          />

          <SelectField
            label="Etapa *"
            value={String(form.etapaId)}
            onChange={(v) => setForm((p) => ({ ...p, etapaId: Number(v) }))}
            error={errors.etapaId}
            options={CRM_ETAPAS.map((o) => ({ value: String(o.id), label: `${o.id}: ${o.label}` }))}
          />

          <SelectField
            label="Fecha Cierre *"
            value={String(form.fechaCierreId)}
            onChange={(v) => setForm((p) => ({ ...p, fechaCierreId: Number(v) }))}
            error={errors.fechaCierreId}
            options={CRM_FECHA_CIERRE.map((o) => ({ value: String(o.id), label: `${o.id}: ${o.label}` }))}
          />

          <SelectField
            label="Probabilidad Cierre *"
            value={String(form.probCierreId)}
            onChange={(v) => setForm((p) => ({ ...p, probCierreId: Number(v) }))}
            error={errors.probCierreId}
            options={CRM_PROB_CIERRE.map((o) => ({ value: String(o.id), label: `${o.id}: ${o.label}` }))}
          />

          <SelectField
            label="Origen del prospecto (comercial) *"
            value={form.origenProspecto}
            onChange={(v) => setForm((p) => ({ ...p, origenProspecto: v }))}
            error={errors.origenProspecto}
            options={[
              { value: "RRSS", label: "RRSS" },
              { value: "Ferias", label: "Ferias" },
              { value: "Referido", label: "Referido" },
              { value: "Web", label: "Web" },
              { value: "Manual", label: "Manual" },
              { value: "Otro", label: "Otro" },
            ]}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block" }}>
            <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>Observación (opcional)</div>
            <textarea
              value={form.observacion}
              onChange={(e) => setForm((p) => ({ ...p, observacion: e.target.value }))}
              rows={4}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button
            onClick={() => {
              setForm((p) => ({
                ...p,
                fecha: nowCL(),
                folio: makeFolio(),
                nombreRazonSocial: "",
                rut: "",
                telefono: "",
                correo: "",
                direccion: "",
                rubro: "",
                montoProyectado: "",
                observacion: "",
                sourceId: undefined,
                sourcePayload: undefined,
              }));
              setErrors({});
              setSelectedSourceId(null);
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "white",
              cursor: "pointer",
            }}
          >
            Limpiar
          </button>

          <button
            onClick={onSubmit}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              cursor: "pointer",
            }}
          >
            Guardar (pendiente asignación)
          </button>
        </div>
      </div>
    </div>
  );
}

/** =========================
 *  UI helpers simples
 *  ========================= */
function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>{props.label}</div>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 10,
          border: `1px solid ${props.error ? "crimson" : "#d1d5db"}`,
        }}
      />
      {props.error && <div style={{ color: "crimson", fontSize: 12, marginTop: 6 }}>{props.error}</div>}
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>{props.label}</div>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 10,
          border: `1px solid ${props.error ? "crimson" : "#d1d5db"}`,
          background: "white",
        }}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {props.error && <div style={{ color: "crimson", fontSize: 12, marginTop: 6 }}>{props.error}</div>}
    </label>
  );
}
