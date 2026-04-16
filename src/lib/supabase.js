import { createClient } from '@supabase/supabase-js'

// ── Estado interno ────────────────────────────────────────────────
// Un único cliente activo. Se reemplaza en cada login (multi-empresa).
let _client = null

// ── API pública ───────────────────────────────────────────────────

/**
 * Crea (o reemplaza) el cliente Supabase activo.
 * Llamar una vez al inicio del flujo de login con las credenciales
 * de la empresa detectada por dominio de email.
 */
export function initSupabaseClient(url, key) {
  _client = createClient(url, key)
  return _client
}

/** Devuelve el cliente activo (o null si aún no se ha inicializado). */
export function getSupabaseClient() {
  return _client
}

// ── Exportación retrocompatible ───────────────────────────────────
// `supabase` resuelve cada propiedad en el cliente activo al momento
// de la llamada, por lo que cambiar el cliente vía initSupabaseClient()
// es transparente para todo el código existente.

function client() {
  if (!_client) throw new Error(
    'Supabase no inicializado — llama a initSupabaseClient() antes de usar el cliente'
  )
  return _client
}

export const supabase = {
  get from()       { return client().from.bind(client()) },
  get auth()       { return client().auth },
  get channel()    { return client().channel.bind(client()) },
  get rpc()        { return client().rpc.bind(client()) },
  get storage()    { return client().storage },
  get realtime()   { return client().realtime },
  get functions()  { return client().functions },
  removeChannel(ch)   { return client().removeChannel(ch) },
  removeAllChannels() { return client().removeAllChannels() },
  getChannels()       { return client().getChannels() },
}
