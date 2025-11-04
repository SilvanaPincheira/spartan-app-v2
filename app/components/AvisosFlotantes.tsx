"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AvisosFlotantes() {
  const supabase = createClientComponentClient();
  const [avisos, setAvisos] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAvisos() {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("avisos")
        .select("*")
        .eq("visible", true)
        .lte("fecha_inicio", today)
        .gte("fecha_fin", today);

      if (error) console.error("Error cargando avisos:", error);
      else setAvisos(data || []);
    }

    fetchAvisos();
  }, []);

  const cerrarAviso = (id: string) => {
    setAvisos((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-4">
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          className={`max-w-sm w-80 p-4 rounded-xl shadow-lg border backdrop-blur-md 
          ${
            aviso.tipo === "error"
              ? "bg-red-100 border-red-400"
              : aviso.tipo === "warning"
              ? "bg-yellow-100 border-yellow-400"
              : aviso.tipo === "success"
              ? "bg-green-100 border-green-400"
              : "bg-blue-100 border-blue-400"
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {aviso.titulo}
              </h3>
              <p
                className="text-sm text-gray-700 whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: aviso.mensaje }}
              />
            </div>
            <button
              className="ml-2 text-gray-500 hover:text-gray-800"
              onClick={() => cerrarAviso(aviso.id)}
            >
              ✖
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
