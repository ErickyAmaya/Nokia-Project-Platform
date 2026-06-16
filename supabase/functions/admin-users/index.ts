import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    // Admin client (service role — bypasses RLS)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify caller identity via their JWT
    const caller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    // Verify caller is admin
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleRow?.role !== 'admin') return json({ error: 'Forbidden' }, 403)

    const body = await req.json()
    const { action } = body

    // ── LIST ─────────────────────────────────────────────────────────
    if (action === 'list') {
      const [{ data: roles }, { data: { users: authUsers } }] = await Promise.all([
        admin.from('user_roles').select('user_id, role, nombre, modulo, email').order('nombre'),
        admin.auth.admin.listUsers({ perPage: 1000 }),
      ])

      const enriched = (roles ?? []).map(r => {
        const au = authUsers?.find(u => u.id === r.user_id)
        return {
          ...r,
          email:        r.email || au?.email || '',
          last_sign_in: au?.last_sign_in_at ?? null,
          confirmed:    !!(au?.email_confirmed_at),
        }
      })

      return json({ users: enriched })
    }

    // ── INVITE ───────────────────────────────────────────────────────
    if (action === 'invite') {
      const { email, nombre, role, modulo, redirectTo } = body
      if (!email || !role) return json({ error: 'Faltan campos requeridos' }, 400)

      let userId: string | null = null

      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectTo || undefined,
      })

      if (error) {
        // Si el usuario ya existe, buscarlo por email para obtener su ID
        const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
        const existing = users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
        if (!existing) return json({ error: error.message }, 400)
        userId = existing.id
      } else {
        userId = data.user.id
      }

      await admin.from('user_roles').upsert({
        user_id: userId,
        email:   email.toLowerCase().trim(),
        role,
        nombre:  nombre || email.split('@')[0],
        modulo:  modulo || 'billing',
      }, { onConflict: 'user_id' })

      return json({ ok: true })
    }

    // ── UPDATE ROLE / MODULO / NOMBRE ─────────────────────────────────
    if (action === 'update-role') {
      const { userId, role, modulo, nombre } = body
      if (!userId) return json({ error: 'Falta userId' }, 400)

      const updates: Record<string, string> = {}
      if (role)   updates.role   = role
      if (modulo) updates.modulo = modulo
      if (nombre) updates.nombre = nombre

      await admin.from('user_roles').update(updates).eq('user_id', userId)
      return json({ ok: true })
    }

    // ── DELETE ───────────────────────────────────────────────────────
    if (action === 'delete') {
      const { userId } = body
      if (!userId) return json({ error: 'Falta userId' }, 400)
      if (userId === user.id) return json({ error: 'No puedes eliminarte a ti mismo' }, 400)

      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) return json({ error: error.message }, 400)

      await admin.from('user_roles').delete().eq('user_id', userId)
      return json({ ok: true })
    }

    return json({ error: 'Acción desconocida' }, 400)

  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
