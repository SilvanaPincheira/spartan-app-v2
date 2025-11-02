"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function EquipoPage() {
  const supabase = createClientComponentClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [topEjecutivos, setTopEjecutivos] = useState<any[]>([]);
  const [clientesNuevos, setClientesNuevos] = useState<any[]>([]);
  const [convenios, setConvenios] = useState<any[]>([]);
  const [mostrarTodosTop, setMostrarTodosTop] = useState(false);
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

      setPerfil(perfilData);

      // === Determinar gerencia ===
      let filtroGerencia = "";
      if (perfilData?.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
      else if (perfilData?.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
      else if (perfilData?.department === "gerencia_ind") filtroGerencia = "ADAMM";

      // === URLs Google Sheets ===
      const ventasURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXztj-EM_OgRPoKxjRiMleVhH0QVWzG7RSpGIwqMXjUwc_9ENeOYeV9VIcoTpN45vAF3HGZlWlWl7f4Q/pub?gid=0&single=true&output=csv";
      const clientesURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQp7GbIVB3BqNycXVRvoJLoZk_ZIQ60cPsmaniDY2ch9LKEV_uTsGYvaND5I5RJr7QcwlVoGmZuteTy/pub?gid=0&single=true&output=csv";
      const conveniosURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9_PWqSrhUDslNNd3Wtt1VfXjdV9XfB4612o2qWlI-p91OKb5-1UDkkdOQuT422aJn9bMZIQhE-Ppo/pub?gid=0&single=true&output=csv";

      const [ventasText, clientesText, conveniosText] = await Promise.all([
        fetch(ventasURL).then((r) => r.text()),
        fetch(clientesURL).then((r) => r.text()),
        fetch(conveniosURL).then((r) => r.text()),
      ]);

      const parseCSV = (t: string) =>
        t
          .trim()
          .split(/\r?\n/)
          .map((row) => row.split(",").map((v) => v.trim()));

      const normalize = (txt: string) =>
        txt.toLowerCase().trim().replace(/\s+/g, " ");

      /* ---------------------------
         TOP 5 EJECUTIVOS
      --------------------------- */
      const ventasRows = parseCSV(ventasText);
      const vHeaders = ventasRows[0].map(normalize);
      const vIdxGerencia = vHeaders.indexOf("gerencia");
      const vIdxEjecutivo = vHeaders.indexOf("ejecutivo");

      const mesActual = new Date().getMonth(); // 0-11
      const ventasFiltradas = ventasRows.slice(1).filter(
        (r) =>
          r[vIdxGerencia] &&
          r[vIdxGerencia].toUpperCase() === filtroGerencia.toUpperCase()
      );

      const totales = ventasFiltradas.map((r) => {
        const ejecutivo = r[vIdxEjecutivo];
        const total = r
          .slice(2, 14)
          .slice(0, mesActual + 1)
          .reduce(
            (acc, v) => acc + (parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0),
            0
          );
        return { ejecutivo, total };
      });

      const totalGeneral = totales.reduce((a, b) => a + b.total, 0);
      const ordenados = totales
        .sort((a, b) => b.total - a.total)
        .map((e) => ({
          ...e,
          participacion: totalGeneral ? (e.total / totalGeneral) * 100 : 0,
        }));

      setTopEjecutivos(ordenados);

      /* ---------------------------
         CLIENTES NUEVOS (Código SN + Total Linea)
      --------------------------- */
      const cRows = parseCSV(clientesText);
      const cHeaders = cRows[0].map(normalize);
      const cIdxGerencia = cHeaders.indexOf("gerencia");
      const cIdxEjecutivo = cHeaders.indexOf("ejecutivo");
      const cIdxCodigoSN = cHeaders.findIndex((h) => h.includes("código sn"));
      const cIdxTotal = cHeaders.findIndex((h) => h.includes("total linea"));

      const cFiltradas = cRows.slice(1).filter(
        (r) =>
          r[cIdxGerencia] &&
          r[cIdxGerencia].toUpperCase() === filtroGerencia.toUpperCase()
      );

      const mapClientes = new Map<
        string,
        { codigos: Set<string>; total: number }
      >();

      cFiltradas.forEach((r) => {
        const ejecutivo = r[cIdxEjecutivo];
        const codigo = r[cIdxCodigoSN];
        const total = parseFloat(
          (r[cIdxTotal] || "0").replace(/\./g, "").replace(",", ".")
        ) || 0;

        if (!mapClientes.has(ejecutivo))
          mapClientes.set(ejecutivo, { codigos: new Set(), total: 0 });
        mapClientes.get(ejecutivo)!.codigos.add(codigo);
        mapClientes.get(ejecutivo)!.total += total;
      });

      const clientesArray = Array.from(mapClientes.entries()).map(([ejecutivo, d]) => ({
        ejecutivo,
        clientes: d.codigos.size,
        total: d.total,
        ticketProm: d.codigos.size ? d.total / d.codigos.size : 0,
      }));

      setClientesNuevos(clientesArray);

      /* ---------------------------
         CONVENIOS ACTIVOS (Monto descontado)
      --------------------------- */
      const convRows = parseCSV(conveniosText);
      const convHeaders = convRows[0].map(normalize);
      const gIdx = convHeaders.indexOf("gerencia");
      const eIdx = convHeaders.indexOf("ejecutivo");
      const nIdx = convHeaders.indexOf("nombre sn");
      const dIdx = convHeaders.indexOf("descuento en %");
      const plIdx = convHeaders.indexOf("precio lista");
      const peIdx = convHeaders.indexOf("precio especial");

      const convFiltradas = convRows.slice(1).filter(
        (r) => r[gIdx] && r[gIdx].toUpperCase() === filtroGerencia.toUpperCase()
      );

      const mapConv = new Map<
        string,
        { nombres: Set<string>; descuentos: number[]; descuentoTotal: number }
      >();

      convFiltradas.forEach((r) => {
        const ejecutivo = r[eIdx];
        const nombre = r[nIdx];
        const desc = parseFloat(r[dIdx]?.replace(",", ".")) || 0;
        const pl = parseFloat(r[plIdx]?.replace(/\./g, "")) || 0;
        const pe = parseFloat(r[peIdx]?.replace(/\./g, "")) || 0;
        if (!mapConv.has(ejecutivo))
          mapConv.set(ejecutivo, { nombres: new Set(), descuentos: [], descuentoTotal: 0 });
        mapConv.get(ejecutivo)!.nombres.add(nombre);
        mapConv.get(ejecutivo)!.descuentos.push(desc);
        mapConv.get(ejecutivo)!.descuentoTotal += pl - pe;
      });

      const convArray = Array.from(mapConv.entries()).map(([ejecutivo, d]) => ({
        ejecutivo,
        convenios: d.nombres.size,
        promDesc:
          d.descuentos.length > 0
            ? (
                d.descuentos.reduce((a, b) => a + b, 0) / d.descuentos.length
              ).toFixed(1)
            : "0.0",
        descuentoTotal: d.descuentoTotal,
      }));

      setConvenios(convArray);
      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Cargando datos...</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-6">
        Equipo — {perfil?.display_name}
      </h1>

      {/* === TOP 5 === */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          🏆 Top 5 Ejecutivos — Ventas acumuladas hasta mes actual
        </h2>
        <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="text-left py-2 px-4">Ejecutivo</th>
                <th className="text-right py-2 px-4">Venta ($)</th>
                <th className="text-right py-2 px-4">% Participación</th>
              </tr>
            </thead>
            <tbody>
              {(mostrarTodosTop
                ? topEjecutivos
                : topEjecutivos.slice(0, 5)
              ).map((e, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4">{e.ejecutivo}</td>
                  <td className="py-2 px-4 text-right text-green-700 font-medium">
                    {e.total.toLocaleString("es-CL")}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {e.participacion.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={() => setMostrarTodosTop(!mostrarTodosTop)}
          className="mt-3 text-blue-700 hover:underline"
        >
          {mostrarTodosTop ? "Mostrar menos" : "Mostrar todos"}
        </button>
      </section>

      {/* === CLIENTES NUEVOS === */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          👥 Clientes nuevos (por Código SN)
        </h2>
        <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
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
              {(mostrarTodosClientes
                ? clientesNuevos
                : clientesNuevos.slice(0, 5)
              ).map((e, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4">{e.ejecutivo}</td>
                  <td className="py-2 px-4 text-right">{e.clientes}</td>
                  <td className="py-2 px-4 text-right text-green-700 font-medium">
                    {e.total.toLocaleString("es-CL")}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {e.ticketProm.toLocaleString("es-CL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={() => setMostrarTodosClientes(!mostrarTodosClientes)}
          className="mt-3 text-blue-700 hover:underline"
        >
          {mostrarTodosClientes ? "Mostrar menos" : "Mostrar todos"}
        </button>
      </section>

      {/* === CONVENIOS === */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          💰 Convenios activos
        </h2>
        <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="text-left py-2 px-4">Ejecutivo</th>
                <th className="text-right py-2 px-4">Convenios activos</th>
                <th className="text-right py-2 px-4">Prom. descuento (%)</th>
                <th className="text-right py-2 px-4">Monto descontado ($)</th>
              </tr>
            </thead>
            <tbody>
              {(mostrarTodosConvenios
                ? convenios
                : convenios.slice(0, 5)
              ).map((e, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4">{e.ejecutivo}</td>
                  <td className="py-2 px-4 text-right">{e.convenios}</td>
                  <td className="py-2 px-4 text-right">{e.promDesc}%</td>
                  <td className="py-2 px-4 text-right text-red-600 font-medium">
                    {e.descuentoTotal.toLocaleString("es-CL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={() => setMostrarTodosConvenios(!mostrarTodosConvenios)}
          className="mt-3 text-blue-700 hover:underline"
        >
          {mostrarTodosConvenios ? "Mostrar menos" : "Mostrar todos"}
        </button>
      </section>
    </div>
  );
}
