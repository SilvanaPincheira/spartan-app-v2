// app/ventas/notaventas/page.tsx
// -----------------------------------------------------------------------------
// NOTA DE VENTA — PÁGINA COMPLETA (CLIENT COMPONENT)
// -----------------------------------------------------------------------------
// - Carga clientes, productos y precios especiales desde Google Sheets (CSV).
// - Aplica 3 listas de precio SOLO a productos cuyo code comience con "PT".
// - Soporta precio especial por cliente+artículo (anula descuento y listas).
// - Permite agregar/eliminar ítems, calcular totales y mostrar en formato A4.
// - Muestra Ejecutivo, Correo Ejecutivo y Comentarios también en impresión.
// - Guarda la Nota de Venta en Google Sheets, una fila por ítem, a través de
//   la API interna /api/save-to-sheets (para evitar CORS/CSP y top-level await).
//
//   BACKEND PARA GUARDAR (crear archivo):
//   - /app/api/save-to-sheets/route.ts (POST)
//   - Debe reenviar el payload al Apps Script WebApp que ESCRIBE en tu hoja.
//   - Revisa que tu WebApp esté desplegada con "Cualquiera" y "Permitir anónimo".
//
//   FRONT: Este archivo no usa top-level await y no importa nada del server.
//
//   IMPRESIÓN (A4):
//   - Se ocultan: botones de lista 1/2/3, columna "Precio base" y botón eliminar.
//   - Se muestran: Ejecutivo, Correo Ejecutivo y Comentarios.
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ===================== HELPERS ===================== */
// Normaliza strings (búsquedas/igualdades sin tildes/mayúsculas)
function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Convierte lo que venga a número (0 si NaN)
function num(x: unknown) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

// Limita un número al rango [min, max]
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Formato moneda CLP (sin decimales)
function money(n: number) {
  return (n || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

/* ===================== CSV PARSER (sin dependencias) ===================== */
// parseCsv: admite comillas y saltos de línea correctos
function parseCsv(text: string): Record<string, string>[] {
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
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        pushCell();
      } else if (ch === "\n") {
        pushCell();
        pushRow();
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length || row.length) {
    pushCell();
    pushRow();
  }
  if (!rows.length) return [];

  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c === "")) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => (obj[h] = (r[j] ?? "").trim()));
    out.push(obj);
  }
  return out;
}

// fetchCsv: lee CSV de Google Sheets export (gid)
async function fetchCsv(spreadsheetId: string, gid: string | number) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

// loadSheetSmart: wrapper con label para error
async function loadSheetSmart(spreadsheetId: string, gid: string | number, label: string) {
  try {
    return await fetchCsv(spreadsheetId, gid);
  } catch {
    throw new Error(`${label}: no se pudo leer`);
  }
}

// Extrae id y gid de una URL de Google Sheets
function normalizeGoogleSheetUrl(url: string) {
  const m = (url || "").match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const id = m ? m[1] : "";
  let gid = "0";
  const g = (url || "").match(/[?&#]gid=([0-9]+)/);
  if (g) gid = g[1];
  return { id, gid };
}

/* ===================== TIPOS ===================== */
type Client = {
  nombre: string;
  rut: string;
  codigo: string;
  ejecutivo: string;
  direccion: string;
};

type Product = { code: string; name: string; price_list: number; kilos: number };

type PrecioEspecial = { codigoSN: string; articulo: string; precio: number };

type Line = {
  code: string;          // código producto
  name: string;          // descripción
  kilos: number;         // kg por unidad
  qty: number;           // cantidad
  priceBase: number;     // lista 1 desde planilla (siempre)
  especialPrice: number; // 0 si no aplica precio especial
  descuento: number;     // -20..20 (%), ignorado si hay especial
  precioVenta: number;   // cálculo final por unidad
  total: number;         // qty * kilos * precioVenta
  isEspecial: boolean;   // bandera de precio especial
};

/* ===================== COMPONENTE PRINCIPAL ===================== */
export default function NotaVentaPage() {
  /* ---- CLIENTES ---- */
  const [clients, setClients] = useState<Client[]>([]);
  const [clientName, setClientName] = useState<string>("");
  const [clientRut, setClientRut] = useState<string>("");
  const [ejecutivo, setEjecutivo] = useState<string>("");
  const [clientCode, setClientCode] = useState<string>("");
  const [direccion, setDireccion] = useState<string>("");

  /* ---- PRODUCTOS ---- */
  const [productos, setProductos] = useState<Product[]>([]);
  const [preciosEspeciales, setPreciosEspeciales] = useState<PrecioEspecial[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  /* ---- LISTA DE PRECIOS ---- */
  const [listaSeleccionada, setListaSeleccionada] = useState<1 | 2 | 3>(1);

  /* ---- CORREO ---- */
  const [emailEjecutivo, setEmailEjecutivo] = useState<string>("");

  /* ---- COMENTARIOS ---- */
  const [comentarios, setComentarios] = useState<string>("");

  /* ---- UI ---- */
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [saveMsg, setSaveMsg] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  /* ---- DOC INFO: N° NV ---- */
  const [numeroNV, setNumeroNV] = useState<string>("");

  /* ===================== HELPERS INTERNOS ===================== */
  // Genera correlativo local por año, persistido en localStorage (por navegador)
  function generarNumeroNV(): string {
    if (typeof window === "undefined") return "";
    const year = new Date().getFullYear();
    const key = `nv.counter.${year}`;
    const last = Number(window.localStorage.getItem(key) || "0");
    const next = last + 1;
    window.localStorage.setItem(key, String(next));
    return `NV-${year}-${String(next).padStart(5, "0")}`;
  }

  /* ===================== EFECTOS INICIALES ===================== */
  // Asigna número NV al cargar la página
  useEffect(() => {
    setNumeroNV(generarNumeroNV());
  }, []);

  // Carga clientes desde tu planilla (hoja Clientes)
  useEffect(() => {
    (async () => {
      const { id, gid } = normalizeGoogleSheetUrl(
        "https://docs.google.com/spreadsheets/d/1kF0INEtwYDXhQCBPTVhU8NQI2URKoi99Hs43DTSO02I/edit?gid=161671364#gid=161671364"
      );
      if (!id) return;
      const rows = await loadSheetSmart(id, gid, "Clientes");
      const list: Client[] = rows.map((r) => ({
        nombre: String(r.CardName ?? r.Nombre ?? "").trim(),
        rut: String(r.RUT ?? r.LicTradNum ?? "").trim(),
        ejecutivo: String(r["Empleado Ventas"] ?? r["Empleado de Ventas"] ?? "").trim(),
        codigo: String(r.CardCode ?? "").trim(),
        direccion: String(r["Dirección Despacho"] ?? r["Direccion Despacho"] ?? r.Address ?? "").trim(),
      }));
      setClients(list.filter((c) => c.nombre));
    })().catch((e) => setErrorMsg(String(e)));
  }, []);

  // Carga productos (hoja Productos)
  useEffect(() => {
    (async () => {
      const { id, gid } = normalizeGoogleSheetUrl(
        "https://docs.google.com/spreadsheets/d/1UXVAxwzg-Kh7AWCPnPbxbEpzXnRPR2pDBKrRUFNZKZo/edit?gid=0#gid=0"
      );
      if (!id) return;
      const rows = await loadSheetSmart(id, gid, "Productos");
      const list: Product[] = rows.map((r) => ({
        code: String((r as any).code ?? (r as any).Codigo ?? "").trim(),
        name: String((r as any).name ?? (r as any).Producto ?? "").trim(),
        price_list: num((r as any).price_list ?? (r as any)["Precio Lista"] ?? (r as any).Precio ?? 0),
        kilos: num((r as any).kilos ?? 1),
      }));
      setProductos(list.filter((p) => p.code));
    })().catch((e) => setErrorMsg(String(e)));
  }, []);

  // Carga precios especiales (hoja Precios especiales)
  useEffect(() => {
    (async () => {
      const { id, gid } = normalizeGoogleSheetUrl(
        "https://docs.google.com/spreadsheets/d/1UXVAxwzg-Kh7AWCPnPbxbEpzXnRPR2pDBKrRUFNZKZo/edit?gid=2117069636#gid=2117069636"
      );
      if (!id) return;
      const rows = await loadSheetSmart(id, gid, "Precios especiales");
      const list: PrecioEspecial[] = rows.map((r) => ({
        codigoSN: String((r as any)["Código SN"] ?? (r as any)["Codigo SN"] ?? "").trim(),
        articulo: String((r as any)["Número de artículo"] ?? (r as any)["Numero de articulo"] ?? "").trim(),
        precio: num((r as any)["Precio especial"] ?? 0),
      }));
      setPreciosEspeciales(list);
    })().catch((e) => setErrorMsg(String(e)));
  }, []);

  /* ===================== LÓGICA DE PRECIOS ===================== */
  // Transformación por lista de precios, partiendo de la lista 1 (base)
  function precioListaDesdeBase(baseLista1: number, lista: 1 | 2 | 3) {
    if (lista === 1) return baseLista1;
    if (lista === 2) return baseLista1 * 0.97;            // -3%
    return baseLista1 * 0.97 * 0.97;                       // -3% adicional
  }

  // Calcula una línea (precioVenta, total) según reglas:
  // - Si es especial: ignora lista y descuento, usa precio especial.
  // - Si no es especial: aplica lista SOLO si code inicia con "PT".
  function computeLine(row: Line): Line {
    const out = { ...row };

    if (out.isEspecial && out.especialPrice > 0) {
      out.descuento = 0;
      out.precioVenta = out.especialPrice;
    } else {
      let baseSegunLista = out.priceBase;
      if ((out.code || "").toUpperCase().startsWith("PT")) {
        baseSegunLista = precioListaDesdeBase(out.priceBase, listaSeleccionada);
      }
      const desc = clamp(num(out.descuento), -20, 20);
      out.precioVenta = baseSegunLista * (1 - desc / 100);
    }

    out.total = (num(out.qty) || 0) * (num(out.kilos) || 1) * (out.precioVenta || 0);
    return out;
  }

  /* ===================== MANEJO DE LÍNEAS ===================== */
  function addLine() {
    setLines((old) => [
      ...old,
      {
        code: "",
        name: "",
        kilos: 1,
        qty: 1,
        priceBase: 0,
        especialPrice: 0,
        descuento: 0,
        precioVenta: 0,
        total: 0,
        isEspecial: false,
      },
    ]);
  }

  function rmLine(i: number) {
    setLines((old) => old.filter((_, idx) => idx !== i));
  }

  // Completa la línea al salir del code (onBlur)
  function fillFromCode(i: number, code: string) {
    const prod = productos.find((p) => p.code === code);
    if (!prod) return;
    setLines((old) => {
      const n = [...old];
      const row = { ...(n[i] ?? n[0]) };

      row.code = prod.code;
      row.name = prod.name;
      row.kilos = prod.kilos || 1;
      row.priceBase = prod.price_list || 0;

      let esp = 0;
      let isEsp = false;
      if (clientCode) {
        const pe = preciosEspeciales.find(
          (p) => p.codigoSN === clientCode && p.articulo === prod.code
        );
        if (pe) {
          esp = pe.precio || 0;
          isEsp = true;
        }
      }
      row.especialPrice = esp;
      row.isEspecial = isEsp;
      row.descuento = isEsp ? 0 : clamp(num(row.descuento), -20, 20);

      n[i] = computeLine(row);
      return n;
    });
  }

  // Actualiza cualquier campo de la línea y recalcula
  function updateLine(i: number, field: keyof Line, value: unknown) {
    setLines((old) => {
      const n = [...old];
      const current = n[i];
      if (!current) return old;

      const row: Line = { ...current, [field]: value } as Line;
      row.kilos = num(row.kilos) || 1;
      row.qty = num(row.qty) || 0;
      row.priceBase = num(row.priceBase) || 0;
      row.especialPrice = num(row.especialPrice) || 0;
      row.descuento = row.isEspecial ? 0 : clamp(num(row.descuento), -20, 20);

      n[i] = computeLine(row);
      return n;
    });
  }

  // Recalcula todas las líneas al cambiar la lista seleccionada
  useEffect(() => {
    setLines((old) => old.map((r) => computeLine(r)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaSeleccionada]);

  // Subtotal de todas las líneas
  const subtotal = useMemo(() => {
    const s = lines.reduce((a, r) => a + (Number.isFinite(r.total) ? r.total : 0), 0);
    return Number.isFinite(s) ? s : 0;
  }, [lines]);

  /* ===================== CLIENTE: SELECCIÓN ===================== */
  // Al escribir/seleccionar Nombre
  function handleNombreChange(val: string) {
    setClientName(val);
    const row = clients.find((c) => normalize(c.nombre) === normalize(val));
    if (row) {
      setClientRut(row.rut || "");
      setClientCode("");
      setEjecutivo(row.ejecutivo || "");
      setDireccion("");
    } else {
      setClientRut("");
      setClientCode("");
      setEjecutivo("");
      setDireccion("");
    }
  }

  // Al elegir Código Cliente (sucursal)
  async function handleCodigoChange(val: string) {
    setClientCode(val);
    const row = clients.find((c) => c.codigo === val);
    if (row) {
      setClientRut(row.rut || "");
      setEjecutivo(row.ejecutivo || "");
      setDireccion(row.direccion || "");
    }
  }

  /* ===================== ACCIONES ===================== */
  function limpiarTodo() {
    setClientName("");
    setClientRut("");
    setClientCode("");
    setEjecutivo("");
    setDireccion("");
    setEmailEjecutivo("");
    setComentarios("");
    setLines([]);
    setErrorMsg("");
    setNumeroNV(generarNumeroNV());
    setListaSeleccionada(1);
    setSaveMsg("");
  }

  function imprimir() {
    window.print();
  }

  function enviarEmail() {
    const destinatarios = [emailEjecutivo, "silvana.pincheira@spartan.cl"]
      .filter((x) => (x || "").trim().length > 0)
      .join(",");
    const subject = encodeURIComponent(`Nota de Venta ${numeroNV}`);
    const body = encodeURIComponent(`Adjunto la Nota de Venta ${numeroNV} generada.`);
    window.location.href = `mailto:${destinatarios}?subject=${subject}&body=${body}`;
  }

  /* ===================== GUARDAR EN GOOGLE SHEETS ===================== */
  // Guarda "una fila por ítem" en una sola pestaña (p.ej. "NV")
  // via API interna /api/save-to-sheets (Next Route Handler)
  async function guardarEnGoogleSheets() {
    setSaveMsg("");
    setErrorMsg("");
  
    try {
      if (!clientName || !clientRut || !clientCode) {
        throw new Error("Faltan datos del cliente (Nombre, RUT y Código Cliente).");
      }
      if (lines.length === 0) {
        throw new Error("Agrega al menos un ítem antes de guardar.");
      }
  
      setSaving(true);
  
      const fecha = new Date().toLocaleDateString("es-CL");
  
      const payload = lines.map((item) => ({
        numeroNV,
        fecha,
        cliente: clientName,
        rut: clientRut,
        codigoCliente: clientCode,
        ejecutivo,
        direccion,
        correoEjecutivo: emailEjecutivo,
        comentarios,
        subtotal,
        total: subtotal,
        codigo: item.code,
        descripcion: item.name,
        kilos: item.kilos,
        cantidad: item.qty,
        precioBase: Math.round(item.priceBase || 0),
        descuento: item.isEspecial ? 0 : item.descuento,
        precioVenta: Math.round(item.precioVenta || 0),
        totalItem: Math.round(item.total || 0),
      }));
  
      // 👇 ahora llama a tu API interna
      const res = await fetch("/api/save-to-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      if (!res.ok) throw new Error("Error al guardar en Google Sheets.");
      const json = await res.json();
      const rows = Number(json?.rows ?? payload.length) || payload.length;
  
      setSaveMsg(`✅ Nota de venta guardada con ${rows} ítem(s) en Google Sheets.`);
    } catch (e: any) {
      setErrorMsg(e?.message || "Error desconocido al guardar en Google Sheets.");
    } finally {
      setSaving(false);
    }
  }
  
  /* ===================== UI ===================== */
  return (
    <>
      <div id="printArea" className="min-h-screen bg-white p-6 text-[12px]">
        {/* ===================== ENCABEZADO ===================== */}
        <header className="mb-4 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-3">
            <img
              src="https://images.jumpseller.com/store/spartan-de-chile/store/logo/Spartan_Logo_-_copia.jpg?0"
              alt="Spartan"
              className="h-12 w-auto"
            />
            <h1 className="text-lg font-bold text-[#2B6CFF]">📝 Nota de Venta</h1>
          </div>
          <div className="text-[11px] bg-zinc-100 px-3 py-2 rounded text-right">
            <div>
              <b>N°</b> {numeroNV || "—"}
            </div>
            <div>{new Date().toLocaleDateString("es-CL")}</div>
          </div>
        </header>

        {/* Mensajes */}
        {errorMsg && (
          <div className="mb-3 rounded bg-red-50 text-red-700 px-3 py-2 text-sm border border-red-200">
            {errorMsg}
          </div>
        )}
        {saveMsg && !errorMsg && (
          <div className="mb-3 rounded bg-green-50 text-green-700 px-3 py-2 text-sm border border-green-200">
            {saveMsg}
          </div>
        )}

        {/* ===================== CLIENTE ===================== */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <h2 className="font-semibold text-[#2B6CFF] mb-2">Cliente</h2>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            {/* Nombre */}
            <label className="flex flex-col gap-1">
              Nombre
              <input
                className="w-full border rounded px-2 py-1"
                value={clientName}
                onChange={(e) => handleNombreChange(e.target.value)}
                list="clientesList"
              />
              <datalist id="clientesList">
                {clients.map((c, i) => (
                  <option key={`${c.codigo}-${i}`} value={c.nombre} />
                ))}
              </datalist>
            </label>

            {/* RUT */}
            <label className="flex flex-col gap-1">
              RUT
              <input className="w-full border rounded px-2 py-1" value={clientRut} readOnly />
            </label>

            {/* Código Cliente */}
            <label className="flex flex-col gap-1">
              Código Cliente
              <select
                className="w-full border rounded px-2 py-1"
                value={clientCode}
                onChange={(e) => handleCodigoChange(e.target.value)}
              >
                <option value="">Seleccione…</option>
                {clients
                  .filter((c) => normalize(c.nombre) === normalize(clientName))
                  .map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.codigo} — {c.direccion}
                    </option>
                  ))}
              </select>
            </label>

            {/* Ejecutivo */}
            <label className="flex flex-col gap-1">
              Ejecutivo
              <input className="w-full border rounded px-2 py-1" value={ejecutivo} readOnly />
            </label>

            {/* Dirección */}
            <label className="flex flex-col gap-1">
              Dirección
              <input className="w-full border rounded px-2 py-1" value={direccion} readOnly />
            </label>
          </div>
        </section>

        {/* ===================== PRODUCTOS ===================== */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <div className="flex justify-between mb-2 items-center">
            <h2 className="font-semibold text-[#2B6CFF]">Productos</h2>

            {/* Botones Lista de precios (ocultos al imprimir) */}
            <div className="flex gap-2 print:hidden">
              <button
                className={`px-2 py-1 rounded text-xs ${listaSeleccionada === 1 ? "bg-blue-500 text-white" : "bg-zinc-200"}`}
                onClick={() => setListaSeleccionada(1)}
              >
                1° Lista
              </button>
              <button
                className={`px-2 py-1 rounded text-xs ${listaSeleccionada === 2 ? "bg-blue-500 text-white" : "bg-zinc-200"}`}
                onClick={() => setListaSeleccionada(2)}
              >
                2° Lista
              </button>
              <button
                className={`px-2 py-1 rounded text-xs ${listaSeleccionada === 3 ? "bg-blue-500 text-white" : "bg-zinc-200"}`}
                onClick={() => setListaSeleccionada(3)}
              >
                3° Lista
              </button>

              <button className="bg-green-500 px-2 py-1 text-xs text-white rounded" onClick={addLine}>
                + Ítem
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] border">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="px-2 py-1 text-left">Código</th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                  <th className="px-2 py-1 text-right">Kg</th>
                  <th className="px-2 py-1 text-right">Cantidad</th>
                  {/* Oculto en impresión */}
                  <th className="hidden md:table-cell px-2 py-1 text-right print:hidden">
  Precio base
</th>
                  <th className="px-2 py-1 text-right">% Desc</th>
                  <th className="px-2 py-1 text-right">Precio venta</th>
                  <th className="px-2 py-1 text-right">Total</th>
                  {/* botón eliminar oculto en impresión */}
                  <th className="print:hidden" />
                </tr>
              </thead>
              <tbody>
                {lines.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1">
                      <input
                        className="w-32 border rounded px-1"
                        value={r.code}
                        onChange={(e) => updateLine(i, "code", e.target.value)}
                        onBlur={(e) => fillFromCode(i, e.target.value)}
                        list="productosList"
                      />
                      <datalist id="productosList">
                        {productos.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.code} — {p.name}
                          </option>
                        ))}
                      </datalist>
                    </td>

                    <td className="px-2 py-1">{r.name}</td>

                    <td className="px-2 py-1 text-right">
                      <input
                        type="number"
                        className="w-16 border rounded text-right"
                        value={r.kilos}
                        onChange={(e) => updateLine(i, "kilos", num(e.target.value))}
                        min={0}
                        step="any"
                      />
                    </td>

                    <td className="px-2 py-1 text-right">
                      <input
                        type="number"
                        className="w-16 border rounded text-right"
                        value={r.qty}
                        onChange={(e) => updateLine(i, "qty", num(e.target.value))}
                        min={0}
                        step="any"
                      />
                    </td>

                    {/* Precio Base -> oculto al imprimir */}
                    <td className="px-2 py-1 text-right print:hidden">{money(r.priceBase)}</td>

                    <td className="px-2 py-1 text-right">
                      <input
                        type="number"
                        className="w-16 border rounded text-right"
                        value={r.descuento}
                        onChange={(e) => updateLine(i, "descuento", num(e.target.value))}
                        disabled={r.isEspecial}
                        min={-20}
                        max={20}
                        step="any"
                      />
                    </td>

                    <td className="px-2 py-1 text-right">{money(r.precioVenta)}</td>
                    <td className="px-2 py-1 text-right">{money(r.total)}</td>

                    {/* Botón Eliminar -> oculto al imprimir */}
                    <td className="px-2 py-1 print:hidden">
                      <button className="text-red-600 text-xs" onClick={() => rmLine(i)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              {lines.length > 0 && (
                <tfoot>
                  <tr className="font-semibold bg-zinc-50">
                    <td colSpan={7} className="text-right px-2 py-1">
                      TOTAL
                    </td>
                    <td className="text-right px-2 py-1">{money(subtotal)}</td>
                    <td className="print:hidden" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        {/* ===================== ENVÍO Y COMENTARIOS (VISIBLE EN IMPRESIÓN) ===================== */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <h2 className="font-semibold text-[#2B6CFF] mb-2">📧 Envío y Comentarios</h2>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <label className="flex flex-col gap-1">
              Correo Ejecutivo
              <input
                type="email"
                className="w-full border rounded px-2 py-1"
                value={emailEjecutivo}
                onChange={(e) => setEmailEjecutivo(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              Comentarios
              <input
                type="text"
                className="w-full border rounded px-2 py-1"
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
              />
            </label>
          </div>
        </section>
      </div>

      {/* ===================== BOTONES DE ACCIÓN (OCULTOS EN IMPRESIÓN) ===================== */}
      <div className="flex flex-wrap gap-2 print:hidden px-6 pb-8">
        <button className="bg-zinc-200 px-3 py-1 rounded" onClick={imprimir}>
          🖨️ Imprimir / PDF
        </button>

        <button
          className={`px-3 py-1 rounded text-white ${saving ? "bg-zinc-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
          onClick={guardarEnGoogleSheets}
          disabled={saving}
        >
          {saving ? "Guardando..." : "💾 Guardar"}
        </button>

        <button className="bg-blue-500 text-white px-3 py-1 rounded" onClick={enviarEmail}>
          ✉️ Enviar por Email
        </button>

        <button className="bg-zinc-200 px-3 py-1 rounded" onClick={limpiarTodo}>
          🧹 Nueva NV
        </button>
      </div>

      {/* ===================== ESTILOS DE IMPRESIÓN ===================== */}
      <style jsx>{`
        :global(html),
        :global(body),
        :global(#printArea) {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printArea,
          #printArea * {
            visibility: visible !important;
          }
          #printArea {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100% !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 12mm;
          }
          header,
          section,
          table,
          h1,
          h2 {
            break-inside: avoid;
          }
          thead {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </>
  );
}

