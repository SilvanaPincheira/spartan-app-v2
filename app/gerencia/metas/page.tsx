"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useState } from "react";
import { FiAward } from "react-icons/fi";

type Ejecutivo = {
  nombre: string;
  meta: number;
  venta: number;
  cumplimiento: number;
};

export default function MetasPage() {
  // 🔹 Datos sintéticos simulando metas y ventas mensuales
  const datosMensuales = [
    { mes: "Ene", meta: 9000000, ventas: 8700000 },
    { mes: "Feb", meta: 9500000, ventas: 9600000 },
    { mes: "Mar", meta: 10000000, ventas: 9800000 },
    { mes: "Abr", meta: 9500000, ventas: 10200000 },
    { mes: "May", meta: 10500000, ventas: 11000000 },
    { mes: "Jun", meta: 11000000, ventas: 10400000 },
    { mes: "Jul", meta: 10800000, ventas: 11200000 },
    { mes: "Ago", meta: 11200000, ventas: 11800000 },
    { mes: "Sep", meta: 11300000, ventas: 10700000 },
    { mes: "Oct", meta: 11500000, ventas: 12000000 },
  ];

  // 🔹 Datos sintéticos por ejecutivo
  const ejecutivosBase = [
    { nombre: "Ana Díaz", meta: 9500000, venta: 10200000 },
    { nombre: "Jorge Pérez", meta: 10000000, venta: 9600000 },
    { nombre: "Luis Soto", meta: 9000000, venta: 9100000 },
    { nombre: "María González", meta: 8500000, venta: 8700000 },
    { nombre: "Carlos Rivas", meta: 9500000, venta: 8900000 },
  ];

  const [hovered, setHovered] = useState<string | null>(null);

  // 🔹 Cálculo de cumplimiento (%)
  const dataEjecutivos: Ejecutivo[] = ejecutivosBase.map((e) => ({
    ...e,
    cumplimiento: Number(((e.venta / e.meta) * 100).toFixed(1)),
  }));

  // 🔹 Ordenar ranking (de mayor a menor cumplimiento)
  const ranking = [...dataEjecutivos].sort(
    (a, b) => b.cumplimiento - a.cumplimiento
  );

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">
        Metas y Cumplimiento
      </h1>
      <p className="text-gray-600 mb-8">
        Tendencia de cumplimiento mensual y desempeño por ejecutivo.
      </p>

      {/* 📈 Gráfico Meta vs Ventas */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Tendencia Meta vs Ventas
        </h2>

        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={datosMensuales}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip
              formatter={(value: number) =>
                `$${value.toLocaleString("es-CL")}`
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="meta"
              stroke="#0033A0"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Meta"
            />
            <Line
              type="monotone"
              dataKey="ventas"
              stroke="#00A86B"
              strokeWidth={3}
              dot={{ r: 5 }}
              activeDot={{ r: 7 }}
              name="Ventas"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 🏆 Tabla de Cumplimiento */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Cumplimiento por Ejecutivo (último mes)
        </h2>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-sm text-gray-600 border-b">
              <th className="pb-2">Ejecutivo</th>
              <th className="pb-2">Meta</th>
              <th className="pb-2">Venta</th>
              <th className="pb-2">% Cumplimiento</th>
              <th className="pb-2 text-center">Logro</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((e, i) => (
              <tr
                key={i}
                className={`text-sm border-b hover:bg-gray-50 transition ${
                  hovered === e.nombre ? "bg-blue-50" : ""
                }`}
                onMouseEnter={() => setHovered(e.nombre)}
                onMouseLeave={() => setHovered(null)}
              >
                <td className="py-2">{e.nombre}</td>
                <td className="py-2">${e.meta.toLocaleString("es-CL")}</td>
                <td className="py-2">${e.venta.toLocaleString("es-CL")}</td>
                <td
                  className={`py-2 font-medium ${
                    e.cumplimiento >= 100
                      ? "text-green-600"
                      : e.cumplimiento >= 90
                      ? "text-orange-500"
                      : "text-red-500"
                  }`}
                >
                  {e.cumplimiento.toFixed(1)}%
                </td>
                <td className="py-2 text-center">
                  {i === 0 ? (
                    <FiAward
                      className="text-yellow-500"
                      size={20}
                      title="🥇 1° Lugar"
                    />
                  ) : i === 1 ? (
                    <FiAward
                      className="text-gray-400"
                      size={20}
                      title="🥈 2° Lugar"
                    />
                  ) : i === 2 ? (
                    <FiAward
                      className="text-amber-700"
                      size={20}
                      title="🥉 3° Lugar"
                    />
                  ) : (
                    ""
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
