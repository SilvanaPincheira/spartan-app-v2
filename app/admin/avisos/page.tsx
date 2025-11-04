"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import dayjs from "dayjs";

type Aviso = {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  visible: boolean;
  fecha_inicio: string;
  fecha_fin: string;
};

export default function AdminAvisosPage() {
  const supabase = createClientComponentClient();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [nuevoAviso, setNuevoAviso] = useState({
    titulo: "",
    mensaje: "",
    tipo: "info",
    fecha_inicio: dayjs().format("YYYY-MM-DD"),
    fecha_fin: dayjs().add(7, "day").format("YYYY-MM-DD"),
  });
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);

  // === Cargar avisos ===
  useEffect(() => {
    async function fetchData() {
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData.session);

      const { data, error } = await supabase
        .from("avisos")
        .select("*")
        .order("fecha_inicio", { ascending: false });

      if (!error && data) setAvisos(data);
    }
    fetchData();
  }, []);

  // === Crear nuevo aviso ===
  async function crearAviso() {
    setLoading(true);
    const { error } = await supabase.from("avisos").insert([
      {
        titulo: nuevoAviso.titulo,
        mensaje: nuevoAviso.mensaje,
        tipo: nuevoAviso.tipo,
        visible: true,
        fecha_inicio: nuevoAviso.fecha_inicio,
        fecha_fin: nuevoAviso.fecha_fin,
        created_by: session?.user?.id,
      },
    ]);
    if (error) alert("❌ Error al crear aviso: " + error.message);
    else {
      alert("✅ Aviso creado correctamente");
      setNuevoAviso({
        titulo: "",
        mensaje: "",
        tipo: "info",
        fecha_inicio: dayjs().format("YYYY-MM-DD"),
        fecha_fin: dayjs().add(7, "day").format("YYYY-MM-DD"),
      });
      const { data } = await supabase.from("avisos").select("*");
      setAvisos(data || []);
    }
    setLoading(false);
  }

  // === Cambiar visibilidad ===
  async function toggleVisible(id: string, current: boolean) {
    await supabase.from("avisos").update({ visible: !current }).eq("id", id);
    setAvisos((prev) =>
      prev.map((a) => (a.id === id ? { ...a, visible: !current } : a))
    );
  }

  // === Eliminar aviso ===
  async function eliminarAviso(id: string) {
    if (!confirm("¿Seguro que quieres eliminar este aviso?")) return;
    await supabase.from("avisos").delete().eq("id", id);
    setAvisos((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">
        Administración de Avisos
      </h1>
      <p className="text-gray-600 mb-8">
        Publica, edita o desactiva avisos flotantes visibles en Spartan One.
      </p>

      {/* === Formulario crear aviso === */}
      <div className="bg-white border rounded-2xl p-6 shadow-sm mb-10">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">
          Crear nuevo aviso
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Título"
            value={nuevoAviso.titulo}
            onChange={(e) =>
              setNuevoAviso({ ...nuevoAviso, titulo: e.target.value })
            }
            className="border rounded-md px-3 py-2"
          />
          <select
            value={nuevoAviso.tipo}
            onChange={(e) =>
              setNuevoAviso({ ...nuevoAviso, tipo: e.target.value })
            }
            className="border rounded-md px-3 py-2"
          >
            <option value="info">Info (azul)</option>
            <option value="success">Éxito (verde)</option>
            <option value="warning">Advertencia (amarillo)</option>
            <option value="error">Error (rojo)</option>
          </select>
          <input
            type="date"
            value={nuevoAviso.fecha_inicio}
            onChange={(e) =>
              setNuevoAviso({ ...nuevoAviso, fecha_inicio: e.target.value })
            }
            className="border rounded-md px-3 py-2"
          />
          <input
            type="date"
            value={nuevoAviso.fecha_fin}
            onChange={(e) =>
              setNuevoAviso({ ...nuevoAviso, fecha_fin: e.target.value })
            }
            className="border rounded-md px-3 py-2"
          />
        </div>
        <textarea
          placeholder="Mensaje del aviso (HTML permitido)"
          value={nuevoAviso.mensaje}
          onChange={(e) =>
            setNuevoAviso({ ...nuevoAviso, mensaje: e.target.value })
          }
          className="border rounded-md px-3 py-2 w-full mt-4 h-32"
        />
        <button
          onClick={crearAviso}
          disabled={loading}
          className="mt-4 bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 transition"
        >
          {loading ? "Guardando..." : "Publicar aviso"}
        </button>
      </div>

      {/* === Tabla de avisos existentes === */}
      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">
          Avisos existentes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="py-2 px-3 text-left">Título</th>
                <th className="py-2 px-3 text-left">Tipo</th>
                <th className="py-2 px-3 text-left">Inicio</th>
                <th className="py-2 px-3 text-left">Fin</th>
                <th className="py-2 px-3 text-center">Visible</th>
                <th className="py-2 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {avisos.map((a) => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{a.titulo}</td>
                  <td className="py-2 px-3">{a.tipo}</td>
                  <td className="py-2 px-3">
                    {dayjs(a.fecha_inicio).format("DD/MM/YYYY")}
                  </td>
                  <td className="py-2 px-3">
                    {dayjs(a.fecha_fin).format("DD/MM/YYYY")}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => toggleVisible(a.id, a.visible)}
                      className={`px-2 py-1 rounded-md text-white text-xs ${
                        a.visible ? "bg-green-600" : "bg-gray-400"
                      }`}
                    >
                      {a.visible ? "Activo" : "Oculto"}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => eliminarAviso(a.id)}
                      className="text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
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
