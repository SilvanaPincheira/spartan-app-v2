import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()

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
    } = body

    // Validaciones base
    if (!folio || !accion || !usuario_email || !rol) {
      return NextResponse.json(
        { ok: false, error: 'Faltan campos obligatorios' },
        { status: 400 }
      )
    }

    // Validación por rol
    if (rol === 'jefatura' && accion !== 'MENSAJE_JEFATURA') {
      return NextResponse.json(
        { ok: false, error: 'La jefatura solo puede dejar mensajes' },
        { status: 403 }
      )
    }

    if (rol === 'ejecutivo' && accion === 'MENSAJE_JEFATURA') {
      return NextResponse.json(
        { ok: false, error: 'El ejecutivo no puede dejar mensajes de jefatura' },
        { status: 403 }
      )
    }

    // Validación por acción
    if (
      (accion === 'MENSAJE_JEFATURA' || accion === 'OBSERVACION') &&
      !mensaje
    ) {
      return NextResponse.json(
        { ok: false, error: 'El mensaje es obligatorio' },
        { status: 400 }
      )
    }

    if (
      (accion === 'CAMBIO_ESTADO' || accion === 'CAMBIO_ETAPA') &&
      (!valor_anterior || !valor_nuevo)
    ) {
      return NextResponse.json(
        { ok: false, error: 'Debe indicar valor anterior y nuevo' },
        { status: 400 }
      )
    }

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

    const response = await fetch(
      process.env.CRM_HISTORIAL_APPS_SCRIPT_URL as string,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text)
    }

    return NextResponse.json({ ok: true, id })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}
