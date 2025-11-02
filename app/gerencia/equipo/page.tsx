"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ---------- Tipos de las filas que realmente mostramos ---------- */
type RowClientes = {
  ejecutivo: string;
  clientesNuevos: number;
  totalVendido: number;
  ticketPromedio: number;
};

type RowConvenios = {
  ejecutivo: string;
  cantidad: number;
  promedioDescuento: number;
  ahorroTotal: number;
};

/* ---------- Utilidades ---------- */
const parseCSV = (text: string): string[][] =>
  text
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split(",").map((v) => v.trim()));

const cleanNumber = (val: any) =>
  parseFloat(String(val ?? "0").replace(/\./g, "").replace(",", ".")) || 0;

const toUpper = (s: any) => String(s ?? "").trim().toUpperCase();

export default function EquipoPage() {
  const supabase = createClientComponentClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [ejecutivosGerencia, setEjecutivosGerencia] = useState<string[]>([]);

  const [clientesData, setClientesData] = useState<RowClientes[]>([]);
  const [conveniosData, setConveniosData] = useState<RowConvenios[]>([]);

  const [mostrarTodosClientes, setMostrarTodosClientes] = useState(false);
  const [mostrarTodosConvenios, setMostrarTodosConvenios] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      /* 1) Perfil */
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: perfilData } = await supabase
        .from("profiles")
        .select("department, email, display_name")
        .eq("id", user.id)
        .single();

      setPerfil(perfilData);

      /* 2) Código de gerencia (para tabla ejecutivos) */
      let codigoGerencia = "";
      if (perfilData?.department === "gerencia_food") codigoGerencia = "CBORQUEZ";
      else if (perfilData?.department === "gerencia_hc") codigoGerencia = "CAVENDANO";
      else if (perfilData?.department === "gerencia_ind") codigoGerencia = "ADAMM";

      /* 3) Traer los ejecutivos de esa gerencia (Supabase) */
      const { data: rowsEjecutivos } = await supabase
        .from("ejecutivos")
        .select("nombre")
        .eq("gerencia", codigoGerencia)
        .eq("activo", true);

      const listaEjecutivos = (rowsEjecutivos ?? [])
        .map((r: any) => toUpper(r.nombre))
        .filter(Boolean);

      setEjecutivosGerencia(listaEjecutivos);

      /* 4) Leer CSVs reales */
      const clientesURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQp7GbIVB3BqNycXVRvoJLoZk_ZIQ60cPsmaniDY2ch9LKEV_uTsGYvaND5I5RJr7QcwlVoGmZuteTy/pub?gid=0&single=true&output=csv";

      const conveniosURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9_PWqSrhUDslNNd3Wtt1VfXjdV9XfB4612o2qWlI-p91OKb5-1UDkkdOQuT422aJn9bMZIQhE-Ppo/pub?gid=0&single=true&output=csv";

      const [clientesText, conveniosText] = await Promise.all([
        fetch(clientesURL).then((r) => r.text()),
        fetch(conveniosURL).then((r) => r.text()),
      ]);

      const clientesRows = parseCSV(clientesText);
      const conveniosRows = parseCSV(conveniosText);

      /* ---------- Clientes Nuevos (RUT únicos) ---------- */
      const hC = clientesRows[0] ?? [];
      const idxEjecutivoC = hC.indexOf("Ejecutivo");
      const idxRut = hC.indexOf("Rut");
      const idxTotalLinea = hC.indexOf("Total Linea");

      const clientesPorEjecutivo: Record<
        string,
        { ruts: Set<string>; total: number }
      > = {};

      clientesRows.slice(1).forEach((r) => {
        const eje = toUpper(r[idxEjecutivoC]);
        if (!listaEjecutivos.includes(eje)) return;

        const rut = String(r[idxRut] ?? "").trim();
        const total = cleanNumber(r[idxTotalLinea]);

        if (!clientesPorEjecutivo[eje]) {
          clientesPorEjecutivo[eje] = { ruts: new Set(), total: 0 };
        }
        if (rut) clientesPorEjecutivo[eje].ruts.add(rut);
        clientesPorEjecutivo[eje].total += total;
      });

      const clientesTabla: RowClientes[] = Object.entries(clientesPorEjecutivo)
        .map(([ejecutivo, v]) => {
          const clientesNuevos = v.ruts.size;
          const totalVendido = v.total;
          const ticketPromedio =
            clientesNuevos > 0 ? totalVendido / clientesNuevos : 0;
          return {
            ejecutivo,
            clientesNuevos,
            totalVendido,
            ticketPromedio,
          };
        })
        .sort((a, b) => b.clientesNuevos - a.clientesNuevos);

      setClientesData(clientesTabla);

      /* ---------- Convenios Activos (promedio % y ahorro) ---------- */
      const hV = conveniosRows[0] ?? [];
      const idxEjecutivoV = hV.indexOf("Ejecutivo");
      const idxDesc = hV.indexOf("Descuento en %");
      const idxLista = hV.indexOf("Precio Lista");
      const idxEspecial = hV.indexOf("Precio especial");
      const idxHasta = hV.indexOf("Activo hasta");

      const hoy = new Date();

      const conveniosPorEjecutivo: Record<
        string,
        { count: number; sumDesc: number; ahorro: number }
      > = {};

      conveniosRows.slice(1).forEach((r) => {
        const eje = toUpper(r[idxEjecutivoV]);
        if (!listaEjecutivos.includes(eje)) return;

        // si hay fecha de vencimiento y ya pasó, no contar
        const hastaStr = r[idxHasta];
        if (hastaStr) {
          const hasta = new Date(hastaStr);
          if (!isNaN(hasta.getTime()) && hasta < hoy) return;
        }

        const desc = cleanNumber(r[idxDesc]);
        const lista = cleanNumber(r[idxLista]);
        const esp = cleanNumber(r[idxEspecial]);
        const ahorro = Math.max(0, lista - esp);

        if (!conveniosPorEjecutivo[eje]) {
          conveniosPorEjecutivo[eje] = { count: 0, sumDesc: 0, ahorro: 0 };
        }
        conveniosPorEjecutivo[eje].count += 1;
        conveniosPorEjecutivo[eje].sumDesc += desc;
        conveniosPorEjecutivo[eje].ahorro += ahorro;
      });

      const conveniosTabla: RowConvenios[] = Object.entries(
        conveniosPorEjecutivo
      )
        .map(([ejecutivo, v]) => ({
          ejecutivo,
          cantidad: v.count,
          promedioDescuento: v.count > 0 ? v.sumDesc / v.count : 0,
          ahorroTotal: v.ahorro,
        }))
        .sort((a, b) => b.cantidad - a.cantidad);

      setConveniosData(conveniosTabla);

      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Cargando datos del equipo…</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">Equipo — {perfil?.department?.replace("gerencia_", "").toUpperCase()}</h1>
      <p className="text-gray-600 mb-8">
        Gerente: <strong>{perfil?.display_name || perfil?.email}</strong>
      </p>

      {/* === Clientes Nuevos === */}
      <div className="bg-white border rounded-2xl shadow-sm p-6 mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">👥 Clientes nuevos (RUT únicos)</h2>
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
            {(mostrarTodosClientes ? clientesData : clientesData.slice(0, 5)).map((r) => (
              <tr key={r.ejecutivo} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-800">{r.ejecutivo}</td>
                <td className="py-2 px-3 text-right">{r.clientesNuevos}</td>
                <td className="py-2 px-3 text-right text-green-700 font-semibold">
                  {r.totalVendido.toLocaleString("es-CL")}
                </td>
                <td className="py-2 px-3 text-right">{Math.round(r.ticketPromedio).toLocaleString("es-CL")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {clientesData.length > 5 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setMostrarTodosClientes((v) => !v)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              {mostrarTodosClientes ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
        )}
      </div>

      {/* === Convenios === */}
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">💰 Convenios activos</h2>
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
            {(mostrarTodosConvenios ? conveniosData : conveniosData.slice(0, 5)).map((r) => (
              <tr key={r.ejecutivo} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-800">{r.ejecutivo}</td>
                <td className="py-2 px-3 text-right">{r.cantidad}</td>
                <td className="py-2 px-3 text-right">
                  {r.promedioDescuento.toFixed(1)}%
                </td>
                <td className="py-2 px-3 text-right text-blue-800 font-semibold">
                  {r.ahorroTotal.toLocaleString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {conveniosData.length > 5 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setMostrarTodosConvenios((v) => !v)}
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
