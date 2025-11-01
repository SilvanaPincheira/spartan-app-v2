"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* =============== UTILS =============== */
function clean(value: any): string {
  return String(value ?? "")
    .normalize("NFD") // quita tildes
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function toNumber(v: string | number | undefined): number {
  const s = String(v ?? "0").trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Parser CSV SOLO CON COMAS. Respeta comillas y "" dentro de campos. */
function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  return lines.map((line) => {
    const out: string[] = [];
    let curr = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        // Comillas escapadas ("")
        if (inQuotes && line[i + 1] === '"') {
          curr += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(curr);
        curr = "";
      } else {
        curr += ch;
      }
    }
    out.push(curr);
    return out.map((v) => v.trim());
  });
}

/** Normaliza filas asumiendo esquema fijo:
 *  [0]=Gerencia, [1]=Ejecutivo, [2..]=Meses
 */
function normalizeRowsCommaCSV(rows: string[][]): { gerencia: string; ejecutivo: string; meses: number[] }[] {
  if (!rows.length) return [];
  const header = rows[0];
  const monthStartIdx = 2; // desde "Enero"
  const monthEndIdx = header.length; // hasta el final

  return rows.slice(1).map((r) => {
    const gerencia = clean(r[0] ?? "");
    const ejecutivo = clean(r[1] ?? "");
    const meses = r.slice(monthStartIdx, monthEndIdx).map((v) => toNumber(v));
    return { gerencia, ejecutivo, meses };
  });
}

type TrendPoint = { mes: string; Meta: number; Venta: number };
type DataGlobal = {
  totalMeta: number;
  totalVenta: number;
  cumplimientoTotal: string;
  dataTrend: TrendPoint[];
  mesActual: string;
};

export default function MetasPage() {
  const supabase = createClientComponentClient();
  const [perfil, setPerfil] = useState<any>(null);
  const [dataGlobal, setDataGlobal] = useState<DataGlobal | null>(null);
  const [dataEjecutivos, setDataEjecutivos] = useState<
    { ejecutivo: string; meta: number; venta: number; cumplimiento: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);

      // Sesión
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

      // Map de department -> código de gerencia usado en Sheets
      let filtroGerencia = "";
      if (perfilData?.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
      else if (perfilData?.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
      else if (perfilData?.department === "gerencia_ind") filtroGerencia = "ADAMM";

      // URLs CSV (comas)
      const metasURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vS6eHEKLPnnwmtrSFaNvShM3zjdoJ7kr7gmaq6qK1giAXgBm4xulZ1ChS460ejlFUCfabxTect725wf/pub?gid=0&single=true&output=csv";
      const ventasURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXztj-EM_OgRPoKxjRiMleVhH0QVWzG7RSpGIwqMXjUwc_9ENeOYeV9VIcoTpN45vAF3HGZlWl7f4Q/pub?gid=0&single=true&output=csv";

      const [metasText, ventasText] = await Promise.all([
        fetch(metasURL).then((r) => r.text()),
        fetch(ventasURL).then((r) => r.text()),
      ]);

      const metasRows = parseCSV(metasText);
      const ventasRows = parseCSV(ventasText);

      // Meses desde header (asumimos: Gerencia, Ejecutivo, Enero..Diciembre)
      const mesesLabels = metasRows[0].slice(2);
      const mesActualIdx = new Date().getMonth(); // 0-11
      const mesActualLabel = mesesLabels[mesActualIdx] ?? "Mes";

      // Normalizar (sin cortar nombres)
      const metasNorm = normalizeRowsCommaCSV(metasRows);
      const ventasNorm = normalizeRowsCommaCSV(ventasRows);

      // Filtrar por gerencia
      const metasGerencia = metasNorm.filter((r) => r.gerencia === clean(filtroGerencia));
      const ventasGerencia = ventasNorm.filter((r) => r.gerencia === clean(filtroGerencia));

      // Quitar filas no válidas (TOTAL, vacíos) y deduplicar por ejecutivo
      const isValidRow = (r: { ejecutivo: string }) =>
        r.ejecutivo.length > 0 && !/TOTAL/i.test(r.ejecutivo);

      const metasValidas = metasGerencia.filter(isValidRow);
      const ventasValidas = ventasGerencia.filter(isValidRow);

      // Deduplicación exacta por ejecutivo (última ocurrencia gana)
      const ventasMap = new Map<string, number[]>();
      ventasValidas.forEach((r) => {
        ventasMap.set(r.ejecutivo, r.meses);
      });
      const ventasUnicas = Array.from(ventasMap.entries()).map(([ejecutivo, meses]) => ({
        ejecutivo,
        meses,
      }));

      // Totales por mes
      let totalMeta = 0;
      let totalVenta = 0;
      const dataTrend: TrendPoint[] = [];

      for (let i = 0; i < mesesLabels.length; i++) {
        const metaMes = metasValidas.reduce((acc, r) => acc + (r.meses[i] || 0), 0);
        const ventaMes = ventasUnicas.reduce((acc, r) => acc + (r.meses[i] || 0), 0);

        totalMeta += metaMes;
        totalVenta += ventaMes;

        dataTrend.push({ mes: mesesLabels[i], Meta: metaMes, Venta: ventaMes });
      }

      const cumplimientoTotal =
        totalMeta > 0 ? ((totalVenta / totalMeta) * 100).toFixed(1) : "0";

      // Tabla ejecutivos (mes actual)
      const ventasIndex = new Map<string, number>();
      ventasUnicas.forEach((v) => {
        ventasIndex.set(v.ejecutivo, v.meses[mesActualIdx] || 0);
      });

      const dataEjecutivosTemp = metasValidas.map((m) => {
        const nombre = m.ejecutivo;
        const meta = m.meses[mesActualIdx] || 0;
        const venta = ventasIndex.get(nombre) ?? 0;
        const cumplimiento = meta > 0 ? ((venta / meta) * 100).toFixed(0) : "0";
        return { ejecutivo: nombre, meta, venta, cumplimiento };
      });

      setDataGlobal({
        totalMeta,
        totalVenta,
        cumplimientoTotal,
        dataTrend,
        mesActual: mesActualLabel,
      });
      setDataEjecutivos(dataEjecutivosTemp);
      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Cargando datos...</p>;
  if (!dataGlobal)
    return <p className="p-8 text-gray-500">No se encontraron datos para esta gerencia.</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">Cumplimiento de Metas 2025</h1>
      <p className="text-gray-600 mb-6">
        Gerencia:{" "}
        <span className="font-semibold text-blue-800">
          {perfil?.department?.replace("gerencia_", "").toUpperCase()}
        </span>{" "}
        — {perfil?.email}
      </p>

      {/* Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <div className="bg-white border rounded-xl p-5 text-center shadow-sm">
          <h3 className="text-gray-600 mb-2 font-medium">Meta Total Anual</h3>
          <p className="text-2xl font-bold text-blue-800">
            {dataGlobal.totalMeta.toLocaleString("es-CL")}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-5 text-center shadow-sm">
          <h3 className="text-gray-600 mb-2 font-medium">Venta Total Anual</h3>
          <p className="text-2xl font-bold text-green-700">
            {dataGlobal.totalVenta.toLocaleString("es-CL")}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-5 text-center shadow-sm">
          <h3 className="text-gray-600 mb-2 font-medium">% Cumplimiento</h3>
          <p
            className={`text-2xl font-bold ${
              parseFloat(dataGlobal.cumplimientoTotal) >= 100 ? "text-green-600" : "text-red-600"
            }`}
          >
            {dataGlobal.cumplimientoTotal}%
          </p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="bg-white border rounded-xl p-6 shadow-sm mb-10">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">
          Tendencia Meta vs Venta (Total Gerencia)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dataGlobal.dataTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Meta" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Venta" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla */}
      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">
          Cumplimiento de Ejecutivos — {dataGlobal.mesActual}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                <th className="text-left py-2 px-3">Ejecutivo</th>
                <th className="text-right py-2 px-3">Meta</th>
                <th className="text-right py-2 px-3">Venta</th>
                <th className="text-right py-2 px-3">% Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {dataEjecutivos.map((e, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="py-2 px-3 font-medium text-gray-800">{e.ejecutivo}</td>
                  <td className="py-2 px-3 text-right">{e.meta.toLocaleString("es-CL")}</td>
                  <td className="py-2 px-3 text-right">{e.venta.toLocaleString("es-CL")}</td>
                  <td
                    className={`py-2 px-3 text-right font-semibold ${
                      parseFloat(e.cumplimiento) >= 100
                        ? "text-green-600"
                        : parseFloat(e.cumplimiento) >= 70
                        ? "text-orange-500"
                        : "text-red-600"
                    }`}
                  >
                    {e.cumplimiento}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
