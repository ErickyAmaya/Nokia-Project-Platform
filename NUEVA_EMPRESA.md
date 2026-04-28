# Guía: Agregar una Nueva Empresa

Nokia Project Platform soporta múltiples empresas desde un único deploy.
Cada empresa tiene su propio proyecto Supabase (base de datos independiente)
y sus usuarios se identifican por el dominio de su correo electrónico.

---

## Arquitectura

```
Login: admin@nuevaempresa.com
           │
           ▼
   Detecta dominio: nuevaempresa.com
           │
           ▼
   Busca en empresas.js → obtiene URL y KEY de Supabase
           │
           ▼
   Inicia sesión en Supabase de NuevaEmpresa
   (datos completamente separados de otras empresas)
```

---

## Paso 1 — Crear el proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → **New project**
2. Asignar nombre, contraseña de base de datos y región
3. Esperar a que el proyecto termine de inicializarse (~2 min)
4. Anotar las credenciales desde **Settings → API**:
   - **Project URL** → `https://xxxxxxxxxxxx.supabase.co`
   - **anon public key** → `eyJ...`

---

## Paso 2 — Ejecutar el schema

1. En el proyecto Supabase recién creado ir a **SQL Editor → New query**
2. Abrir el archivo `schema.sql` de este repositorio
3. Pegar el contenido completo y hacer clic en **Run**
4. Verificar que se crearon las tablas en **Table Editor**:
   - `user_roles`
   - `config`
   - `sitios`
   - `gastos`
   - `subcontratistas`
   - `catalogo_ti`
   - `catalogo_cw`
   - `liquidaciones_cw`

---

## Paso 3 — Crear usuarios

En el proyecto Supabase → **Authentication → Users → Add user**:

| Campo    | Valor                          |
|----------|-------------------------------|
| Email    | `usuario@nuevaempresa.com`    |
| Password | Contraseña segura             |

Repetir por cada usuario que necesite acceso.

> **Importante:** el dominio del email (`@nuevaempresa.com`) debe coincidir
> exactamente con el que se registre en `empresas.js` en el Paso 5.

---

## Paso 4 — Asignar roles

Después de crear cada usuario, copiar su **UUID** desde la columna `id`
en Authentication → Users y ejecutar en SQL Editor:

```sql
-- Roles disponibles: admin | coordinador | TI | TSS | CW | viewer
INSERT INTO user_roles (user_id, role, nombre) VALUES
  ('uuid-usuario-1', 'admin',       'Nombre Admin'),
  ('uuid-usuario-2', 'coordinador', 'Nombre Coordinador'),
  ('uuid-usuario-3', 'TI',          'Nombre Técnico TI'),
  ('uuid-usuario-4', 'TSS',         'Nombre Técnico TSS'),
  ('uuid-usuario-5', 'CW',          'Nombre Técnico CW'),
  ('uuid-usuario-6', 'viewer',      'Nombre Viewer');
```

### Permisos por rol

| Rol          | Acceso                                                  |
|--------------|---------------------------------------------------------|
| `admin`      | Todo, incluyendo Config y Catálogo                      |
| `coordinador`| Todo excepto Config                                     |
| `TI`         | Dashboard, módulo TI, Liquidador                        |
| `TSS`        | Dashboard, módulo TSS, Liquidador                       |
| `CW`         | Dashboard, módulo CW, Liquidador                        |
| `viewer`     | Lectura de todos los módulos, sin edición               |

---

## Paso 5 — Registrar la empresa en el código

Abrir `src/config/empresas.js` y agregar una nueva entrada:

```js
'nuevaempresa.com': {
  id:           'nuevaempresa',
  nombre:       'NUEVA EMPRESA S.A.',      // nombre completo
  nombre_corto: 'NuevaEmpresa',            // aparece en el header
  supabaseUrl:  import.meta.env.VITE_NUEVAEMPRESA_URL,
  supabaseKey:  import.meta.env.VITE_NUEVAEMPRESA_KEY,
  logoUrl:      null,                      // URL pública del logo o null
  color:        '#1a4f7a',                 // color primario (hex)
  modulo:       'nokia-billing',
},
```

> **Nota sobre el logo:** puede usarse una URL pública directa, por ejemplo
> desde GitHub raw:
> `https://raw.githubusercontent.com/usuario/repo/main/logo.png`

---

## Paso 6 — Agregar las credenciales al hosting

Las credenciales **nunca se suben a Git**. Se configuran directamente en el
panel del hosting. El método varía según la plataforma:

---

### Netlify ⭐ (recomendado — más simple)

1. Ir al proyecto en [app.netlify.com](https://app.netlify.com)
2. **Site settings → Environment variables → Add a variable**
3. Agregar las dos variables:

| Key                       | Value                               |
|---------------------------|-------------------------------------|
| `VITE_NUEVAEMPRESA_URL`   | `https://xxxxxxxxxxxx.supabase.co`  |
| `VITE_NUEVAEMPRESA_KEY`   | `eyJ...`                            |

4. Ir a **Deploys → Trigger deploy → Deploy site**

**No se requiere ningún otro cambio** — Netlify inyecta las variables
automáticamente en cada build.

---

### GitHub Pages (GitHub Actions)

Requiere dos pasos adicionales:

**a) Agregar los secrets en el repositorio:**

Repositorio → **Settings → Secrets and variables → Actions → New secret**:

| Name                      | Value                               |
|---------------------------|-------------------------------------|
| `VITE_NUEVAEMPRESA_URL`   | `https://xxxxxxxxxxxx.supabase.co`  |
| `VITE_NUEVAEMPRESA_KEY`   | `eyJ...`                            |

**b) Exponer los secrets en `.github/workflows/deploy.yml`:**

```yaml
- name: Build
  env:
    VITE_INGETEL_URL: ${{ secrets.VITE_INGETEL_URL }}
    VITE_INGETEL_KEY: ${{ secrets.VITE_INGETEL_KEY }}
    VITE_NUEVAEMPRESA_URL: ${{ secrets.VITE_NUEVAEMPRESA_URL }}
    VITE_NUEVAEMPRESA_KEY: ${{ secrets.VITE_NUEVAEMPRESA_KEY }}
  run: npm run build
```

---

## Paso 7 — Deploy

```bash
git add src/config/empresas.js
git commit -m "Add empresa: NuevaEmpresa"
git push
```

El CI/CD genera el build y publica. A partir de ese momento cualquier
usuario con `@nuevaempresa.com` es dirigido automáticamente a su Supabase.

---

## Paso 8 — Configuración inicial desde la app (opcional)

1. Ingresar con el usuario `admin@nuevaempresa.com`
2. Ir a **Config**
3. Completar nombre, nombre corto, URL del logo y color primario
4. Hacer clic en **Guardar**

Estos valores se guardan en la tabla `config` del Supabase de la empresa
y tienen prioridad sobre los valores estáticos de `empresas.js`.

---

## Paso 9 — Cargar catálogo (opcional)

Si la nueva empresa usa el mismo catálogo de precios TI/CW que Ingetel:

1. Ir a **Catálogo → TI** o **CW**
2. Importar los ítems manualmente, o
3. Ejecutar un script SQL de seed en el SQL Editor del nuevo proyecto Supabase

> Para generar el script de seed con los datos actuales de Ingetel,
> exportar desde Supabase Dashboard → Table Editor → `catalogo_ti` → Export CSV,
> o solicitar el script al equipo de desarrollo.

---

## Resumen rápido

```
1. Crear proyecto Supabase
2. Ejecutar schema.sql
3. Crear usuarios en Authentication
4. Asignar roles en user_roles
5. Agregar entrada en src/config/empresas.js
6. Agregar variables en Netlify (o secrets en GitHub Actions)
7. git push → deploy automático
8. Entrar a Config y personalizar branding
9. Cargar catálogo si aplica
```

---

*Nokia Project Platform — desarrollado por SCYTEL*
