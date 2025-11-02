"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function EquipoPage() {
  const supabase = createClientComponentClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [topEjecutivos, setTopEjecutivos] = useState<any[]>([]);
  const [clientesNuevos, setClientesNuevos] = useState<any[]>([]);
  const [convenios, setConvenios] = useState<any[]>([]);
  const [mostrarTodosClientes, setMostrarTodosClientes] = useState(false);
  const [mostrarTodosConvenios, setMostrarTodosConvenios] = useState(false);

  useEffect(() => {
    async function cargarDatos() {
      // === SESIÓN ===
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;

      // === PERFIL ===
      const { data: perfilData } = await supabase
        .from("profiles")
        .select("display_name, department, email, role")
        .eq("id", user.id)
        .single();

      setPerfil(perfilData);

      // === MAPEAR GERENCIA ===
      let filtroGerencia = "";
      if (perfilData?.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
      else if (perfilData?.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
      else if (perfilData?.department === "gerencia_ind") filtroGerencia = "ADAMM";

      /* ==============================
         URLs de los datasets publicados
      ============================== */
      const clientesURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQp7GbIVB3BqNycXVRvoJLoZk_ZIQ60cPsmaniDY2ch9LKEV_uTsGYvaND5I5RJr7QcwlVoGmZuteTy/pub?gid=0&single=true&output=csv";

      const conveniosURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9_PWqSrhUDslNNd3Wtt1VfXjdV9XfB4612o2qWlI-p91OKb5-1UDkkdOQuT422aJn9bMZIQhE-Ppo/pub?gid=0&single=true&output=csv";

      const ventasURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXztj-EM_OgRPoKxjRiMleVhH0QVWzG7RSpGIwqMXjUwc_9ENeOYeV9VIcoTpN45vAF3HGZlWl7f4Q/pub?gid=0&single=true&output=csv";

      const [clientesText, conveniosText, ventasText] = await Promise.all([
        fetch(clientesURL).then((r) => r.text()),
        fetch(conveniosURL).then((r) => r.text()),
        fetch(ventasURL).then((r) => r.text()),
      ]);

      // === PARSE CSV ===
      const parseCSV = (text: string) =>
        text
          .trim()
          .split(/\r?\n/)
          .map((row) => row.split(",").map((v) => v.trim()));

      const clientesRows = parseCSV(clientesText);
      const conveniosRows = parseCSV(conveniosText);
      const ventasRows = parseCSV(ventasText);

      /* ==============================
         1️⃣ CLIENTES NUEVOS
      ============================== */
      const clientesHeader = clientesRows[0];
      const clientesGerenciaIdx = clientesHeader.indexOf("Gerencia");
      const ejecutivoIdx = clientesHeader.indexOf("Ejecutivo");
      const rutIdx = clientesHeader.indexOf("Rut");
      const totalIdx = clientesHeader.indexOf("Total Linea");

      const clientesFiltrados = clientesRows.slice(1).filter(
        (r) => r[clientesGerenciaIdx]?.toUpperCase() === filtroGerencia.toUpperCase()
      );

      // Agrupar por Ejecutivo y RUT único
      const clientesPorEjecutivo: Record<
        string,
        { ruts: Set<string>; total: number }
      > = {};

      clientesFiltrados.forEach((r) => {
        const ejecutivo = r[ejecutivoIdx];
        const rut = r[rutIdx];
        const total = parseFloat(r[totalIdx]?.replace(/\./g, "")) || 0;

        if (!clientesPorEjecutivo[ejecutivo]) {
          clientesPorEjecutivo[ejecutivo] = { ruts: new Set(), total: 0 };
        }
        clientesPorEjecutivo[ejecutivo].ruts.add(rut);
        clientesPorEjecutivo[ejecutivo].total += total;
      });

      const clientesArray = Object.entries(clientesPorEjecutivo).map(
        ([ejecutivo, datos]) => ({
          ejecutivo,
          clientes: datos.ruts.size,
          total: datos.total,
          ticketPromedio:
            datos.ruts.size > 0 ? datos.total / datos.ruts.size : 0,
        })
      );

      setClientesNuevos(clientesArray);

      /* ==============================
         2️⃣ CONVENIOS ACTIVOS
      ============================== */
      const conveniosHeader = conveniosRows[0];
      const convGerenciaIdx = conveniosHeader.indexOf("Gerencia");
      const convEjecutivoIdx = conveniosHeader.indexOf("Ejecutivo");
      const descuentoIdx = conveniosHeader.indexOf("Descuento en %");
      const precioListaIdx = conveniosHeader.indexOf("Precio Lista");
      const precioEspIdx = conveniosHeader.indexOf("Precio especial");

      const conveniosFiltrados = conveniosRows.slice(1).filter(
        (r) => r[convGerenciaIdx]?.toUpperCase() === filtroGerencia.toUpperCase()
      );

      const conveniosPorEjecutivo: Record<
        string,
        { descuentos: number[]; ahorro: number }
      > = {};

      conveniosFiltrados.forEach((r) => {
        const ejecutivo = r[convEjecutivoIdx];
        const descuento = parseFloat(r[descuentoIdx]?.replace(",", ".")) || 0;
        const precioLista = parseFloat(r[precioListaIdx]?.replace(/\./g, "")) || 0;
        const precioEsp = parseFloat(r[precioEspIdx]?.replace(/\./g, "")) || 0;

        if (!conveniosPorEjecutivo[ejecutivo]) {
          conveniosPorEjecutivo[ejecutivo] = { descuentos: [], ahorro: 0 };
        }

        conveniosPorEjecutivo[ejecutivo].descuentos.push(descuento);
        conveniosPorEjecutivo[ejecutivo].ahorro += precioLista - precioEsp;
      });

      const conveniosArray = Object.entries(conveniosPorEjecutivo).map(
        ([ejecutivo, datos]) => ({
          ejecutivo,
          convenios: datos.descuentos.length,
          promDesc:
            datos.descuentos.length > 0
              ? (
                  datos.descuentos.reduce((a, b) => a + b, 0) /
                  datos.descuentos.length
                ).toFixed(1)
              : "0.0",
          ahorro: datos.ahorro,
        })
      );

      setConvenios(conveniosArray);

      /* ==============================
         3️⃣ TOP 5 EJECUTIVOS (VENTAS)
      ============================== */
      const ventasHeader = ventasRows[0];
      const ventasGerenciaIdx = ventasHeader.indexOf("Gerencia");
      const ventasEjecutivoIdx = ventasHeader.indexOf("Ejecutivo");

      const ventasFiltradas = ventasRows.slice(1).filter(
        (r) => r[ventasGerenciaIdx]?.toUpperCase() === filtroGerencia.toUpperCase()
      );

      const topEjecutivosData = ventasFiltradas.map((r) => {
        const ejecutivo = r[ventasEjecutivoIdx];
        const total = r.slice(2, 14).reduce((acc, v) => {
          const num = parseFloat(v.replace(/\./g, "")) || 0;
          return acc + num;
        }, 0);
        return { ejecutivo, total };
      });

      const top5 = topEjecutivosData
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setTopEjecutivos(top5);
    }

    cargarDatos();
  }, []);

  /* === COMPONENTE === */
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-6">Equipo — {perfil?.display_name}</h1>

      {/* === TOP 5 EJECUTIVOS === */}
      <h2 className="text-lg font-semibold mb-3 text-gray-800">🏆 Top 5 Ejecutivos por Ventas Anuales</h2>
      <div className="bg-white border rounded-xl shadow-sm mb-10">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr>
              <th className="text-left py-2 px-4">Ejecutivo</th>
              <th className="text-right py-2 px-4">Total vendido ($)</th>
            </tr>
          </thead>
          <tbody>
            {topEjecutivos.map((e, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4">{e.ejecutivo}</td>
                <td className="py-2 px-4 text-right text-green-600 font-semibold">
                  {e.total.toLocaleString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === CLIENTES NUEVOS === */}
      <h2 className="text-lg font-semibold mb-3 text-gray-800">👥 Clientes nuevos (RUT únicos)</h2>
      <div className="bg-white border rounded-xl shadow-sm mb-10">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr>
              <th className="text-left py-2 px-4">Ejecutivo</th>
              <th className="text-right py-2 px-4">Clientes nuevos</th>
              <th className="text-right py-2 px-4">Total vendido ($)</th>
              <th className="text-right py-2 px-4">Ticket promedio ($)</th>
            </tr>
          </thead>
          <tbody>
            {(mostrarTodosClientes ? clientesNuevos : clientesNuevos.slice(0, 5)).map((e, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4">{e.ejecutivo}</td>
                <td className="py-2 px-4 text-right">{e.clientes}</td>
                <td className="py-2 px-4 text-right text-green-600">{e.total.toLocaleString("es-CL")}</td>
                <td className="py-2 px-4 text-right">{e.ticketPromedio.toLocaleString("es-CL")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {clientesNuevos.length > 5 && (
          <div className="text-center py-4">
            <button
              onClick={() => setMostrarTodosClientes(!mostrarTodosClientes)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              {mostrarTodosClientes ? "Ver menos" : "Mostrar todos"}
            </button>
          </div>
        )}
      </div>

      {/* === CONVENIOS ACTIVOS === */}
      <h2 className="text-lg font-semibold mb-3 text-gray-800">💰 Convenios activos</h2>
      <div className="bg-white border rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr>
              <th className="text-left py-2 px-4">Ejecutivo</th>
              <th className="text-right py-2 px-4">Convenios activos</th>
              <th className="text-right py-2 px-4">Prom. descuento (%)</th>
              <th className="text-right py-2 px-4">Ahorro total ($)</th>
            </tr>
          </thead>
          <tbody>
            {(mostrarTodosConvenios ? convenios : convenios.slice(0, 5)).map((e, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4">{e.ejecutivo}</td>
                <td className="py-2 px-4 text-right">{e.convenios}</td>
                <td className="py-2 px-4 text-right">{e.promDesc}%</td>
                <td className="py-2 px-4 text-right text-green-600">
                  {e.ahorro.toLocaleString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {convenios.length > 5 && (
          <div className="text-center py-4">
            <button
              onClick={() => setMostrarTodosConvenios(!mostrarTodosConvenios)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              {mostrarTodosConvenios ? "Ver menos" : "Mostrar todos"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
