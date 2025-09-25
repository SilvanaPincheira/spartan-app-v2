"use client";
import { useEffect, useState } from "react";

export default function MetasPage() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sheets/Metas")
      .then((res) => res.json())
      .then((data) => {
        setRows(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6">⏳ Cargando metas...</p>;

  if (rows.length === 0)
    return (
      <p className="p-6 text-red-600 font-medium">
        ⚠️ No tienes metas asignadas.
      </p>
    );

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-blue-700">
        📊 Metas Septiembre
      </h1>

      <div className="overflow-x-auto shadow-lg rounded-lg border border-gray-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-blue-600 text-white">
            <tr>
              {Object.keys(rows[0]).map((key) => (
                <th
                  key={key}
                  className="px-4 py-2 text-left font-semibold uppercase tracking-wide border-b border-blue-700"
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}
              >
                {Object.values(row).map((val, j) => (
                  <td
                    key={j}
                    className={`px-4 py-2 border-b border-gray-200 ${
                      typeof val === "number" ||
                      (!isNaN(Number(val)) && val !== "")
                        ? "text-right font-medium"
                        : "text-left"
                    }`}
                  >
                    {val}
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
