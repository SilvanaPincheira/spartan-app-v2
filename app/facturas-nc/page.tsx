// app/facturas-nc/page.tsx
// -----------------------------------------------------------------------------
// FACTURAS Y NOTAS DE CRÉDITO — con columnMap robusto y detalle por Folio
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* =============================== Helpers ================================== */
function normKey(k: string) {
  return (k || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
function parseCsv(text: string): Record<string, string>[] {
  // parser simple con soporte de comillas
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;
  const s = (text || "").replace(/\r/g, "");

  const pushCell = () => { row.push(cell); cell = ""; };
  const pushRow = () => { if (row.length) rows.push(row); row = []; };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") pushCell();
      else if (ch === "\n") { pushCell(); pushRow(); }
      else cell += ch;
    }
  }
  if (cell.length || row.length) { pushCell(); pushRow(); }
  if (!rows.length) return [];
  const headers = rows[0];
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c.trim() === "")) continue;
    const o: Record<string, string> = {};
    headers.forEach((h, j) => (o[h.trim()] = (r[j] ?? "").trim()));
    out.push(o);
  }
  return out;
}
function money(n: any) {
  const v = Number(String(n).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(v) || v === 0) return "-";
  return v.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}
function num(n: any) {
  const v = Number(String(n).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

/* =========================== Column mapping =============================== */
// nombres canónicos -> posibles variantes normalizadas
const COLS: Record<string, string[]> = {
  tipo_dte: ["tipo_dte", "tipo__dte", "tipo_dte_"],
  periodo: ["periodo", "periodo_mes", "periodo_"],
  empleado_ventas: ["empleado_ventas", "empleado_de_ventas", "mpleado_ventas", "empleado_ventas_"],
  codigo_cliente: ["codigo_cliente", "codigocliente", "cod_cliente", "cardcode"],
  rut_cliente: ["rut_cliente", "lictradnum", "rut"],
  nombre_cliente: ["nombre_cliente", "cardname", "cliente", "razon_social", "nombre"],
  direccion: ["direccion", "direccion_1", "direccion_fact", "direccion_despacho", "direccion_despacho_"],
  comuna: ["comuna"],
  ciudad: ["ciudad"],
  folionum: ["folionum", "folio", "folio_num", "folionumero"],
  global_venta: ["global_venta", "total_linea", "monto", "total", "total_doc", "total_documento"],
  itemcode: ["itemcode", "codigo_producto", "codigo", "articulo"],
  dscription: ["dscription", "descripcion", "dscript", "u_descripcion_det"],
  quantity: ["quantity", "cantidad", "qty"],
  cantidad_kilos: ["cantidad_kilos", "kilos", "cantidadkg", "cant_kilos"],
  email_col: ["email_col", "email", "email_col_1", "email_vendedor"],
  docnum: ["docnum"], // opcional por si quieres usarlo
};

function normalizeRow(raw: Record<string, string>) {
  // indexa por clave normalizada
  const idx: Record<string, string> = {};
  for (const k of Object.keys(raw)) idx[normKey(k)] = raw[k];

  const pick = (canon: string) => {
    for (const key of COLS[canon] || []) {
      if (idx[key] != null && String(idx[key]).trim() !== "") return idx[key];
    }
    return "";
  };

  return {
    tipo_dte: pick("tipo_dte"),
    periodo: pick("periodo"),
    empleado_ventas: pick("empleado_ventas"),
    codigo_cliente: pick("codigo_cliente"),
    rut_cliente: pick("rut_cliente"),
    nombre_cliente: pick("nombre_cliente"),
    direccion: pick("direccion"),
    comuna: pick("comuna"),
    ciudad: pick("ciudad"),
    folionum: pick("folionum"),
    global_venta: pick("global_venta"),
    itemcode: pick("itemcode"),
    dscription: pick("dscription"),
    quantity: pick("quantity"),
    cantidad_kilos: pick("cantidad_kilos"),
    email_col: (pick("email_col") || "").toLowerCase().trim(),
    docnum: pick("docnum"),
  };
}

/* ============================== Página =================================== */
export default function FacturasNCPage() {
  const [userEmail, setUserEmail] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [detalle, setDetalle] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  const SHEET_CSV =
    "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/export?format=csv&gid=871602912";
  const ADMIN = "silvana.pincheira@spartan.cl";

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClientComponentClient();
        const { data: { user } } = await supabase.auth.getUser();
        const me = (user?.email || "").toLowerCase().trim();
        setUserEmail(me);

        const res = await fetch(SHEET_CSV, { cache: "no-store" });
        const txt = await res.text();
        const raw = parseCsv(txt);
        const norm = raw.map(normalizeRow);

        // filtro por EMAIL_COL (si no es admin)
        const visible = me === ADMIN || !me
          ? norm
          : norm.filter(r => r.email_col === me);

        setRows(visible);
      } catch (e) {
        console.error("Error cargando ventas:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // agrupar por FolioNum para listado principal
  const grupos = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of rows) {
      const folio = r.folionum || "(sin folio)";
      if (!m.has(folio)) m.set(folio, []);
      m.get(folio)!.push(r);
    }
    return m;
  }, [rows]);

  // convertir grupos a resumen
  const resumen = useMemo(() => {
    const out: any[] = [];
    for (const [folio, items] of grupos) {
      const first = items[0] || {};
      const total = items.reduce((acc, it) => acc + num(it.global_venta), 0);
      out.push({
        tipo_dte: first.tipo_dte,
        periodo: first.periodo,
        empleado_ventas: first.empleado_ventas,
        codigo_cliente: first.codigo_cliente,
        nombre_cliente: first.nombre_cliente,
        direccion: first.direccion,
        comuna: first.comuna,
        ciudad: first.ciudad,
        folionum: folio,
        total_doc: total,
      });
    }
    // orden opcional: por folio descendente si es numérico
    out.sort((a, b) => (Number(b.folionum) || 0) - (Number(a.folionum) || 0));
    return out;
  }, [grupos]);

  // filtro de búsqueda
  const filtered = useMemo(() => {
    if (!search) return resumen;
    const s = (search || "").toLowerCase().trim();
    return resumen.filter(r =>
      String(r.folionum || "").toLowerCase().includes(s) ||
      String(r.codigo_cliente || "").toLowerCase().includes(s) ||
      String(r.nombre_cliente || "").toLowerCase().includes(s) ||
      String(r.rut_cliente || "").toLowerCase().includes(s)
    );
  }, [resumen, search]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
        🧾 Facturas y Notas de Crédito
      </h1>

      {/* Filtro */}
      <div className="mb-4 flex items-center gap-2">
        <input
          className="w-full max-w-xl border rounded px-3 py-2"
          placeholder="Buscar por RUT, Cliente o Folio…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {userEmail && (
          <span className="text-xs text-zinc-500">
            Sesión: {userEmail === ADMIN ? "Admin" : userEmail}
          </span>
        )}
      </div>

      {loading ? (
        <div>Cargando…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-2 py-1 border">Tipo_DTE</th>
                <th className="px-2 py-1 border">Periodo</th>
                <th className="px-2 py-1 border">Empleado Ventas</th>
                <th className="px-2 py-1 border">Codigo Cliente</th>
                <th className="px-2 py-1 border">Nombre Cliente</th>
                <th className="px-2 py-1 border">Direccion</th>
                <th className="px-2 py-1 border">Comuna</th>
                <th className="px-2 py-1 border">Ciudad</th>
                <th className="px-2 py-1 border">FolioNum</th>
                <th className="px-2 py-1 border text-right">Global Venta</th>
                <th className="px-2 py-1 border">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-2 py-4 text-center text-zinc-500">
                    Sin documentos para mostrar.
                  </td>
                </tr>
              )}
              {filtered.map((r, i) => (
                <tr key={i} className="border-t hover:bg-zinc-50">
                  <td className="px-2 py-1 border">{r.tipo_dte}</td>
                  <td className="px-2 py-1 border">{r.periodo}</td>
                  <td className="px-2 py-1 border">{r.empleado_ventas}</td>
                  <td className="px-2 py-1 border">{r.codigo_cliente}</td>
                  <td className="px-2 py-1 border">{r.nombre_cliente}</td>
                  <td className="px-2 py-1 border">{r.direccion}</td>
                  <td className="px-2 py-1 border">{r.comuna}</td>
                  <td className="px-2 py-1 border">{r.ciudad}</td>
                  <td className="px-2 py-1 border">{r.folionum}</td>
                  <td className="px-2 py-1 border text-right">
                    {money(r.total_doc)}
                  </td>
                  <td className="px-2 py-1 border">
                    <button
                      className="text-blue-600 underline"
                      onClick={() => setDetalle(grupos.get(r.folionum) || [])}
                    >
                      Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Modal Detalle */}
          {detalle && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded shadow-lg max-w-5xl w-full p-6 relative">
                <button
                  onClick={() => setDetalle(null)}
                  className="absolute top-2 right-2 text-zinc-600"
                >
                  ✖
                </button>
                <h2 className="text-lg font-semibold mb-4">
                  Detalle — Folio {detalle[0]?.folionum || ""}
                </h2>
                <table className="min-w-full border text-sm">
                  <thead className="bg-zinc-100">
                    <tr>
                      <th className="px-2 py-1 border">ItemCode</th>
                      <th className="px-2 py-1 border">Dscription</th>
                      <th className="px-2 py-1 border text-right">Quantity</th>
                      <th className="px-2 py-1 border text-right">Cantidad Kilos</th>
                      <th className="px-2 py-1 border text-right">Global Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((d, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 border">{d.itemcode}</td>
                        <td className="px-2 py-1 border">{d.dscription}</td>
                        <td className="px-2 py-1 border text-right">{d.quantity}</td>
                        <td className="px-2 py-1 border text-right">{d.cantidad_kilos}</td>
                        <td className="px-2 py-1 border text-right">{money(d.global_venta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
