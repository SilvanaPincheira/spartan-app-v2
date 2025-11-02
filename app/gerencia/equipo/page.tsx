"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { FiUsers, FiDollarSign } from "react-icons/fi";

/* === Funciones utilitarias === */
function clean(value: any) {
  return String(value || "").trim().replace(/\r|\n/g, "").replace(/\s+/g, " ");
}

function parseCSV(text: string) {
  return text
    .trim()
    .split("\n")
    .map((line) => line.split(",").map((v) => v.replace(/^"|"$/g, "")));
}

/* === Tipos === */
type EjecutivoVenta = { ejecutivo: string; totalVenta: number };
type ClienteNuevo = {
  ejecutivo: string;
  clientes: number;
  total: number;
  ticket: number;
};
type Convenio = {
  ejecutivo: string;
  convenios: number;
  promDesc: number;
  ahorro: number;
};

export default function EquipoPage() {
  const supabase = createClientComponentClient();
  const [perfil, setPerfil] = useState<any>(null);
  const [topEjecutivos, setTopEjecutivos] = useState<EjecutivoVenta[]>([]);
  const [clientesNuevos, setClientesNuevos] = useState<ClienteNuevo[]>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [mostrarClientes, setMostrarClientes] = useState(false);
  const [mostrarConvenios, setMostrarConvenios] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: perfilData } = await supabase
        .from("profiles")
        .select("display_name, department, email, role")
        .eq("id", user.id)
        .single();
      setPerfil(perfilData);

      let filtroGerencia = "";
      if (perfilData?.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
      else if (perfilData?.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
      else if (perfilData?.department === "gerencia_ind") filtroGerencia = "ADAMM";

      /* === URLs CSV === */
      const ventasURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXztj-EM_OgRPoKxjRiMleVhH0QVWzG7RSpGIwqMXjUwc_9ENeOYeV9VIcoTpN45vAF3HGZlWl7f4Q/pub?gid=0&single=true&output=csv";
      const clientesURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQp7GbIVB3BqNycXVRvoJLoZk_ZIQ60cPsmaniDY2ch9LKEV_uTsGYvaND5I5RJr7QcwlVoGmZuteTy/pub?gid=0&single=true&output=csv";
      const conveniosURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9_PWqSrhUDslNNd3Wtt1VfXjdV9XfB4612o2qWlI-p91OKb5-1UDkkdOQuT422aJn9bMZIQhE-Ppo/pub?gid=0&single=true&output=csv";

      const [ventasText, clientesText, conveniosText] = await Promise.all([
        fetch(ventasURL).then((r) => r.text()),
        fetch(clientesURL).then((r) => r.text()),
        fetch(conveniosURL).then((r) => r.text()),
      ]);

      const ventasRows = parseCSV(ventasText);
      const clientesRows = parseCSV(clientesText);
      const conveniosRows = parseCSV(conveniosText);

      /* === Filtrar por gerencia === */
      const ventasFiltradas = ventasRows.filter(
        (r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase()
      );
      const clientesFiltradas = clientesRows.filter(
        (r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase()
      );
      const conveniosFiltradas = conveniosRows.filter(
        (r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase()
      );

      /* === Top 5 Ejecutivos por ventas === */
      const topEjecutivosData = ventasFiltradas.map((r) => {
        const ejecutivo = clean(r[1]);
        const total = r
          .slice(2)
          .reduce(
            (acc, v) =>
              acc + (parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0),
            0
          );
        return { ejecutivo, totalVenta: total };
      });
      topEjecutivosData.sort((a, b) => b.totalVenta - a.totalVenta);
      setTopEjecutivos(topEjecutivosData.slice(0, 5));

      /* === Clientes nuevos === */
      const clientesAgrupados: Record<
        string,
        { ruts: Set<string>; total: number }
      > = {};
      clientesFiltradas.forEach((r) => {
        const ejecutivo = clean(r[0] || r[1]);
        const rut = clean(r[14]);
        const total = parseFloat(r[13]?.replace(/\./g, "").replace(",", ".")) || 0;
        if (!clientesAgrupados[ejecutivo])
          clientesAgrupados[ejecutivo] = { ruts: new Set(), total: 0 };
        clientesAgrupados[ejecutivo].ruts.add(rut);
        clientesAgrupados[ejecutivo].total += total;
      });
      const clientesArray: ClienteNuevo[] = Object.entries(clientesAgrupados).map(
        ([ejecutivo, { ruts, total }]) => ({
          ejecutivo,
          clientes: ruts.size,
          total,
          ticket: ruts.size > 0 ? total / ruts.size : 0,
        })
      );
      setClientesNuevos(clientesArray);

      /* === Convenios activos === */
      const conveniosAgrupados: Record<
        string,
        { count: number; desc: number; ahorro: number }
      > = {};
      conveniosFiltradas.forEach((r) => {
        const ejecutivo = clean(r[0] || r[1]);
        const precioLista = parseFloat(r[7]?.replace(/\./g, "").replace(",", ".")) || 0;
        const precioEspecial =
          parseFloat(r[8]?.replace(/\./g, "").replace(",", ".")) || 0;
        const descuento =
          parseFloat(r[9]?.replace(/\./g, "").replace(",", ".")) || 0;
        const ahorro = Math.max(precioLista - precioEspecial, 0);
        if (!conveniosAgrupados[ejecutivo])
          conveniosAgrupados[ejecutivo] = { count: 0, desc: 0, ahorro: 0 };
        conveniosAgrupados[ejecutivo].count += 1;
        conveniosAgrupados[ejecutivo].desc += descuento;
        conveniosAgrupados[ejecutivo].ahorro += ahorro;
      });
      const conveniosArray: Convenio[] = Object.entries(conveniosAgrupados).map(
        ([ejecutivo, v]) => ({
          ejecutivo,
          convenios: v.count,
          promDesc: v.count > 0 ? v.desc / v.count : 0,
          ahorro: v.ahorro,
        })
      );
      setConvenios(conveniosArray);

      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Cargando datos...</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">Equipo Comercial</h1>
      <p className="text-gray-600 mb-8">
        Gerencia:{" "}
        <span className="font-semibold text-blue-800">
          {perfil?.department?.replace("gerencia_", "").toUpperCase()}
        </span>{" "}
        — {perfil?.email}
      </p>

      {/* === Top 5 Ejecutivos === */}
      <div className="bg-white border rounded-xl p-6 shadow-sm mb-10">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">
          🏆 Top 5 Ejecutivos por Ventas Totales
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Ejecutivo</th>
              <th className="text-right py-2 px-3">Total Vendido ($)</th>
            </tr>
          </thead>
          <tbody>
            {topEjecutivos.map((e, i) => (
              <tr key={i} className="border-b hover:bg-gray-50 transition">
                <td className="py-2 px-3">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </td>
                <td className="py-2 px-3 font-medium text-gray-800">{e.ejecutivo}</td>
                <td className="py-2 px-3 text-right text-green-700 font-semibold">
                  {e.totalVenta.toLocaleString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === Clientes nuevos === */}
      <div className="bg-white border rounded-xl p-6 shadow-sm mb-10">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">
          <FiUsers className="inline mr-2 text-purple-600" /> Clientes nuevos (RUT únicos)
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left py-2 px-3">Ejecutivo</th>
              <th className="text-right py-2 px-3">Clientes nuevos</th>
              <th className="text-right py-2 px-3">Total vendido ($)</th>
              <th className="text-right py-2 px-3">Ticket promedio ($)</th>
            </tr>
          </thead>
          <tbody>
            {(mostrarClientes ? clientesNuevos : clientesNuevos.slice(0, 5)).map(
              (c, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 transition">
                  <td className="py-2 px-3 font-medium text-gray-800">{c.ejecutivo}</td>
                  <td className="py-2 px-3 text-right">{c.clientes}</td>
                  <td className="py-2 px-3 text-right text-green-700">
                    {c.total.toLocaleString("es-CL")}
                  </td>
                  <td className="py-2 px-3 text-right text-blue-700">
                    {c.ticket.toLocaleString("es-CL")}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
        {clientesNuevos.length > 5 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setMostrarClientes(!mostrarClientes)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
            >
              {mostrarClientes ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
        )}
      </div>

      {/* === Convenios activos === */}
      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">
          <FiDollarSign className="inline mr-2 text-yellow-600" /> Convenios activos
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left py-2 px-3">Ejecutivo</th>
              <th className="text-right py-2 px-3">Convenios activos</th>
              <th className="text-right py-2 px-3">Prom. descuento (%)</th>
              <th className="text-right py-2 px-3">Ahorro total ($)</th>
            </tr>
          </thead>
          <tbody>
            {(mostrarConvenios ? convenios : convenios.slice(0, 5)).map((c, i) => (
              <tr key={i} className="border-b hover:bg-gray-50 transition">
                <td className="py-2 px-3 font-medium text-gray-800">{c.ejecutivo}</td>
                <td className="py-2 px-3 text-right">{c.convenios}</td>
                <td className="py-2 px-3 text-right text-orange-600">
                  {c.promDesc.toFixed(1)}%
                </td>
                <td className="py-2 px-3 text-right text-green-700">
                  {c.ahorro.toLocaleString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {convenios.length > 5 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setMostrarConvenios(!mostrarConvenios)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
            >
              {mostrarConvenios ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
