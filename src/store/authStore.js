import { create } from 'zustand'
import { initSupabaseClient, getSupabaseClient } from '../lib/supabase'
import { getEmpresaByDomain, getDomainFromEmail } from '../config/empresas'
import { normalizeRole, can, ACCESS } from '../config/permissions'
import { TABLES } from '../lib/tables'

const LS_DOMAIN_KEY = 'npp_empresa_domain'

// ── Store de autenticación ────────────────────────────────────────
export const useAuthStore = create((set, get) => ({

  // ── Estado ─────────────────────────────────────────────────────
  user:    null,   // { id, email, nombre, role }
  empresa: null,   // objeto empresa desde empresas.js
  session: null,
  loading: true,

  // ── Helpers de rol ──────────────────────────────────────────────
  isAdmin:   () => get().user?.role === 'admin',
  isCoord:   () => get().user?.role === 'coordinador',
  isViewer:  () => get().user?.role === 'viewer',
  isTI:      () => get().user?.role === 'TI',
  isTSS:     () => get().user?.role === 'TSS',
  isCW:      () => get().user?.role === 'CW',
  canDelete: () => can(get().user?.role ?? '', 'sitio.delete'),
  canRoute:  (path) => {
    const user = get().user
    if (!user) return false
    const routeMap = {
      '/ti':             ACCESS.TI,
      '/tss':            ACCESS.TSS,
      '/cw':             ACCESS.CW,
      '/cw-consolidado': ACCESS.CW,
      '/catalogo':       ACCESS.CATALOG,
      '/config':         ACCESS.ADMIN,
    }
    const allowed = routeMap[path]
    if (!allowed) return true
    return allowed.includes(user.role)
  },

  // ── Login (detección de empresa + auth Supabase) ────────────────
  login: async (email, password) => {
    const domain  = getDomainFromEmail(email)
    const empresa = getEmpresaByDomain(domain) ?? getEmpresaByDomain('ingetel.com')

    // Inicializar/cambiar cliente Supabase al de esta empresa
    const client = initSupabaseClient(empresa.supabaseUrl, empresa.supabaseKey)

    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: roleData } = await client
      .from(TABLES.USER_ROLES)
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
        .from(TABLES.USER_ROLES)
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
