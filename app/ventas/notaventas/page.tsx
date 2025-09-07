// app/ventas/notaventas/page.tsx
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

  /* ---- DOC INFO: N° NV ---- */
  const [numeroNV, setNumeroNV] = useState<string>("");

  // ====== NUEVO: estados para guardar en Supabase ======
  const [customerUUID, setCustomerUUID] = useState<string>(""); // UUID de cliente en Supabase
  const [saving, setSaving] = useState<boolean>(false);
  const [saveMsg, setSaveMsg] = useState<string>("");
  const [saveErr, setSaveErr] = useState<string>("");

  // Genera correlativo local por año (persistente en este navegador)
  function generarNumeroNV(): string {
    if (typeof window === "undefined") return "";
    const year = new Date().getFullYear();
    const key = `nv.counter.${year}`;
    const last = Number(window.localStorage.getItem(key) || "0");
    const next = last + 1;
    window.localStorage.setItem(key, String(next));
    return `NV-${year}-${String(next).padStart(5, "0")}`;
  }

  // Asignar número al cargar
  useEffect(() => {
    setNumeroNV(generarNumeroNV());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /* ---- LÓGICA DE LÍNEAS (NO CAMBIADA) ---- */
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

  /* ---- ACCIONES EXISTENTES ---- */
  function limpiarTodo() {
    setClientName("");
    setClientRut("");
    setClientCode("");
    setDireccion("");
    setEmailEjecutivo("");
    setLines([]);
    setErrorMsg("");
    // nuevo correlativo
    setNumeroNV(generarNumeroNV());
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

  /* ====== NUEVO: GUARDAR EN SUPABASE ====== */
  async function guardarEnSupabase() {
    setSaveMsg("");
    setSaveErr("");

    if (!customerUUID.trim()) {
      setSaveErr("Debes ingresar el UUID del cliente (Supabase).");
      return;
    }

    const round = (n: number) => Math.round(n || 0);

    const payload = {
      customer_id: customerUUID.trim(),
      note_date: new Date().toISOString().slice(0, 10),
      related_quote: null,
      subtotal: round(subtotal),
      tax: 0,
      total: round(subtotal),
      total_amount: round(subtotal), // numeric
      status: "draft" as const,
      document_number: numeroNV || null,
      pdf_url: null,
      created_by: emailEjecutivo || null,
      notes: `NV ${numeroNV} — ${clientName} (${clientCode})`,
    };

    try {
      setSaving(true);
      const res = await fetch("/api/sales-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No se pudo guardar en Supabase.");
      setSaveMsg(`✅ Nota guardada en Supabase (id: ${json?.data?.id ?? "?"})`);
    } catch (e: any) {
      setSaveErr(e?.message || "Error desconocido al guardar.");
    } finally {
      setSaving(false);
    }
  }

  /* ===================== UI ===================== */
  return (
    <>
      <div id="printArea" className="min-h-screen bg-white p-6 text-[12px]">
        {/* Encabezado con logo + número */}
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
            <div><b>N°</b> {numeroNV || "—"}</div>
            <div>{new Date().toLocaleDateString("es-CL")}</div>
          </div>
        </header>

        {errorMsg && (
          <div className="mb-3 rounded bg-red-50 text-red-700 px-3 py-2 text-sm border border-red-200">
            {errorMsg}
          </div>
        )}

        {/* Cliente */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <h2 className="font-semibold text-[#2B6CFF] mb-2">Cliente</h2>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
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

            {/* ====== NUEVO: UUID Cliente (Supabase) ====== */}
            <label className="flex flex-col gap-1 md:col-span-2">
              UUID Cliente (Supabase)
              <input
                className="w-full border rounded px-2 py-1"
                placeholder="83d97533-83fb-4808-a480-0c2154ef3dbb"
                value={customerUUID}
                onChange={(e) => setCustomerUUID(e.target.value)}
              />
              <span className="text-[11px] text-zinc-500">
                Pega aquí el UUID del cliente (tabla de clientes en Supabase). Requerido para guardar.
              </span>
            </label>
          </div>
        </section>

        {/* Productos */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <div className="flex justify-between mb-2">
            <h2 className="font-semibold text-[#2B6CFF]">Productos</h2>
            <button className="bg-zinc-200 px-2 py-1 rounded text-xs" onClick={addLine}>
              + Ítem
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] border">
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

        {/* ====== NUEVOS MENSAJES DE GUARDADO ====== */}
        {saveMsg && (
          <div className="mb-3 rounded bg-green-50 text-green-700 px-3 py-2 text-sm border border-green-200">
            {saveMsg}
          </div>
        )}
        {saveErr && (
          <div className="mb-3 rounded bg-red-50 text-red-700 px-3 py-2 text-sm border border-red-200">
            {saveErr}
          </div>
        )}
      </div>

      {/* Botones acción (ocultos al imprimir) */}
<div className="flex flex-wrap gap-2 print:hidden px-6 pb-8">
  <button className="bg-zinc-200 px-3 py-1 rounded" onClick={imprimir}>
    🖨️ Imprimir / PDF
  </button>

  {/* NUEVO: Guardar en Supabase */}
  <button
    className={`px-3 py-1 rounded text-white ${saving ? "bg-zinc-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
    onClick={guardarEnSupabase}
    disabled={saving}
  >
    {saving ? "Guardando..." : "💾 Guardar en Supabase"}
  </button>

  <button className="bg-blue-500 text-white px-3 py-1 rounded" onClick={enviarEmail}>
    ✉️ Enviar por Email
  </button>
  <button className="bg-zinc-200 px-3 py-1 rounded" onClick={limpiarTodo}>
    🧹 Nueva NV
  </button>
</div>


      {/* Estilos para imprimir idéntico */}
      <style jsx>{`
        :global(html), :global(body), :global(#printArea) {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print {
          body * { visibility: hidden !important; }
          #printArea, #printArea * { visibility: visible !important; }
          #printArea { position: absolute !important; left: 0; top: 0; width: 100% !important; }
          .print\\:hidden { display: none !important; }
          @page { size: A4; margin: 12mm; }
          header, section, table, h1, h2 { break-inside: avoid; }
          thead { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
