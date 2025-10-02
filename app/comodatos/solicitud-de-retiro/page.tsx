// app/gestion/comodatos/solicitud-retiro/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { generarPdfSolicitudRetiro } from "@/lib/utils/pdf-solicitud-retiro";


/* ============================================================================
   HELPERS
   ============================================================================ */
function num(x: any) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
function money(n: number) {
  return (n || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}
function sanitizeRut(r: string) {
  return (r || "").toString().replace(/[^0-9Kk]+/g, "").toUpperCase();
}
function formatRut(rSan: string) {
  if (!rSan) return "";
  const cuerpo = rSan.slice(0, -1);
  const dv = rSan.slice(-1);
  return `${cuerpo}-${dv}`;
}
function extractRutFromLabel(label: string) {
  // admite "12.345.678-9 — NOMBRE"
  const m = label.match(/(\d{1,3}(?:\.\d{3})*|\d{7,9})-[0-9Kk]/);
  return sanitizeRut(m ? m[0] : label);
}
function formatISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseDateLike(d: any): Date | null {
  if (!d && d !== 0) return null;
  if (d instanceof Date) return d;
  if (typeof d === "number") {
    // excel serial
    const base = new Date(1899, 11, 30).getTime();
    return new Date(base + d * 86400000);
  }
  const s = String(d).trim();
  // yyyy-mm(-dd)
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (m) return new Date(+m[1], +m[2] - 1, +(m[3] || 1));
  // dd/mm/yyyy
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  // yyyymm o yyyy/mm
  m = s.match(/^(\d{4})(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, 1);
  m = s.match(/^(\d{4})[\/-](\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, 1);
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}
function normalizeGoogleSheetUrl(url: string) {
  const m = (url || "").match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const id = m ? m[1] : "";
  let gid = "0";
  const g = (url || "").match(/[?&#]gid=([0-9]+)/);
  if (g) gid = g[1];
  return { id, gid };
}
function parseCsv(text: string): Record<string, any>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const pushCell = () => (row.push(cell), (cell = ""));
  const pushRow = () => {
    if (row.length) rows.push(row);
    row = [];
  };
  const s = (text || "").replace(/\r/g, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") pushCell();
      else if (ch === "\n") {
        pushCell();
        pushRow();
      } else cell += ch;
    }
  }
  if (cell.length || row.length) {
    pushCell();
    pushRow();
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, any>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c === "")) continue;
    const obj: Record<string, any> = {};
    headers.forEach((h, j) => (obj[h] = (r[j] ?? "").trim()));
    out.push(obj);
  }
  return out;
}
async function fetchCsv(spreadsheetId: string, gid: string | number) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

/* ============================================================================
   TIPOS
   ============================================================================ */
type SolicitudMotivo = "Cambio de equipo" | "Retiro total" | "Mal estado" | "Otro";
type Cliente = {
  rut: string;
  codigo: string;
  nombre: string;
  direccion: string;
  ejecutivo: string;
};
type SucursalOpt = { code: string; direccion: string; ejecutivo: string; name: string };
type Comodato = {
  rowId: string; // clave única por fila histórica
  codigo: string;
  descripcion: string;
  valor: number;
  fechaInstalacion: string; // ISO yyyy-mm-dd
};
type RowRetiro = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  valor: number;
  valorTotal: number;
};

/* ============================================================================
   CONFIG
   ============================================================================ */
const FUENTE_COMODATOS_URL =
  "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/edit?gid=551810728#gid=551810728";
const FUENTE_SN_URL =
  "https://docs.google.com/spreadsheets/d/1kF0INEtwYDXhQCBPTVhU8NQI2URKoi99Hs43DTSO02I/edit?gid=161671364#gid=161671364";

const DESTINO_SOLICITUDES_URL =
  "https://docs.google.com/spreadsheets/d/1sXKhTzc0XB4ynvEubL5pxlZePAeuZOaYrQGfJaXHZZ4/edit?gid=0#gid=0";

const API_MAIL = "/api/solicitud-retiro-mail";
const API_SAVE = "/api/solicitud-retiro-save";

/* ============================================================================
   PÁGINA
   ============================================================================ */
export default function SolicitudRetiroPage() {
  /* ----- Form meta ----- */
  const [fecha, setFecha] = useState(formatISODate(new Date()));
  const [fechaRetiro, setFechaRetiro] = useState(formatISODate(new Date()));
  const [motivo, setMotivo] = useState<SolicitudMotivo>("Cambio de equipo");
  const [contacto, setContacto] = useState("");
  const [comentarios, setComentarios] = useState("");

  /* ----- Cliente ----- */
  const [rutInput, setRutInput] = useState("");
  const [rutOptions, setRutOptions] = useState<{ rut: string; label: string }[]>(
    []
  );
  const [cliente, setCliente] = useState<Cliente>({
    rut: "",
    codigo: "",
    nombre: "",
    direccion: "",
    ejecutivo: "",
  });
  const [sucursales, setSucursales] = useState<SucursalOpt[]>([]);

  /* ----- Históricos / selección / retiro ----- */
  const [comodatos, setComodatos] = useState<Comodato[]>([]);
  const [loadingComodatos, setLoadingComodatos] = useState(false);
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({}); // rowId -> bool
  const [retiro, setRetiro] = useState<RowRetiro[]>([]);
  const subtotal = useMemo(
    () => retiro.reduce((acc, r) => acc + (r.valorTotal || 0), 0),
    [retiro]
  );

  const [errorMsg, setErrorMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  /* ================== CARGA: Maestro SN para datalist ================== */
  useEffect(() => {
    (async () => {
      try {
        const { id, gid } = normalizeGoogleSheetUrl(FUENTE_SN_URL);
        if (!id) return;
        const rows = await fetchCsv(id, gid);
        const map = new Map<string, string>(); // rut -> nombre (último visto)
        for (const r of rows) {
          const rutSan = sanitizeRut(String(r["RUT"] ?? r["Rut"] ?? r.rut ?? ""));
          if (!rutSan) continue;
          const name = String(r["CardName"] ?? r.CardName ?? "").trim();
          if (name) map.set(rutSan, name);
        }
        const opts = Array.from(map.entries())
          .map(([rut, name]) => ({ rut, label: `${formatRut(rut)} — ${name}` }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setRutOptions(opts);
      } catch (e: any) {
        setErrorMsg(e?.message || "No se pudo cargar maestro de clientes.");
      }
    })();
  }, []);

  /* ================== Aplicar cliente desde RUT ================== */
  async function aplicarClienteDesdeRut(rutSan: string) {
    setErrorMsg("");
    setOkMsg("");
    try {
      const { id, gid } = normalizeGoogleSheetUrl(FUENTE_SN_URL);
      if (!id) throw new Error("URL de SN inválida.");
      const rows = await fetchCsv(id, gid);

      // construir sucursales por código (dedupe), con dirección compuesta
      const map = new Map<string, SucursalOpt>(); // code -> opt
      let nombreCliente = "";
      let ejecutivoDefault = "";

      for (const r of rows) {
        const rutRow = sanitizeRut(String(r["RUT"] ?? r["Rut"] ?? r.rut ?? ""));
        if (rutRow !== rutSan) continue;

        const code = String(r["CardCode"] ?? r.CardCode ?? "").trim().toUpperCase();
        if (!code) continue;

        const name = String(r["CardName"] ?? r.CardName ?? "").trim();
        const dirBase =
          String(r["Dirección Despacho"] ?? r["Direccion Despacho"] ?? r["Address"] ?? "").trim();
        const comuna = String(r["Despacho Comuna"] ?? r["Comuna"] ?? "").trim();
        const ciudad = String(r["Despacho Ciudad"] ?? r["Ciudad"] ?? "").trim();
        const direccion = [dirBase, comuna, ciudad].filter(Boolean).join(", ");
        const ejecutivo =
          String(r["Empleado Ventas"] ?? r["Èmpleado Ventas"] ?? r["Empleado ventas"] ?? "").trim();

        if (name) nombreCliente = name;
        if (ejecutivo) ejecutivoDefault = ejecutivo;

        const prev = map.get(code);
        if (!prev) {
          map.set(code, {
            code,
            direccion,
            ejecutivo: ejecutivo || ejecutivoDefault || "",
            name: nombreCliente || "",
          });
        } else {
          // preferir la que tenga dirección no vacía
          if (!prev.direccion && direccion) prev.direccion = direccion;
          if (!prev.ejecutivo && ejecutivo) prev.ejecutivo = ejecutivo;
          if (!prev.name && nombreCliente) prev.name = nombreCliente;
        }
      }

      const suc = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
      setSucursales(suc);

      // set cliente base (primera sucursal si existe)
      if (suc.length) {
        const base = suc[0];
        setCliente({
          rut: rutSan,
          codigo: base.code,
          nombre: base.name || "",
          direccion: base.direccion || "",
          ejecutivo: base.ejecutivo || "",
        });
        // cargar historial de 3 años para esa sucursal
        await cargarComodatosHistoricos(rutSan, base.code);
      } else {
        setCliente({ rut: rutSan, codigo: "", nombre: nombreCliente || "", direccion: "", ejecutivo: ejecutivoDefault || "" });
        setComodatos([]);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo aplicar el cliente.");
    }
  }

  /* ================== Cargar comodatos (3 años) por rut+codigo ================== */
  async function cargarComodatosHistoricos(rutSan: string, codigoCliente: string) {
    setErrorMsg("");
    setLoadingComodatos(true);
    setSeleccion({});
    try {
      const { id, gid } = normalizeGoogleSheetUrl(FUENTE_COMODATOS_URL);
      if (!id) throw new Error("URL de comodatos inválida.");
      const rows = await fetchCsv(id, gid);

      const hoy = new Date();
      const hace3 = new Date(hoy.getFullYear() - 3, hoy.getMonth(), hoy.getDate());

      // soportar distintas cabeceras: "Rut Cliente", "RUT", "RUT Cliente", "Codigo Cliente"
      const listRaw = rows.filter((r) => {
        const rutRow = sanitizeRut(
          String(r["Rut Cliente"] ?? r["RUT Cliente"] ?? r["RUT"] ?? r["Rut"] ?? "")
        );
        const codCli = String(
          r["Codigo Cliente"] ?? r["Código Cliente"] ?? r["CardCode"] ?? r["codigo cliente"] ?? ""
        ).trim().toUpperCase();
        return rutRow === rutSan && codCli === codigoCliente.toUpperCase();
      });

      const list: Comodato[] = listRaw
        .map((r, idx) => {
          const codigo = String(r["Codigo Producto"] ?? r["Código Producto"] ?? r["ITEM"] ?? r["code"] ?? "").trim().toUpperCase();
          const descripcion = String(r["Producto"] ?? r["DESCRIPCION"] ?? r["Descripcion"] ?? r["name"] ?? "").trim();
          const valor = num(r["Total"] ?? r["VALOR"] ?? r["Valor"] ?? 0);
          const periodo =
            r["Periodo"] ?? r["Periodo Instalacion"] ?? r["Periodo Instalación"] ?? r["Fecha"] ?? r["fecha instalación"] ?? r["Fecha Instalacion"];
          const dt = parseDateLike(periodo);
          const iso = dt ? formatISODate(dt) : "";
          // rowId único por fila
          const rowId = `${codigo}__${iso || String(periodo || "")}__${idx}`;
          return { rowId, codigo, descripcion, valor, fechaInstalacion: iso };
        })
        .filter((c) => {
          if (!c.codigo) return false;
          const d = parseDateLike(c.fechaInstalacion);
          return d ? d >= hace3 : false;
        })
        .sort((a, b) => (a.fechaInstalacion < b.fechaInstalacion ? 1 : -1));

      setComodatos(list);
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo cargar el histórico.");
      setComodatos([]);
    } finally {
      setLoadingComodatos(false);
    }
  }

  /* ================== Selecciones y retiro ================== */
  function toggleSeleccion(rowId: string, checked: boolean) {
    setSeleccion((old) => ({ ...old, [rowId]: checked }));
  }

  function agregarSeleccionados() {
    const seleccionados = comodatos.filter((c) => !!seleccion[c.rowId]);
    if (!seleccionados.length) return;

    setRetiro((old) => {
      const map = new Map<string, RowRetiro>();
      old.forEach((r) => map.set(r.codigo, { ...r }));
      for (const c of seleccionados) {
        const ex = map.get(c.codigo);
        if (ex) {
          const nuevaCant = ex.cantidad + 1;
          map.set(c.codigo, {
            ...ex,
            cantidad: nuevaCant,
            valorTotal: Math.round(nuevaCant * (ex.valor || 0)),
          });
        } else {
          map.set(c.codigo, {
            codigo: c.codigo,
            descripcion: c.descripcion,
            cantidad: 1,
            valor: Math.round(c.valor || 0),
            valorTotal: Math.round(c.valor || 0),
          });
        }
      }
      return Array.from(map.values());
    });

    // limpiar sólo los que se agregaron (para evitar confusión)
    setSeleccion((old) => {
      const n: Record<string, boolean> = { ...old };
      for (const c of seleccionados) delete n[c.rowId];
      return n;
    });
  }

  function cambiarCantidad(idx: number, cantidad: number) {
    setRetiro((old) => {
      const n = [...old];
      const row = { ...n[idx] };
      const cant = Math.max(0, Math.floor(num(cantidad)));
      row.cantidad = cant;
      row.valorTotal = Math.round((row.valor || 0) * cant);
      n[idx] = row;
      return n;
    });
  }

  function quitarFila(idx: number) {
    setRetiro((old) => old.filter((_, i) => i !== idx));
  }

  /* ================== Enviar / Guardar ================== */
  async function enviarSolicitud() {
    setErrorMsg("");
    setOkMsg("");
    try {
      if (!cliente.rut || !cliente.codigo || !cliente.nombre) {
        throw new Error("Completa los datos del cliente (RUT, Código y Nombre).");
      }
      if (!retiro.length) throw new Error("Selecciona al menos 1 equipo para retirar.");
  
      // --- payload que ya estabas enviando al Apps Script ---
      const payload = {
        fechaSolicitud: fecha,
        fechaRetiro,
        motivo,
        contacto,
        comentarios,
        cliente,
        equipos: retiro.map((r) => ({
          codigo: r.codigo,
          descripcion: r.descripcion,
          cantidad: r.cantidad,
          valor: r.valor,
          valorTotal: r.valorTotal,
        })),
        subtotal,
        // si quieres forzar destinatario específico desde el front:
        destinatario: "jorge.palma@spartan.cl",
      };
  
      // 1) Guardar en Google Sheets (Apps Script WebApp)
      const resSave = await fetch(API_SAVE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinoSheetUrl: DESTINO_SOLICITUDES_URL, payload }),
      });
      if (!resSave.ok) {
        const raw = await resSave.text();
        throw new Error(`No se pudo guardar en Google Sheets. Detalle: ${raw || resSave.status}`);
      }
  
      // 2) Generar PDF
      const { base64, filename } = generarPdfSolicitudRetiro({
        fechaSolicitud: fecha,
        fechaRetiro,
        motivo,
        contacto,
        comentarios,
        cliente,
        equipos: retiro,
        subtotal,
      });
  
      // 3) Enviar correo (puedes pasar "to" para sobrescribir el default del API)
      const subject = `Solicitud de Retiro – ${cliente.nombre} (${cliente.codigo})`;
      const message = `
        <p>Se ha generado una <b>Solicitud de Retiro</b>.</p>
        <ul>
          <li><b>Cliente:</b> ${cliente.nombre}</li>
          <li><b>RUT:</b> ${cliente.rut}</li>
          <li><b>Código Cliente:</b> ${cliente.codigo}</li>
          <li><b>Fecha Solicitud:</b> ${fecha}</li>
          <li><b>Fecha Retiro:</b> ${fechaRetiro}</li>
          <li><b>Motivo:</b> ${motivo}</li>
        </ul>
      `;
  
      const resMail = await fetch(API_MAIL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: payload.destinatario,              // opcional: override
          subject,
          message,
          attachment: { filename, content: base64 },
          cc: "silvana.pincheira@spartan.cl"          // opcional
        }),
      });
  
      if (!resMail.ok) {
        const errText = await resMail.text();
        throw new Error(`No se pudo enviar el correo. ${errText || resMail.status}`);
      }
  
      setOkMsg("✅ Solicitud enviada y guardada correctamente.");
    } catch (e: any) {
      setErrorMsg(e?.message || "Error al enviar la solicitud.");
    }
  }
  

  function limpiar() {
    setRutInput("");
    setCliente({ rut: "", codigo: "", nombre: "", direccion: "", ejecutivo: "" });
    setSucursales([]);
    setComodatos([]);
    setSeleccion({});
    setRetiro([]);
    setMotivo("Cambio de equipo");
    setFechaRetiro(formatISODate(new Date()));
    setContacto("");
    setComentarios("");
    setOkMsg("");
    setErrorMsg("");
    setFecha(formatISODate(new Date()));
  }

  /* ============================================================================
     UI
     ============================================================================ */
  return (
    <div className="p-6 text-[12px] space-y-6">
      <h1 className="text-lg font-bold text-[#2B6CFF]">📦 Solicitud de Retiro de Equipos</h1>

      {!!errorMsg && (
        <div className="rounded bg-red-50 text-red-700 px-3 py-2 text-sm border border-red-200">
          {errorMsg}
        </div>
      )}
      {!!okMsg && !errorMsg && (
        <div className="rounded bg-green-50 text-green-700 px-3 py-2 text-sm border border-green-200">
          {okMsg}
        </div>
      )}

      {/* ================== Cliente ================== */}
      <section className="bg-white shadow p-4 rounded space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Fecha solicitud</span>
            <input type="date" className="border rounded px-2 py-1" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="font-medium">RUT o Nombre</span>
            <input
              list="rutList"
              className="border rounded px-2 py-1"
              placeholder="Escribe RUT o nombre y tabula…"
              value={rutInput}
              onChange={(e) => setRutInput(e.target.value)}
              onBlur={(e) => {
                const val = e.target.value.trim();
                const picked = rutOptions.find((o) => o.label === val);
                const rutSan = picked ? picked.rut : extractRutFromLabel(val);
                if (rutSan) aplicarClienteDesdeRut(rutSan);
              }}
            />
            <datalist id="rutList">
              {rutOptions.map((o) => (
                <option key={o.rut} value={o.label} />
              ))}
            </datalist>
          </label>

          {/* Código + Dirección (anidado) */}
          <label className="flex flex-col gap-1">
            <span className="font-medium">Código cliente / Sucursal</span>
            <select
              className="border rounded px-2 py-1"
              value={cliente.codigo}
              onChange={(e) => {
                const code = e.target.value;
                const opt = sucursales.find((s) => s.code === code);
                if (opt) {
                  setCliente((c) => ({
                    ...c,
                    codigo: opt.code,
                    nombre: opt.name || c.nombre,
                    direccion: opt.direccion || c.direccion,
                    ejecutivo: opt.ejecutivo || c.ejecutivo,
                  }));
                  if (cliente.rut) cargarComodatosHistoricos(cliente.rut, opt.code);
                }
              }}
              disabled={!sucursales.length}
            >
              {!sucursales.length && <option value="">—</option>}
              {sucursales.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.direccion || "s/dirección"}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="font-medium">Dirección (autocompletada por sucursal)</span>
            <input className="border rounded px-2 py-1 bg-zinc-50" value={cliente.direccion} readOnly placeholder="—" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-medium">Ejecutivo</span>
            <input className="border rounded px-2 py-1 bg-zinc-50" value={cliente.ejecutivo} readOnly placeholder="—" />
          </label>
        </div>

        {/* Datos de retiro adicionales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Motivo del retiro</span>
            <select className="border rounded px-2 py-1" value={motivo} onChange={(e) => setMotivo(e.target.value as SolicitudMotivo)}>
              <option>Cambio de equipo</option>
              <option>Retiro total</option>
              <option>Mal estado</option>
              <option>Otro</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-medium">Fecha de retiro</span>
            <input type="date" className="border rounded px-2 py-1" value={fechaRetiro} onChange={(e) => setFechaRetiro(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="font-medium">Contacto</span>
            <input
              className="border rounded px-2 py-1"
              placeholder="Nombre y datos de contacto"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* ================== Históricos 3 años ================== */}
      <section className="bg-white shadow p-4 rounded">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-[#2B6CFF]">🧾 Comodatos históricos (últimos 3 años)</h2>
          <button
            className="px-3 py-1 rounded text-xs bg-emerald-600 text-white disabled:bg-zinc-400"
            onClick={agregarSeleccionados}
            disabled={!Object.values(seleccion).some(Boolean)}
          >
            ➕ Agregar seleccionados
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px] border">
            <thead className="bg-zinc-100">
              <tr className="text-center">
                <th className="px-2 py-1" style={{ width: 50 }}>Sel.</th>
                <th className="px-2 py-1" style={{ width: 120 }}>Código</th>
                <th className="px-2 py-1 text-left">Descripción</th>
                <th className="px-2 py-1 text-right" style={{ width: 120 }}>Valor</th>
                <th className="px-2 py-1" style={{ width: 140 }}>Fecha instalación</th>
              </tr>
            </thead>
            <tbody>
              {loadingComodatos ? (
                <tr><td colSpan={5} className="px-2 py-3 text-center">Cargando…</td></tr>
              ) : comodatos.length === 0 ? (
                <tr><td colSpan={5} className="px-2 py-3 text-center">Sin registros</td></tr>
              ) : (
                comodatos.map((c) => (
                  <tr key={c.rowId} className="border-t hover:bg-zinc-50 text-center">
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={!!seleccion[c.rowId]}
                        onChange={(e) => toggleSeleccion(c.rowId, e.target.checked)}
                      />
                    </td>
                    <td className="px-2 py-1">{c.codigo}</td>
                    <td className="px-2 py-1 text-left">{c.descripcion}</td>
                    <td className="px-2 py-1 text-right">{money(c.valor)}</td>
                    <td className="px-2 py-1">{c.fechaInstalacion || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ================== Equipos a retirar ================== */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="font-semibold text-[#2B6CFF] mb-2">📤 Equipos a retirar</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px] border">
            <thead className="bg-zinc-100">
              <tr className="text-center">
                <th className="px-2 py-1" style={{ width: 120 }}>Código</th>
                <th className="px-2 py-1 text-left">Descripción</th>
                <th className="px-2 py-1" style={{ width: 90 }}>Cantidad</th>
                <th className="px-2 py-1 text-right" style={{ width: 120 }}>Valor</th>
                <th className="px-2 py-1 text-right" style={{ width: 120 }}>Valor total</th>
                <th className="px-2 py-1" style={{ width: 70 }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {retiro.length === 0 ? (
                <tr><td colSpan={6} className="px-2 py-3 text-center">No hay equipos seleccionados.</td></tr>
              ) : (
                retiro.map((r, idx) => (
                  <tr key={r.codigo} className="border-t hover:bg-zinc-50 text-center">
                    <td className="px-2 py-1">{r.codigo}</td>
                    <td className="px-2 py-1 text-left">{r.descripcion}</td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        min={0}
                        className="w-20 border rounded text-right"
                        value={r.cantidad}
                        onChange={(e) => cambiarCantidad(idx, Number(e.target.value))}
                      />
                    </td>
                    <td className="px-2 py-1 text-right">{money(r.valor)}</td>
                    <td className="px-2 py-1 text-right">{money(r.valorTotal)}</td>
                    <td className="px-2 py-1">
                      <button className="text-red-600 text-xs" onClick={() => quitarFila(idx)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {retiro.length > 0 && (
              <tfoot>
                <tr className="font-semibold bg-zinc-50">
                  <td colSpan={4} className="text-right px-2 py-1 border-t">TOTAL</td>
                  <td className="text-right px-2 py-1 border-t">{money(subtotal)}</td>
                  <td className="border-t" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* ================== Comentarios ================== */}
      <section className="bg-white shadow p-4 rounded">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Comentarios</span>
            <textarea
              className="border rounded px-2 py-1 min-h-[80px]"
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2">
            <button
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded"
              onClick={enviarSolicitud}
            >
              ✉️ Enviar a Servicio Técnico & Guardar
            </button>
            <button className="bg-zinc-200 px-3 py-2 rounded" onClick={limpiar}>
              🧹 Limpiar
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

