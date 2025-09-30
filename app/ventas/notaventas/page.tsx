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
     [I] ACCIONES (limpiar/imprimir/guardar+pdf+email)
     ========================================================================== */
  function limpiarTodo() {
    setClientName("");
    setClientRut("");
    setClientCode("");
    setEjecutivo("");
    setDireccion("");
    setDireccionNueva("");
    setComuna("");
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

  // 🔹 Helper para clonar y reemplazar <input>, <select>, <textarea> por spans con sus valores
function cloneForPrint(node: HTMLElement) {
  const clone = node.cloneNode(true) as HTMLElement;

  clone.querySelectorAll("input, textarea, select").forEach((el) => {
    const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const span = document.createElement("span");
    span.textContent = input.value || "";
    span.style.whiteSpace = "pre-wrap";
    span.style.fontSize = "11px";
    span.style.display = "inline-block";
    span.style.minWidth = input.offsetWidth + "px";
    el.replaceWith(span);
  });

  return clone;
}

// 🔹 Genera y descarga PDF desde #printArea mostrando valores en vez de inputs
async function crearYDescargarPdfDesdePrintArea(): Promise<{ filename: string; base64: string }> {
  const input = document.getElementById("printArea") as HTMLElement | null;
  if (!input) throw new Error("No se encontró el contenedor #printArea");

  // Clonamos el nodo y lo preparamos para impresión
  const clone = cloneForPrint(input);

  // Captura con html2canvas (JPEG comprimido para que no pese tanto)
  const canvas = await html2canvas(clone, { scale: 1 });
  const imgData = canvas.toDataURL("image/jpeg", 0.6);

  // Creamos el PDF
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight;
  }

  const filename = `Nota_Venta_${numeroNV || "sin_numero"}.pdf`;
  pdf.save(filename);

  // Devolver en base64 para adjuntar al correo
  const base64 = pdf.output("datauristring").split(",")[1];
  return { filename, base64 };
}

  // 🔻 ÚNICO BOTÓN: guarda -> genera/descarga PDF -> envía email con adjunto
  async function guardarPdfYEnviar() {
    if (procesando) return;
    setProcesando(true);
    setErrorMsg("");
    setSaveMsg("");

    try {
      // 1) Validaciones básicas
      if (!clientName || !clientRut || !clientCode)
        throw new Error("Faltan datos del cliente (Nombre, RUT y Código Cliente).");
      if (lines.length === 0) throw new Error("Agrega al menos un ítem antes de guardar.");
      if (lines.some((l) => l.isBloqueado))
        throw new Error("No puedes guardar: hay precios especiales vencidos en la tabla.");

      // 2) Construir payload y GUARDAR en Google Sheets
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

      setSaving(true);
      const resSave = await fetch("/api/save-to-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaving(false);
      if (!resSave.ok) throw new Error("Error al guardar en Google Sheets.");
      const json = await resSave.json();
      const rows = Number(json?.rows ?? payload.length) || payload.length;
      setSaveMsg(`✅ Nota de venta guardada con ${rows} ítem(s) en Google Sheets.`);

      // 3) Generar y DESCARGAR PDF + obtener base64
      const { filename, base64 } = await crearYDescargarPdfDesdePrintArea();

      // 4) Enviar email con adjunto
      const destinatarios = [emailEjecutivo, "silvana.pincheira@spartan.cl"].filter(Boolean);
      const subject = `Nota de Venta ${numeroNV}`;
      const message = `
        <p>Se ha generado una Nota de Venta.</p>
        <ul>
          <li><b>Número:</b> ${numeroNV}</li>
          <li><b>Cliente:</b> ${clientName}</li>
          <li><b>RUT:</b> ${clientRut}</li>
          <li><b>Total:</b> ${subtotal.toLocaleString("es-CL", { style: "currency", currency: "CLP" })}</li>
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

      alert("✅ Guardado en Sheets, PDF descargado y correo enviado.");
    } catch (e: any) {
      console.error("❌ Error en guardarPdfYEnviar:", e);
      setErrorMsg(e?.message || "Ocurrió un error inesperado.");
      alert(e?.message || "Ocurrió un error inesperado.");
    } finally {
      setProcesando(false);
    }
  }

  /* ==========================================================================
     [J] UI
     ========================================================================== */
  return (
    <>
      <div id="printArea" className="min-h-screen bg-white p-6 text-[12px]">
        {/* ===== ENCABEZADO ===== */}
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

        {/* Mensajes globales */}
        {!!errorMsg && (
          <div className="mb-3 rounded bg-red-50 text-red-700 px-3 py-2 text-sm border border-red-200">
            {errorMsg}
          </div>
        )}
        {!!saveMsg && !errorMsg && (
          <div className="mb-3 rounded bg-green-50 text-green-700 px-3 py-2 text-sm border border-green-200">
            {saveMsg}
          </div>
        )}

        {/* ===== CLIENTE ===== */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <h2 className="font-semibold text-[#2B6CFF] mb-2">Cliente</h2>
          <div className="client-grid grid grid-cols-2 gap-2 text-[12px] print:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Nombre</span>
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

            <label className="flex flex-col gap-1">
              <span className="font-medium">RUT</span>
              <input className="w-full border rounded px-2 py-1" value={clientRut} readOnly />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium">Código Cliente</span>
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

            <label className="flex flex-col gap-1">
              <span className="font-medium">Ejecutivo</span>
              <input className="w-full border rounded px-2 py-1" value={ejecutivo} readOnly />
            </label>

            <label className="flex flex-col gap-1 print:col-span-2">
              <span className="font-medium">Dirección de Despacho</span>
              <input className="w-full border rounded px-2 py-1" value={direccion} readOnly />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium">Dirección nueva</span>
              <input
                className="w-full border rounded px-2 py-1"
                value={direccionNueva}
                onChange={(e) => setDireccionNueva(e.target.value)}
                placeholder="(Opcional)"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium">Comuna</span>
              <input
                className="w-full border rounded px-2 py-1"
                value={comuna}
                onChange={(e) => setComuna(e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* ===== PRODUCTOS ===== */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <div className="flex justify-between mb-2 items-center">
            <h2 className="font-semibold text-[#2B6CFF]">Productos</h2>

            <div className="flex gap-2 print:hidden">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  className={`px-2 py-1 rounded text-xs ${
                    listaSeleccionada === (n as 1 | 2 | 3) ? "bg-blue-500 text-white" : "bg-zinc-200"
                  }`}
                  onClick={() => setListaSeleccionada(n as 1 | 2 | 3)}
                >
                  {n}° Lista
                </button>
              ))}
              <button className="bg-green-500 px-2 py-1 text-xs text-white rounded" onClick={addLine}>
                + Ítem
              </button>
            </div>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="min-w-full text-[11px] border">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="px-2 py-1 text-left" style={{ width: "80px" }}>
                    Código
                  </th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                  <th className="px-2 py-1 text-right print:hidden" style={{ width: "70px" }}>
                    Kg
                  </th>
                  <th className="px-2 py-1 text-right" style={{ width: "80px" }}>
                    Cant
                  </th>
                  <th className="px-2 py-1 text-right print:hidden" style={{ width: "110px" }}>
                    Precio base
                  </th>
                  <th className="px-2 py-1 text-right print:hidden" style={{ width: "80px" }}>
                    % Desc
                  </th>
                  <th className="px-2 py-1 text-right" style={{ width: "110px" }}>
                    Precio venta
                  </th>
                  <th className="px-2 py-1 text-right" style={{ width: "130px" }}>
                    $ Presentación
                  </th>
                  <th className="px-2 py-1 text-right" style={{ width: "130px" }}>
                    Total
                  </th>
                  <th className="print:hidden" />
                </tr>
              </thead>

              <tbody>
                {lines.map((r, i) => {
                  const precioPresentacion = (r.precioVenta || 0) * (r.kilos || 1);
                  return (
                    <tr key={i} className="border-t align-middle">
                      {/* Código */}
                      <td className="px-2 py-1">
                        <input
                          className="w-24 border rounded px-1"
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

                        {r.isEspecial && !r.isBloqueado && (
                          <div className="text-[10px] text-emerald-700 mt-1 print:hidden">
                            ✅ Precio especial vigente
                          </div>
                        )}
                        {r.isBloqueado && (
                          <div className="text-[10px] text-red-600 mt-1 print:hidden">
                            ❌ Precio especial vencido (corrige para continuar)
                          </div>
                        )}
                      </td>

                      {/* Descripción */}
                      <td className="px-2 py-1">
                        <div className="truncate print:whitespace-normal">{r.name}</div>
                      </td>

                      {/* Kg (solo pantalla) */}
                      <td className="px-2 py-1 text-right print:hidden">
                        <input
                          type="number"
                          className="w-16 border rounded text-right"
                          value={r.kilos}
                          onChange={(e) => updateLine(i, "kilos", num(e.target.value))}
                          min={0}
                          step="any"
                        />
                      </td>

                      {/* Cantidad */}
                      <td className="px-2 py-1 text-center">
                        <input
                          type="number"
                          className="w-16 border rounded text-right print:hidden"
                          value={r.qty}
                          onChange={(e) => updateLine(i, "qty", num(e.target.value))}
                          min={0}
                          step="any"
                        />
                        <span className="hidden print:inline">{r.qty}</span>
                      </td>

                      {/* Precio Base (solo pantalla) */}
                      <td className="px-2 py-1 text-right print:hidden">{money(r.priceBase)}</td>

                      {/* % Desc (solo pantalla) */}
                      <td className="px-2 py-1 text-right print:hidden">
                        <input
                          type="number"
                          className="w-16 border rounded text-right"
                          value={r.descuento}
                          onChange={(e) => updateLine(i, "descuento", num(e.target.value))}
                          disabled={r.isEspecial || r.isBloqueado}
                          min={-20}
                          max={20}
                          step="any"
                        />
                      </td>

                      {/* Precio venta $/kg (editable) */}
                      <td className="px-2 py-1 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="w-28 rounded border px-2 py-1 text-right"
                          value={r.precioVenta === 0 ? "" : r.precioVenta}
                          onChange={(e) => {
                            const n = [...lines];
                            n[i].precioVenta = e.target.value === "" ? 0 : Number(e.target.value);
                            setLines(n);
                          }}
                          onBlur={(e) => {
                            updateLine(i, "precioVenta", e.target.value);
                          }}
                          disabled={r.isEspecial || r.isBloqueado}
                        />
                      </td>

                      {/* $ Presentación */}
                      <td className="px-2 py-1 text-right">{money(precioPresentacion)}</td>

                      {/* Total */}
                      <td className="px-2 py-1 text-right">{money(r.total)}</td>

                      {/* Acciones (solo pantalla) */}
                      <td className="px-2 py-1 print:hidden">
                        <button className="text-red-600 text-xs" onClick={() => rmLine(i)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {lines.length > 0 && (
                <>
                  <tfoot className="print:hidden">
                    <tr className="font-semibold bg-zinc-50">
                      <td colSpan={9} className="text-right px-2 py-1 border-t">
                        TOTAL
                      </td>
                      <td className="text-right px-2 py-1 border-t">{money(subtotal)}</td>
                    </tr>
                  </tfoot>

                  <tfoot className="hidden print:table-footer-group">
                    <tr className="font-semibold">
                      <td colSpan={5} className="text-right px-2 py-2" style={{ borderTop: "2px solid #000" }}>
                        TOTAL
                      </td>
                      <td className="text-right px-2 py-2" style={{ borderTop: "2px solid #000" }}>
                        {money(subtotal)}
                      </td>
                    </tr>
                  </tfoot>
                </>
              )}
            </table>
          </div>
        </section>

        {/* ===== ENVÍO Y COMENTARIOS ===== */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <h2 className="font-semibold text-[#2B6CFF] mb-2">📧 Envío y Comentarios</h2>
          <div className="grid grid-cols-2 gap-2 text-[12px] print:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Correo Ejecutivo</span>
              <input
                type="email"
                className="w-full border rounded px-2 py-1"
                value={emailEjecutivo}
                onChange={(e) => setEmailEjecutivo(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Comentarios</span>
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

      {/* ===== BOTONES (solo pantalla) ===== */}
      <div className="flex flex-wrap gap-2 print:hidden px-6 pb-8">
        <button className="bg-zinc-200 px-3 py-1 rounded" onClick={imprimir}>
          🖨️ Imprimir / PDF
        </button>

        {/* 🔹 Botón único: Guarda + descarga PDF + envía email */}
        <button
          className={`px-3 py-1 rounded text-white ${
            procesando ? "bg-zinc-400" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
          onClick={guardarPdfYEnviar}
          disabled={procesando}
        >
          {procesando ? "Procesando..." : "💾 Guardar + 📄 PDF + 📧 Email"}
        </button>

        <button className="bg-zinc-200 px-3 py-1 rounded" onClick={limpiarTodo}>
          🧹 Nueva NV
        </button>
      </div>

 {/* =========================================================================
      [K] ESTILOS DE IMPRESIÓN — PDF profesional
      ======================================================================= */}
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

       input,
       select,
       textarea,
       button {
         border: none !important;
         background: transparent !important;
         box-shadow: none !important;
         padding: 0 !important;
         margin: 0 !important;
         width: auto !important;
         color: #000 !important;
         font-size: 11px !important;
         appearance: none !important;
       }

       .client-grid > label {
         display: inline-block !important;
         width: 32% !important;
         vertical-align: top !important;
         margin-right: 1.5% !important;
       }
       .client-grid > label.print\\:col-span-2 {
         width: 66% !important;
       }

       .overflow-x-auto {
         overflow: visible !important;
       }
       table {
         border-collapse: collapse !important;
         width: 100% !important;
         table-layout: fixed !important;
       }
       th,
       td {
         border: 1px solid #e5e5e5 !important;
         padding: 4px 6px !important;
         vertical-align: middle !important;
         font-variant-numeric: tabular-nums !important;
       }
       thead th {
         background: #f5f5f5 !important;
         text-align: center !important;
         font-weight: 600 !important;
       }

       thead tr th:nth-child(3),
       thead tr th:nth-child(5),
       thead tr th:nth-child(6),
       thead tr th:nth-child(10),
       tbody tr td:nth-child(3),
       tbody tr td:nth-child(5),
       tbody tr td:nth-child(6),
       tbody tr td:nth-child(10) {
         display: none !important;
       }

       th:nth-child(1),
       td:nth-child(1) {
         width: 70px !important;
         font-size: 10px !important;
         text-align: left !important;
       }
       th:nth-child(2),
       td:nth-child(2) {
         width: auto !important;
         white-space: normal !important;
       }
       th:nth-child(4),
       td:nth-child(4) {
         width: 60px !important;
         text-align: center !important;
       }

       th:nth-child(7),
       td:nth-child(7) {
         width: 70px !important;
         text-align: right !important;
         padding-right: 2px !important;
       }
       td:nth-child(7) input {
         width: 60px !important;
         text-align: right !important;
         padding: 0 !important;
         margin: 0 !important;
       }

       th:nth-child(8),
       td:nth-child(8) {
         width: 135px !important;
         text-align: right !important;
         padding-left: 4px !important;
       }

       th:nth-child(9),
       td:nth-child(9) {
         width: 125px !important;
         text-align: right !important;
       }

       tfoot tr td {
         border-top: 2px solid #2B6CFF !important;
         font-weight: 700 !important;
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
     }
     `}</style>
     </>   
   );      {/* cierre del return */}
   }
     
