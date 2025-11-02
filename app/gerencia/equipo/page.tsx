"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { FaMedal } from "react-icons/fa";

function clean(v: any) {
  return String(v || "").trim().replace(/\r|\n/g, "").replace(/\s+/g, " ");
}
function parseCSV(text: string) {
  const rows = text.trim().split(/\r?\n/);
  return rows.map((r) => r.split(",").map((v) => v.trim()));
}

export default function EquipoPage() {
  const supabase = createClientComponentClient();
  const [perfil, setPerfil] = useState<any>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [convenios, setConvenios] = useState<any[]>([]);
  const [mostrarTodosClientes, setMostrarTodosClientes] = useState(false);
  const [mostrarTodosConvenios, setMostrarTodosConvenios] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);

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

      let filtroGerencia = "";
      if (perfilData.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
      else if (perfilData.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
      else if (perfilData.department === "gerencia_ind") filtroGerencia = "ADAMM";

      /* === 1️⃣ Ventas 2025 === */
      const ventasURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXztj-EM_OgRPoKxjRiMleVhH0QVWzG7RSpGIwqMXjUwc_9ENeOYeV9VIcoTpN45vAF3HGZlWl7f4Q/pub?gid=0&single=true&output=csv";
      const ventasText = await fetch(ventasURL).then((r) => r.text());
      const ventasRows = parseCSV(ventasText);

      const ventas = ventasRows
        .slice(1)
        .filter((r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase());

      const rankingTemp = ventas.map((r) => {
        const nombre = clean(r[1]);
        const total = r
          .slice(2, 13)
          .reduce((acc, val) => acc + (parseFloat(val.replace(/\./g, "").replace(",", ".")) || 0), 0);
        return { nombre, total };
      });

      const totalGeneral = rankingTemp.reduce((a, b) => a + b.total, 0);
      const rankingFinal = rankingTemp
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
        .map((r, i) => ({
          ...r,
          posicion: i + 1,
          porcentaje: totalGeneral > 0 ? ((r.total / totalGeneral) * 100).toFixed(1) : "0",
        }));
      setRanking(rankingFinal);

      /* === 2️⃣ Clientes nuevos 2025 === */
      const clientesURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQp7GbIVB3BqNycXVRvoJLoZk_ZIQ60cPsmaniDY2ch9LKEV_uTsGYvaND5I5RJr7QcwlVoGmZuteTy/pub?gid=0&single=true&output=csv";
      const clientesText = await fetch(clientesURL).then((r) => r.text());
      const clientesRows = parseCSV(clientesText);

      const headClientes = clientesRows[0];
      const idxEjecutivo = headClientes.indexOf("Ejecutivo");
      const idxTotal = headClientes.indexOf("Total Linea");
      const idxRUT = headClientes.indexOf("Rut");

      const filasClientes = clientesRows.slice(1).filter((r) =>
        clean(r[idxEjecutivo]).toUpperCase().includes(filtroGerencia.toUpperCase())
      );

      const resumenClientes: Record<string, { total: number; ruts: Set<string> }> = {};
      filasClientes.forEach((r) => {
        const ejecutivo = clean(r[idxEjecutivo]);
        const rut = clean(r[idxRUT]);
        const total = parseFloat(r[idxTotal]?.replace(/\./g, "").replace(",", ".")) || 0;
        if (!resumenClientes[ejecutivo])
          resumenClientes[ejecutivo] = { total: 0, ruts: new Set() };
        resumenClientes[ejecutivo].total += total;
        if (rut) resumenClientes[ejecutivo].ruts.add(rut);
      });

      const clientesFinal = Object.entries(resumenClientes)
        .map(([ejecutivo, data]) => ({
          ejecutivo,
          clientesNuevos: data.ruts.size,
          totalVendido: data.total,
          ticketPromedio:
            data.ruts.size > 0 ? data.total / data.ruts.size : 0,
        }))
        .sort((a, b) => b.clientesNuevos - a.clientesNuevos);
      setClientes(clientesFinal);

      /* === 3️⃣ Convenios === */
      const convURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9_PWqSrhUDslNNd3Wtt1VfXjdV9XfB4612o2qWlI-p91OKb5-1UDkkdOQuT422aJn9bMZIQhE-Ppo/pub?gid=0&single=true&output=csv";
      const convText = await fetch(convURL).then((r) => r.text());
      const convRows = parseCSV(convText);

      const headConv = convRows[0];
      const idxEjec = headConv.indexOf("Ejecutivo");
      const idxActivoHasta = headConv.indexOf("Activo hasta");
      const idxLista = headConv.indexOf("Precio Lista");
      const idxEspecial = headConv.indexOf("Precio especial");
      const idxDesc = headConv.indexOf("Descuento en %");

      const hoy = new Date();
      const resumenConv: Record<string, { cant: number; ahorro: number; sumDesc: number }> = {};

      convRows.slice(1).forEach((r) => {
        const ejecutivo = clean(r[idxEjec]);
        const hasta = new Date(r[idxActivoHasta]);
        if (!ejecutivo.toUpperCase().includes(filtroGerencia.toUpperCase())) return;
        if (!isNaN(hasta.getTime()) && hasta < hoy) return;

        const lista = parseFloat(r[idxLista]?.replace(/\./g, "").replace(",", ".")) || 0;
        const especial = parseFloat(r[idxEspecial]?.replace(/\./g, "").replace(",", ".")) || 0;
        const desc = parseFloat(r[idxDesc]?.replace(",", ".")) || 0;
        const ahorro = lista - especial;

        if (!resumenConv[ejecutivo])
          resumenConv[ejecutivo] = { cant: 0, ahorro: 0, sumDesc: 0 };

        resumenConv[ejecutivo].cant += 1;
        resumenConv[ejecutivo].ahorro += ahorro;
        resumenConv[ejecutivo].sumDesc += desc;
      });

      const conveniosFinal = Object.entries(resumenConv)
        .map(([ejecutivo, d]) => ({
          ejecutivo,
          cantidad: d.cant,
          promedioDescuento: d.cant > 0 ? d.sumDesc / d.cant : 0,
          ahorroTotal: d.ahorro,
        }))
        .sort((a, b) => b.cantidad - a.cantidad);
      setConvenios(conveniosFinal);

      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Cargando datos...</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">
        Equipo — {perfil?.department?.replace("gerencia_", "").toUpperCase()}
      </h1>
      <p className="text-gray-600 mb-8">
        Gerente: <strong>{perfil?.display_name || perfil?.email}</strong>
      </p>

      {/* === 1️⃣ Ranking === */}
      <div className="bg-white border rounded-2xl shadow-sm p-6 mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          🏆 Top 5 Ejecutivos por Ventas Anuales
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600">
              <th className="text-left py-2 px-3">Pos.</th>
              <th className="text-left py-2 px-3">Ejecutivo</th>
              <th className="text-right py-2 px-3">Ventas ($)</th>
              <th className="text-right py-2 px-3">% del total</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r) => (
              <tr key={r.nombre} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 flex items-center gap-2 font-semibold">
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
                <td className="py-2 px-3 text-right text-blue-800 font-semibold">
                  {r.total.toLocaleString("es-CL")}
                </td>
                <td className="py-2 px-3 text-right text-gray-600">{r.porcentaje}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === 2️⃣ Clientes nuevos === */}
      <div className="bg-white border rounded-2xl shadow-sm p-6 mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          👥 Clientes Nuevos 2025
        </h2>
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
            {(mostrarTodosClientes ? clientes : clientes.slice(0, 5)).map((c) => (
              <tr key={c.ejecutivo} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-800">{c.ejecutivo}</td>
                <td className="py-2 px-3 text-right">{c.clientesNuevos}</td>
                <td className="py-2 px-3 text-right text-green-700 font-semibold">
                  {c.totalVendido.toLocaleString("es-CL")}
                </td>
                <td className="py-2 px-3 text-right text-gray-700">
                  {c.ticketPromedio.toLocaleString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clientes.length > 5 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setMostrarTodosClientes(!mostrarTodosClientes)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              {mostrarTodosClientes ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
        )}
      </div>

      {/* === 3️⃣ Convenios === */}
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          💰 Convenios Activos
        </h2>
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
            {(mostrarTodosConvenios ? convenios : convenios.slice(0, 5)).map((c) => (
              <tr key={c.ejecutivo} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-800">{c.ejecutivo}</td>
                <td className="py-2 px-3 text-right">{c.cantidad}</td>
                <td
                  className={`py-2 px-3 text-right font-semibold ${
                    c.promedioDescuento > 20
                      ? "text-red-600"
                      : c.promedioDescuento < 10
                      ? "text-green-600"
                      : "text-orange-500"
                  }`}
                >
                  {c.promedioDescuento.toFixed(1)}%
                </td>
                <td className="py-2 px-3 text-right text-blue-800 font-semibold">
                  {c.ahorroTotal.toLocaleString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {convenios.length > 5 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setMostrarTodosConvenios(!mostrarTodosConvenios)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              {mostrarTodosConvenios ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
