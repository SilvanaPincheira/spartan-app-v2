"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* =========================
   CONFIG ACCESO
   ========================= */
const USUARIOS_CLASIFICACION = new Set(
  [
    "patricia.acuna@spartan.cl",
    "silvana.pincheira@spartan.cl",
  ].map((x) => x.trim().toLowerCase())
);

const DIVISIONES = ["FB", "IN", "HC", "IND", "BSC"];

/* =========================
   UI helpers
   ========================= */
const BRAND_BLUE = "#2563eb";

function cardStyle() {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "white",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    padding: 16,
  } as const;
}

function inputStyle() {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    outline: "none",
  } as const;
}

function btnStyle(primary?: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: primary ? "1px solid #1e40af" : "1px solid #e5e7eb",
    background: primary ? BRAND_BLUE : "white",
    color: primary ? "white" : "#111827",
    fontWeight: 900,
    cursor: "pointer",
  } as const;
}

/* =========================
   PAGE
   ========================= */
export default function ClasificacionProspectosPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState("");

  /* =========================
     FORM STATE
     ========================= */
  const [razonSocial, setRazonSocial] = useState("");
  const [rut, setRut] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mail, setMail] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [industria, setIndustria] = useState("");
  const [division, setDivision] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  /* =========================
     AUTH
     ========================= */
  useEffect(() => {
    (async () => {
      try {
        setLoadingAuth(true);
        const { data } = await supabase.auth.getUser();
        setEmail(data.user?.email?.toLowerCase() || "");
      } finally {
        setLoadingAuth(false);
      }
    })();
  }, [supabase]);

  const permitido = USUARIOS_CLASIFICACION.has(email);

  /* =========================
     SUBMIT (solo mock por ahora)
     ========================= */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    setErrMsg(null);

    if (!razonSocial || !telefono || !division || !mensaje) {
      setErrMsg("Completa los campos obligatorios.");
      return;
    }

    try {
      setSaving(true);

      // 👉 acá luego conectamos a la API BD_WEB
      const payload = {
        Razon_Social: razonSocial,
        contacto,
        Mail: mail,
        Teléfono: telefono,
        Industria: industria,
        Mensaje: mensaje,
        Fecha_Contacto: new Date().toISOString(),
        division,
        Gestion: "ASIGNADO_DIVISION",
        Etapa: "PENDIENTE_ASIGNACION",
        Monto: 0,
        RUT: rut,
        CIUDAD: ciudad,
        creado_por: email,
      };

      console.log("Payload BD_WEB:", payload);

      // simulación OK
      setOkMsg("Prospecto registrado y asignado a división.");
      setRazonSocial("");
      setRut("");
      setContacto("");
      setTelefono("");
      setMail("");
      setCiudad("");
      setIndustria("");
      setDivision("");
      setMensaje("");
    } catch (e: any) {
      setErrMsg("Error al guardar el prospecto.");
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     RENDER
     ========================= */
  if (loadingAuth) {
    return <div style={{ padding: 16 }}>Cargando usuario…</div>;
  }

  if (!permitido) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontWeight: 900, color: BRAND_BLUE }}>
          Clasificación de Prospectos
        </h2>
        <div style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>
          No tienes permisos para este módulo.
        </div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>
          Usuario: <b>{email || "—"}</b>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 900 }}>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: BRAND_BLUE }}>
        Clasificación de Prospectos
      </h2>
      <p style={{ marginTop: 6, color: "#374151" }}>
        Registro de llamados telefónicos y clasificación por división.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 14, ...cardStyle() }}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <input
            style={inputStyle()}
            placeholder="Razón Social *"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
          />

          <input
            style={inputStyle()}
            placeholder="RUT"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
          />

          <input
            style={inputStyle()}
            placeholder="Contacto"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
          />

          <input
            style={inputStyle()}
            placeholder="Teléfono *"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />

          <input
            style={inputStyle()}
            placeholder="Mail"
            value={mail}
            onChange={(e) => setMail(e.target.value)}
          />

          <input
            style={inputStyle()}
            placeholder="Ciudad"
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
          />

          <input
            style={inputStyle()}
            placeholder="Industria"
            value={industria}
            onChange={(e) => setIndustria(e.target.value)}
          />

          <select
            style={inputStyle()}
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            <option value="">División *</option>
            {DIVISIONES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <textarea
          style={{ ...inputStyle(), marginTop: 12, minHeight: 120 }}
          placeholder="Mensaje del cliente (qué solicita, contexto, necesidad) *"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
        />

        {errMsg && (
          <div style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>
            {errMsg}
          </div>
        )}

        {okMsg && (
          <div style={{ marginTop: 10, color: "#166534", fontWeight: 900 }}>
            {okMsg}
          </div>
        )}

        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <button type="submit" disabled={saving} style={btnStyle(true)}>
            {saving ? "Guardando…" : "Registrar Prospecto"}
          </button>
        </div>
      </form>
    </div>
  );
}
