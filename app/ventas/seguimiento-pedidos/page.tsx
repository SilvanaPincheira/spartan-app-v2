"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ============================================================
   TIPOS
   ============================================================ */

type LineaSeguimiento = {
  pedido_docentry: number;
  linea_num: number;
  clave_seguimiento: string;

  empleado_ventas: string;
  numero_pedido: number;
  correo: string;
  fecha: string;

  estado_sac: string;
  estado_cobranza: string;
  estado_bodega: string;
  estado_detalle: string;

  folio_gdd: number | null;
  folio_fe: number | null;

  nro_ot: string;
  transporte: string;
  indicador: string;

  cardcode: string;
  cardname: string;
  direccion_despacho: string;
  oc: string;

  codigo_articulo: string;
  descripcion: string;

  cantidad_pedido: number;
  kilos_pedido: number;

  cantidad_entregada: number;
  cantidad_pendiente_entrega: number;

  cantidad_facturada: number;
  cantidad_pendiente_facturar: number;

  ultima_sincronizacion: string;
  activo: boolean;
};

type Usuario = {
  email: string;
  nombre: string;
  zona: string;
  gerencia: string;
};

type PedidoAgrupado = {
  numeroPedido: number;
  pedidoDocEntry: number;

  fecha: string;
  empleadoVentas: string;

  cardcode: string;
  cardname: string;
  direccionDespacho: string;
  oc: string;

  estadoSac: string;
  estadoCobranza: string;
  estadoBodega: string;
  estadoGeneral: string;

  nroOt: string;
  transporte: string;
  indicador: string;

  foliosGdd: number[];
  foliosFe: number[];

  cantidadPedido: number;
  cantidadEntregada: number;
  cantidadPendiente: number;
  cantidadFacturada: number;
  cantidadPendienteFacturar: number;

  lineas: LineaSeguimiento[];
};

/* ============================================================
   HELPERS
   ============================================================ */

function numero(valor: unknown) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function formatearNumero(valor: number) {
  return numero(valor).toLocaleString("es-CL", {
    maximumFractionDigits: 2,
  });
}

function formatearFecha(fecha?: string) {
  if (!fecha) return "-";

  const partes = fecha.split("-");

  if (partes.length === 3) {
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }

  return fecha;
}

function limpiarDireccion(valor?: string) {
  if (!valor) return "-";

  return String(valor)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .trim();
}

function obtenerEstadoGeneral(
  lineas: LineaSeguimiento[]
): string {
  const totalPedido = lineas.reduce(
    (s, l) => s + numero(l.cantidad_pedido),
    0
  );

  const totalEntregado = lineas.reduce(
    (s, l) => s + numero(l.cantidad_entregada),
    0
  );

  const totalFacturado = lineas.reduce(
    (s, l) => s + numero(l.cantidad_facturada),
    0
  );

  if (totalEntregado === 0) {
    return "Pendiente Despacho";
  }

  if (totalEntregado < totalPedido) {
    return "Despacho Parcial";
  }

  if (totalFacturado === 0) {
    return "Despachado - Pendiente Factura";
  }

  if (totalFacturado < totalEntregado) {
    return "Facturación Parcial";
  }

  return "Completo";
}

function obtenerEstadoBodega(
  lineas: LineaSeguimiento[]
): string {
  const totalPedido = lineas.reduce(
    (s, l) => s + numero(l.cantidad_pedido),
    0
  );

  const totalEntregado = lineas.reduce(
    (s, l) => s + numero(l.cantidad_entregada),
    0
  );

  if (totalEntregado === 0) {
    return "Por Liberar";
  }

  if (totalEntregado < totalPedido) {
    return "Liberación Parcial";
  }

  return "Liberado";
}

function estiloEstado(estado: string) {
  const e = String(estado || "").toLowerCase();

  if (
    e.includes("completo") ||
    e === "liberado" ||
    e === "autorizado" ||
    e === "ingresado"
  ) {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (
    e.includes("parcial") ||
    e.includes("pendiente factura")
  ) {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    };
  }

  if (
    e.includes("pendiente") ||
    e.includes("por liberar") ||
    e.includes("no liberado")
  ) {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    };
  }

  return {
    background: "#e2e8f0",
    color: "#334155",
    border: "1px solid #cbd5e1",
  };
}

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */

export default function SeguimientoPedidosPage() {
  const [lineas, setLineas] = useState<LineaSeguimiento[]>([]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const [loading, setLoading] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [soloPendientes, setSoloPendientes] = useState(false);

  const [abiertos, setAbiertos] = useState<Set<number>>(
    new Set()
  );

  /* ============================================================
     CARGAR API
     ============================================================ */

  async function cargarSeguimiento(manual = false) {
    try {
      if (manual) {
        setActualizando(true);
      } else {
        setLoading(true);
      }

      setError("");

      const res = await fetch(
        `/api/seguimiento-pedidos?_=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      const responseText = await res.text();

      let json: any = {};

      try {
        json = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        throw new Error(
          `La API de seguimiento no devolvió JSON válido. HTTP ${res.status}`
        );
      }

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            "No se pudo cargar el seguimiento de pedidos."
        );
      }

      setUsuario(json.usuario || null);
      setLineas(
        Array.isArray(json.data)
          ? json.data
          : []
      );
    } catch (err: any) {
      console.error(
        "Error cargando seguimiento:",
        err
      );

      setError(
        err?.message ||
          "No se pudo cargar el seguimiento."
      );
    } finally {
      setLoading(false);
      setActualizando(false);
    }
  }

  useEffect(() => {
    cargarSeguimiento();
  }, []);

  /* ============================================================
     AGRUPAR POR PEDIDO
     ============================================================ */

  const pedidos = useMemo<PedidoAgrupado[]>(() => {
    const mapa =
      new Map<number, LineaSeguimiento[]>();

    for (const linea of lineas) {
      const numeroPedido =
        Number(linea.numero_pedido);

      if (!mapa.has(numeroPedido)) {
        mapa.set(numeroPedido, []);
      }

      mapa.get(numeroPedido)!.push(linea);
    }

    const resultado: PedidoAgrupado[] = [];

    for (const [
      numeroPedido,
      detalle,
    ] of mapa.entries()) {
      if (!detalle.length) continue;

      const primera = detalle[0];

      const foliosGdd = Array.from(
        new Set(
          detalle
            .map((l) => Number(l.folio_gdd))
            .filter(
              (x) =>
                Number.isFinite(x) &&
                x > 0
            )
        )
      );

      const foliosFe = Array.from(
        new Set(
          detalle
            .map((l) => Number(l.folio_fe))
            .filter(
              (x) =>
                Number.isFinite(x) &&
                x > 0
            )
        )
      );

      resultado.push({
        numeroPedido,

        pedidoDocEntry:
          primera.pedido_docentry,

        fecha:
          primera.fecha || "",

        empleadoVentas:
          primera.empleado_ventas || "",

        cardcode:
          primera.cardcode || "",

        cardname:
          primera.cardname || "",

        direccionDespacho:
          primera.direccion_despacho || "",

        oc:
          primera.oc || "",

        estadoSac:
          primera.estado_sac || "",

        estadoCobranza:
          primera.estado_cobranza || "",

        estadoBodega:
          obtenerEstadoBodega(detalle),

        estadoGeneral:
          obtenerEstadoGeneral(detalle),

        nroOt:
          detalle
            .map((x) => x.nro_ot)
            .find((x) => String(x || "").trim()) ||
          "",

        transporte:
          detalle
            .map((x) => x.transporte)
            .find((x) => String(x || "").trim()) ||
          "",

        indicador:
          detalle
            .map((x) => x.indicador)
            .find((x) => String(x || "").trim()) ||
          "",

        foliosGdd,
        foliosFe,

        cantidadPedido:
          detalle.reduce(
            (s, l) =>
              s + numero(l.cantidad_pedido),
            0
          ),

        cantidadEntregada:
          detalle.reduce(
            (s, l) =>
              s + numero(l.cantidad_entregada),
            0
          ),

        cantidadPendiente:
          detalle.reduce(
            (s, l) =>
              s +
              numero(
                l.cantidad_pendiente_entrega
              ),
            0
          ),

        cantidadFacturada:
          detalle.reduce(
            (s, l) =>
              s + numero(l.cantidad_facturada),
            0
          ),

        cantidadPendienteFacturar:
          detalle.reduce(
            (s, l) =>
              s +
              numero(
                l.cantidad_pendiente_facturar
              ),
            0
          ),

        lineas:
          [...detalle].sort(
            (a, b) =>
              a.linea_num -
              b.linea_num
          ),
      });
    }

    return resultado.sort((a, b) => {
      const fechaA =
        new Date(a.fecha).getTime();

      const fechaB =
        new Date(b.fecha).getTime();

      if (fechaA !== fechaB) {
        return fechaB - fechaA;
      }

      return (
        b.numeroPedido -
        a.numeroPedido
      );
    });
  }, [lineas]);

  /* ============================================================
     FILTROS
     ============================================================ */

  const pedidosFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();

      return pedidos.filter((pedido) => {
        if (
          estadoFiltro !== "TODOS" &&
          pedido.estadoGeneral !==
            estadoFiltro
        ) {
          return false;
        }

        if (
          soloPendientes &&
          pedido.estadoGeneral ===
            "Completo"
        ) {
          return false;
        }

        if (!texto) {
          return true;
        }

        const detalleProductos =
          pedido.lineas
            .map(
              (l) =>
                `${l.codigo_articulo} ${l.descripcion}`
            )
            .join(" ");

        const contenido = `
          ${pedido.numeroPedido}
          ${pedido.cardcode}
          ${pedido.cardname}
          ${pedido.oc}
          ${pedido.nroOt}
          ${pedido.transporte}
          ${detalleProductos}
        `
          .toLowerCase()
          .replace(/\s+/g, " ");

        return contenido.includes(texto);
      });
    }, [
      pedidos,
      busqueda,
      estadoFiltro,
      soloPendientes,
    ]);

  /* ============================================================
     KPI
     ============================================================ */

  const resumen = useMemo(() => {
    return {
      total:
        pedidos.length,

      pendientes:
        pedidos.filter(
          (p) =>
            p.estadoGeneral ===
            "Pendiente Despacho"
        ).length,

      parciales:
        pedidos.filter(
          (p) =>
            p.estadoGeneral ===
              "Despacho Parcial" ||
            p.estadoGeneral ===
              "Facturación Parcial"
        ).length,

      pendientesFactura:
        pedidos.filter(
          (p) =>
            p.estadoGeneral ===
            "Despachado - Pendiente Factura"
        ).length,

      completos:
        pedidos.filter(
          (p) =>
            p.estadoGeneral ===
            "Completo"
        ).length,
    };
  }, [pedidos]);

  /* ============================================================
     ABRIR / CERRAR
     ============================================================ */

  function togglePedido(
    numeroPedido: number
  ) {
    setAbiertos((actual) => {
      const nuevo =
        new Set(actual);

      if (
        nuevo.has(numeroPedido)
      ) {
        nuevo.delete(numeroPedido);
      } else {
        nuevo.add(numeroPedido);
      }

      return nuevo;
    });
  }

  /* ============================================================
     LOADING
     ============================================================ */

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: 30,
          fontFamily:
            "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            background: "white",
            border:
              "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 25,
          }}
        >
          Cargando seguimiento de pedidos...
        </div>
      </div>
    );
  }

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div
      style={{
        padding:
          "28px clamp(18px, 3vw, 46px)",
        background: "#f8fafc",
        minHeight: "100vh",
        fontFamily:
          "Arial, Helvetica, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* ======================================================
          ENCABEZADO
          ====================================================== */}

      <div
        style={{
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 27,
            fontWeight: 700,
            letterSpacing: "-0.4px",
          }}
        >
          Seguimiento de Pedidos
        </h1>

        <div
          style={{
            marginTop: 7,
            color: "#64748b",
            fontSize: 14,
          }}
        >
          {usuario?.nombre || ""}

          {usuario?.zona
            ? ` · ${usuario.zona}`
            : ""}

          {usuario?.gerencia
            ? ` · ${usuario.gerencia}`
            : ""}
        </div>
      </div>

      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            border:
              "1px solid #fecaca",
            borderRadius: 10,
            padding: "12px 15px",
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* ======================================================
          KPI
          ====================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(5, minmax(135px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Kpi
          titulo="Pedidos"
          valor={resumen.total}
          tipo="neutral"
        />

        <Kpi
          titulo="Pend. despacho"
          valor={resumen.pendientes}
          tipo="rojo"
        />

        <Kpi
          titulo="Parciales"
          valor={resumen.parciales}
          tipo="amarillo"
        />

        <Kpi
          titulo="Pend. factura"
          valor={
            resumen.pendientesFactura
          }
          tipo="azul"
        />

        <Kpi
          titulo="Completos"
          valor={resumen.completos}
          tipo="verde"
        />
      </div>

      {/* ======================================================
          FILTROS
          ====================================================== */}

      <div
        style={{
          background: "white",
          padding: 16,
          borderRadius: 12,
          border:
            "1px solid #e2e8f0",
          marginBottom: 18,

          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",

          boxShadow:
            "0 1px 2px rgba(15,23,42,0.03)",
        }}
      >
        <input
          value={busqueda}
          onChange={(e) =>
            setBusqueda(
              e.target.value
            )
          }
          placeholder="Buscar pedido, OC, cliente, código o producto..."
          style={{
            flex: "1 1 420px",
            minWidth: 250,

            height: 44,
            padding:
              "0 13px",

            border:
              "1px solid #cbd5e1",

            borderRadius: 8,

            fontSize: 14,

            outline: "none",
          }}
        />

        <select
          value={estadoFiltro}
          onChange={(e) =>
            setEstadoFiltro(
              e.target.value
            )
          }
          style={{
            minWidth: 200,
            height: 44,

            padding:
              "0 12px",

            border:
              "1px solid #cbd5e1",

            borderRadius: 8,

            background: "white",

            fontSize: 14,
          }}
        >
          <option value="TODOS">
            Todos los estados
          </option>

          <option value="Pendiente Despacho">
            Pendiente despacho
          </option>

          <option value="Despacho Parcial">
            Despacho parcial
          </option>

          <option value="Despachado - Pendiente Factura">
            Pendiente factura
          </option>

          <option value="Facturación Parcial">
            Facturación parcial
          </option>

          <option value="Completo">
            Completo
          </option>
        </select>

        <label
          style={{
            height: 44,

            display: "flex",
            gap: 7,
            alignItems: "center",

            whiteSpace: "nowrap",

            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={
              soloPendientes
            }
            onChange={(e) =>
              setSoloPendientes(
                e.target.checked
              )
            }
          />

          Solo pendientes
        </label>

        <button
          onClick={() =>
            cargarSeguimiento(true)
          }
          disabled={actualizando}
          style={{
            height: 44,

            padding:
              "0 18px",

            border: 0,
            borderRadius: 8,

            background:
              actualizando
                ? "#94a3b8"
                : "#2563eb",

            color: "white",

            cursor:
              actualizando
                ? "default"
                : "pointer",

            fontWeight: 700,

            fontSize: 14,
          }}
        >
          {actualizando
            ? "Actualizando..."
            : "Actualizar"}
        </button>
      </div>

      {/* ======================================================
          CONTADOR
          ====================================================== */}

      <div
        style={{
          marginBottom: 11,
          color: "#64748b",
          fontSize: 13,
        }}
      >
        <strong>
          {pedidosFiltrados.length.toLocaleString(
            "es-CL"
          )}
        </strong>{" "}
        pedidos ·{" "}
        <strong>
          {lineas.length.toLocaleString(
            "es-CL"
          )}
        </strong>{" "}
        líneas de productos
      </div>

      {/* ======================================================
          LISTADO
          ====================================================== */}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {pedidosFiltrados.map(
          (pedido) => {
            const abierto =
              abiertos.has(
                pedido.numeroPedido
              );

            return (
              <div
                key={
                  pedido.pedidoDocEntry
                }
                style={{
                  background: "white",

                  border:
                    "1px solid #dbe3ed",

                  borderRadius: 12,

                  overflow: "hidden",

                  boxShadow:
                    "0 1px 2px rgba(15,23,42,0.03)",
                }}
              >
                {/* ==============================================
                    CABECERA DEL PEDIDO
                    ============================================== */}

                <button
                  onClick={() =>
                    togglePedido(
                      pedido.numeroPedido
                    )
                  }
                  style={{
                    width: "100%",

                    border: 0,

                    background:
                      abierto
                        ? "#fcfdff"
                        : "white",

                    padding:
                      "17px 18px",

                    cursor: "pointer",

                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      display: "grid",

                      gridTemplateColumns:
                        "145px minmax(260px, 1fr) minmax(170px, 215px) 135px 30px",

                      gap: 18,

                      alignItems:
                        "center",

                      width: "100%",
                    }}
                  >
                    {/* PEDIDO */}

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          marginBottom: 3,
                        }}
                      >
                        Pedido
                      </div>

                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color: "#0f172a",
                        }}
                      >
                        {
                          pedido.numeroPedido
                        }
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          marginTop: 5,
                        }}
                      >
                        {formatearFecha(
                          pedido.fecha
                        )}
                      </div>
                    </div>

                    {/* CLIENTE */}

                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <div
                        title={
                          pedido.cardname
                        }
                        style={{
                          fontSize: 15,
                          fontWeight: 700,

                          color: "#0f172a",

                          overflow:
                            "hidden",

                          textOverflow:
                            "ellipsis",

                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {
                          pedido.cardname
                        }
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          marginTop: 5,

                          overflow:
                            "hidden",

                          textOverflow:
                            "ellipsis",

                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {
                          pedido.cardcode
                        }

                        {pedido.oc
                          ? ` · OC ${pedido.oc}`
                          : ""}
                      </div>
                    </div>

                    {/* ESTADO */}

                    <div
                      style={{
                        display: "flex",

                        justifyContent:
                          "flex-end",

                        minWidth: 0,
                      }}
                    >
                      <Badge>
                        {
                          pedido.estadoGeneral
                        }
                      </Badge>
                    </div>

                    {/* CANTIDADES */}

                    <div
                      style={{
                        borderLeft:
                          "1px solid #e2e8f0",

                        paddingLeft: 16,

                        fontSize: 12,

                        lineHeight: 1.75,
                      }}
                    >
                      <FilaCantidad
                        titulo="Pedido"
                        valor={
                          pedido.cantidadPedido
                        }
                      />

                      <FilaCantidad
                        titulo="Entregado"
                        valor={
                          pedido.cantidadEntregada
                        }
                      />

                      <FilaCantidad
                        titulo="Pendiente"
                        valor={
                          pedido.cantidadPendiente
                        }
                        destacado={
                          pedido.cantidadPendiente >
                          0
                        }
                      />
                    </div>

                    {/* ABRIR */}

                    <div
                      style={{
                        display: "flex",

                        justifyContent:
                          "center",

                        alignItems:
                          "center",

                        width: 30,
                        height: 30,

                        borderRadius:
                          "50%",

                        background:
                          abierto
                            ? "#e2e8f0"
                            : "#f1f5f9",

                        fontSize: 20,

                        color: "#334155",
                      }}
                    >
                      {abierto
                        ? "−"
                        : "+"}
                    </div>
                  </div>
                </button>

                {/* ==============================================
                    DETALLE DESPLEGADO
                    ============================================== */}

                {abierto && (
                  <div
                    style={{
                      borderTop:
                        "1px solid #e2e8f0",

                      padding:
                        "18px",
                    }}
                  >
                    {/* ==========================================
                        ESTADOS
                        ========================================== */}

                    <div
                      style={{
                        marginBottom: 18,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,

                          color: "#475569",

                          marginBottom: 9,

                          textTransform:
                            "uppercase",

                          letterSpacing:
                            "0.4px",
                        }}
                      >
                        Estado del pedido
                      </div>

                      <div
                        style={{
                          display: "grid",

                          gridTemplateColumns:
                            "repeat(3, minmax(140px, 200px))",

                          gap: 10,
                        }}
                      >
                        <EstadoBox
                          titulo="SAC"
                          estado={
                            pedido.estadoSac
                          }
                        />

                        <EstadoBox
                          titulo="Cobranza"
                          estado={
                            pedido.estadoCobranza
                          }
                        />

                        <EstadoBox
                          titulo="Bodega"
                          estado={
                            pedido.estadoBodega
                          }
                        />
                      </div>
                    </div>

                    {/* ==========================================
                        DOCUMENTOS
                        ========================================== */}

                    <div
                      style={{
                        marginBottom: 18,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,

                          color: "#475569",

                          marginBottom: 9,

                          textTransform:
                            "uppercase",

                          letterSpacing:
                            "0.4px",
                        }}
                      >
                        Documentos y despacho
                      </div>

                      <div
                        style={{
                          display: "grid",

                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(155px, 1fr))",

                          gap: 9,
                        }}
                      >
                        <Dato
                          titulo="OC Cliente"
                          valor={
                            pedido.oc ||
                            "-"
                          }
                        />

                        <Dato
                          titulo="GDD"
                          valor={
                            pedido
                              .foliosGdd
                              .length
                              ? pedido.foliosGdd.join(
                                  ", "
                                )
                              : "-"
                          }
                        />

                        <Dato
                          titulo="Factura"
                          valor={
                            pedido
                              .foliosFe
                              .length
                              ? pedido.foliosFe.join(
                                  ", "
                                )
                              : "-"
                          }
                        />

                        <Dato
                          titulo="N° OT"
                          valor={
                            pedido.nroOt ||
                            "-"
                          }
                        />

                        <Dato
                          titulo="Transporte"
                          valor={
                            pedido.transporte ||
                            "-"
                          }
                        />

                        <Dato
                          titulo="Indicador"
                          valor={
                            pedido.indicador ||
                            "-"
                          }
                        />
                      </div>
                    </div>

                    {/* ==========================================
                        DIRECCIÓN
                        ========================================== */}

                    <div
                      style={{
                        marginBottom: 20,

                        background:
                          "#f8fafc",

                        borderRadius: 9,

                        padding:
                          "12px 13px",

                        border:
                          "1px solid #eef2f7",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          marginBottom: 5,
                        }}
                      >
                        Dirección de despacho
                      </div>

                      <div
                        style={{
                          fontSize: 13,

                          whiteSpace:
                            "pre-line",

                          color: "#334155",

                          lineHeight: 1.5,
                        }}
                      >
                        {limpiarDireccion(
                          pedido.direccionDespacho
                        )}
                      </div>
                    </div>

                    {/* ==========================================
                        RESUMEN CANTIDADES
                        ========================================== */}

                    <div
                      style={{
                        display: "grid",

                        gridTemplateColumns:
                          "repeat(5, minmax(120px, 1fr))",

                        gap: 9,

                        marginBottom: 20,
                      }}
                    >
                      <MiniKpi
                        titulo="Pedido"
                        valor={
                          pedido.cantidadPedido
                        }
                      />

                      <MiniKpi
                        titulo="Entregado"
                        valor={
                          pedido.cantidadEntregada
                        }
                      />

                      <MiniKpi
                        titulo="Pend. despacho"
                        valor={
                          pedido.cantidadPendiente
                        }
                        alerta={
                          pedido.cantidadPendiente >
                          0
                        }
                      />

                      <MiniKpi
                        titulo="Facturado"
                        valor={
                          pedido.cantidadFacturada
                        }
                      />

                      <MiniKpi
                        titulo="Pend. factura"
                        valor={
                          pedido.cantidadPendienteFacturar
                        }
                        alerta={
                          pedido.cantidadPendienteFacturar >
                          0
                        }
                      />
                    </div>

                    {/* ==========================================
                        TABLA PRODUCTOS
                        ========================================== */}

                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,

                          color: "#475569",

                          marginBottom: 9,

                          textTransform:
                            "uppercase",

                          letterSpacing:
                            "0.4px",
                        }}
                      >
                        Detalle de productos
                      </div>

                      <div
                        style={{
                          overflowX:
                            "auto",

                          border:
                            "1px solid #e2e8f0",

                          borderRadius: 9,
                        }}
                      >
                        <table
                          style={{
                            width: "100%",

                            minWidth:
                              980,

                            borderCollapse:
                              "collapse",

                            fontSize: 12,
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                background:
                                  "#f8fafc",
                              }}
                            >
                              <Th>
                                Línea
                              </Th>

                              <Th>
                                Código
                              </Th>

                              <Th>
                                Producto
                              </Th>

                              <Th align="right">
                                Pedido
                              </Th>

                              <Th align="right">
                                Entregado
                              </Th>

                              <Th align="right">
                                Pendiente
                              </Th>

                              <Th align="right">
                                Facturado
                              </Th>

                              <Th align="right">
                                Pend. factura
                              </Th>

                              <Th>
                                Estado
                              </Th>
                            </tr>
                          </thead>

                          <tbody>
                            {pedido.lineas.map(
                              (
                                linea
                              ) => (
                                <tr
                                  key={
                                    linea.clave_seguimiento
                                  }
                                >
                                  <Td>
                                    {
                                      linea.linea_num
                                    }
                                  </Td>

                                  <Td>
                                    <strong>
                                      {
                                        linea.codigo_articulo
                                      }
                                    </strong>
                                  </Td>

                                  <Td>
                                    {
                                      linea.descripcion
                                    }
                                  </Td>

                                  <Td align="right">
                                    {formatearNumero(
                                      linea.cantidad_pedido
                                    )}
                                  </Td>

                                  <Td align="right">
                                    {formatearNumero(
                                      linea.cantidad_entregada
                                    )}
                                  </Td>

                                  <Td align="right">
                                    <span
                                      style={{
                                        fontWeight:
                                          linea.cantidad_pendiente_entrega >
                                          0
                                            ? 800
                                            : 500,

                                        color:
                                          linea.cantidad_pendiente_entrega >
                                          0
                                            ? "#b91c1c"
                                            : "#334155",
                                      }}
                                    >
                                      {formatearNumero(
                                        linea.cantidad_pendiente_entrega
                                      )}
                                    </span>
                                  </Td>

                                  <Td align="right">
                                    {formatearNumero(
                                      linea.cantidad_facturada
                                    )}
                                  </Td>

                                  <Td align="right">
                                    <span
                                      style={{
                                        fontWeight:
                                          linea.cantidad_pendiente_facturar >
                                          0
                                            ? 800
                                            : 500,

                                        color:
                                          linea.cantidad_pendiente_facturar >
                                          0
                                            ? "#92400e"
                                            : "#334155",
                                      }}
                                    >
                                      {formatearNumero(
                                        linea.cantidad_pendiente_facturar
                                      )}
                                    </span>
                                  </Td>

                                  <Td>
                                    <Badge>
                                      {
                                        linea.estado_detalle
                                      }
                                    </Badge>
                                  </Td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          }
        )}

        {!pedidosFiltrados.length && (
          <div
            style={{
              background: "white",

              border:
                "1px solid #e2e8f0",

              borderRadius: 12,

              padding: 35,

              textAlign:
                "center",

              color: "#64748b",

              fontSize: 14,
            }}
          >
            No se encontraron pedidos con los filtros seleccionados.
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   COMPONENTES
   ============================================================ */

function Badge({
  children,
}: {
  children: React.ReactNode;
}) {
  const texto =
    String(children || "");

  return (
    <span
      style={{
        ...estiloEstado(texto),

        display:
          "inline-flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        borderRadius: 999,

        padding:
          "5px 10px",

        fontSize: 11,

        fontWeight: 700,

        lineHeight: 1.2,

        textAlign: "center",

        whiteSpace:
          "normal",

        maxWidth: 190,
      }}
    >
      {children}
    </span>
  );
}

function Kpi({
  titulo,
  valor,
  tipo = "neutral",
}: {
  titulo: string;
  valor: number;
  tipo?:
    | "neutral"
    | "rojo"
    | "amarillo"
    | "azul"
    | "verde";
}) {
  const configuracion = {
    neutral: {
      fondo: "#ffffff",
      borde: "#dbe3ed",
      texto: "#0f172a",
    },

    rojo: {
      fondo: "#fffafa",
      borde: "#fecaca",
      texto: "#991b1b",
    },

    amarillo: {
      fondo: "#fffdf5",
      borde: "#fde68a",
      texto: "#92400e",
    },

    azul: {
      fondo: "#f8fbff",
      borde: "#bfdbfe",
      texto: "#1d4ed8",
    },

    verde: {
      fondo: "#f7fef9",
      borde: "#bbf7d0",
      texto: "#166534",
    },
  }[tipo];

  return (
    <div
      style={{
        background:
          configuracion.fondo,

        border: `1px solid ${configuracion.borde}`,

        borderRadius: 11,

        padding:
          "14px 16px",

        minHeight: 72,
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          fontWeight: 800,
          fontSize: 23,
          marginTop: 5,
          color:
            configuracion.texto,
        }}
      >
        {valor.toLocaleString(
          "es-CL"
        )}
      </div>
    </div>
  );
}

function EstadoBox({
  titulo,
  estado,
}: {
  titulo: string;
  estado: string;
}) {
  return (
    <div
      style={{
        background:
          "#f8fafc",

        border:
          "1px solid #eef2f7",

        borderRadius: 9,

        padding:
          "10px 11px",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 11,
          marginBottom: 6,
        }}
      >
        {titulo}
      </div>

      <Badge>
        {estado || "-"}
      </Badge>
    </div>
  );
}

function Dato({
  titulo,
  valor,
}: {
  titulo: string;
  valor: React.ReactNode;
}) {
  return (
    <div
      style={{
        background:
          "#f8fafc",

        borderRadius: 8,

        padding:
          "10px 11px",

        border:
          "1px solid #eef2f7",

        minHeight: 53,
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 10,
          marginBottom: 5,
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 700,

          color: "#0f172a",

          overflowWrap:
            "anywhere",
        }}
      >
        {valor}
      </div>
    </div>
  );
}

function MiniKpi({
  titulo,
  valor,
  alerta = false,
}: {
  titulo: string;
  valor: number;
  alerta?: boolean;
}) {
  return (
    <div
      style={{
        border:
          alerta
            ? "1px solid #fecaca"
            : "1px solid #e2e8f0",

        background:
          alerta
            ? "#fffafa"
            : "#ffffff",

        borderRadius: 8,

        padding:
          "9px 11px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          marginTop: 3,

          fontSize: 15,
          fontWeight: 800,

          color:
            alerta
              ? "#b91c1c"
              : "#0f172a",
        }}
      >
        {formatearNumero(
          valor
        )}
      </div>
    </div>
  );
}

function FilaCantidad({
  titulo,
  valor,
  destacado = false,
}: {
  titulo: string;
  valor: number;
  destacado?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",

        justifyContent:
          "space-between",

        gap: 9,
      }}
    >
      <span
        style={{
          color: "#64748b",
        }}
      >
        {titulo}
      </span>

      <strong
        style={{
          color:
            destacado
              ? "#b91c1c"
              : "#0f172a",
        }}
      >
        {formatearNumero(
          valor
        )}
      </strong>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      style={{
        padding:
          "10px 9px",

        borderBottom:
          "1px solid #e2e8f0",

        textAlign:
          align,

        whiteSpace:
          "nowrap",

        color: "#475569",

        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      style={{
        padding:
          "10px 9px",

        borderBottom:
          "1px solid #f1f5f9",

        textAlign:
          align,

        verticalAlign:
          "middle",

        color: "#334155",
      }}
    >
      {children}
    </td>
  );
}