"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import dayjs from "dayjs";

type Aviso = {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: "info" | "warning" | "success" | "error";
  visible: boolean;
  fecha_inicio: string;
  fecha_fin: string;
};

export default function AvisoFlotante() {
  const supabase = createClientComponentClient();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [cerrados, setCerrados] = useState<string[]>([]);

  useEffect(() => {
    async function cargarAvisos() {
      const today = dayjs().format("YYYY-MM-DD");

      const { data, error } = await supabase
        .from("avisos")
        .select("id, titulo, mensaje, tipo, visible, fecha_inicio, fecha_fin")
        .eq("visible", true)
        .lte("fecha_inicio", today)
        .gte("fecha_fin", today)
        .order("fecha_inicio", { ascending: false });

      if (error) {
        console.error("Error cargando avisos:", error.message);
        return;
      }

      setAvisos(data || []);
    }

    cargarAvisos();
  }, []);

  if (avisos.length === 0) return null;

  const colores = {
    info: "bg-blue-100 border-blue-400 text-blue-800",
    success: "bg-green-100 border-green-400 text-green-800",
    warning: "bg-yellow-100 border-yellow-400 text-yellow-800",
    error: "bg-red-100 border-red-400 text-red-800",
  };

  return (
    <div className="fixed bottom-6 right-6 space-y-3 z-50">
      {avisos
        .filter((a) => !cerrados.includes(a.id))
        .map((aviso) => (
          <div
            key={aviso.id}
            className={`max-w-sm border rounded-xl shadow-lg p-4 transition-all duration-500 ${colores[aviso.tipo]
              }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg mb-1">{aviso.titulo}</h3>
                <p
                  className="text-sm leading-snug"
                  dangerouslySetInnerHTML={{ __html: aviso.mensaje }}
                />
              </div>
              <button
                onClick={() => setCerrados((prev) => [...prev, aviso.id])}
                className="ml-3 text-gray-500 hover:text-gray-700 font-bold"
              >
                ✖
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
