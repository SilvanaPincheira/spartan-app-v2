"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  FiUsers,
  FiAward,
  FiDollarSign,
} from "react-icons/fi";

/* === FUNCIONES AUXILIARES === */
function clean(v: any) {
  return String(v || "").trim().replace(/\r|\n/g, "");
}

function parseCSV(text: string) {
  const rows = text.trim().split(/\r?\n/);
  return rows.map((r) => r.split(",").map((c) => clean(c)));
}

export default function EquipoPage() {
  const supabase = createClientComponentClient();
  const [perfil, setPerfil] = useState<any>(null);
  const [topEjecutivos, setTopEjecutivos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [convenios, setConvenios] = useState<any[]>([]);
  const [mostrarClientes, setMostrarClientes] = useState(false);
  const [mostrarConvenios, setMostrarConvenios] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;

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

      /* === 1️⃣ TOP EJECUTIVOS POR VENTAS === */
      const meses = ventasRows[0].slice(2, 12); // Enero-Octubre
      const idxInicio = 2;
      const idxFin = idxInicio + meses.length;
      const ventasFiltradas = ventasRows.filter(
        (r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase()
      );

      const topData = ventasFiltradas.map((r) => {
        const total = r
          .slice(idxInicio, idxFin)
          .reduce((acc, v) => acc + (parseFloat(v.replace(/\./g, "")) || 0), 0);
        return { ejecutivo: r[1], total };
      });

      const totalGeneral = topData.reduce((a, b) => a + b.total, 0);
      const top5 = topData
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
        .map((e) => ({
          ...e,
          participacion: totalGeneral > 0 ? ((e.total / totalGeneral) * 100).toFixed(1) : "0",
        }));

      setTopEjecutivos(top5);

      /* === 2️⃣ CLIENTES NUEVOS === */
      const clientesFiltrados = clientesRows.filter(
        (r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase()
      );

      const mapaClientes = new Map<string, any>();
      clientesFiltrados.forEach((r) => {
        const ejecutivo = clean(r[0]);
        const codCliente = clean(r[15]);
        const totalLinea = parseFloat(clean(r[14]).replace(/\./g, "")) || 0;
        const clave = `${ejecutivo}-${codCliente}`;
        if (!mapaClientes.has(clave)) mapaClientes.set(clave, { ejecutivo, codCliente, totalLinea });
      });

      const agrupadoClientes: Record<string, { total: number; count: number }> = {};
      Array.from(mapaClientes.values()).forEach((r: any) => {
        if (!agrupadoClientes[r.ejecutivo])
          agrupadoClientes[r.ejecutivo] = { total: 0, count: 0 };
        agrupadoClientes[r.ejecutivo].count += 1;
        agrupadoClientes[r.ejecutivo].total += r.totalLinea;
      });

      const clientesArray = Object.entries(agrupadoClientes).map(([ejecutivo, val]) => ({
        ejecutivo,
        count: val.count,
        total: val.total,
        ticket: val.count > 0 ? val.total / val.count : 0,
      }));

      setClientes(clientesArray.sort((a, b) => b.total - a.total));

      /* === 3️⃣ CONVENIOS ACTIVOS === */
      const conveniosFiltrados = conveniosRows.filter(
        (r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase()
      );

      const agrupadoConv: Record<string, { count: number; descuento: number[] }> = {};
      conveniosFiltrados.forEach((r) => {
        const ejecutivo = clean(r[0]);
        const descuento = parseFloat(clean(r[9]).replace(",", ".")) || 0;
        if (!agrupadoConv[ejecutivo])
          agrupadoConv[ejecutivo] = { count: 0, descuento: [] };
        agrupadoConv[ejecutivo].count += 1;
        agrupadoConv[ejecutivo].descuento.push(descuento);
      });

      const conveniosArray = Object.entries(agrupadoConv).map(([ejecutivo, val]) => ({
        ejecutivo,
        count: val.count,
        promDesc:
          val.descuento.length > 0
            ? (val.descuento.reduce((a, b) => a + b, 0) / val.descuento.length).toFixed(1)
            : "0",
      }));

      setConvenios(conveniosArray.sort((a, b) => b.count - a.count));

      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading)
    return <p className="p-8 text-gray-500">Cargando datos del equipo...</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">
        Equipo — {perfil?.email}
      </h1>

      {/* === 1️⃣ Top 5 ejecutivos === */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FiAward className="text-yellow-500" /> Top 5 Ejecutivos por Ventas Anuales
        </h2>
        <div className="overflow-x-auto bg-white border rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="text-left py-2 px-3">Ejecutivo</th>
                <th className="text-right py-2 px-3">Total vendido ($)</th>
                <th className="text-right py-2 px-3">% Participación</th>
              </tr>
            </thead>
            <tbody>
              {topEjecutivos.map((e, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 transition">
                  <td className="py-2 px-3 font-medium">{e.ejecutivo}</td>
                  <td className="py-2 px-3 text-right text-green-700">
                    {e.total.toLocaleString("es-CL")}
                  </td>
                  <td className="py-2 px-3 text-right">{e.participacion}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* === 2️⃣ Clientes nuevos === */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FiUsers className="text-purple-600" /> Clientes nuevos (RUT únicos)
        </h2>
        <div className="overflow-x-auto bg-white border rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="text-left py-2 px-3">Ejecutivo</th>
                <th className="text-right py-2 px-3">Clientes nuevos</th>
                <th className="text-right py-2 px-3">Total vendido ($)</th>
                <th className="text-right py-2 px-3">Ticket promedio ($)</th>
              </tr>
            </thead>
            <tbody>
              {(mostrarClientes ? clientes : clientes.slice(0, 5)).map((e, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{e.ejecutivo}</td>
                  <td className="py-2 px-3 text-right">{e.count}</td>
                  <td className="py-2 px-3 text-right text-green-700">
                    {e.total.toLocaleString("es-CL")}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {e.ticket.toLocaleString("es-CL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-center py-3">
            <button
              onClick={() => setMostrarClientes(!mostrarClientes)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition"
            >
              {mostrarClientes ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
        </div>
      </section>

      {/* === 3️⃣ Convenios activos === */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FiDollarSign className="text-amber-500" /> Convenios activos
        </h2>
        <div className="overflow-x-auto bg-white border rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="text-left py-2 px-3">Ejecutivo</th>
                <th className="text-right py-2 px-3">Convenios activos</th>
                <th className="text-right py-2 px-3">Prom. descuento (%)</th>
              </tr>
            </thead>
            <tbody>
              {(mostrarConvenios ? convenios : convenios.slice(0, 5)).map((e, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{e.ejecutivo}</td>
                  <td className="py-2 px-3 text-right">{e.count}</td>
                  <td className="py-2 px-3 text-right">{e.promDesc}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-center py-3">
            <button
              onClick={() => setMostrarConvenios(!mostrarConvenios)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition"
            >
              {mostrarConvenios ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
