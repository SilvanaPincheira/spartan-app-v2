import type { NextApiRequest, NextApiResponse } from 'next'

const CRM_APPS_SCRIPT_URL = process.env.CRM_HISTORIAL_APPS_SCRIPT_URL as string

type Rol = 'ejecutivo' | 'jefatura' | 'sistema'
type Accion =
  | 'CAMBIO_ESTADO'
  | 'CAMBIO_ETAPA'
  | 'UPDATE_DATOS'
  | 'OBSERVACION'
  | 'MENSAJE_JEFATURA'
  | 'AUTO_ESTADO'
  | 'AUTO_ETAPA'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' })
  }

  try {
    const {
      folio,
      accion,
      campo = '',
      valor_anterior = '',
      valor_nuevo = '',
      mensaje = '',
      usuario_email,
      rol,
      visible_ejecutivo = true,
    } = req.body as {
      folio: string
      accion: Accion
      campo?: string
      valor_anterior?: string
      valor_nuevo?: string
      mensaje?: string
      usuario_email: string
      rol: Rol
      visible_ejecutivo?: boolean
    }

    // -------------------------
    // Validaciones base
    // -------------------------
    if (!folio || !accion || !usuario_email || !rol) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan campos obligatorios',
      })
    }

    // -------------------------
    // Validación por rol
    // -------------------------
    if (rol === 'jefatura' && accion !== 'MENSAJE_JEFATURA') {
      return res.status(403).json({
        ok: false,
        error: 'La jefatura solo puede dejar mensajes',
      })
    }

    if (rol === 'ejecutivo' && accion === 'MENSAJE_JEFATURA') {
      return res.status(403).json({
        ok: false,
        error: 'El ejecutivo no puede dejar mensajes de jefatura',
      })
    }

    // -------------------------
    // Validación por acción
    // -------------------------
    if (
      ['MENSAJE_JEFATURA', 'OBSERVACION'].includes(accion) &&
      !mensaje
    ) {
      return res.status(400).json({
        ok: false,
        error: 'El mensaje es obligatorio para esta acción',
      })
    }

    if (
      ['CAMBIO_ESTADO', 'CAMBIO_ETAPA'].includes(accion) &&
      (!valor_anterior || !valor_nuevo)
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Debe indicar valor anterior y nuevo',
      })
    }

    // -------------------------
    // Construcción del registro
    // -------------------------
    const id = `HIST-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const fecha = new Date().toISOString()

    const payload = {
      action: 'ADD_HISTORIAL',
      data: {
        id,
        folio,
        fecha,
        usuario_email,
        rol,
        accion,
        campo,
        valor_anterior,
        valor_nuevo,
        mensaje,
        visible_ejecutivo,
      },
    }

    // -------------------------
    // Envío a Apps Script
    // -------------------------
    const response = await fetch(CRM_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text)
    }

    return res.status(200).json({
      ok: true,
      id,
    })
  } catch (error: any) {
    console.error('[CRM_HISTORIAL_ADD]', error)
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error interno',
    })
  }
}
