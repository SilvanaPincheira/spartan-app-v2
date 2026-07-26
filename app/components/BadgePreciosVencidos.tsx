"use client";

import { useEffect, useState } from "react";

export default function BadgePreciosVencidos() {
  const [vencidos, setVencidos] = useState(0);
  const [proximos, setProximos] = useState(0);

  useEffect(() => {
    let activo = true;

    async function cargarAlertas() {
      try {
        const res = await fetch(
            "/api/precios-especiales/vencimientos?resumen=true",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(
            json.error || "No se pudieron cargar las alertas."
          );
        }

        if (!activo) return;

        setVencidos(
          Number(json?.resumen?.vencidos || 0)
        );

        setProximos(
          Number(json?.resumen?.proximos30 || 0) +
            Number(json?.resumen?.proximos60 || 0)
        );
      } catch (error) {
        console.error(
          "Error cargando badge de precios:",
          error
        );

        if (activo) {
          setVencidos(0);
          setProximos(0);
        }
      }
    }

    cargarAlertas();

    return () => {
      activo = false;
    };
  }, []);

  if (vencidos === 0 && proximos === 0) {
    return null;
  }

  const cantidad = vencidos > 0 ? vencidos : proximos;

  return (
    <span
      title={
        vencidos > 0
          ? "Tiene precios vencidos. Revisar módulo y actualizar."
          : "Tiene precios especiales próximos a vencer."
      }
      className={`ml-auto flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white ${
        vencidos > 0
          ? "bg-red-600"
          : "bg-amber-500"
      }`}
    >
      {cantidad > 99 ? "99+" : cantidad}
    </span>
  );
}