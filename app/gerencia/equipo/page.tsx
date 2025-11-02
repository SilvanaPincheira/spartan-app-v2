"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { FaMedal } from "react-icons/fa";

/* === UTILIDADES === */
function clean(value: any) {
  return String(value || "").trim().replace(/\r|\n/g, "").replace(/\s+/g, " ");
}
function parseCSV(text: string) {
  const rows = text.trim().split(/\r?\n/);
  return rows.map((r) => r.split(",").map((v) => v.trim()));
}

export default function EquipoPage() {
  const supabase = createClientComponentClient();
  const [perfil, setPerfil] = useState<any>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [clientesNuevos, setClientesNuevos] = useState<any[]>([]);
  const [convenios, setConvenios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);

      /* === Sesión y perfil === */
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;

      const { data: perfilData } = await supabase
        .from("profiles")
        .select("display_name, department, email")
        .eq("id", user.id)
        .single();

      if (!perfilData) return;
      setPerfil(perfilData);

      /* === Determinar filtro de gerencia === */
      let filtroGerencia = "";
      if (perfilData.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
      else if (perfilData.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
      else if (perfilData.department === "gerencia_ind") filtroGerencia = "ADAMM";

      /* === 1️⃣ Leer hoja de Ventas === */
      const ventasURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXztj-EM_OgRPoKxjRiMleVhH0QVWzG7RSpGIwqMXjUwc_9ENeOYeV9VIcoTpN45vAF3HGZlWl7f4Q/pub?gid=0&single=true&output=csv";
      const ventasText = await fetch(ventasURL).then((r) => r.text());
      const ventasRows = parseCSV(ventasText);
      const ventas = ventasRows
        .slice(1)
        .filter((r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase());

      const rankingTemp = ventas.map((r) => {
        const nombre = r[1];
        const ventasTotales = r
          .slice(2, 13)
          .reduce((acc, val) => acc + (parseFloat(val.replace(/\./g, "").replace(",", ".")) || 0), 0);
        return { nombre, ventasTotales };
      });

      const totalGeneral = rankingTemp.reduce((acc, r) => acc + r.ventasTotales, 0);
      const rankingFinal = rankingTemp
        .sort((a, b) => b.ventasTotales - a.ventasTotales)
        .slice(0, 5)
        .map((r, i) => ({
          ...r,
          posicion: i + 1,
          porcentaje: totalGeneral > 0 ? ((r.ventasTotales / totalGeneral) * 100).toFixed(1) : "0.0",
        }));
      setRanking(rankingFinal);

      /* === 2️⃣ Leer hoja Clientes Nuevos === */
      const clientesURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQp7GbIVB3BqNycXVRvoJLoZk_ZIQ60cPsmaniDY2ch9LKEV_uTsGYvaND5I5RJr7QcwlVoGmZuteTy/pub?gid=0&single=true&output=csv";
      const clientesText = await fetch(clientesURL).then((r) => r.text());
      const clientesRows = parseCSV(clientesText);

      const headerClientes = clientesRows[0];
      const idxVendedor = headerClientes.indexOf("VENDEDOR");
      const idxTotal = headerClientes.indexOf("Total Linea");
      const idxRUT = headerClientes.indexOf("Rut");

      const clientes = clientesRows.slice(1).filter((r) =>
        clean(r[idxVendedor]).toUpperCase().includes(filtroGerencia.toUpperCase())
      );

      const resumenPorEjecutivo: Record<
        string,
        { total: number; clientesUnicos: Set<string> }
      > = {};

      clientes.forEach((r) => {
        const vendedor = clean(r[idxVendedor]);
        const rut = clean(r[idxRUT]);
        const total = parseFloat(r[idxTotal]?.replace(/\./g, "").replace(",", ".")) || 0;

        if (!resumenPorEjecutivo[vendedor])
          resumenPorEjecutivo[vendedor] = { total: 0, clientesUnicos: new Set() };

        resumenPorEjecutivo[vendedor].total += total;
        if (rut) resumenPorEjecutivo[vendedor].clientesUnicos.add(rut);
      });

      const resumenClientes = Object.entries(resumenPorEjecutivo)
        .map(([vendedor, data]) => ({
          vendedor,
          total: data.total,
          cantidadClientes: data.clientesUnicos.size,
          ticketPromedio: data.clientesUnicos.size > 0 ? data.total / data.clientesUnicos.size : 0,
        }))
        .sort((a, b) => b.cantidadClientes - a.cantidadClientes)
        .slice(0, 5);
      setClientesNuevos(resumenClientes);

      /* === 3️⃣ Leer hoja Convenios === */
      const conveniosURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9_PWqSrhUDslNNd3Wtt1VfXjdV9XfB4612o2qWlI-p91OKb5-1UDkkdOQuT422aJn9bMZIQhE-Ppo/pub?gid=0&single=true&output=csv";
      const conveniosText = await fetch(conveniosURL).then((r) => r.text());
      const conveniosRows = parseCSV(conveniosText);

      const headerConv = conveniosRows[0];
      const idxEmp = headerConv.indexOf("Empleado Ventas");
      const idxActivoHasta = headerConv.indexOf("Activo hasta");
      const idxPrecioLista = headerConv.indexOf("Precio Lista");
      const idxPrecioEspecial = headerConv.indexOf("Precio especial");
      const idxDesc = headerConv.indexOf("Descuento en %");

      const hoy = new Date();
      const conveniosFiltrados = conveniosRows.slice(1).filter((r) => {
        const emp = clean(r[idxEmp]);
        const hasta = new Date(r[idxActivoHasta]);
        return (
          clean(emp).toUpperCase().includes(filtroGerencia.toUpperCase()) &&
          (!isNaN(hasta.getTime()) ? hasta >= hoy : true)
        );
      });

      const resumenConv: Record<
        string,
        { cantidad: number; totalDesc: number; promDesc: number; sumDesc: number }
      > = {};

      conveniosFiltrados.forEach((r) => {
        const emp = clean(r[idxEmp]);
        const lista = parseFloat(r[idxPrecioLista]?.replace(/\./g, "").replace(",", ".")) || 0;
        const especial = parseFloat(r[idxPrecioEspecial]?.replace(/\./g, "").replace(",", ".")) || 0;
        const desc = parseFloat(r[idxDesc]?.replace(",", ".")) || 0;
        const ahorro = lista - especial;

        if (!resumenConv[emp])
          resumenConv[emp] = { cantidad: 0, totalDesc: 0, promDesc: 0, sumDesc: 0 };

        resumenConv[emp].cantidad += 1;
        resumenConv[emp].totalDesc += ahorro;
        resumenConv[emp].sumDesc += desc;
      });

      const resumenConvenios = Object.entries(resumenConv)
        .map(([emp, d]) => ({
          emp,
          cantidad: d.cantidad,
          totalAhorro: d.totalDesc,
          promedioDescuento: d.cantidad > 0 ? d.sumDesc / d.cantidad : 0,
        }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);
      setConvenios(resumenConvenios);

      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Cargando datos...</p>;

  /* === UI === */
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">
        Equipo — {perfil?.department?.replace("gerencia_", "").toUpperCase()}
      </h1>
      <p className="text-gray-600 mb-8">
        Gerente: <strong>{perfil?.display_name || perfil?.email}</strong>
      </p>

      {/* === 1️⃣ Top 5 Ventas === */}
      <div className="bg-white border rounded-2xl shadow-sm p-6 mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">🏆 Top 5 Ejecutivos por Ventas Anuales</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600">
              <th className="text-left py-2 px-3">Pos.</th>
              <th className="text-left py-2 px-3">Ejecutivo</th>
              <th className="text-right py-2 px-3">Venta total ($)</th>
              <th className="text-right py-2 px-3">% del total</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r) => (
              <tr key={r.nombre} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 font-semibold flex items-center gap-2">
                  <FaMedal
                    size={18}
                    className={
                      r.posicion === 1
                        ? "text-yellow-400"
                        : r.posicion === 2
                        ? "text-gray-400"
                        : r.posicion === 3
                        ? "text-amber-700"
                        : "text-blue-300"
                    }
                  />
                  {r.posicion}
                </td>
                <td className="py-2 px-3 text-gray-800 font-medium">{r.nombre}</td>
                <td className="py-2 px-3 text-right text-blue-900 font-semibold">
                  {r.ventasTotales.toLocaleString("es-CL")}
                </td>
                <td className="py-2 px-3 text-right text-gray-600">{r.porcentaje}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === 2️⃣ Clientes nuevos === */}
      <div className="bg-white border rounded-2xl shadow-sm p-6 mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">👥 Top 5 Ejecutivos por Clientes Nuevos (RUT únicos)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600">
              <th className="text-left py-2 px-3">Ejecutivo</th>
              <th className="text-right py-2 px-3">Clientes nuevos</th>
              <th className="text-right py-2 px-3">Total vendido ($)</th>
              <th className="text-right py-2 px-3">Ticket promedio ($)</th>
            </tr>
          </thead>
          <tbody>
            {clientesNuevos.map((c) => (
              <tr key={c.vendedor} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-800">{c.vendedor}</td>
                <td className="py-2 px-3 text-right">{c.cantidadClientes}</td>
                <td className="py-2 px-3 text-right text-blue-800 font-semibold">
                  {c.total.toLocaleString("es-CL")}
                </td>
                <td className="py-2 px-3 text-right text-gray-700">
                  {c.ticketPromedio.toLocaleString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === 3️⃣ Convenios activos === */}
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">💰 Convenios Activos y Descuentos</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600">
              <th className="text-left py-2 px-3">Ejecutivo</th>
              <th className="text-right py-2 px-3">Convenios activos</th>
              <th className="text-right py-2 px-3">Prom. descuento (%)</th>
              <th className="text-right py-2 px-3">Ahorro total ($)</th>
            </tr>
          </thead>
          <tbody>
            {convenios.map((c) => (
              <tr key={c.emp} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-800">{c.emp}</td>
                <td className="py-2 px-3 text-right">{c.cantidad}</td>
                <td className="py-2 px-3 text-right text-orange-600 font-semibold">
                  {c.promedioDescuento.toFixed(1)}%
                </td>
                <td className="py-2 px-3 text-right text-green-700 font-semibold">
                  {c.totalAhorro.toLocaleString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
