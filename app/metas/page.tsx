"use client";

import { useEffect, useState } from "react";

export default function MetasPage() {
  const [metas, setMetas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Orden de las columnas según la hoja
  const columnasOrdenadas = [
    "ejecutivo",
    "mes",
    "anio",
    "meta_kg",
    "meta_monto",
    "avance_kg",
    "avance_monto",
    "cumplimiento_kg",
    "cumplimiento_monto",
  ];

  // Nombres legibles para la UI
  const columnasLegibles: Record<string, string> = {
    ejecutivo: "Ejecutivo",
    mes: "Mes",
    anio: "Año",
    meta_kg: "Meta (Kg)",
    meta_monto: "Meta ($)",
    avance_kg: "Avance (Kg)",
    avance_monto: "Avance ($)",
    cumplimiento_kg: "% Cumpl. Kg",
    cumplimiento_monto: "% Cumpl. $",
  };

  useEffect(() => {
    fetch("/api/metas")
      .then((res) => res.json())
      .then((data) => {
        setMetas(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6">⏳ Cargando metas...</p>;

  if (metas.length === 0)
    return (
      <p className="p-6 text-red-600 font-medium">
        ⚠️ No tienes metas asignadas.
      </p>
    );

  const pintarCumplimiento = (valor: string | number) => {
    const v = Number(valor);
    if (isNaN(v)) return "";
    if (v >= 100) return "bg-green-100 text-green-700 font-semibold";
    if (v >= 70) return "bg-yellow-100 text-yellow-700 font-semibold";
    return "bg-red-100 text-red-700 font-semibold";
  };

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-blue-700">📊 Metas</h1>

      <div className="overflow-x-auto shadow-lg rounded-lg border border-gray-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-blue-600 text-white">
            <tr>
              {columnasOrdenadas.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-left font-semibold uppercase tracking-wide border-b border-blue-700"
                >
                  {columnasLegibles[col] || col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metas.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                {columnasOrdenadas.map((col, j) => (
                  <td
                    key={j}
                    className={`px-4 py-2 border-b border-gray-200 ${
                      col.includes("cumplimiento")
                        ? pintarCumplimiento(row[col])
                        : typeof row[col] === "number" ||
                          (!isNaN(Number(row[col])) && row[col] !== "")
                        ? "text-right font-medium"
                        : "text-left"
                    }`}
                  >
                    {row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
