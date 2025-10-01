// app/ventas/notaventas/page.tsx
// -----------------------------------------------------------------------------
// NOTA DE VENTA — CLIENT COMPONENT (Next.js / React)
// -----------------------------------------------------------------------------
// ✔ Carga clientes, productos y precios especiales (CSV Google Sheets)
// ✔ Listas 1/2/3 para códigos que comienzan con "PT"
// ✔ Precio especial por cliente+artículo con VIGENCIA:
//      - Vigente  -> se aplica y muestra “✅ Precio especial vigente”
//      - Vencido  -> BLOQUEA la línea y muestra “❌ Precio especial vencido”
// ✔ Columna “$ Presentación” (= Precio venta × Kg)
// ✔ Guarda una fila por ítem (payload) vía /api/save-to-sheets
// ✔ Impresión A4 profesional:
//      - Datos del cliente en 2–3 campos por fila
//      - Tabla limpia sin scroll con: Código | Descripción | Cant | Precio venta | $ Presentación | Total
//      - Oculta en impresión: Kg, Precio base, % Desc, Acciones
//      - Totales con borde superior y alineados a la derecha
// ✔ Precio venta editable con teclado y validación: no menor al 80% del precio base
//    (se calcula % Desc inverso y se respeta el precio digitado)
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ============================================================================
   [A] HELPERS GENERALES
   ============================================================================ */
function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
function num(x: unknown) {
  if (typeof x === "string") {
    const cleaned = x.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const v = Number(cleaned);
    return Number.isFinite(v) ? v : 0;
  }
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function money(n: number) {
  return (n || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}
function parseFecha(v?: string): Date | null {
  const s = (v || "").trim();
  if (!s) return null;
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const y = Number(m[3]);
    const dt = new Date(y, mo, d, 0, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}
function hoySinHora(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/* ============================================================================
   [B] LECTURA DE CSVs (Google Sheets) — sin dependencias
   ============================================================================ */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
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

async function fetchCsv(spreadsheetId: string, gid: string | number) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

async function loadSheetSmart(spreadsheetId: string, gid: string | number, label: string) {
  try {
    return await fetchCsv(spreadsheetId, gid);
  } catch {
    throw new Error(`${label}: no se pudo leer`);
  }
}

function normalizeGoogleSheetUrl(url: string) {
  const m = (url || "").match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const id = m ? m[1] : "";
  let gid = "0";
  const g = (url || "").match(/[?&#]gid=([0-9]+)/);
  if (g) gid = g[1];
  return { id, gid };
}

/* ============================================================================
   [C] TIPOS
   ============================================================================ */
type Client = {
  nombre: string;
  rut: string;
  codigo: string;
  ejecutivo: string;
  direccion: string;
};
type Product = { code: string; name: string; price_list: number; kilos: number };
type PrecioEspecial = {
  codigoSN: string;
  articulo: string;
  precio: number;
  vencimiento?: string;
};
type Line = {
  code: string;
  name: string;
  kilos: number;
  qty: number;
  priceBase: number;
  especialPrice: number;
  descuento: number;
  precioVenta: number;
  total: number;
  isEspecial: boolean;
  isBloqueado: boolean;
};

/* ============================================================================
   [D] COMPONENTE PRINCIPAL
   ============================================================================ */
export default function NotaVentaPage() {
  /* ----- Estado: Cliente ----- */
  const [clients, setClients] = useState<Client[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientRut, setClientRut] = useState("");
  const [ejecutivo, setEjecutivo] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [direccion, setDireccion] = useState("");
  const [direccionNueva, setDireccionNueva] = useState("");
  const [comuna, setComuna] = useState("");

  /* ----- Estado: Productos/Precios ----- */
  const [productos, setProductos] = useState<Product[]>([]);
  const [preciosEspeciales, setPreciosEspeciales] = useState<PrecioEspecial[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  /* ----- Estado: Metadatos/UX ----- */
  const [listaSeleccionada, setListaSeleccionada] = useState<1 | 2 | 3>(1);
  const [emailEjecutivo, setEmailEjecutivo] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [numeroNV, setNumeroNV] = useState("");

  /* ----- Helpers internos ----- */
  function generarNumeroNV(): string {
    if (typeof window === "undefined") return "";
    const year = new Date().getFullYear();
    const key = `nv.counter.${year}`;
    const last = Number(window.localStorage.getItem(key) || "0");
    const next = last + 1;
    window.localStorage.setItem(key, String(next));
    return `NV-${year}-${String(next).padStart(5, "0")}`;
  }
  function especialVigente(pe?: PrecioEspecial | null) {
    if (!pe) return false;
    if (!pe.vencimiento) return true;
    const f = parseFecha(pe.vencimiento);
    if (!f) return true;
    const fv = new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
    return hoySinHora().getTime() <= fv;
  }

  /* ==========================================================================
     [E] EFECTOS: Inicialización y carga de datos
     ========================================================================== */
  useEffect(() => setNumeroNV(generarNumeroNV()), []);

  // Clientes
  useEffect(() => {
    (async () => {
      const { id, gid } = normalizeGoogleSheetUrl(
        "https://docs.google.com/spreadsheets/d/1kF0INEtwYDXhQCBPTVhU8NQI2URKoi99Hs43DTSO02I/edit?gid=161671364#gid=161671364"
      );
      if (!id) return;
      const rows = await loadSheetSmart(id, gid, "Clientes");
      const list: Client[] = rows.map((r) => ({
        nombre: String((r as any).CardName ?? (r as any).Nombre ?? "").trim(),
        rut: String((r as any).RUT ?? (r as any).LicTradNum ?? "").trim(),
        ejecutivo: String((r as any)["Empleado Ventas"] ?? (r as any)["Empleado de Ventas"] ?? "").trim(),
        codigo: String((r as any).CardCode ?? "").trim(),
        direccion: String((r as any)["Dirección Despacho"] ?? (r as any)["Direccion Despacho"] ?? (r as any).Address ?? "").trim(),
      }));
      setClients(list.filter((c) => c.nombre));
    })().catch((e) => setErrorMsg(String(e)));
  }, []);

  // Productos
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

  // Precios especiales
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
        vencimiento: String((r as any).Vencimiento ?? (r as any)["Fecha Vencimiento"] ?? "").trim(),
      }));
      setPreciosEspeciales(list);
    })().catch((e) => setErrorMsg(String(e)));
  }, []);

  /* ==========================================================================
     [F] LÓGICA DE PRECIOS
     ========================================================================== */
  function precioListaDesdeBase(baseLista1: number, lista: 1 | 2 | 3) {
    if (lista === 1) return baseLista1;
    if (lista === 2) return baseLista1 * 0.97; // -3%
    return baseLista1 * 0.97 * 0.97;           // -3% adicional
  }
  function precioBaseSegunLista(row: Line) {
    let base = row.priceBase;
    if ((row.code || "").toUpperCase().startsWith("PT")) {
      base = precioListaDesdeBase(row.priceBase, listaSeleccionada);
    }
    return base;
  }
  function computeLine(row: Line): Line {
    const out = { ...row };

    if (out.isBloqueado) {
      out.precioVenta = 0;
      out.total = 0;
      return out;
    }

    if (out.isEspecial && out.especialPrice > 0) {
      out.descuento = 0;
      out.precioVenta = Math.round(out.especialPrice);
    } else {
      const base = precioBaseSegunLista(out);
      if (out.precioVenta && out.precioVenta > 0) {
        out.precioVenta = Math.round(out.precioVenta);
        const descCalc = base > 0 ? ((base - out.precioVenta) / base) * 100 : 0;
        out.descuento = Math.round(clamp(descCalc, -20, 20) * 100) / 100;
      } else {
        const desc = clamp(num(out.descuento), -20, 20);
        out.precioVenta = Math.round(base * (1 - desc / 100));
        out.descuento = Math.round(desc * 100) / 100;
      }
    }

    const precioPresentacion = out.precioVenta * (num(out.kilos) || 1);
    out.total = precioPresentacion * (num(out.qty) || 0);
    return out;
  }

  /* ==========================================================================
   [G] MANEJO DE LÍNEAS
   ========================================================================== */
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
        isBloqueado: false,
      },
    ]);
  }
  function rmLine(i: number) {
    setLines((old) => old.filter((_, idx) => idx !== i));
  }
  function fillFromCode(i: number, code: string) {
    const prod = productos.find((p) => p.code === code);
    if (!prod) return;
    setLines((old) => {
      const n = [...old];
      const row = { ...(n[i] ?? n[0]) } as Line;

      row.code = prod.code;
      row.name = prod.name;
      row.kilos = prod.kilos || 1;
      row.priceBase = prod.price_list || 0;

      let esp = 0;
      let isEsp = false;
      let bloqueado = false;

      if (clientCode) {
        const pe = preciosEspeciales.find(
          (p) => p.codigoSN === clientCode && p.articulo === prod.code
        );
        if (pe) {
          if (especialVigente(pe)) {
            esp = pe.precio || 0;
            isEsp = true;
          } else {
            bloqueado = true;
          }
        }
      }

      row.especialPrice = esp;
      row.isEspecial = isEsp;
      row.isBloqueado = bloqueado;
      row.descuento = isEsp ? 0 : Math.round(clamp(num(row.descuento), -20, 20) * 100) / 100;

      n[i] = computeLine(row);
      return n;
    });
  }
  function updateLine(i: number, field: keyof Line, value: unknown) {
    setLines((old) => {
      const n = [...old];
      const current = n[i];
      if (!current) return old;

      const row: Line = { ...current };

      if (field === "precioVenta") {
        if (value === "" || value === undefined) {
          row.precioVenta = 0;
          row.descuento = 0;
        } else {
          const pv = Math.round(num(value));
          const base = precioBaseSegunLista(row);
          const descCalc = base > 0 ? ((base - pv) / base) * 100 : 0;

          if (descCalc > 20) {
            if (typeof window !== "undefined") {
              alert(
                `❌ Precio inferior al esperado.\n\n` +
                  `Base: ${base.toLocaleString("es-CL", {
                    style: "currency",
                    currency: "CLP",
                    minimumFractionDigits: 0,
                  })}\n` +
                  `Digitado: ${pv.toLocaleString("es-CL", {
                    style: "currency",
                    currency: "CLP",
                    minimumFractionDigits: 0,
                  })}\n\n` +
                  `El precio no puede ser menor al 80% del base.`
              );
            }
            return old;
          }

          row.precioVenta = pv;
          row.descuento = Math.round(clamp(descCalc, -20, 20) * 100) / 100;
        }
      } else {
        (row as any)[field] = value as any;
        row.kilos = num(row.kilos) || 1;
        row.qty = num(row.qty) || 0;
        row.priceBase = num(row.priceBase) || 0;
        row.especialPrice = num(row.especialPrice) || 0;
        row.descuento = row.isEspecial ? 0 : Math.round(clamp(num(row.descuento), -20, 20) * 100) / 100;

        if (field === "descuento") {
          const base = precioBaseSegunLista(row);
          row.precioVenta = Math.round(base * (1 - row.descuento / 100));
        }
      }

      n[i] = computeLine(row);
      return n;
    });
  }

  // Recalcula al cambiar lista
  useEffect(() => {
    setLines((old) => old.map((r) => computeLine(r)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaSeleccionada]);

  // Subtotal
  const subtotal = useMemo(
    () => lines.reduce((a, r) => a + (Number.isFinite(r.total) ? r.total : 0), 0),
    [lines]
  );

  /* ==========================================================================
     [H] CLIENTE: eventos
     ========================================================================== */
  function handleNombreChange(val: string) {
    setClientName(val);
    const row = clients.find((c) => normalize(c.nombre) === normalize(val));
    if (row) {
      setClientRut(row.rut || "");
      setClientCode("");
      setEjecutivo(row.ejecutivo || "");
      setDireccion("");
      setDireccionNueva("");
      setComuna("");
    } else {
      setClientRut("");
      setClientCode("");
      setEjecutivo("");
      setDireccion("");
      setDireccionNueva("");
      setComuna("");
    }
  }
  function handleCodigoChange(val: string) {
    setClientCode(val);
    const row = clients.find((c) => c.codigo === val);
    if (row) {
      setClientRut(row.rut || "");
      setEjecutivo(row.ejecutivo || "");
      setDireccion(row.direccion || "");
    }
  }

 /* ==========================================================================
   [I] ACCIONES: guardar + generar PDF + enviar email (sin estados React)
   ========================================================================== */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function money(n: number): string {
  return (n || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result?.toString() || null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function generarPDFProfesional({
  numeroNV,
  clientName,
  clientRut,
  ejecutivo,
  direccion,
  direccionNueva,
  comuna,
  subtotal,
  comentarios,
  lines,
}: {
  numeroNV: string;
  clientName: string;
  clientRut: string;
  ejecutivo: string;
  direccion: string;
  direccionNueva: string;
  comuna: string;
  subtotal: number;
  comentarios: string;
  lines: {
    code: string;
    name: string;
    qty: number;
    precioVenta: number;
    kilos: number;
    total: number;
  }[];
}): Promise<{ filename: string; base64: string }> {
  const pdf = new jsPDF();
  const fecha = new Date().toLocaleDateString("es-CL");
  const filename = `Nota_Venta_${numeroNV}.pdf`;

  const logoUrl =
    "https://images.jumpseller.com/store/spartan-de-chile/store/logo/Spartan_Logo_-_copia.jpg?0";
  const logoImg = await loadImageAsBase64(logoUrl);
  if (logoImg) pdf.addImage(logoImg, "JPEG", 14, 12, 24, 24);

  pdf.setFontSize(14);
  pdf.setTextColor(43, 108, 255);
  pdf.text("📝 Nota de Venta", 42, 20);

  pdf.setTextColor(0);
  pdf.setFontSize(11);
  pdf.text(`N° ${numeroNV}`, 160, 16);
  pdf.text(fecha, 160, 22);

  let y = 40;
  pdf.setFontSize(10);
  pdf.text("Cliente:", 14, y); pdf.text(clientName, 35, y); y += 6;
  pdf.text("RUT:", 14, y); pdf.text(clientRut, 35, y); y += 6;
  pdf.text("Ejecutivo:", 14, y); pdf.text(ejecutivo, 35, y); y += 6;
  pdf.text("Dirección:", 14, y); pdf.text(direccionNueva || direccion || "", 35, y); y += 6;
  pdf.text("Comuna:", 14, y); pdf.text(comuna || "", 35, y); y += 10;

  autoTable(pdf, {
    startY: y,
    head: [["Código", "Descripción", "Cant", "Precio venta", "$ Presentación", "Total"]],
    body: lines.map((item) => [
      item.code,
      item.name,
      item.qty,
      money(item.precioVenta),
      money(item.precioVenta * item.kilos),
      money(item.total),
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [43, 108, 255], textColor: 255 },
    theme: "grid",
    foot: [["", "", "", "", "TOTAL", money(subtotal)]],
    footStyles: { fillColor: [255, 255, 255], fontStyle: "bold" },
  });

  if (comentarios?.trim()) {
    const finalY = (pdf as any).lastAutoTable.finalY + 10;
    pdf.setFontSize(10);
    pdf.text("Comentarios:", 14, finalY);
    pdf.text(comentarios, 35, finalY);
  }

  pdf.save(filename);
  const base64 = pdf.output("datauristring").split(",")[1];
  return { filename, base64 };
}

export async function guardarPdfYEnviarSinEstado({
  numeroNV,
  clientName,
  clientRut,
  clientCode,
  ejecutivo,
  direccion,
  direccionNueva,
  comuna,
  emailEjecutivo,
  comentarios,
  lines,
}: {
  numeroNV: string;
  clientName: string;
  clientRut: string;
  clientCode: string;
  ejecutivo: string;
  direccion: string;
  direccionNueva: string;
  comuna: string;
  emailEjecutivo: string;
  comentarios: string;
  lines: {
    code: string;
    name: string;
    kilos: number;
    qty: number;
    priceBase: number;
    especialPrice: number;
    descuento: number;
    precioVenta: number;
    total: number;
    isEspecial: boolean;
    isBloqueado: boolean;
  }[];
}): Promise<{ ok: boolean; message: string }> {
  try {
    const subtotal = lines.reduce((a, r) => a + (Number.isFinite(r.total) ? r.total : 0), 0);

    if (!clientName || !clientRut || !clientCode)
      throw new Error("Faltan datos del cliente (Nombre, RUT y Código Cliente).");
    if (lines.length === 0) throw new Error("Agrega al menos un ítem antes de guardar.");
    if (lines.some((l) => l.isBloqueado))
      throw new Error("No puedes guardar: hay precios especiales vencidos en la tabla.");

    const fecha = new Date().toLocaleDateString("es-CL");
    const payload = lines.map((item) => ({
      numeroNV,
      fecha,
      cliente: clientName,
      rut: clientRut,
      codigoCliente: clientCode,
      ejecutivo,
      direccionDespacho: direccion,
      direccionNueva,
      comuna,
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
      precioPresentacion: Math.round((item.precioVenta || 0) * (item.kilos || 1)),
      totalItem: Math.round(item.total || 0),
      especialVigente: !!item.isEspecial,
      especialBloqueado: !!item.isBloqueado,
    }));

    const resSave = await fetch("/api/save-to-sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resSave.ok) throw new Error("Error al guardar en Google Sheets.");
    await resSave.json();

    const { filename, base64 } = await generarPDFProfesional({
      numeroNV,
      clientName,
      clientRut,
      ejecutivo,
      direccion,
      direccionNueva,
      comuna,
      subtotal,
      comentarios,
      lines,
    });

    const destinatarios = [
      emailEjecutivo,
      "silvana.pincheira@spartan.cl",
    ].filter(Boolean);

    const subject = `Nota de Venta ${numeroNV}`;
    const message = `
      <p>Se ha generado una Nota de Venta.</p>
      <ul>
        <li><b>Número:</b> ${numeroNV}</li>
        <li><b>Cliente:</b> ${clientName}</li>
        <li><b>RUT:</b> ${clientRut}</li>
        <li><b>Total:</b> ${subtotal.toLocaleString("es-CL", {
          style: "currency",
          currency: "CLP",
        })}</li>
      </ul>
    `;

    const resMail = await fetch("/api/send-notaventa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: destinatarios,
        subject,
        message,
        attachment: {
          filename,
          content: base64,
        },
      }),
    });

    if (!resMail.ok) {
      const err = await resMail.text();
      throw new Error(`Error al enviar correo: ${err || resMail.status}`);
    }

    return { ok: true, message: `✅ Nota guardada y correo enviado.` };
  } catch (error: any) {
    console.error("❌ Error:", error);
    return { ok: false, message: error?.message || "Error inesperado." };
  }
}

// Componente vacío (si estás en una página Next.js)
export default function NotaVentaPage() {
  return null;
}
