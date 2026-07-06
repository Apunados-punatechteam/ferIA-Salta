# Separar el login a su propia URL

## Contexto

Hoy `App.tsx` renderiza `LoginScreen`, que a su vez embebe
`<PublicLandingPage />` seguida del formulario de login en la misma
página (sección `#login-card`). Los botones "Ingresar" de
`PublicLandingPage` solo hacen scroll a esa sección — no hay
navegación real ni URL propia para el login. El proyecto no usa
ninguna librería de ruteo (no hay `react-router-dom` en
`package.json`).

## Objetivo

El botón "Ingresar" debe llevar a una URL separada (`/login`) con el
formulario de login, sacando el login de la página principal (`/`).

## Diseño

### Ruteo

Se agrega `react-router-dom` como dependencia. `main.tsx` envuelve
`<App />` con `<BrowserRouter>`.

Dentro de `App.tsx`, dos rutas:

- **`/`** — si hay sesión activa (`authUsuario` no nulo), renderiza el
  dashboard actual (header, stats, paneles por rol) exactamente como
  hoy. Si no hay sesión, renderiza únicamente `PublicLandingPage`
  (sin formulario de login embebido).
- **`/login`** — renderiza `LoginScreen` (el formulario + grilla de
  usuarios demo), sin `<PublicLandingPage />` adentro. Si ya hay
  sesión activa al entrar a esta ruta, redirige a `/` con
  `<Navigate to="/" replace />`.

### Componentes afectados

- **`PublicLandingPage.tsx`**: `LandingNav`'s `onLoginClick` y el
  botón del hero "Ingresar al sistema →" dejan de llamar a
  `scrollToLogin()` y en su lugar navegan a `/login` vía
  `useNavigate()`. Se elimina la función `scrollToLogin` y el id
  `login-card` (ya no existe en esta página).
- **`App.tsx`**: `LoginScreen` deja de renderizar
  `<PublicLandingPage />` internamente — solo queda el card de login.
  Al loguearse con éxito (`handleLogin`), se navega a `/` para llegar
  al dashboard. Al cerrar sesión (`handleLogout`), se navega a `/`
  (que mostrará la landing pública de nuevo, dado que `authUsuario`
  queda en `null`).

### Data flow

Sin cambios en autenticación: `backendLogin`, `storeAuthToken`,
`saveAuthUser`/`readAuthUser` y el JWT decodificado siguen igual.
Únicamente cambia dónde se montan los componentes según la ruta.

### Infraestructura

No requiere cambios. Nginx (`nginx.conf`) ya tiene
`try_files $uri $uri/ /index.html`, y el backend (`server.ts`) ya
tiene `setNotFoundHandler` sirviendo `index.html`. Entrar directo a
`/login` por URL funciona en dev (Vite) y en producción sin tocar
nada de eso.

## Fuera de alcance

- No se agregan más rutas ni un layout de rutas anidadas — solo `/` y
  `/login`.
- No se cambia el contenido visual del formulario de login ni de la
  landing, solo dónde viven.
- No se agrega protección de rutas por rol vía router (eso ya lo
  maneja `canAccessSectionByRole` dentro del dashboard, sin cambios).

## Plan de verificación

- `npm install react-router-dom`.
- Levantar frontend + backend, y en el navegador:
  - Visitar `/` sin sesión → se ve la landing pública, sin formulario
    de login visible.
  - Click en "Ingresar" (nav y hero) → navega a `/login` y se ve el
    formulario.
  - Login exitoso con un usuario demo → redirige a `/` y se ve el
    dashboard correspondiente al rol.
  - Visitar `/login` estando ya logueado → redirige automáticamente a
    `/`.
  - Cerrar sesión → vuelve a `/` y se ve la landing pública.
