"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* === UTILIDADES === */
function parseCSV(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((row) =>
      row.split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
    );
}

function clean(value: any) {
  return String(value || "").trim().replace(/\r|\n/g, "").replace(/\s+/g, " ");
}

/* === COMPONENTE PRINCIPAL === */
export default function EquipoPage() {
  const supabase = createClientComponentClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [topEjecutivos, setTopEjecutivos] = useState<any[]>([]);
  const [clientesNuevos, setClientesNuevos] = useState<any[]>([]);
  const [convenios, setConvenios] = useState<any[]>([]);
  const [mostrarTop, setMostrarTop] = useState(false);
  const [mostrarClientes, setMostrarClientes] = useState(false);
  const [mostrarConvenios, setMostrarConvenios] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);

      // === Obtener sesión y perfil ===
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return setLoading(false);

      const { data: perfilData } = await supabase
        .from("profiles")
        .select("display_name, department, email, role")
        .eq("id", user.id)
        .single();

      setPerfil(perfilData);

      // === Determinar gerencia ===
      let filtroGerencia = "";
      if (perfilData?.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
      else if (perfilData?.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
      else if (perfilData?.department === "gerencia_ind") filtroGerencia = "ADAMM";

      /* === URLs Google Sheets === */
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

      /* === LIMPIAR Y FILTRAR === */
      const ventas = ventasRows.slice(1).filter((r) => clean(r[0]) === filtroGerencia);
      const clientes = clientesRows.slice(1).filter((r) => clean(r[0]) === filtroGerencia);
      const convenios = conveniosRows.slice(1).filter((r) => clean(r[0]) === filtroGerencia);

      /* ====================== TOP 5 EJECUTIVOS ====================== */
      const meses = ventasRows[0].slice(2, 14);
      const mesActual = new Date().getMonth(); // 0-11

      const ejecutivosTotales = ventas.map((r) => {
        const nombre = clean(r[1]);
        const total = r
          .slice(2, mesActual + 3)
          .reduce((acc, v) => acc + (parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0), 0);
        return { nombre, total };
      });

      const totalGeneral = ejecutivosTotales.reduce((a, b) => a + b.total, 0);

      const top5 = ejecutivosTotales
        .sort((a, b) => b.total - a.total)
        .map((e) => ({
          ...e,
          participacion: totalGeneral > 0 ? ((e.total / totalGeneral) * 100).toFixed(1) : "0.0",
        }));

      setTopEjecutivos(top5);

      /* ====================== CLIENTES NUEVOS ====================== */
      const clientesAgrupados: Record<string, any> = {};

      clientes.forEach((r) => {
        const ejecutivo = clean(r[1]);
        const codigoSN = clean(r[15]);
        const totalLinea = parseFloat(r[14]?.replace(/\./g, "").replace(",", ".")) || 0;

        if (!clientesAgrupados[ejecutivo]) {
          clientesAgrupados[ejecutivo] = { clientes: new Set(), total: 0 };
        }
        clientesAgrupados[ejecutivo].clientes.add(codigoSN);
        clientesAgrupados[ejecutivo].total += totalLinea;
      });

      const clientesArray = Object.entries(clientesAgrupados).map(([ejecutivo, data]: any) => {
        const totalVendido = data.total;
        const clientesNuevos = data.clientes.size;
        return {
          ejecutivo,
          clientesNuevos,
          totalVendido,
          ticketPromedio: clientesNuevos > 0 ? totalVendido / clientesNuevos : 0,
        };
      });

      setClientesNuevos(clientesArray);

      /* ====================== CONVENIOS ACTIVOS ====================== */
      const conveniosAgrupados: Record<string, any> = {};

      convenios.forEach((r) => {
        const ejecutivo = clean(r[1]);
        const desc = parseFloat(r[9]?.replace(",", ".") || "0");
        const precioLista = parseFloat(r[7]?.replace(/\./g, "").replace(",", ".")) || 0;
        const precioEsp = parseFloat(r[8]?.replace(/\./g, "").replace(",", ".")) || 0;

        if (!conveniosAgrupados[ejecutivo]) {
          conveniosAgrupados[ejecutivo] = { count: 0, descuentos: [], ahorro: 0 };
        }
        conveniosAgrupados[ejecutivo].count += 1;
        conveniosAgrupados[ejecutivo].descuentos.push(desc);
        conveniosAgrupados[ejecutivo].ahorro += precioLista - precioEsp;
      });

      const conveniosArray = Object.entries(conveniosAgrupados).map(([ejecutivo, data]: any) => ({
        ejecutivo,
        convenios: data.count,
        promDesc:
          data.descuentos.length > 0
            ? (data.descuentos.reduce((a: number, b: number) => a + b, 0) /
                data.descuentos.length).toFixed(1)
            : "0",
        ahorro: data.ahorro,
      }));

      setConvenios(conveniosArray);

      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Cargando datos...</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-6">
        Equipo — {perfil?.email}
      </h1>

      {/* ====================== TOP 5 EJECUTIVOS ====================== */}
      <section className="bg-white border rounded-xl shadow-sm p-6 mb-10">
        <h2 className="text-lg font-semibold mb-4 text-yellow-700 flex items-center gap-2">
          🏅 Top 5 Ejecutivos por Ventas Anuales
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                <th className="text-left py-2 px-3">Ejecutivo</th>
                <th className="text-right py-2 px-3">Total vendido ($)</th>
                <th className="text-right py-2 px-3">% Participación</th>
              </tr>
            </thead>
            <tbody>
              {(mostrarTop ? topEjecutivos : topEjecutivos.slice(0, 5)).map((e, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 transition">
                  <td className="py-2 px-3 font-medium text-gray-800">{e.nombre}</td>
                  <td className="py-2 px-3 text-right text-green-700 font-semibold">
                    {e.total.toLocaleString("es-CL")}
                  </td>
                  <td className="py-2 px-3 text-right">{e.participacion}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {topEjecutivos.length > 5 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setMostrarTop(!mostrarTop)}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700"
            >
              {mostrarTop ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
        )}
      </section>

      {/* ====================== CLIENTES NUEVOS ====================== */}
      <section className="bg-white border rounded-xl shadow-sm p-6 mb-10">
        <h2 className="text-lg font-semibold mb-4 text-purple-700 flex items-center gap-2">
          👥 Clientes nuevos (RUT únicos)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                <th className="text-left py-2 px-3">Ejecutivo</th>
                <th className="text-right py-2 px-3">Clientes nuevos</th>
                <th className="text-right py-2 px-3">Total vendido ($)</th>
                <th className="text-right py-2 px-3">Ticket promedio ($)</th>
              </tr>
            </thead>
            <tbody>
              {(mostrarClientes
                ? clientesNuevos
                : clientesNuevos.slice(0, 5)
              ).map((c, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 transition">
                  <td className="py-2 px-3 font-medium text-gray-800">{c.ejecutivo}</td>
                  <td className="py-2 px-3 text-right">{c.clientesNuevos}</td>
                  <td className="py-2 px-3 text-right text-green-700 font-semibold">
                    {c.totalVendido.toLocaleString("es-CL")}
                  </td>
                  <td className="py-2 px-3 text-right text-blue-700">
                    {c.ticketPromedio.toLocaleString("es-CL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clientesNuevos.length > 5 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setMostrarClientes(!mostrarClientes)}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700"
            >
              {mostrarClientes ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
        )}
      </section>

      {/* ====================== CONVENIOS ACTIVOS ====================== */}
      <section className="bg-white border rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 text-amber-700 flex items-center gap-2">
          💰 Convenios activos
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                <th className="text-left py-2 px-3">Ejecutivo</th>
                <th className="text-right py-2 px-3">Convenios activos</th>
                <th className="text-right py-2 px-3">Prom. descuento (%)</th>
                <th className="text-right py-2 px-3">Ahorro total ($)</th>
              </tr>
            </thead>
            <tbody>
              {(mostrarConvenios
                ? convenios
                : convenios.slice(0, 5)
              ).map((e, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 transition">
                  <td className="py-2 px-3 font-medium text-gray-800">{e.ejecutivo}</td>
                  <td className="py-2 px-3 text-right">{e.convenios}</td>
                  <td className="py-2 px-3 text-right text-orange-600">{e.promDesc}%</td>
                  <td className="py-2 px-3 text-right text-green-700 font-semibold">
                    {e.ahorro.toLocaleString("es-CL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {convenios.length > 5 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setMostrarConvenios(!mostrarConvenios)}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700"
            >
              {mostrarConvenios ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
