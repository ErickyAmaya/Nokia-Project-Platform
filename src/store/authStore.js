import { create } from 'zustand'
import { initSupabaseClient, getSupabaseClient } from '../lib/supabase'
import { getEmpresaByDomain, getDomainFromEmail } from '../config/empresas'

const LS_DOMAIN_KEY = 'npp_empresa_domain'

// ── Normalización de roles ────────────────────────────────────────
// Mapea valores legacy de la DB al conjunto canónico de roles.
// Roles canónicos: admin | coordinador | TI | TSS | CW | viewer
const ROLE_ALIASES = {
  coord:    'coordinador',
  operador: 'coordinador', // operador legacy → coordinador
}

function normalizeRole(raw) {
  if (!raw) return 'viewer'
  return ROLE_ALIASES[raw] ?? raw
}

// ── Roles que pueden eliminar sitios ─────────────────────────────
export const DELETE_ROLES = new Set(['admin', 'coordinador', 'TI', 'TSS', 'CW'])

// ── Visibilidad de rutas por rol ──────────────────────────────────
export const ROUTE_ROLES = {
  '/ti':             ['admin', 'coordinador', 'TI',  'viewer'],
  '/tss':            ['admin', 'coordinador', 'TSS', 'viewer'],
  '/cw':             ['admin', 'coordinador', 'CW',  'viewer'],
  '/cw-consolidado': ['admin', 'coordinador', 'CW',  'viewer'],
  '/catalogo':       ['admin', 'coordinador'],
  '/config':         ['admin'],
  // null = cualquier usuario autenticado
}

// ── Store de autenticación ────────────────────────────────────────
export const useAuthStore = create((set, get) => ({

  // ── Estado ─────────────────────────────────────────────────────
  user:    null,   // { id, email, nombre, role }
  empresa: null,   // objeto empresa desde empresas.js
  session: null,
  loading: true,

  // ── Helpers de rol ──────────────────────────────────────────────
  isAdmin:    () => get().user?.role === 'admin',
  isCoord:    () => get().user?.role === 'coordinador',
  isViewer:   () => get().user?.role === 'viewer',
  isTI:       () => get().user?.role === 'TI',
  isTSS:      () => get().user?.role === 'TSS',
  isCW:       () => get().user?.role === 'CW',
  canDelete:  () => DELETE_ROLES.has(get().user?.role ?? ''),
  canRoute:   (path) => {
    const user = get().user
    if (!user) return false
    const allowed = ROUTE_ROLES[path]
    if (!allowed) return true   // ruta sin restricción
    return allowed.includes(user.role)
  },

  // ── Login (detección de empresa + auth Supabase) ────────────────
  login: async (email, password) => {
    const domain  = getDomainFromEmail(email)
    const empresa = getEmpresaByDomain(domain)

    if (!empresa) {
      throw Object.assign(
        new Error(`El dominio @${domain} no está registrado en la plataforma`),
        { code: 'EMPRESA_NOT_FOUND' }
      )
    }

    // Inicializar/cambiar cliente Supabase al de esta empresa
    const client = initSupabaseClient(empresa.supabaseUrl, empresa.supabaseKey)

    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: roleData } = await client
      .from('user_roles')
      .select('role, nombre, modulo')
      .eq('user_id', data.user.id)
      .single()

    const role   = normalizeRole(roleData?.role)
    const nombre = roleData?.nombre || email
    const modulo = roleData?.modulo || 'billing'

    // Persistir dominio para restaurar sesión al recargar
    localStorage.setItem(LS_DOMAIN_KEY, domain)

    const user = { id: data.user.id, email, nombre, role, modulo }
    set({ session: data.session, user, empresa })
    return nombre
  },

  // ── Logout ──────────────────────────────────────────────────────
  logout: async () => {
    try {
      const client = getSupabaseClient()
      if (client) await client.auth.signOut()
    } catch { /* ignore network errors on logout */ }
    localStorage.removeItem(LS_DOMAIN_KEY)
    set({ session: null, user: null, empresa: null })
  },

  // ── Restaurar sesión al montar la app ───────────────────────────
  initSession: async () => {
    set({ loading: true })
    try {
      const domain = localStorage.getItem(LS_DOMAIN_KEY)
      if (!domain) return

      const empresa = getEmpresaByDomain(domain)
      if (!empresa) { localStorage.removeItem(LS_DOMAIN_KEY); return }

      const client = initSupabaseClient(empresa.supabaseUrl, empresa.supabaseKey)
      const { data: { session } } = await client.auth.getSession()
      if (!session) return

      const { data: roleData } = await client
        .from('user_roles')
        .select('role, nombre, modulo')
        .eq('user_id', session.user.id)
        .single()

      const role   = normalizeRole(roleData?.role)
      const nombre = roleData?.nombre || session.user.email
      const modulo = roleData?.modulo || 'billing'

      set({
        session,
        empresa,
        user: { id: session.user.id, email: session.user.email, nombre, role, modulo },
      })
    } catch (e) {
      console.warn('[authStore] initSession error:', e)
    } finally {
      set({ loading: false })
    }
  },
}))
