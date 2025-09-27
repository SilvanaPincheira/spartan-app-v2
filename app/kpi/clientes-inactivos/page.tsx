"use client";

import { useEffect, useMemo, useState } from "react";

/* ===== Helpers ===== */
const normEmail = (s: string) => (s || "").trim().toLowerCase();
function sanitizeRut(rut: string) {
  return (rut || "").replace(/[^0-9Kk]/g, "").toUpperCase();
}
function parseDateLike(d: any): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}
function num(x: any) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
async function fetchCsv(spreadsheetId: string, gid: string) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();

  // CSV simple
  const rows = txt.split("\n").map((r) => r.split(","));
  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const obj: any = {};
    headers.forEach((h, i) => (obj[h.trim()] = (r[i] || "").trim()));
    return obj;
  });
}

/* ===== Page ===== */
export default function ClientesInactivos() {
  // URLs (si cambian en el futuro, basta actualizar aquí)
  const ventasId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
  const comId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
  const ventasGid = "871602912";
  const comGid = "551810728";

  // estado
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // correo del usuario (persistente)
  const [email, setEmail] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("kpi.email") || "";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kpi.email", email);
    }
  }, [email]);

  // modo admin (?admin=1 ve todo)
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      setAdmin(u.searchParams.get("admin") === "1");
      const qEmail = u.searchParams.get("email");
      if (qEmail && !email) setEmail(qEmail);
    }
  }, []);

  const emailFilter = useMemo(() => normEmail(email), [email]);
  const showAll = admin || !emailFilter;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const [ventas, comodatos] = await Promise.all([
          fetchCsv(ventasId, ventasGid),
          fetchCsv(comId, comGid),
        ]);

        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 6);

        /* === FILTRO POR EMAIL_COL (si no admin y hay email) === */
        const ventasFiltradas = showAll
          ? ventas
          : ventas.filter(
              (v) => normEmail(v["EMAIL_COL"] || v["Email"] || "") === emailFilter
            );

        const comodatosFiltrados = showAll
          ? comodatos
          : comodatos.filter(
              (c) => normEmail(c["EMAIL_COL"] || c["Email"] || "") === emailFilter
            );

        /* === Consolidar ventas por RUT === */
        const ultimaCompra: Record<string, Date> = {};
        const activos = new Set<string>();

        for (const v of ventasFiltradas) {
          const rut = sanitizeRut(v["Rut Cliente"] || v["RUT Cliente"] || v["RUT"]);
          const fecha = parseDateLike(
            v["DocDate"] || v["Fecha Documento"] || v["Posting Date"] || v["Fecha Doc."]
          );
          if (!rut || !fecha) continue;

          if (!ultimaCompra[rut] || fecha > ultimaCompra[rut]) {
            ultimaCompra[rut] = fecha;
          }
          if (fecha >= cutoff) activos.add(rut);
        }

        /* === Consolidar comodatos por RUT === */
        const comodatosPorRut: Record<string, any> = {};

        for (const c of comodatosFiltrados) {
          const rut = sanitizeRut(c["Rut Cliente"] || c["RUT Cliente"] || c["RUT"]);
          if (!rut) continue;

          const nombre = c["Nombre Cliente"] || "";
          const ejecutivo = c["Empleado ventas"] || c["Èmpleado Ventas"] || "";
          const emailC = c["EMAIL_COL"] || "";
          const monto = num(c["Total"]);

          if (!comodatosPorRut[rut]) {
            comodatosPorRut[rut] = {
              rut,
              nombre,
              email: emailC,
              ejecutivo,
              monto: 0,
            };
          }

          comodatosPorRut[rut].monto += monto;
        }

        /* === Resultado: con comodato > 0 y sin compras en 6M === */
        const resultado: any[] = [];

        Object.values(comodatosPorRut).forEach((c: any) => {
          if (c.monto <= 0) return;
          if (activos.has(c.rut)) return;

          resultado.push({
            rut: c.rut,
            nombre: c.nombre,
            email: c.email,
            ejecutivo: c.ejecutivo,
            monto: c.monto,
            ultimaCompra: ultimaCompra[c.rut]
              ? ultimaCompra[c.rut].toLocaleDateString("es-CL")
              : "—",
            estado: "Sin compras 6M",
          });
        });

        // ordenar por monto comodato desc
        resultado.sort((a, b) => b.monto - a.monto);

        setData(resultado);
      } catch (err) {
        console.error("Error KPI:", err);
        setData([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [emailFilter, showAll]);

  return (
    <div className="p-6">
      <div className="mb-3 flex items-end gap-3">
        <h1 className="text-xl font-bold text-[#2B6CFF]">
          📊 Clientes con comodatos vigentes sin compras de químicos en 6M
        </h1>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-zinc-600">Mi correo</span>
            <input
              type="email"
              className="rounded border px-2 py-1"
              placeholder="tu@spartan.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {!showAll && (
            <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
              Filtrando por: {emailFilter}
            </span>
          )}
          {admin && (
            <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
              Admin: sin filtro
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <table className="min-w-full text-sm border border-zinc-200 shadow-sm">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-2 py-2 text-left">RUT</th>
              <th className="px-2 py-2 text-left">Cliente</th>
              <th className="px-2 py-2 text-left">Email</th>
              <th className="px-2 py-2 text-left">Ejecutivo</th>
              <th className="px-2 py-2 text-right">Monto Comodato</th>
              <th className="px-2 py-2 text-left">Última compra</th>
              <th className="px-2 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-4 text-green-700">
                  ✅ No hay clientes inactivos con comodato vigente
                </td>
              </tr>
            )}
            {data.map((d, i) => (
              <tr key={i} className="border-t hover:bg-zinc-50">
                <td className="px-2 py-1">{d.rut}</td>
                <td className="px-2 py-1">{d.nombre}</td>
                <td className="px-2 py-1">{d.email}</td>
                <td className="px-2 py-1">{d.ejecutivo}</td>
                <td className="px-2 py-1 text-right">
                  {d.monto.toLocaleString("es-CL")}
                </td>
                <td className="px-2 py-1">{d.ultimaCompra}</td>
                <td className="px-2 py-1">
                  <span className="inline-flex items-center gap-1 text-red-600">
                    🔴 {d.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
