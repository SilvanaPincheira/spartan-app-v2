"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// 🔹 Función para normalizar el RUT y unificar variantes
function normalizarRut(rut: string): string {
  if (!rut) return "";
  return rut
    .toString()
    .trim()
    .toUpperCase()
    .replace(/^C/, "")           // quita prefijo C
    .replace(/[^\dK\-]/g, "");   // deja solo números, guion y K
}

export default function ClientesInactivos() {
  const supabase = createClientComponentClient();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionEmail(session?.user?.email ?? null);
    };
    fetchSession();
  }, [supabase]);

  useEffect(() => {
    if (!sessionEmail) return;

    const fetchData = async () => {
      try {
        // URLs de Google Sheets
        const urlVentas =
          "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/gviz/tq?tqx=out:json&gid=871602912";
        const urlComodatos =
          "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/gviz/tq?tqx=out:json&gid=551810728";

        // 🔹 Cargar Ventas
        const resVentas = await fetch(urlVentas);
        const textVentas = await resVentas.text();
        const jsonVentas = JSON.parse(textVentas.substring(47).slice(0, -2));
        const ventas = jsonVentas.table.rows.map((r: any) =>
          r.c.map((c: any) => (c ? c.v : ""))
        );

        // 🔹 Cargar Comodatos
        const resComodatos = await fetch(urlComodatos);
        const textComodatos = await resComodatos.text();
        const jsonComodatos = JSON.parse(textComodatos.substring(47).slice(0, -2));
        const comodatos = jsonComodatos.table.rows.map((r: any) =>
          r.c.map((c: any) => (c ? c.v : ""))
        );

        // 🔹 Identificar cabeceras
        const headersVentas = jsonVentas.table.cols.map((c: any) => c.label);
        const headersComodatos = jsonComodatos.table.cols.map((c: any) => c.label);

        const ventasData = ventas.map((row: string[]) =>
          Object.fromEntries(row.map((val, i) => [headersVentas[i], val]))
        );
        const comodatosData = comodatos.map((row: string[]) =>
          Object.fromEntries(row.map((val, i) => [headersComodatos[i], val]))
        );

        // 🔹 Map de Ventas por RUT normalizado
        const ventasMap = new Map<string, { total: number; ultima: string }>();
        ventasData.forEach((v) => {
          const rutBase = normalizarRut(v["Rut Cliente"] || v["Codigo Cliente"]);
          if (!rutBase) return;

          const fecha = new Date(v["DocDate"]);
          const total = Number(v["Global Venta"] || 0);

          if (!ventasMap.has(rutBase)) {
            ventasMap.set(rutBase, { total, ultima: fecha.toISOString() });
          } else {
            const actual = ventasMap.get(rutBase)!;
            actual.total += total;
            if (fecha > new Date(actual.ultima)) {
              actual.ultima = fecha.toISOString();
            }
            ventasMap.set(rutBase, actual);
          }
        });

        // 🔹 Map de Comodatos por RUT normalizado
        const comodatosMap = new Map<string, { total: number; cliente: string; email: string; ejecutivo: string }>();
        comodatosData.forEach((c) => {
          const rutBase = normalizarRut(c["Rut Cliente"] || c["Codigo Cliente"]);
          if (!rutBase) return;

          const total = Number(c["Total"] || 0);
          comodatosMap.set(rutBase, {
            total: (comodatosMap.get(rutBase)?.total || 0) + total,
            cliente: c["Nombre Cliente"] || "",
            email: c["EMAIL_COL"] || "",
            ejecutivo: c["Empleado ventas"] || ""
          });
        });

        // 🔹 Unir datos
        const resultado = Array.from(comodatosMap.keys()).map((rut) => {
          const info = comodatosMap.get(rut)!;
          const ventaInfo = ventasMap.get(rut);

          return {
            rut,
            cliente: info.cliente,
            email: info.email,
            ejecutivo: info.ejecutivo,
            montoComodato: info.total,
            ultimaCompra: ventaInfo ? new Date(ventaInfo.ultima).toLocaleDateString("es-CL") : "—",
            estado: ventaInfo && ventaInfo.total > 0 ? "✅ Con compras" : "🔴 Sin compras 6M",
          };
        });

        // 🔹 Filtrar por el usuario logueado (EMAIL_COL desde Comodatos)
        const filtrado = resultado.filter((r) => r.email === sessionEmail);

        setData(filtrado);
        setLoading(false);
      } catch (err) {
        console.error("Error cargando datos:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionEmail]);

  if (loading) return <p className="p-4">⏳ Cargando datos...</p>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-blue-600 mb-4">
        📊 Clientes con comodatos vigentes sin compras de químicos en 6M
      </h1>
      {sessionEmail && (
        <p className="mb-4 text-sm text-zinc-600">
          👋 Bienvenido <b>{sessionEmail}</b>, aquí puedes ver tus clientes asignados con alerta de inactividad.
        </p>
      )}

      <table className="min-w-full border border-gray-200 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">RUT</th>
            <th className="border px-2 py-1">Cliente</th>
            <th className="border px-2 py-1">Email</th>
            <th className="border px-2 py-1">Ejecutivo</th>
            <th className="border px-2 py-1">Monto Comodato</th>
            <th className="border px-2 py-1">Última compra</th>
            <th className="border px-2 py-1">Estado</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="border px-2 py-1">{row.rut}</td>
              <td className="border px-2 py-1">{row.cliente}</td>
              <td className="border px-2 py-1">{row.email}</td>
              <td className="border px-2 py-1">{row.ejecutivo}</td>
              <td className="border px-2 py-1">
                {row.montoComodato.toLocaleString("es-CL")}
              </td>
              <td className="border px-2 py-1">{row.ultimaCompra}</td>
              <td className="border px-2 py-1">{row.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
