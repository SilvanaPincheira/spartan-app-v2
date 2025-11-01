"use client";

import { useState } from "react";
import { FiTrendingUp, FiAward } from "react-icons/fi";

type Ejecutivo = {
  nombre: string;
  area: "F&B" | "HC" | "IND";
  enero: number;
  febrero: number;
  marzo: number;
  abril: number;
  mayo: number;
  junio: number;
  julio: number;
  agosto: number;
  septiembre: number;
};

export default function RendimientoPage() {
  const [areaSeleccionada, setAreaSeleccionada] = useState<"F&B" | "HC" | "IND">("F&B");
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(2025);

  // 🔹 Datos sintéticos de prueba
  const ejecutivos: Ejecutivo[] = [
    {
      nombre: "CLAUDIO BEI",
      area: "F&B",
      enero: 8920257,
      febrero: 9452700,
      marzo: 11035400,
      abril: 10936880,
      mayo: 8511420,
      junio: 7498314,
      julio: 8739730,
      agosto: 9271558,
      septiembre: 8671220,
    },
    {
      nombre: "JORGE VELE",
      area: "F&B",
      enero: 8823900,
      febrero: 9464000,
      marzo: 10143694,
      abril: 11227588,
      mayo: 5664287,
      junio: 8095523,
      julio: 8582560,
      agosto: 7781290,
      septiembre: 9439000,
    },
    {
      nombre: "CARLOS RAMOS",
      area: "HC",
      enero: 7600000,
      febrero: 7250000,
      marzo: 8400000,
      abril: 9100000,
      mayo: 9500000,
      junio: 8700000,
      julio: 8800000,
      agosto: 9400000,
      septiembre: 9000000,
    },
    {
      nombre: "ALBERTO DAMM",
      area: "IND",
      enero: 12000000,
      febrero: 11800000,
      marzo: 11200000,
      abril: 12300000,
      mayo: 11000000,
      junio: 10800000,
      julio: 11900000,
      agosto: 12100000,
      septiembre: 12200000,
    },
  ];

  // ✅ Función con tipado correcto
  const getColor = (valor: number): string => {
    if (valor >= 10000000) return "bg-green-100 text-green-700";
    if (valor >= 5000000) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-700";
  };

  // 🔹 Filtrar por área seleccionada
  const filtrados = ejecutivos.filter((e) => e.area === areaSeleccionada);

  // 🔹 Calcular totales
  const data = filtrados.map((e) => {
    const meses = [
      e.enero, e.febrero, e.marzo, e.abril, e.mayo,
      e.junio, e.julio, e.agosto, e.septiembre,
    ];
    const total = meses.reduce((a, b) => a + b, 0);
    const promedio = total / meses.length;
    return { ...e, total, promedio };
  });

  const totalGlobal = data.reduce((a, b) => a + b.total, 0);
  const promedioGlobal = totalGlobal / (data.length * 9);

  const mejor = data.reduce((max, e) => (e.total > max.total ? e : max), data[0]);
  const peor = data.reduce((min, e) => (e.total < min.total ? e : min), data[0]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">
        Rendimiento por Ejecutivo
      </h1>
      <p className="text-gray-600 mb-6">
        Desempeño mensual, global y promedio por ejecutivo del área seleccionada.
      </p>

      {/* 🔹 Filtros */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Año</label>
          <select
            value={anioSeleccionado}
            onChange={(e) => setAnioSeleccionado(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[2023, 2024, 2025].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Área / Gerencia</label>
          <select
            value={areaSeleccionada}
            onChange={(e) => setAreaSeleccionada(e.target.value as "F&B" | "HC" | "IND")}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="F&B">F&B (Claudia Borquez)</option>
            <option value="HC">HC (Carlos Avendaño)</option>
            <option value="IND">IND (Alberto Damm)</option>
          </select>
        </div>
      </div>

      {/* 🔹 Resumen global */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
          <h2 className="text-gray-700 font-semibold mb-1">Total Global</h2>
          <p className="text-2xl font-bold text-blue-900">
            ${totalGlobal.toLocaleString("es-CL")}
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
          <h2 className="text-gray-700 font-semibold mb-1">
            Promedio Mensual Global
          </h2>
          {/* ✅ FIX aplicado aquí */}
          <p className="text-2xl font-bold text-green-700">
            ${promedioGlobal.toLocaleString("es-CL", { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 text-gray-700 font-semibold mb-1">
            <FiAward className="text-yellow-500" /> Mejor / Peor Ejecutivo
          </div>
          <p className="text-sm">
            🥇 <strong>{mejor.nombre}</strong> — ${mejor.total.toLocaleString("es-CL")}
            <br />
            🥉 <strong>{peor.nombre}</strong> — ${peor.total.toLocaleString("es-CL")}
          </p>
        </div>
      </div>

      {/* 🔹 Tabla de rendimiento */}
      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="py-2 text-left">Ejecutivo</th>
              <th>Ene</th>
              <th>Feb</th>
              <th>Mar</th>
              <th>Abr</th>
              <th>May</th>
              <th>Jun</th>
              <th>Jul</th>
              <th>Ago</th>
              <th>Sep</th>
              <th>Global</th>
              <th>Prom. Mes</th>
            </tr>
          </thead>
          <tbody>
            {data.map((e, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="py-2 font-medium text-gray-700">{e.nombre}</td>
                {[
                  e.enero, e.febrero, e.marzo, e.abril,
                  e.mayo, e.junio, e.julio, e.agosto, e.septiembre,
                ].map((v, j) => (
                  <td key={j} className={`py-2 text-right px-2 ${getColor(v)}`}>
                    {v.toLocaleString("es-CL")}
                  </td>
                ))}
                <td className="py-2 text-right font-bold text-blue-900">
                  {e.total.toLocaleString("es-CL")}
                </td>
                <td className="py-2 text-right font-semibold text-green-700">
                  {e.promedio.toLocaleString("es-CL", { maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
