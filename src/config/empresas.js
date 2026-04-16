// ── Registro de empresas ──────────────────────────────────────────
// Mapa: dominio de email → credenciales Supabase + branding.
// Agregar una entrada por empresa. Dominio siempre en minúsculas.
//
// Para nueva empresa:
//   1. Crear proyecto Supabase
//   2. Agregar VITE_<ID>_URL y VITE_<ID>_KEY al .env
//   3. Copiar la plantilla comentada al final de este objeto

export const EMPRESAS = {
  'ingetel.com': {
    id:           'ingetel',
    nombre:       'INGETEL',
    nombre_corto: 'Ingetel',
    supabaseUrl:  import.meta.env.VITE_INGETEL_URL,
    supabaseKey:  import.meta.env.VITE_INGETEL_KEY,
    logoUrl:      null,       // ruta/import del logo, o null para mostrar nombre
    color:        '#144E4A',  // color primario (barra de navegación, botones)
    modulo:       'nokia-billing',
  },

  // scytel.com apunta al mismo Supabase dev para pruebas
  'scytel.com': {
    id:           'scytel',
    nombre:       'SCYTEL',
    nombre_corto: 'Scytel',
    supabaseUrl:  import.meta.env.VITE_INGETEL_URL,
    supabaseKey:  import.meta.env.VITE_INGETEL_KEY,
    logoUrl:      null,
    color:        '#1a4f7a',
    modulo:       'nokia-billing',
  },

  // ── Plantilla para nuevas empresas ──────────────────────────────
  // 'nueva-empresa.com': {
  //   id:           'nueva',
  //   nombre:       'NUEVA EMPRESA',
  //   nombre_corto: 'Nueva',
  //   supabaseUrl:  import.meta.env.VITE_NUEVA_URL,
  //   supabaseKey:  import.meta.env.VITE_NUEVA_KEY,
  //   logoUrl:      null,
  //   color:        '#144E4A',
  //   modulo:       'nokia-billing',
  // },
}

/** Devuelve la empresa para el dominio dado, o null si no está registrada. */
export function getEmpresaByDomain(domain) {
  if (!domain) return null
  return EMPRESAS[domain.toLowerCase()] ?? null
}

/** Extrae el dominio del email (parte después del @), en minúsculas. */
export function getDomainFromEmail(email) {
  return email?.split('@')[1]?.toLowerCase().trim() ?? ''
}
