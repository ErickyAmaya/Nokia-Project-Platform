import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GITHUB_OWNER    = 'ErickyAmaya'
const GITHUB_REPO     = 'Nokia-Project-Platform'
const GITHUB_WORKFLOW = 'backup.yml'
const GITHUB_BRANCH   = 'main'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const caller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await caller.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401, headers: CORS })

    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleRow?.role !== 'admin') return new Response('Forbidden', { status: 403, headers: CORS })

    const githubPat = Deno.env.get('GITHUB_PAT')
    if (!githubPat) return new Response(
      JSON.stringify({ error: 'GITHUB_PAT no configurado en Supabase secrets' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

    const body = await req.json().catch(() => ({}))
    const reason = body.reason || 'Backup manual desde la app'

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization':        `Bearer ${githubPat}`,
          'Accept':               'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type':         'application/json',
        },
        body: JSON.stringify({ ref: GITHUB_BRANCH, inputs: { reason } }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      return new Response(
        JSON.stringify({ error: `GitHub API error ${res.status}: ${errText}` }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
