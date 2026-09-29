"use client";

import React, { useEffect, useMemo, useState } from "react";

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
    background: "#e5e7eb",
    color: "#374151",
    border: "1px solid #d1d5db",
  };
}

function Badge({
  children,
}: {
  children: React.ReactNode;
}) {
  const texto = String(children || "");

  return (
    <span
      style={{
        ...estiloEstado(texto),
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 9px",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export default function SeguimientoPedidosPage() {
  const [lineas, setLineas] = useState<
    LineaSeguimiento[]
  >([]);

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [busqueda, setBusqueda] =
    useState("");

  const [estadoFiltro, setEstadoFiltro] =
    useState("TODOS");

  const [soloPendientes, setSoloPendientes] =
    useState(false);

  const [abiertos, setAbiertos] =
    useState<Set<number>>(new Set());

  async function cargarSeguimiento() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        "/api/seguimiento-pedidos",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            "No se pudo cargar el seguimiento."
        );
      }

      setUsuario(json.usuario || null);
      setLineas(json.data || []);
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
    }
  }

  useEffect(() => {
    cargarSeguimiento();
  }, []);

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
      const primera = detalle[0];

      const foliosGdd = Array.from(
        new Set(
          detalle
            .map((l) => Number(l.folio_gdd))
            .filter((x) => Number.isFinite(x) && x > 0)
        )
      );

      const foliosFe = Array.from(
        new Set(
          detalle
            .map((l) => Number(l.folio_fe))
            .filter((x) => Number.isFinite(x) && x > 0)
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
          primera.nro_ot || "",

        transporte:
          primera.transporte || "",

        indicador:
          primera.indicador || "",

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
              a.linea_num - b.linea_num
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
        `.toLowerCase();

        return contenido.includes(texto);
      });
    }, [
      pedidos,
      busqueda,
      estadoFiltro,
      soloPendientes,
    ]);

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

  if (loading) {
    return (
      <div
        style={{
          padding: 24,
          fontFamily: "Arial, sans-serif",
        }}
      >
        Cargando seguimiento de pedidos...
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24,
        background: "#f8fafc",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* =========================================================
          ENCABEZADO
          ========================================================= */}

      <div
        style={{
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 26,
          }}
        >
          Seguimiento de Pedidos
        </h1>

        <div
          style={{
            marginTop: 6,
            color: "#64748b",
            fontSize: 14,
          }}
        >
          {usuario?.nombre || ""}
          {usuario?.zona
            ? ` · ${usuario.zona}`
            : ""}
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 12,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      {/* =========================================================
          KPI
          ========================================================= */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Kpi
          titulo="Pedidos"
          valor={resumen.total}
        />

        <Kpi
          titulo="Pend. despacho"
          valor={resumen.pendientes}
        />

        <Kpi
          titulo="Parciales"
          valor={resumen.parciales}
        />

        <Kpi
          titulo="Pend. factura"
          valor={
            resumen.pendientesFactura
          }
        />

        <Kpi
          titulo="Completos"
          valor={resumen.completos}
        />
      </div>

      {/* =========================================================
          FILTROS
          ========================================================= */}

      <div
        style={{
          background: "white",
          padding: 16,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          marginBottom: 18,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          value={busqueda}
          onChange={(e) =>
            setBusqueda(e.target.value)
          }
          placeholder="Buscar pedido, OC, cliente, código o producto..."
          style={{
            flex: "1 1 350px",
            minWidth: 260,
            padding: "10px 12px",
            border:
              "1px solid #cbd5e1",
            borderRadius: 7,
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
            padding: "10px 12px",
            border:
              "1px solid #cbd5e1",
            borderRadius: 7,
            background: "white",
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
            display: "flex",
            gap: 7,
            alignItems: "center",
            fontSize: 14,
          }}
        >
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) =>
              setSoloPendientes(
                e.target.checked
              )
            }
          />

          Solo pendientes
        </label>

        <button
          onClick={cargarSeguimiento}
          style={{
            padding: "10px 14px",
            border: 0,
            borderRadius: 7,
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Actualizar
        </button>
      </div>

      <div
        style={{
          marginBottom: 10,
          color: "#64748b",
          fontSize: 13,
        }}
      >
        {pedidosFiltrados.length} pedidos ·{" "}
        {lineas.length} líneas de productos
      </div>

      {/* =========================================================
          PEDIDOS
          ========================================================= */}

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
                    "1px solid #e2e8f0",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() =>
                    togglePedido(
                      pedido.numeroPedido
                    )
                  }
                  style={{
                    width: "100%",
                    border: 0,
                    background: "white",
                    padding: 16,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "150px minmax(220px, 1fr) 140px 160px 40px",
                      gap: 14,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                        }}
                      >
                        Pedido
                      </div>

                      <strong
                        style={{
                          fontSize: 17,
                        }}
                      >
                        {
                          pedido.numeroPedido
                        }
                      </strong>

                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          marginTop: 3,
                        }}
                      >
                        {formatearFecha(
                          pedido.fecha
                        )}
                      </div>
                    </div>

                    <div>
                      <strong>
                        {pedido.cardname}
                      </strong>

                      <div
                        style={{
                          color: "#64748b",
                          fontSize: 13,
                          marginTop: 3,
                        }}
                      >
                        {pedido.cardcode}

                        {pedido.oc
                          ? ` · OC ${pedido.oc}`
                          : ""}
                      </div>
                    </div>

                    <div>
                      <Badge>
                        {
                          pedido.estadoGeneral
                        }
                      </Badge>
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                      }}
                    >
                      <div>
                        Pedido:{" "}
                        <strong>
                          {formatearNumero(
                            pedido.cantidadPedido
                          )}
                        </strong>
                      </div>

                      <div>
                        Pendiente:{" "}
                        <strong>
                          {formatearNumero(
                            pedido.cantidadPendiente
                          )}
                        </strong>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: 20,
                      }}
                    >
                      {abierto
                        ? "−"
                        : "+"}
                    </div>
                  </div>
                </button>

                {abierto && (
                  <div
                    style={{
                      borderTop:
                        "1px solid #e2e8f0",
                      padding: 16,
                    }}
                  >
                    {/* ESTADOS */}

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 16,
                      }}
                    >
                      <div>
                        <small>SAC</small>
                        <br />
                        <Badge>
                          {
                            pedido.estadoSac
                          }
                        </Badge>
                      </div>

                      <div>
                        <small>
                          Cobranza
                        </small>
                        <br />
                        <Badge>
                          {
                            pedido.estadoCobranza
                          }
                        </Badge>
                      </div>

                      <div>
                        <small>
                          Bodega
                        </small>
                        <br />
                        <Badge>
                          {
                            pedido.estadoBodega
                          }
                        </Badge>
                      </div>
                    </div>

                    {/* DATOS DOCUMENTO */}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                        marginBottom: 16,
                        fontSize: 13,
                      }}
                    >
                      <Dato
                        titulo="OC"
                        valor={
                          pedido.oc || "-"
                        }
                      />

                      <Dato
                        titulo="GDD"
                        valor={
                          pedido.foliosGdd
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
                          pedido.foliosFe
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
                          pedido.nroOt || "-"
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

                    <div
                      style={{
                        marginBottom: 16,
                        fontSize: 13,
                      }}
                    >
                      <strong>
                        Dirección de despacho:
                      </strong>

                      <div
                        style={{
                          marginTop: 4,
                          whiteSpace:
                            "pre-line",
                          color: "#475569",
                        }}
                      >
                        {(
                          pedido.direccionDespacho ||
                          "-"
                        ).replace(
                          /\r/g,
                          "\n"
                        )}
                      </div>
                    </div>

                    {/* DETALLE */}

                    <div
                      style={{
                        overflowX: "auto",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse:
                            "collapse",
                          fontSize: 13,
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
                            (linea) => (
                              <tr
                                key={
                                  linea.clave_seguimiento
                                }
                              >
                                <Td>
                                  {
                                    linea.codigo_articulo
                                  }
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
                                  <strong>
                                    {formatearNumero(
                                      linea.cantidad_pendiente_entrega
                                    )}
                                  </strong>
                                </Td>

                                <Td align="right">
                                  {formatearNumero(
                                    linea.cantidad_facturada
                                  )}
                                </Td>

                                <Td align="right">
                                  {formatearNumero(
                                    linea.cantidad_pendiente_facturar
                                  )}
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
              borderRadius: 10,
              padding: 30,
              textAlign: "center",
              color: "#64748b",
            }}
          >
            No se encontraron pedidos con
            los filtros seleccionados.
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 13,
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          fontWeight: 800,
          fontSize: 25,
          marginTop: 4,
        }}
      >
        {valor.toLocaleString(
          "es-CL"
        )}
      </div>
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
        background: "#f8fafc",
        borderRadius: 7,
        padding: 10,
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 11,
          marginBottom: 3,
        }}
      >
        {titulo}
      </div>

      <strong>{valor}</strong>
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
        padding: "9px 8px",
        borderBottom:
          "1px solid #e2e8f0",
        textAlign: align,
        whiteSpace: "nowrap",
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
        padding: "9px 8px",
        borderBottom:
          "1px solid #f1f5f9",
        textAlign: align,
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}