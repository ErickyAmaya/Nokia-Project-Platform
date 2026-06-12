// ─────────────────────────────────────────────────────────────────────────────
// permissions.js — única fuente de verdad para roles y permisos
//
// Para agregar un rol nuevo:
//   1. Agregar a ROLES
//   2. Agregar a ROLE_BADGE
//   3. Agregar a ROLE_HOME (si aplica)
//   4. Agregar a los grupos ACCESS que correspondan
//   5. Agregar a MODULE_ACCESS si debe ver tarjetas de módulo
//   6. Agregar sus capacidades en CAPS_MAP
//   → 0 archivos de página o rutas requieren modificación
// ─────────────────────────────────────────────────────────────────────────────

// ── Registro canónico de roles ────────────────────────────────────────────────
export const ROLES = [
  'admin', 'coordinador', 'TI', 'TSS', 'CW',
  'logistica', 'facturacion', 'rollout', 'viewer',
]

// Aliases legacy de la DB → rol canónico
export const ROLE_ALIASES = {
  coord:    'coordinador',
  operador: 'coordinador',
  almacen:  'logistica',
}

export function normalizeRole(raw) {
  if (!raw) return 'viewer'
  return ROLE_ALIASES[raw] ?? raw
}

// ── Roles de campo (confinados al mapa) ───────────────────────────────────────
export const LC_ROLES = ['TI', 'TSS']

// ── Badge de rol (header + panel admin) ──────────────────────────────────────
export const ROLE_BADGE = {
  admin:       { label: '⚙ Admin',      cls: 'ub-admin'  },
  coordinador: { label: '🏢 Coord',     cls: 'ub-coord'  },
  TI:          { label: '📡 TI',        cls: 'ub-op'     },
  TSS:         { label: '📡 TSS',       cls: 'ub-op'     },
  CW:          { label: '🔧 CW',        cls: 'ub-op'     },
  viewer:      { label: '👁 Viewer',    cls: 'ub-viewer' },
  logistica:   { label: '📦 Logística', cls: 'ub-op'     },
  facturacion: { label: '🧾 Fact.',    cls: 'ub-op'     },
  rollout:     { label: '📡 Rollout',  cls: 'ub-op'     },
}

// ── Landing al denegar acceso (ProtectedRoute) ───────────────────────────────
export const ROLE_HOME = {
  TI:         '/rollout/mapa',
  TSS:        '/rollout/mapa',
  CW:         '/cw-consolidado',
  logistica:  '/materiales',
  facturacion:'/facturacion',
  rollout:    '/rollout',
}

export function getRoleHome(role) {
  return ROLE_HOME[role] || '/dashboard'
}

// ── Helpers de identidad ──────────────────────────────────────────────────────
export function isFieldRole(role) {
  return LC_ROLES.includes(role)
}

// ── Grupos de acceso a rutas (reemplazan R_* en App.jsx y roles: en Layout) ──
// Cada grupo es el allowedRoles que se pasa a <ProtectedRoute> o canSee() en nav.
export const ACCESS = {
  ADMIN:       ['admin'],
  CATALOG:     ['admin', 'coordinador'],
  MGMT:        ['admin', 'coordinador', 'viewer'],
  TI:          ['admin', 'coordinador', 'viewer'],
  TSS:         ['admin', 'coordinador', 'viewer'],
  CW:          ['admin', 'coordinador', 'CW', 'viewer'],
  MAT:         ['admin', 'coordinador', 'logistica', 'viewer'],
  MAT_ED:      ['admin', 'coordinador', 'logistica'],
  MAT_RO:      ['admin', 'coordinador', 'logistica', 'viewer', 'rollout'],
  MAT_SITIOS:  ['admin', 'coordinador', 'logistica', 'rollout'],   // nav SITIOS
  FACTURACION: ['admin', 'coordinador', 'facturacion', 'viewer'],
  ROLLOUT:     ['admin', 'coordinador', 'viewer', 'rollout'],
  ANALITICA:   ['admin', 'coordinador', 'viewer', 'CW', 'rollout'],
  MAPA:        ['admin', 'coordinador', 'viewer', 'TI', 'TSS', 'rollout'],
  MODULOS:     ['admin', 'coordinador', 'logistica', 'facturacion', 'viewer', 'CW', 'rollout'],
}

// ── Acceso a tarjetas de módulo (ModuloHomePage) ─────────────────────────────
export const MODULE_ACCESS = {
  billing:     ['admin', 'coordinador', 'viewer', 'CW'],
  materiales:  ['admin', 'coordinador', 'logistica', 'viewer', 'rollout'],
  rollout:     ['admin', 'coordinador', 'viewer', 'rollout'],
  facturacion: ['admin', 'coordinador', 'facturacion', 'viewer'],
}

export function canAccessModule(role, moduleId) {
  return MODULE_ACCESS[moduleId]?.includes(role) ?? false
}

// ── Capacidades (what you can DO on a page) ───────────────────────────────────
// admin siempre puede todo (can() retorna true para admin sin verificar la tabla).
// El resto de roles hereda solo lo que está listado aquí.
//
// NOTA: viewer y rollout son read-only globales → no tienen entradas.
const CAPS_MAP = {
  // Liquidador / Billing
  'liq.edit':              ['coordinador', 'CW'],
  'liq.finalize':          ['coordinador'],
  // Dashboard
  'liq.dashboard.edit':    ['coordinador'],
  // Consolidados
  'consolidado.edit':      ['coordinador', 'CW'],
  // Gastos
  'gastos.edit':           ['coordinador'],
  // Catálogo global
  'catalogo.edit':         ['coordinador'],
  // CW
  'cw.write':              ['coordinador', 'CW'],
  'cw.unlock':             ['coordinador'],
  // Materiales — movimientos
  'mat.movimientos.edit':  ['coordinador', 'logistica'],
  'mat.movimientos.admin': ['coordinador'],
  'mat.movimientos.delete':['coordinador'],
  // Materiales — configuración
  'mat.config.edit':       ['coordinador', 'logistica'],
  // Materiales — catálogo
  'mat.catalogo.edit':     ['coordinador'],
  // Materiales — inventario (logistica only; coordinador no tiene acceso de edición aquí)
  'mat.inventario.edit':   ['logistica'],
  // Materiales — sitios
  'mat.sitios.edit':       ['coordinador', 'logistica'],
  // Materiales — despachos
  'mat.despachos.edit':    ['coordinador', 'logistica'],
  'mat.despachos.delete':  ['coordinador'],
  // Hardware
  'hw.inventario.edit':    ['coordinador', 'logistica'],
  // hw.movimientos: logistica only (coordinador no tiene edición de movimientos HW)
  'hw.movimientos.edit':   ['logistica'],
  'hw.loginversa.edit':    ['coordinador', 'logistica'],
  'hw.loginversa.undo':    ['coordinador', 'logistica'],
  'hw.despachos.edit':     ['coordinador', 'logistica'],
  // ACK / Rollout
  'ack.forecast.edit':     ['coordinador'],
  'ack.upload':            ['coordinador'],
  // Facturación
  'fact.edit':             ['coordinador', 'facturacion'],
  'fact.upload.rollout':   ['coordinador', 'facturacion'],
  // Sitios (delete global)
  'sitio.delete':          ['coordinador', 'CW'],
  // Alertas
  'alerts.see':            ['coordinador', 'logistica', 'CW', 'facturacion'],
}

/**
 * Verifica si un rol tiene una capacidad concreta.
 * @param {string} role  - Rol del usuario (ya normalizado)
 * @param {string} cap   - Capability key (ej. 'mat.movimientos.edit')
 * @returns {boolean}
 */
export function can(role, cap) {
  if (!role) return false
  if (role === 'admin') return true
  return CAPS_MAP[cap]?.includes(role) ?? false
}
