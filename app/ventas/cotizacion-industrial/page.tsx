// app/ventas/cotizacion/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { generarPdfCotizacion } from "@/lib/utils/pdf-cotizacion";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";


/* ========================= Helpers ========================= */
function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
function num(x: unknown) {
  if (typeof x === "string") {
    const cleaned = x.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const v = Number(cleaned);
    return Number.isFinite(v) ? v : 0;
  }
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}
function money(n: number) {
  return (n || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const pushCell = () => (row.push(cell), (cell = ""));
  const pushRow = () => {
    if (row.length) rows.push(row);
    row = [];
  };
  const s = (text || "").replace(/\r/g, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") pushCell();
      else if (ch === "\n") {
        pushCell();
        pushRow();
      } else cell += ch;
    }
  }
  if (cell.length || row.length) {
    pushCell();
    pushRow();
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c === "")) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => (obj[h] = (r[j] ?? "").trim()));
    out.push(obj);
  }
  return out;
}
async function fetchCsv(spreadsheetId: string, gid: string | number) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}
function normalizeGoogleSheetUrl(url: string) {
  const m = (url || "").match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const id = m ? m[1] : "";
  let gid = "0";
  const g = (url || "").match(/[?&#]gid=([0-9]+)/);
  if (g) gid = g[1];
  return { id, gid };
}
function hoyCL() {
  return new Date().toLocaleDateString("es-CL");
}

/* ========================= Tipos ========================= */
type Client = {
  nombre: string;
  rut: string;
  codigo: string;
  direccion: string;
  comuna?: string;
  contacto?: string;
  email?: string;
  telefono?: string;
};
type Product = { code: string; name: string; price_list: number; kilos: number };
type Line = {
  code: string;
  name: string;
  kilos: number;      // solo aplica a PT
  qty: number;
  priceBase: number;  // referencia: $/kg si PT (o $ unit para no-PT)
  precioVenta: number; // $/kg si PT (modo kilo), $/presentación si PT (modo presentación), $ unit si no-PT
  descuento: number;  // % entre -20 y 20 (positivo = rebaja)
  total: number;
};

/* ========================= Componente ========================= */
export default function CotizacionPage() {
  /* ---- Modo cliente ---- */
  const [tipoCliente, setTipoCliente] = useState<"activo" | "nuevo">("activo");

  /* ---- Preferencias dinámicas (con memoria) ---- */
  const [modoPrecio, setModoPrecio] = useState<"kilo" | "presentacion">("kilo");
  const [mostrarTotales, setMostrarTotales] = useState<boolean>(true);
  const [mostrarIva, setMostrarIva] = useState<boolean>(true);

  useEffect(() => {
    try {
      const mp = window.localStorage.getItem("ctz.pref.modoPrecio") as "kilo" | "presentacion" | null;
      const mt = window.localStorage.getItem("ctz.pref.mostrarTotales");
      const mi = window.localStorage.getItem("ctz.pref.mostrarIva");
      if (mp === "kilo" || mp === "presentacion") setModoPrecio(mp);
      if (mt !== null) setMostrarTotales(mt === "1");
      if (mi !== null) setMostrarIva(mi === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("ctz.pref.modoPrecio", modoPrecio);
      window.localStorage.setItem("ctz.pref.mostrarTotales", mostrarTotales ? "1" : "0");
      window.localStorage.setItem("ctz.pref.mostrarIva", mostrarIva ? "1" : "0");
    } catch {}
  }, [modoPrecio, mostrarTotales, mostrarIva]);

  /* ---- Datos cliente ---- */
  const [clients, setClients] = useState<Client[]>([]);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteRut, setClienteRut] = useState("");
  const [clienteCodigo, setClienteCodigo] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [clienteComuna, setClienteComuna] = useState("");
  const [clienteContacto, setClienteContacto] = useState("");
  const [emailCliente, setEmailCliente] = useState("");

  /* ---- Ejecutivo (firma dinámica) ---- */
  const [ejecutivoNombre, setEjecutivoNombre] = useState("");
  const [emailEjecutivo, setEmailEjecutivo] = useState("");
  const [celularEjecutivo, setCelularEjecutivo] = useState("");

  /* ---- Productos ---- */
  const [productos, setProductos] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  /* ---- Metadatos ---- */
  const [numeroCTZ, setNumeroCTZ] = useState("");
  const [validez, setValidez] = useState("10 días");
  const [formaPago, setFormaPago] = useState("Contado - Transferencia");
  const [plazoEntrega, setPlazoEntrega] = useState("A convenir");
  const [observaciones, setObservaciones] = useState("");

  const [procesando, setProcesando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  /* ---- Numeración CTZ local ---- */
  useEffect(() => {
    function generarNumeroCTZ(): string {
      if (typeof window === "undefined") return "";
      const year = new Date().getFullYear();
      const key = `ctz.counter.${year}`;
      const last = Number(window.localStorage.getItem(key) || "0");
      const next = last + 1;
      window.localStorage.setItem(key, String(next));
      return `CTZ-${year}-${String(next).padStart(5, "0")}`;
    }
    setNumeroCTZ(generarNumeroCTZ());
  }, []);

  /* ---- Carga de clientes (misma fuente que NV) ---- */
  useEffect(() => {
    (async () => {
      try {
        const { id, gid } = normalizeGoogleSheetUrl(
          "https://docs.google.com/spreadsheets/d/1kF0INEtwYDXhQCBPTVhU8NQI2URKoi99Hs43DTSO02I/edit?gid=161671364#gid=161671364"
        );
        if (!id) return;
        const rows = await fetchCsv(id, gid);
        const list: Client[] = rows.map((r) => ({
          nombre: String((r as any).CardName ?? (r as any).Nombre ?? "").trim(),
          rut: String((r as any).RUT ?? (r as any).LicTradNum ?? "").trim(),
          codigo: String((r as any).CardCode ?? "").trim(),
          direccion: String((r as any)["Dirección Despacho"] ?? (r as any)["Direccion Despacho"] ?? (r as any).Address ?? "").trim(),
          comuna: String((r as any)["Comuna"] ?? "").trim(),
          contacto: String((r as any)["Contacto"] ?? "").trim(),
          email: String((r as any)["Email"] ?? "").trim(),
          telefono: String((r as any)["Telefono"] ?? "").trim(),
        }));
        setClients(list.filter((c) => c.nombre));
      } catch (e: any) {
        setErrorMsg(`Clientes: ${e.message}`);
      }
    })();
  }, []);

  /* ---- Carga de productos (misma fuente que NV) ---- */
  useEffect(() => {
    (async () => {
      try {
        const { id, gid } = normalizeGoogleSheetUrl(
          "https://docs.google.com/spreadsheets/d/1UXVAxwzg-Kh7AWCPnPbxbEpzXnRPR2pDBKrRUFNZKZo/edit?gid=0#gid=0"
        );
        if (!id) return;
        const rows = await fetchCsv(id, gid);
        const list: Product[] = rows.map((r) => ({
          code: String((r as any).code ?? (r as any).Codigo ?? "").trim(),
          name: String((r as any).name ?? (r as any).Producto ?? "").trim(),
          price_list: num((r as any).price_list ?? (r as any)["Precio Lista"] ?? (r as any).Precio ?? 0),
          kilos: num((r as any).kilos ?? 1),
        }));
        setProductos(list.filter((p) => p.code));
      } catch (e: any) {
        setErrorMsg(`Productos: ${e.message}`);
      }
    })();
  }, []);

  // 🧠 Autocompletar Ejecutivo y Email desde Supabase
useEffect(() => {
  (async () => {
    try {
      const supabase = createClientComponentClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const email = session?.user?.email || "";
      const fullName = session?.user?.user_metadata?.name || ""; // depende de cómo guardes nombre
      const fallbackName = fullName || email.split("@")[0].replace(".", " ").toUpperCase();

      if (email) setEmailEjecutivo(email);         // campo "Email"
      if (fallbackName) setEjecutivoNombre(fallbackName); // campo "Ejecutivo"
    } catch (err) {
      console.error("❌ Error obteniendo datos Supabase:", err);
    }
  })();
}, []);


  /* ---- Eventos cliente (solo en modo activo autocompleta y bloquea) ---- */
  function onClienteNombre(val: string) {
    setClienteNombre(val);
    if (tipoCliente === "activo") {
      const row = clients.find((c) => normalize(c.nombre) === normalize(val));
      if (row) {
        setClienteRut(row.rut || "");
        setClienteCodigo("");
        setClienteDireccion(row.direccion || "");
        setClienteComuna(row.comuna || "");
        setClienteContacto(row.contacto || "");
        setEmailCliente(row.email || "");
      } else {
        setClienteRut("");
        setClienteCodigo("");
        setClienteDireccion("");
        setClienteComuna("");
        setClienteContacto("");
        setEmailCliente("");
      }
    }
  }
  function onClienteCodigo(val: string) {
    setClienteCodigo(val);
    if (tipoCliente === "activo") {
      const row = clients.find((c) => c.codigo === val);
      if (row) {
        setClienteRut(row.rut || "");
        setClienteDireccion(row.direccion || "");
        setClienteComuna(row.comuna || "");
        setClienteContacto(row.contacto || "");
        setEmailCliente(row.email || "");
      }
    }
  }

  /* ---- Líneas ---- */
  function addLine() {
    setLines((old) => [
      ...old,
      { code: "", name: "", kilos: 1, qty: 1, priceBase: 0, precioVenta: 0, descuento: 0, total: 0 },
    ]);
  }
  function rmLine(i: number) {
    setLines((old) => old.filter((_, idx) => idx !== i));
  }
  function fillFromCode(i: number, code: string) {
    const prod = productos.find((p) => p.code === code);
    if (!prod) return;
    setLines((old) => {
      const n = [...old];
      const base = n[i] ?? {
        code: "", name: "", kilos: 1, qty: 1, priceBase: 0, precioVenta: 0, descuento: 0, total: 0,
      };
      const row: Line = {
        ...base,
        code: prod.code,
        name: prod.name,
        kilos: prod.kilos || 1,
        priceBase: prod.price_list || 0,
        precioVenta: prod.price_list || 0, // editable
        descuento: 0,
      };
      n[i] = computeLine(row);
      return n;
    });
  }

  // 🔁 Recalcular totales cuando cambia el modo de precio
  useEffect(() => {
    setLines((old) => old.map((r) => computeLine(r)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoPrecio]);

  function updateLine(i: number, field: keyof Line | "descuento", value: unknown) {
    setLines((old) => {
      const n = [...old];
      const current = n[i];
      if (!current) return old;
      const row: Line = { ...current };

      const esPT = (row.code || "").toUpperCase().startsWith("PT");
      const basePorKg = num(row.priceBase) || 0;     // base por kg (PT) o base unit (no-PT)
      const basePresentacion = Math.round(basePorKg * (num(row.kilos) || 1)); // base por presentación (PT)

      // Helper: base correspondiente según modo
      const baseComparacion =
        esPT && modoPrecio === "presentacion" ? basePresentacion : basePorKg;

      if (field === "precioVenta") {
        const pv = value === "" || value === undefined ? 0 : Math.round(num(value));
        const descCalc = baseComparacion > 0 ? ((baseComparacion - pv) / baseComparacion) * 100 : 0;

        if (descCalc > 20) {
          // 🚫 no permitir >20% descuento
          alert(
            `❌ Precio inferior al 80% del precio base.\n\n` +
              `Precio base de comparación: ${money(baseComparacion)}\n` +
              `Digitado: ${money(pv)}\n\n` +
              `El descuento calculado sería ${descCalc.toFixed(2)}%, lo que supera el máximo permitido (20%).\n\n` +
              `El precio será restablecido al valor base.`
          );
          row.precioVenta = baseComparacion; // restablecer al base correspondiente
          row.descuento = 0;
        } else {
          row.precioVenta = pv;
          // sincroniza % desc (puede ser negativo si sube el precio)
          row.descuento = Math.round((baseComparacion - pv) / baseComparacion * 100);
          // clamp sólo para visualización; no alerta si es < -20
          row.descuento = clamp(row.descuento, -20, 20);
        }
      } else if (field === "descuento") {
        // Usuario edita % desc
        let d = Math.round(num(value));
        if (d > 20) {
          alert("❌ Descuento máximo permitido es 20%. Se restablece al precio base.");
          d = 0;
          row.precioVenta = baseComparacion;
        } else {
          d = clamp(d, -20, 20); // permite -20% (recargo) hasta +20% (rebaja)
          // aplica al precio
          const precio = Math.round(baseComparacion * (1 - d / 100));
          row.precioVenta = precio;
        }
        row.descuento = d;
      } else {
        // Otros campos
        (row as any)[field] = value as any;
        row.kilos = num(row.kilos) || 1;
        row.qty = num(row.qty) || 0;
        row.priceBase = num(row.priceBase) || 0;
        row.precioVenta = num(row.precioVenta) || 0;

        // Si cambia kilos y estamos en modo "presentación" para PT,
        // revalidamos que el precio por presentación no caiga bajo 80% del nuevo base
        if (field === "kilos" && esPT && modoPrecio === "presentacion") {
          const basePres = Math.round((num(row.priceBase) || 0) * (num(row.kilos) || 1));
          const pv = Math.round(num(row.precioVenta));
          const descCalc = basePres > 0 ? ((basePres - pv) / basePres) * 100 : 0;
          if (descCalc > 20) {
            alert(
              `❌ El precio por presentación quedó bajo el 80% del precio base al cambiar los Kg.\n\n` +
                `Nuevo base presentación: ${money(basePres)}\n` +
                `Precio: ${money(pv)}\n\n` +
                `Se restablecerá al precio base.`
            );
            row.precioVenta = basePres;
            row.descuento = 0;
          } else {
            // sincroniza el % desc frente a cambio de kilos
            row.descuento = Math.round((basePres - pv) / basePres * 100);
            row.descuento = clamp(row.descuento, -20, 20);
          }
        }
      }

      n[i] = computeLine(row);
      return n;
    });
  }

  function computeLine(row: Line): Line {
    const out = { ...row };
    const esPT = (out.code || "").toUpperCase().startsWith("PT");

    // 👇 dinámica por modo
    let precioPresentacion: number;
    if (esPT) {
      precioPresentacion =
        modoPrecio === "kilo"
          ? (out.precioVenta || 0) * (out.kilos || 1) // $/kg × kg
          : (out.precioVenta || 0);                   // $ por presentación
    } else {
      precioPresentacion = (out.precioVenta || 0);    // $ unitario
    }

    out.total = Math.round(precioPresentacion) * (out.qty || 0);
    return out;
  }

  /* ---- Totales ---- */
  const subtotal = useMemo(
    () => lines.reduce((sum, r) => sum + (Number.isFinite(r.total) ? r.total : 0), 0),
    [lines]
  );
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal + iva;

  /* ---- Acciones ---- */
  function limpiar() {
    setTipoCliente("activo");
    setClienteNombre("");
    setClienteRut("");
    setClienteCodigo("");
    setClienteDireccion("");
    setClienteComuna("");
    setClienteContacto("");
    setEmailCliente("");
    setEjecutivoNombre("");
    setEmailEjecutivo("");
    setCelularEjecutivo("");
    setValidez("10 días");
    setFormaPago("Contado - Transferencia");
    setPlazoEntrega("A convenir");
    setObservaciones("");
    setLines([]);
    setInfoMsg("");
    setErrorMsg("");
  }

  async function guardarPdfYEnviar() {
    if (procesando) return;
    setProcesando(true);
    setErrorMsg("");
    setInfoMsg("");

    try {
      // Validaciones mínimas
      if (!clienteNombre) throw new Error("Falta el nombre del cliente.");
      if (!emailCliente) throw new Error("Falta el email del cliente.");
      if (!emailEjecutivo) throw new Error("Falta el email del ejecutivo.");
      if (lines.length === 0) throw new Error("Agrega al menos un ítem.");

      // 🚨 Validación de descuentos > 20% antes de guardar
      const descuentosInvalidos = lines
        .map((l) => {
          const esPT = (l.code || "").toUpperCase().startsWith("PT");
          const basePorKg = num(l.priceBase) || 0;
          const basePresentacion = Math.round(basePorKg * (num(l.kilos) || 1));
          let baseComparacion = basePorKg;
          if (esPT && modoPrecio === "presentacion") baseComparacion = basePresentacion;
          const pv = Math.round(num(l.precioVenta) || 0);
          const descCalc = baseComparacion > 0 ? ((baseComparacion - pv) / baseComparacion) * 100 : 0;
          return { l, descCalc };
        })
        .filter(({ descCalc }) => descCalc > 20);

      if (descuentosInvalidos.length > 0) {
        const detalle = descuentosInvalidos
          .map(({ l, descCalc }) => `• ${l.code} (${l.name}) — Descuento ${descCalc.toFixed(2)}%`)
          .join("\n");
        throw new Error(
          `❌ No se puede generar la Cotización.\n\n` +
          `Hay ${descuentosInvalidos.length} ítem(s) con descuento superior al 20%:\n\n` +
          `${detalle}\n\nCorrige los precios antes de continuar.`
        );
      }

      const fecha = hoyCL();

      // Payload para Sheets (una fila por ítem)
      const datos = lines.map((item) => ({
        numeroCTZ,
        fecha,
        cliente: clienteNombre,
        rut: clienteRut,
        codigoCliente: clienteCodigo,
        direccion: clienteDireccion,
        comuna: clienteComuna,
        contacto: clienteContacto,
        emailCliente,
        ejecutivo: ejecutivoNombre,
        emailEjecutivo,
        celularEjecutivo,
        validez,
        formaPago,
        entrega: plazoEntrega,
        observaciones,
        subtotal,
        iva,
        total,
        codigo: item.code,
        descripcion: item.name,
        kilos: item.kilos,
        cantidad: item.qty,
        precioUnitarioPresentacion: Math.round(item.precioVenta || 0),
        descuento: item.descuento,
        totalItem: Math.round(item.total || 0),
        modoPrecio,
        mostrarTotales: mostrarTotales ? "Sí" : "No",
        mostrarIva: mostrarIva ? "Sí" : "No",
      }));

      // 1) Guardar en Sheets (pestaña "Cotizaciones")
      const resSave = await fetch("/api/save-to-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "Cotizacion", datos }),
      });
      if (!resSave.ok) throw new Error("Error al guardar en Google Sheets.");
      const saved = await resSave.json();
      const rows = Number(saved?.rows ?? datos.length) || datos.length;
      setInfoMsg(`✅ Cotización guardada con ${rows} ítem(s) en "Cotizaciones".`);

      // 2) Generar PDF corporativo
      const { filename, base64 } = await generarPdfCotizacion({
        numero: numeroCTZ,
        fecha: `Santiago, ${new Date().toLocaleDateString("es-CL", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}`,
        cliente: {
          nombre: clienteNombre,
          rut: clienteRut,
          direccion: clienteDireccion,
          comuna: clienteComuna,
          email: emailCliente,
        },
        productos: lines.map((r) => ({
          codigo: r.code,
          descripcion: r.name,
          cantidad: r.qty,
          kilos: r.kilos,
          precioUnitario: r.precioVenta,
          descuento: r.descuento,
          total: r.total,
        })),
        validez,
        formaPago,
        entrega: plazoEntrega,
        observaciones,
        subtotal,
        iva,
        total,
        opciones: {
          modoPrecio,                 // "kilo" | "presentacion"
          mostrarTotales,             // true/false (leyenda y totales)
          mostrarIva,                 // true/false (incluye IVA)
          mostrarTotalColumna: mostrarTotales, // 👈 importante para la TABLA del PDF
        },
        ejecutivo: {
          nombre: ejecutivoNombre,
          correo: emailEjecutivo,
          celular: celularEjecutivo,
          cargo: "",
        },
      });

      // 3) Enviar email (cliente + ejecutivo, CC Patricia)
      const subject = `Cotización ${numeroCTZ} — ${clienteNombre}`;
      const htmlTotales = mostrarTotales
        ? `
          <li><b>Subtotal:</b> ${money(subtotal)}</li>
          ${mostrarIva ? `<li><b>IVA (19%):</b> ${money(iva)}</li>` : ""}
          ${mostrarIva ? `<li><b>Total (con IVA):</b> ${money(total)}</li>` : ""}
        `
        : "";

      const html = `
        <p>Estimado(a),</p>
        <p>Adjuntamos la <b>Cotización ${numeroCTZ}</b> para <b>${clienteNombre}</b>.</p>
        <ul>
          <li><b>RUT:</b> ${clienteRut || "-"}</li>
          <li><b>Validez:</b> ${validez}</li>
          <li><b>Forma de pago:</b> ${formaPago}</li>
          <li><b>Plazo de entrega:</b> ${plazoEntrega}</li>
          ${htmlTotales}
        </ul>
        ${observaciones ? `<p><b>Observaciones:</b> ${observaciones}</p>` : ""}
        <hr />
        <p style="font-size:12px;color:#666">
          Atentamente,<br/>
          <b>${ejecutivoNombre || "Ejecutivo de Ventas"}</b><br/>
          ${emailEjecutivo ? `${emailEjecutivo}<br/>` : ""}
          ${celularEjecutivo ? `Cel.: ${celularEjecutivo}<br/>` : ""}
          Spartan de Chile Ltda.
        </p>
      `;

      const resMail = await fetch("/api/send-cotizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          html,
          toCliente: emailCliente,
          toEjecutivo: emailEjecutivo,
          ccFija: "patricia.acuna@spartan.cl",
          attachments: [{ filename, content: base64 }],
          replyTo: emailEjecutivo,
          fromName: `Spartan App — ${numeroCTZ}`,
        }),
      });
      const mailJson = await resMail.json();
      if (!mailJson.ok) throw new Error(mailJson.error || "No se pudo enviar el correo");

      alert("✅ Guardado en Sheets, PDF generado y correo enviado a Cliente + Ejecutivo (CC Patricia).");
    } catch (e: any) {
      console.error("❌ Error:", e);
      setErrorMsg(e?.message || "Ocurrió un error inesperado.");
      alert(`❌ No se pudo completar el proceso.\n\nDetalles: ${e?.message || "Error inesperado"}`);
    } finally {
      setProcesando(false);
    }
  }

  /* ========================= UI ========================= */
  const readOnlyActivos = tipoCliente === "activo";

  return (
    <>
      <div id="printArea" className="min-h-screen bg-white p-6 text-[12px]">
        {/* Encabezado */}
        <header className="mb-4 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-3">
            <img
              src="https://images.jumpseller.com/store/spartan-de-chile/store/logo/Spartan_Logo_-_copia.jpg?0"
              alt="Spartan"
              className="h-12 w-auto"
            />
            <h1 className="text-lg font-bold text-[#2B6CFF]">📄 Cotización</h1>
          </div>
          <div className="text-[11px] bg-zinc-100 px-3 py-2 rounded text-right">
            <div><b>N°</b> {numeroCTZ || "—"}</div>
            <div>{hoyCL()}</div>
          </div>
        </header>

        {/* Mensajes */}
        {!!errorMsg && (
          <div className="mb-3 rounded bg-red-50 text-red-700 px-3 py-2 text-sm border border-red-200">{errorMsg}</div>
        )}
        {!!infoMsg && !errorMsg && (
          <div className="mb-3 rounded bg-green-50 text-green-700 px-3 py-2 text-sm border border-green-200">
            {infoMsg}
          </div>
        )}

        {/* Preferencias dinámicas */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <h2 className="font-semibold text-[#2B6CFF] mb-2">Preferencias de Cotización</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
            <label className="flex items-center gap-2">
              <span className="font-medium w-40">Modo de precio (PT):</span>
              <select
                className="border rounded px-2 py-1"
                value={modoPrecio}
                onChange={(e) => setModoPrecio(e.target.value as "kilo" | "presentacion")}
              >
                <option value="kilo">Por kilo (× Kg)</option>
                <option value="presentacion">Por presentación</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarTotales}
                onChange={(e) => setMostrarTotales(e.target.checked)}
              />
              <span>Mostrar totales</span>
            </label>

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarIva}
                onChange={(e) => setMostrarIva(e.target.checked)}
                disabled={!mostrarTotales}
                title={!mostrarTotales ? "Activa 'Mostrar totales' primero" : ""}
              />
              <span>Incluir IVA (19%)</span>
            </label>
          </div>
        </section>

        {/* Selector tipo cliente */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[#2B6CFF]">Tipo de cliente:</span>
            <select
              value={tipoCliente}
              onChange={(e) => {
                const v = e.target.value as "activo" | "nuevo";
                setTipoCliente(v);
                if (v === "nuevo") {
                  setClienteCodigo("");
                  setClienteRut("");
                  setClienteDireccion("");
                  setClienteComuna("");
                  setClienteContacto("");
                }
              }}
              className="border p-2 rounded w-52"
            >
              <option value="activo">🧾 Cliente Activo</option>
              <option value="nuevo">🆕 Cliente Nuevo</option>
            </select>
          </div>
        </section>

        {/* Cliente */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <h2 className="font-semibold text-[#2B6CFF] mb-2">Datos del Cliente</h2>
          <div className="grid grid-cols-2 gap-2 text-[12px] print:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Nombre</span>
              {tipoCliente === "activo" ? (
                <>
                  <input
                    className="w-full border rounded px-2 py-1"
                    value={clienteNombre}
                    onChange={(e) => onClienteNombre(e.target.value)}
                    list="clientesList"
                  />
                  <datalist id="clientesList">
                    {clients.map((c, i) => <option key={`${c.codigo}-${i}`} value={c.nombre} />)}
                  </datalist>
                </>
              ) : (
                <input
                  className="w-full border rounded px-2 py-1"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Razón Social / Nombre"
                />
              )}
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium">RUT</span>
              <input
                className="w-full border rounded px-2 py-1"
                value={clienteRut}
                readOnly={tipoCliente === "activo"}
                onChange={(e) => setClienteRut(e.target.value)}
                placeholder={tipoCliente === "activo" ? "" : "Ej: 12.345.678-9"}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium">Código Cliente</span>
              {tipoCliente === "activo" ? (
                <select
                  className="w-full border rounded px-2 py-1"
                  value={clienteCodigo}
                  onChange={(e) => onClienteCodigo(e.target.value)}
                >
                  <option value="">Seleccione…</option>
                  {clients
                    .filter((c) => normalize(c.nombre) === normalize(clienteNombre))
                    .map((c) => (
                      <option key={c.codigo} value={c.codigo}>
                        {c.codigo} — {c.direccion}
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  className="w-full border rounded px-2 py-1"
                  value={clienteCodigo}
                  onChange={(e) => setClienteCodigo(e.target.value)}
                  placeholder="(Opcional)"
                />
              )}
            </label>

            <label className="flex flex-col gap-1 print:col-span-2">
              <span className="font-medium">Dirección</span>
              <input
                className="w-full border rounded px-2 py-1"
                value={clienteDireccion}
                readOnly={tipoCliente === "activo"}
                onChange={(e) => setClienteDireccion(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium">Comuna</span>
              <input
                className="w-full border rounded px-2 py-1"
                value={clienteComuna}
                readOnly={tipoCliente === "activo"}
                onChange={(e) => setClienteComuna(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium">Contacto</span>
              <input
                className="w-full border rounded px-2 py-1"
                value={clienteContacto}
                onChange={(e) => setClienteContacto(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium">Email cliente</span>
              <input
                type="email"
                className="w-full border rounded px-2 py-1"
                value={emailCliente}
                onChange={(e) => setEmailCliente(e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* Ejecutivo (firma) */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <h2 className="font-semibold text-[#2B6CFF] mb-2">Ejecutivo</h2>
          <div className="grid grid-cols-3 gap-2 text-[12px]">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Nombre</span>
              <input className="w-full border rounded px-2 py-1" value={ejecutivoNombre} onChange={(e) => setEjecutivoNombre(e.target.value)} placeholder="Ej: Nelson Norambuena" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Email</span>
              <input type="email" className="w-full border rounded px-2 py-1" value={emailEjecutivo} onChange={(e) => setEmailEjecutivo(e.target.value)} placeholder="ejecutivo@spartan.cl" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Celular</span>
              <input className="w-full border rounded px-2 py-1" value={celularEjecutivo} onChange={(e) => setCelularEjecutivo(e.target.value)} placeholder="+56 9 ...." />
            </label>
          </div>
        </section>

        {/* Condiciones */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <h2 className="font-semibold text-[#2B6CFF] mb-2">Condiciones</h2>
          <div className="grid grid-cols-2 gap-2 text-[12px] print:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Validez</span>
              <input className="w-full border rounded px-2 py-1" value={validez} onChange={(e) => setValidez(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Forma de pago</span>
              <select className="w-full border rounded px-2 py-1" value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                <option>Contado - Transferencia</option>
                <option>30 días</option>
                <option>60 días</option>
                <option>Por definir</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Plazo de entrega</span>
              <input className="w-full border rounded px-2 py-1" value={plazoEntrega} onChange={(e) => setPlazoEntrega(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 print:col-span-3">
              <span className="font-medium">Observaciones</span>
              <textarea className="w-full border rounded px-2 py-1" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </label>
          </div>
        </section>

        {/* Productos */}
        <section className="bg-white shadow p-4 rounded mb-4">
          <div className="flex justify-between mb-2 items-center">
            <h2 className="font-semibold text-[#2B6CFF]">Productos</h2>
            <div className="flex gap-2 print:hidden">
              <button className="bg-green-500 px-2 py-1 text-xs text-white rounded" onClick={addLine}>+ Ítem</button>
            </div>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="min-w-full text-[11px] border">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="px-2 py-1 text-left" style={{ width: "80px" }}>Código</th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                  <th className="px-2 py-1 text-right print:hidden" style={{ width: "70px" }}>Kg (PT)</th>
                  <th className="px-2 py-1 text-right" style={{ width: "70px" }}>Cant</th>
                  <th className="px-2 py-1 text-right print:hidden" style={{ width: "110px" }}>Precio base</th>
                  <th className="px-2 py-1 text-right" style={{ width: "85px" }}>% Desc</th>
                  <th className="px-2 py-1 text-right" style={{ width: "140px" }}>
                    {(modoPrecio === "kilo") ? "$ por kg / $ unit" : "$ presentación / $ unit"}
                  </th>
                  <th className="px-2 py-1 text-right" style={{ width: "130px" }}>Total</th>
                  <th className="print:hidden" />
                </tr>
              </thead>
              <tbody>
                {lines.map((r, i) => {
                  const esPT = (r.code || "").toUpperCase().startsWith("PT");
                  return (
                    <tr key={i} className="border-t align-middle">
                      <td className="px-2 py-1">
                        <input
                          className="w-24 border rounded px-1"
                          value={r.code}
                          onChange={(e) => updateLine(i, "code", e.target.value)}
                          onBlur={(e) => fillFromCode(i, e.target.value)}
                          list="productosList"
                        />
                        <datalist id="productosList">
                          {productos.map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.code} — {p.name}
                            </option>
                          ))}
                        </datalist>
                      </td>
                      <td className="px-2 py-1">
                        <div className="truncate print:whitespace-normal">{r.name}</div>
                      </td>
                      <td className="px-2 py-1 text-right print:hidden">
                        <input
                          type="number"
                          className="w-16 border rounded text-right"
                          value={r.kilos}
                          onChange={(e) => updateLine(i, "kilos", num(e.target.value))}
                          min={0}
                          step="any"
                          disabled={!esPT}
                          title={esPT ? "Kilos por presentación" : "Solo aplica a PT"}
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="number"
                          className="w-16 border rounded text-right print:hidden"
                          value={r.qty}
                          onChange={(e) => updateLine(i, "qty", num(e.target.value))}
                          min={0}
                          step="any"
                        />
                        <span className="hidden print:inline">{r.qty}</span>
                      </td>
                      <td className="px-2 py-1 text-right print:hidden">{money(r.priceBase)}</td>

                      {/* % Desc */}
                      <td className="px-2 py-1 text-right">
                        <input
                          type="number"
                          step={1}
                          className="w-20 rounded border px-2 py-1 text-right"
                          value={String(r.descuento ?? 0)}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Permitimos escribir libremente y validamos en blur
                            const n = [...lines];
                            n[i].descuento = num(val);
                            setLines(n);
                          }}
                          onBlur={(e) => updateLine(i, "descuento", e.target.value)}
                        />
                        <div className="text-[10px] text-zinc-500 mt-1">[-20%, +20%]</div>
                      </td>

                      {/* Precio Venta */}
                      <td className="px-2 py-1 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="w-28 rounded border px-2 py-1 text-right"
                          value={r.precioVenta === 0 ? "" : r.precioVenta}
                          onChange={(e) => {
                            const n = [...lines];
                            n[i].precioVenta = e.target.value === "" ? 0 : Number(e.target.value);
                            setLines(n);
                          }}
                          onBlur={(e) => updateLine(i, "precioVenta", e.target.value)}
                        />
                        <div className="text-[10px] text-zinc-500 mt-1">
                          {(r.code || "").toUpperCase().startsWith("PT")
                            ? (modoPrecio === "kilo" ? "$ por kg × Kg" : "$ por presentación")
                            : "$ unitario"}
                        </div>
                      </td>

                      <td className="px-2 py-1 text-right">{money(r.total)}</td>
                      <td className="px-2 py-1 print:hidden">
                        <button className="text-red-600 text-xs" onClick={() => rmLine(i)}>Eliminar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {lines.length > 0 && mostrarTotales && (
                <tfoot>
                  <tr className="font-semibold bg-zinc-50">
                    <td colSpan={6} />
                    <td className="text-right px-2 py-1 border-t">Subtotal</td>
                    <td className="text-right px-2 py-1 border-t">{money(subtotal)}</td>
                    <td />
                  </tr>
                  {mostrarIva && (
                    <>
                      <tr className="bg-zinc-50">
                        <td colSpan={6} />
                        <td className="text-right px-2 py-1">IVA (19%)</td>
                        <td className="text-right px-2 py-1">{money(iva)}</td>
                        <td />
                      </tr>
                      <tr className="font-bold bg-zinc-50">
                        <td colSpan={6} />
                        <td className="text-right px-2 py-1" style={{ borderTop: "2px solid #2B6CFF" }}>
                          TOTAL
                        </td>
                        <td className="text-right px-2 py-1" style={{ borderTop: "2px solid #2B6CFF" }}>
                          {money(total)}
                        </td>
                        <td />
                      </tr>
                    </>
                  )}
                </tfoot>
              )}
            </table>
          </div>
        </section>

        {/* Pie: condiciones + firma */}
        <section className="bg-white shadow p-4 rounded">
          <p className="text-[11px] text-zinc-600">
            Estos precios son netos y no incluyen IVA. Despacho según condiciones indicadas. Validez de la presente
            cotización según se indica. Forma de pago según acuerdo. Spartan de Chile Ltda. presta asesoría técnica
            permanente, sin costo para el cliente, en el uso de su amplia gama de productos.
          </p>
          <div className="mt-4 text-right text-[12px]">
            <div>Atentamente,</div>
            <div className="font-semibold">{ejecutivoNombre || "Ejecutivo de Ventas"}</div>
            <div>Spartan de Chile Ltda.</div>
            {emailEjecutivo && <div>{emailEjecutivo}</div>}
            {celularEjecutivo && <div>Cel.: {celularEjecutivo}</div>}
          </div>
        </section>
      </div>

      {/* Botones */}
<div className="flex flex-wrap gap-2 print:hidden px-6 pb-8">
  <button
    onClick={async () => {
      if (procesando) return; // ⛔ Evita doble clic
      setProcesando(true);

      try {
        await guardarPdfYEnviar(); // tu función actual de guardar + pdf + email
        alert("✅ Cotización guardada y enviada correctamente.");
        // 🔒 Mantiene bloqueado hasta que se cree una nueva cotización
        setProcesando(true);
      } catch (err) {
        console.error("❌ Error al enviar la Cotización:", err);
        alert("Ocurrió un error al guardar o enviar la Cotización.");
        setProcesando(false); // solo se desbloquea si hay error
      }
    }}
    disabled={procesando}
    className={`px-3 py-1 rounded text-white font-medium flex items-center gap-2 shadow transition ${
      procesando
        ? "bg-zinc-400 cursor-not-allowed"
        : "bg-emerald-600 hover:bg-emerald-700"
    }`}
  >
    {procesando ? (
      <>
        <span className="animate-spin">⏳</span>
        Enviando...
      </>
    ) : (
      <>
        💾 Guardar + 📄 PDF + 📧 Email
      </>
    )}
  </button>


        <button className="bg-zinc-200 px-3 py-1 rounded" onClick={limpiar}>🧹 Nueva Cotización</button>
      </div>

      {/* Estilos de impresión */}
      <style jsx>{`
        :global(html), :global(body), :global(#printArea) { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          body * { visibility: hidden !important; }
          #printArea, #printArea * { visibility: visible !important; }
          #printArea { position: absolute !important; left: 0; top: 0; width: 100% !important; }
          input, select, textarea, button {
            border: none !important; background: transparent !important; box-shadow: none !important;
            padding: 0 !important; margin: 0 !important; width: auto !important; color: #000 !important; font-size: 11px !important; appearance: none !important;
          }
          .overflow-x-auto { overflow: visible !important; }
          table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; }
          th, td { border: 1px solid #e5e5e5 !important; padding: 4px 6px !important; vertical-align: middle !important; font-variant-numeric: tabular-nums !important; }
          thead th { background: #f5f5f5 !important; text-align: center !important; font-weight: 600 !important; }
          tfoot tr td { border-top: 2px solid #2B6CFF !important; font-weight: 700 !important; }
          .print\\:hidden { display: none !important; }
          @page { size: A4; margin: 12mm; }
          header, section, table, h1, h2 { break-inside: avoid; }
        }
      `}</style>
    </>
  );
}
