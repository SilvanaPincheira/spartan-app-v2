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
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    async function cargarAviso() {
      const today = dayjs().format("YYYY-MM-DD");

      const { data, error } = await supabase
        .from("avisos")
        .select("id, titulo, mensaje, tipo, visible, fecha_inicio, fecha_fin")
        .eq("visible", true)
        .lte("fecha_inicio", today)
        .gte("fecha_fin", today)
        .order("fecha_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error cargando aviso:", error.message);
        return;
      }

      if (data) setAviso(data);
    }

    cargarAviso();
  }, []);

  if (!aviso || cerrado) return null;

  const colores = {
    info: "bg-blue-100 border-blue-400 text-blue-800",
    success: "bg-green-100 border-green-400 text-green-800",
    warning: "bg-yellow-100 border-yellow-400 text-yellow-800",
    error: "bg-red-100 border-red-400 text-red-800",
  };

  return (
    <div
      className={`fixed bottom-6 right-6 max-w-sm border rounded-xl shadow-lg p-4 transition-all duration-500 ${colores[aviso.tipo]
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
          onClick={() => setCerrado(true)}
          className="ml-3 text-gray-500 hover:text-gray-700 font-bold"
        >
          ✖
        </button>
      </div>
    </div>
  );
}
