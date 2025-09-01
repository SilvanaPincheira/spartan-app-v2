// app/notaventa/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ===================== HELPERS ===================== */
function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
function num(x: unknown) {
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

/* === CSV === */
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
        } else inQuotes = false;
      } else cell += ch;
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

/* ===================== TIPOS ===================== */
type Client = { nombre: string; rut: string; codigo: string; direccion: string };
type Product = { code: string; name: string; price_list: number; kilos: number };
type PrecioEspecial = { codigoSN: string; articulo: string; precio: number };
type Line = {
  code: string;
  name: string;
  kilos: number;
  qty: number;
  priceBase: number;
  descuento: number; // 0..20 (deshabilitado si isEspecial)
  precioVenta: number;
  total: number;
  isEspecial: boolean;
};

/* ===================== COMPONENTE ===================== */
export default function NotaVentaPage() {
  /* ---- CLIENTES ---- */
  const [clients, setClients] = useState<Client[]>([]);
  const [clientName, setClientName] = useState<string>("");
  const [clientRut, setClientRut] = useState<string>("");
  const [clientCode, setClientCode] = useState<string>("");
  const [direccion, setDireccion] = useState<string>("");

  /* ---- PRODUCTOS ---- */
  const [productos, setProductos] = useState<Product[]>([]);
  const [preciosEspeciales, setPreciosEspeciales] = useState<PrecioEspecial[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  /* ---- CORREO ---- */
  const [emailEjecutivo, setEmailEjecutivo] = useState<string>("");

  /* ---- UI ---- */
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Cargar clientes
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
        codigo: String(r.CardCode ?? "").trim(),
        direccion: String(r["Dirección Despacho"] ?? r["Direccion Despacho"] ?? r.Address ?? "").trim(),
      }));
      setClients(list.filter((c) => c.nombre));
    })().catch((e) => setErrorMsg(String(e)));
  }, []);

  // Cargar productos
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

  // Cargar precios especiales
  useEffect(() => {
    (async () => {
      const { id, gid } = normalizeGoogleSheetUrl(
        "https://docs.google.com/spreadsheets/d/1UXVAxwzg-Kh7AWCPnPbxbEpzXnRPR2pDBKrRUFNZKZo/edit?gid=2117069636#gid=2117069636"
      );
      if (!id) return;
      const rows = await loadSheetSmart(id, gid, "Precios especiales");
      const list: PrecioEspecial[] = rows.map((r) => ({
        codigoSN: String((r as any)["Código SN"] ?? "").trim(),
        articulo: String((r as any)["Número de artículo"] ?? "").trim(),
        precio: num((r as any)["Precio especial"] ?? 0),
      }));
      setPreciosEspeciales(list);
    })().catch((e) => setErrorMsg(String(e)));
  }, []);

  /* ---- LOGICA ---- */
  function addLine() {
    setLines((old) => [
      ...old,
      { code: "", name: "", kilos: 1, qty: 1, priceBase: 0, descuento: 0, precioVenta: 0, total: 0, isEspecial: false },
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
      const row = { ...(n[i] ?? n[0]) };
      row.code = prod.code;
      row.name = prod.name;
      row.kilos = prod.kilos || 1;

      // Precio base = especial si aplica
      let precio = prod.price_list || 0;
      let isEspecial = false;
      if (clientCode) {
        const pe = preciosEspeciales.find((p) => p.codigoSN === clientCode && p.articulo === prod.code);
        if (pe) {
          precio = pe.precio || 0;
          isEspecial = true;
        }
      }
      row.priceBase = precio;
      row.isEspecial = isEspecial;

      // Descuento (si no especial)
      row.descuento = isEspecial ? 0 : clamp(num(row.descuento), 0, 20);

      // Precio venta + total
      const pVenta = isEspecial ? precio : precio * (1 - row.descuento / 100);
      row.precioVenta = pVenta;
      row.total = (num(row.qty) || 0) * (num(row.kilos) || 1) * pVenta;

      n[i] = row;
      return n;
    });
  }
  function updateLine(i: number, field: keyof Line, value: unknown) {
    setLines((old) => {
      const n = [...old];
      const current = n[i];
      if (!current) return old;
      const row: Line = { ...current, [field]: value } as Line;

      // Normalizaciones
      row.kilos = num(row.kilos) || 1;
      row.qty = num(row.qty) || 0;
      row.priceBase = num(row.priceBase) || 0;
      row.descuento = row.isEspecial ? 0 : clamp(num(row.descuento), 0, 20);

      const precio = row.priceBase;
      const pVenta = row.isEspecial ? precio : precio * (1 - row.descuento / 100);
      row.precioVenta = pVenta;
      row.total = row.qty * row.kilos * pVenta;

      n[i] = row;
      return n;
    });
  }

  const subtotal = useMemo(() => {
    const s = lines.reduce((a, r) => a + (Number.isFinite(r.total) ? r.total : 0), 0);
    return Number.isFinite(s) ? s : 0;
  }, [lines]);

  function limpiarTodo() {
    setClientName("");
    setClientRut("");
    setClientCode("");
    setDireccion("");
    setEmailEjecutivo("");
    setLines([]);
    setErrorMsg("");
  }

  /* ---- PDF ---- */
  async function descargarPDF() {
    setErrorMsg("");

    // Validaciones mínimas
    if (!clientName || !clientRut || !clientCode) {
      setErrorMsg("Completa los datos del cliente (Nombre, RUT y Código).");
      return;
    }
    if (lines.length === 0) {
      setErrorMsg("Agrega al menos un producto antes de generar el PDF.");
      return;
    }

    // Import dinámico para evitar SSR issues
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;
    const CONTENT_W = W - 2 * M;
    let y = 0;

    // Helper: salto de página
    const ensureSpace = (need: number) => {
      if (y + need <= H - 60) return;
      doc.addPage();
      y = 40;
    };

    // Encabezado degradado
    const gradSteps = 20;
    for (let i = 0; i < gradSteps; i++) {
      const t = i / (gradSteps - 1);
      const r = Math.round(31 + (47 - 31) * t);
      const g = Math.round(78 + (178 - 78) * t);
      const b = Math.round(216 + (255 - 216) * t);
      doc.setFillColor(r, g, b);
      doc.rect((W / gradSteps) * i, 0, W / gradSteps + 1, 80, "F");
    }

    // Logo (best-effort)
    try {
      const logoUrl =
        "https://assets.jumpseller.com/store/spartan-de-chile/themes/317202/options/27648963/Logo-spartan-white.png";
      const res = await fetch(logoUrl);
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
      doc.addImage(base64, "PNG", M, 15, 120, 40);
    } catch {
      // si falla, seguimos sin abortar
    }

    // Título
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text("NOTA DE VENTA", W / 2, 45, { align: "center" });

    y = 100;
    doc.setTextColor(0, 0, 0);

    // Datos Cliente
    doc.setFontSize(11);
    const datosCliente = [
      `Cliente: ${clientName || "-"}`,
      `RUT: ${clientRut || "-"}`,
      `Código: ${clientCode || "-"}`,
      `Dirección: ${direccion || "-"}`,
    ];
    datosCliente.forEach((txt) => {
      ensureSpace(16);
      doc.text(txt, M, y);
      y += 16;
    });

    y += 8;

    // Tabla Productos
    const headers = ["Código", "Descripción", "Kg", "Cant", "Precio", "Total"];
    const colWidths = [80, 220, 50, 50, 80, 80] as const;
    const headerBg = { r: 31, g: 78, b: 216 };
    const colX = (idx: number) => M + colWidths.slice(0, idx).reduce((a, b) => a + b, 0);
    const colRight = (idx: number) => colX(idx) + colWidths[idx];

    // Header
    ensureSpace(28);
    doc.setFillColor(headerBg.r, headerBg.g, headerBg.b);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.rect(M, y, CONTENT_W, 20, "F");
    headers.forEach((h, i) => {
      const xAnchor = i >= 2 ? colRight(i) - 6 : colX(i) + 6;
      doc.text(h, xAnchor, y + 14, { align: i >= 2 ? "right" : "left" });
    });
    y += 22;

    // Filas
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);

    const baseRowHeight = 20;
    for (const r of lines) {
      // Descripción multilínea
      const maxDescWidth = colWidths[1] - 12;
      const descLines = doc.splitTextToSize(String(r.name || ""), maxDescWidth);
      const neededHeight = Math.max(baseRowHeight, 14 + (descLines.length - 1) * 12);

      ensureSpace(neededHeight + 2);

      // Código
      doc.text(String(r.code || ""), colX(0) + 6, y + 14);
      // Descripción
      let dy = 0;
      descLines.forEach((ln: string) => {
        doc.text(ln, colX(1) + 6, y + 14 + dy);
        dy += 12;
      });
      // Kg (right)
      doc.text(String(r.kilos ?? ""), colRight(2) - 6, y + 14, { align: "right" });
      // Cant (right)
      doc.text(String(r.qty ?? ""), colRight(3) - 6, y + 14, { align: "right" });
      // Precio (right)
      doc.text(money(r.precioVenta), colRight(4) - 6, y + 14, { align: "right" });
      // Total (right)
      doc.text(money(r.total), colRight(5) - 6, y + 14, { align: "right" });

      // línea separadora
      y += neededHeight;
      doc.setDrawColor(230);
      doc.line(M, y, M + CONTENT_W, y);
      y += 2;
    }

    y += 10;

    // Totales
    const neto = subtotal;
    const iva = neto * 0.19;
    const total = neto + iva;
    const boxW = 220;
    const boxX = W - M - boxW;

    ensureSpace(84);
    doc.setFillColor(245, 246, 250);
    doc.roundedRect(boxX, y, boxW, 78, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Neto: ${money(neto)}`, boxX + boxW - 10, y + 22, { align: "right" });
    doc.text(`IVA (19%): ${money(iva)}`, boxX + boxW - 10, y + 40, { align: "right" });
    doc.text(`TOTAL: ${money(total)}`, boxX + boxW - 10, y + 58, { align: "right" });

    // Pie
    doc.setFontSize(10);
    doc.text("Ejecutivo de Ventas:", M, H - 60);
    doc.text(emailEjecutivo || "__________________", M + 140, H - 60);

    doc.save("NotaVenta.pdf");
  }

  function enviarEmail() {
    const destinatarios = [emailEjecutivo, "silvana.pincheira@spartan.cl"]
      .filter((x) => (x || "").trim().length > 0)
      .join(",");
    const subject = encodeURIComponent("Nota de Venta");
    const body = encodeURIComponent("Adjunto la Nota de Venta generada.");
    window.location.href = `mailto:${destinatarios}?subject=${subject}&body=${body}`;
  }

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-4">📝 Nota de Venta</h1>

      {errorMsg && (
        <div className="mb-3 rounded bg-red-50 text-red-700 px-3 py-2 text-sm border border-red-200">
          {errorMsg}
        </div>
      )}

      {/* Cliente */}
      <section className="bg-white shadow p-4 rounded mb-4">
        <h2 className="font-semibold text-[#2B6CFF] mb-2">Cliente</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="flex flex-col gap-1">
            Nombre
            <input
              className="w-full border rounded px-2 py-1"
              value={clientName}
              onChange={(e) => {
                const val = e.target.value;
                setClientName(val);
                const row = clients.find((c) => normalize(c.nombre) === normalize(val));
                if (row) {
                  setClientRut(row.rut || "");
                  setClientCode("");
                  setDireccion("");
                }
              }}
              list="clientesList"
            />
            <datalist id="clientesList">
              {clients.map((c, i) => (
                <option key={`${c.codigo}-${i}`} value={c.nombre} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1">
            RUT
            <input className="w-full border rounded px-2 py-1" value={clientRut} readOnly />
          </label>

          <label className="flex flex-col gap-1">
            Código Cliente
            <select
              className="w-full border rounded px-2 py-1"
              value={clientCode}
              onChange={(e) => {
                const val = e.target.value;
                setClientCode(val);
                const row = clients.find((c) => c.codigo === val);
                if (row) {
                  setClientRut(row.rut || "");
                  setDireccion(row.direccion || "");
                }
              }}
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
            Dirección
            <input className="w-full border rounded px-2 py-1" value={direccion} readOnly />
          </label>
        </div>
      </section>

      {/* Productos */}
      <section className="bg-white shadow p-4 rounded mb-4">
        <div className="flex justify-between mb-2">
          <h2 className="font-semibold text-[#2B6CFF]">Productos</h2>
          <button className="bg-zinc-200 px-2 py-1 rounded text-sm" onClick={addLine}>
            + Ítem
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-2 py-1 text-left">Código</th>
                <th className="px-2 py-1 text-left">Descripción</th>
                <th className="px-2 py-1 text-right">Kg</th>
                <th className="px-2 py-1 text-right">Cantidad</th>
                <th className="px-2 py-1 text-right">Precio base</th>
                <th className="px-2 py-1 text-right">% Desc</th>
                <th className="px-2 py-1 text-right">Precio venta</th>
                <th className="px-2 py-1 text-right">Total</th>
                <th />
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
                  <td className="px-2 py-1 text-right">{money(r.priceBase)}</td>
                  <td className="px-2 py-1 text-right">
                    <input
                      type="number"
                      className="w-16 border rounded text-right"
                      value={r.descuento}
                      onChange={(e) => updateLine(i, "descuento", num(e.target.value))}
                      disabled={r.isEspecial}
                      min={0}
                      max={20}
                      step="any"
                    />
                  </td>
                  <td className="px-2 py-1 text-right">{money(r.precioVenta)}</td>
                  <td className="px-2 py-1 text-right">{money(r.total)}</td>
                  <td className="px-2 py-1">
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
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Correo */}
      <section className="bg-white shadow p-4 rounded mb-4">
        <h2 className="font-semibold text-[#2B6CFF] mb-2">📧 Envío</h2>
        <label className="flex flex-col gap-1">
          Correo Ejecutivo
          <input
            type="email"
            className="w-full border rounded px-2 py-1"
            value={emailEjecutivo}
            onChange={(e) => setEmailEjecutivo(e.target.value)}
          />
        </label>
      </section>

      {/* Botones */}
      <div className="flex gap-2">
        <button className="bg-zinc-200 px-3 py-1 rounded" onClick={descargarPDF}>
          📄 Descargar PDF
        </button>
        <button className="bg-blue-500 text-white px-3 py-1 rounded" onClick={enviarEmail}>
          ✉️ Enviar por Email
        </button>
        <button className="bg-zinc-200 px-3 py-1 rounded" onClick={limpiarTodo}>
          🧹 Limpiar
        </button>
      </div>
    </div>
  );
}
