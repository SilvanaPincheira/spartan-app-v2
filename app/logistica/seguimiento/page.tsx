"use client";

import { useEffect, useState } from "react";

export default function SeguimientoPedidos() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const columnasOrdenadas = [
    "empleado_ventas",
    "n_pedido",
    "correo",
    "fecha",
    "estado_pedido_sac",
    "estado_pedido_cobranza",
    "estado_pedido_bodega",
    "folio_gdd",
    "folio_fe",
    "nro_ot",
    "transporte",
    "indicador",
    "cardcode",
    "cardname",
    "direccion_despacho",
    "oc",
  ];

  const columnasLegibles: Record<string, string> = {
    empleado_ventas: "Empleado Ventas",
    n_pedido: "N° Pedido",
    correo: "Correo",
    fecha: "Fecha",
    estado_pedido_sac: "Estado SAC",
    estado_pedido_cobranza: "Estado Cobranza",
    estado_pedido_bodega: "Estado Bodega",
    folio_gdd: "Folio GDD",
    folio_fe: "Folio FE",
    nro_ot: "N° OT",
    transporte: "Transporte",
    indicador: "Indicador",
    cardcode: "Código Cliente",
    cardname: "Nombre Cliente",
    direccion_despacho: "Dirección Despacho",
    oc: "OC",
  };

  const formatearFecha = (valor: string) => {
    if (!valor) return "";
    const partes = valor.includes("-") ? valor.split("-") : [];
    if (partes.length === 3) {
      if (partes[0].length === 4) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
      } else {
        return `${partes[0]}/${partes[1]}/${partes[2]}`;
      }
    }
    return valor;
  };

  const parseFecha = (valor: string): Date | null => {
    if (!valor) return null;
    const partes = valor.split("-");
    if (partes.length === 3) {
      if (partes[0].length === 4) {
        // yyyy-mm-dd
        return new Date(+partes[0], +partes[1] - 1, +partes[2]);
      } else {
        // dd-mm-yyyy
        return new Date(+partes[2], +partes[1] - 1, +partes[0]);
      }
    }
    return null;
  };

  const pintarEstado = (estado: string) => {
    if (!estado) return "";
    const e = estado.toLowerCase();
    if (e.includes("pendiente")) return "bg-red-100 text-red-700 font-semibold";
    if (e.includes("aprobado") || e.includes("completado") || e.includes("liberado"))
      return "bg-green-100 text-green-700 font-semibold";
    if (e.includes("proceso")) return "bg-yellow-100 text-yellow-700 font-semibold";
    return "";
  };

  useEffect(() => {
    fetch("/api/logistica/seguimiento")
      .then((res) => res.json())
      .then((data) => setPedidos(data.data || []));
  }, []);

  const filtrarPedidos = pedidos.filter((p) => {
    const coincideFiltro =
      filtro === "" ||
      p["estado_pedido_sac"] === filtro ||
      p["estado_pedido_cobranza"] === filtro ||
      p["estado_pedido_bodega"] === filtro;

    const coincideBusqueda =
      busqueda === "" ||
      Object.values(p).some((val) =>
        String(val).toLowerCase().includes(busqueda.toLowerCase())
      );

    let coincideFecha = true;
    const fechaPedido = parseFecha(p["fecha"]);

    if (fechaInicio && fechaPedido) {
      coincideFecha = coincideFecha && fechaPedido >= new Date(fechaInicio);
    }
    if (fechaFin && fechaPedido) {
      coincideFecha = coincideFecha && fechaPedido <= new Date(fechaFin);
    }

    return coincideFiltro && coincideBusqueda && coincideFecha;
  });

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">🚚 Seguimiento de Pedidos</h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <input
          type="text"
          placeholder="🔍 Buscar pedido, cliente, etc..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border p-2 rounded w-1/3"
        />
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Todos los estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="En Proceso">En Proceso</option>
          <option value="Aprobado">Aprobado</option>
          <option value="Completado">Completado</option>
          <option value="Liberado">Liberado</option>
        </select>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 text-sm">
          <thead className="bg-gray-100">
            <tr>
              {columnasOrdenadas.map((col) => (
                <th key={col} className="border p-2">
                  {columnasLegibles[col] || col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrarPedidos.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {columnasOrdenadas.map((col, j) => (
                  <td
                    key={j}
                    className={`border p-2 ${
                      col.includes("estado") ? pintarEstado(row[col]) : ""
                    }`}
                  >
                    {col === "fecha"
                      ? formatearFecha(row[col])
                      : row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
