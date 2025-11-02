"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function EquipoPage() {
  const supabase = createClientComponentClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [topEjecutivos, setTopEjecutivos] = useState<any[]>([]);
  const [clientesNuevos, setClientesNuevos] = useState<any[]>([]);
  const [convenios, setConvenios] = useState<any[]>([]);
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

      // === Gerencia según usuario ===
      let filtroGerencia = "";
      if (perfilData?.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
      else if (perfilData?.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
      else if (perfilData?.department === "gerencia_ind") filtroGerencia = "ADAMM";

      // === URLs Google Sheets ===
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

      const parseCSV = (text: string) =>
        text
          .trim()
          .split(/\r?\n/)
          .map((row) => row.split(",").map((v) => v.trim()));

      const clientesRows = parseCSV(clientesText);
      const conveniosRows = parseCSV(conveniosText);
      const ventasRows = parseCSV(ventasText);

      const normalizeHeaders = (headers: string[]) =>
        headers.map((h) => h.toLowerCase().trim());

      /* ===============================
         CLIENTES NUEVOS
      =============================== */
      const clientesHeader = normalizeHeaders(clientesRows[0]);
      const idxGerencia = clientesHeader.indexOf("gerencia");
      const idxEjecutivo = clientesHeader.indexOf("ejecutivo");
      const idxRut = clientesHeader.indexOf("rut");
      const idxTotal = clientesHeader.indexOf("total linea");

      const clientesFiltrados = clientesRows.slice(1).filter(
        (r) =>
          r[idxGerencia] &&
          r[idxGerencia].trim().toUpperCase() === filtroGerencia.toUpperCase()
      );

      const clientesPorEjecutivo: Record<
        string,
        { ruts: Set<string>; total: number }
      > = {};

      clientesFiltrados.forEach((r) => {
        const ejecutivo = r[idxEjecutivo] || "";
        const rut = r[idxRut] || "";
        const total = parseFloat(r[idxTotal]?.replace(/\./g, "")) || 0;

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
          ticketPromedio: datos.ruts.size ? datos.total / datos.ruts.size : 0,
        })
      );

      /* ===============================
         CONVENIOS (por Nombre SN único)
      =============================== */
      const conveniosHeader = normalizeHeaders(conveniosRows[0]);
      const cIdxGerencia = conveniosHeader.indexOf("gerencia");
      const cIdxEjecutivo = conveniosHeader.indexOf("ejecutivo");
      const cIdxNombre = conveniosHeader.indexOf("nombre sn");
      const cIdxDesc = conveniosHeader.indexOf("descuento en %");
      const cIdxPL = conveniosHeader.indexOf("precio lista");
      const cIdxPE = conveniosHeader.indexOf("precio especial");

      const conveniosFiltrados = conveniosRows.slice(1).filter(
        (r) =>
          r[cIdxGerencia] &&
          r[cIdxGerencia].trim().toUpperCase() === filtroGerencia.toUpperCase()
      );

      const conveniosPorEjecutivo: Record<
        string,
        { clientesSN: Set<string>; descuentos: number[]; ahorro: number }
      > = {};

      conveniosFiltrados.forEach((r) => {
        const ejecutivo = r[cIdxEjecutivo] || "";
        const clienteSN = r[cIdxNombre] || "";
        const desc = parseFloat(r[cIdxDesc]?.replace(",", ".")) || 0;
        const pl = parseFloat(r[cIdxPL]?.replace(/\./g, "")) || 0;
        const pe = parseFloat(r[cIdxPE]?.replace(/\./g, "")) || 0;

        if (!conveniosPorEjecutivo[ejecutivo]) {
          conveniosPorEjecutivo[ejecutivo] = {
            clientesSN: new Set(),
            descuentos: [],
            ahorro: 0,
          };
        }

        conveniosPorEjecutivo[ejecutivo].clientesSN.add(clienteSN);
        conveniosPorEjecutivo[ejecutivo].descuentos.push(desc);
        conveniosPorEjecutivo[ejecutivo].ahorro += pl - pe;
      });

      const conveniosArray = Object.entries(conveniosPorEjecutivo).map(
        ([ejecutivo, datos]) => ({
          ejecutivo,
          convenios: datos.clientesSN.size,
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

      /* ===============================
         TOP 5 EJECUTIVOS (por Ventas)
      =============================== */
      const ventasHeader = normalizeHeaders(ventasRows[0]);
      const vIdxGerencia = ventasHeader.indexOf("gerencia");
      const vIdxEjecutivo = ventasHeader.indexOf("ejecutivo");

      const ventasFiltradas = ventasRows.slice(1).filter(
        (r) =>
          r[vIdxGerencia] &&
          r[vIdxGerencia].trim().toUpperCase() === filtroGerencia.toUpperCase()
      );

      const top = ventasFiltradas.map((r) => {
        const ejecutivo = r[vIdxEjecutivo];
        const total = r.slice(2, 14).reduce(
          (acc, val) => acc + (parseFloat(val.replace(/\./g, "")) || 0),
          0
        );
        return { ejecutivo, total };
      });

      setTopEjecutivos(top.sort((a, b) => b.total - a.total).slice(0, 5));
      setClientesNuevos(clientesArray);
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

      {/* === TOP 5 === */}
      <h2 className="text-lg font-semibold mb-3 text-gray-800">
        🏆 Top 5 Ejecutivos por Ventas Anuales
      </h2>
      {topEjecutivos.length === 0 ? (
        <p className="text-gray-500 mb-6">No hay datos disponibles.</p>
      ) : (
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
                  <td className="py-2 px-4 text-right text-green-600">
                    {e.total.toLocaleString("es-CL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* === CLIENTES NUEVOS === */}
      <h2 className="text-lg font-semibold mb-3 text-gray-800">
        👥 Clientes nuevos (RUT únicos)
      </h2>
      {clientesNuevos.length === 0 ? (
        <p className="text-gray-500 mb-6">No hay clientes nuevos registrados.</p>
      ) : (
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
              {clientesNuevos.map((e, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4">{e.ejecutivo}</td>
                  <td className="py-2 px-4 text-right">{e.clientes}</td>
                  <td className="py-2 px-4 text-right text-green-600">
                    {e.total.toLocaleString("es-CL")}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {e.ticketPromedio.toLocaleString("es-CL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* === CONVENIOS === */}
      <h2 className="text-lg font-semibold mb-3 text-gray-800">
        💰 Convenios activos
      </h2>
      {convenios.length === 0 ? (
        <p className="text-gray-500">No hay convenios activos.</p>
      ) : (
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
              {convenios.map((e, i) => (
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
        </div>
      )}
    </div>
  );
}
