# Separar el login a su propia URL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover el formulario de login de la landing page (`/`) a su propia ruta (`/login`), navegable con URL real en vez de scroll.

**Architecture:** Se agrega `react-router-dom` y se envuelve `<App />` con `<BrowserRouter>` en `main.tsx`. `App.tsx` pasa a renderizar dos `<Route>`: `/` (landing pública si no hay sesión, dashboard si la hay) y `/login` (formulario de login, con redirect a `/` si ya hay sesión). Los botones "Ingresar" de `PublicLandingPage` navegan a `/login` con `useNavigate` en vez de hacer scroll.

**Tech Stack:** React 19, TypeScript, Vite, react-router-dom (nueva dependencia).

## Global Constraints

- Rutas exactas: `/` y `/login` únicamente — no se agregan más rutas ni layouts anidados (ver spec, sección "Fuera de alcance").
- No se cambia el contenido visual del formulario de login ni de la landing — solo dónde se montan (spec, sección "Fuera de alcance").
- No se agrega protección de rutas por rol vía router — `canAccessSectionByRole` sigue manejando eso dentro del dashboard, sin cambios (spec, sección "Fuera de alcance").
- El proyecto no tiene test runner configurado (no hay script `test` en `package.json`). La validación de cada tarea es `npm run build` (typecheck vía `tsc -b` + `vite build`) y verificación manual en navegador — no se introduce un framework de testing nuevo (YAGNI, fuera del alcance del spec).
- No tocar `nginx.conf` ni `backend/src/server.ts` — ya tienen fallback SPA (`try_files ... /index.html` y `setNotFoundHandler`), confirmado en el spec.

---

## File Structure

- **Modify `package.json`** (raíz) — nueva dependencia `react-router-dom` (vía `npm install`, no edición manual).
- **Modify `src/main.tsx`** — envolver `<App />` con `<BrowserRouter>`.
- **Modify `src/App.tsx`** — importar primitivas de router; `LoginScreen` deja de embeber `<PublicLandingPage />`; `handleLogin` navega a `/` tras loguearse; el render final de `App()` pasa de un `if/return` a `<Routes>` con dos `<Route>`.
- **Modify `src/components/PublicLandingPage.tsx`** — los dos botones "Ingresar" navegan a `/login` en vez de hacer scroll; se elimina `scrollToLogin`.

---

### Task 1: Agregar react-router-dom y envolver la app en BrowserRouter

**Files:**
- Modify: `package.json` (vía `npm install`)
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `<BrowserRouter>` envolviendo `<App />`, disponible para que `App.tsx` (Task 3) y `PublicLandingPage.tsx` (Task 2) usen `useNavigate`/`Routes`/`Route`/`Navigate` de `react-router-dom`.

- [ ] **Step 1: Instalar react-router-dom**

Run: `cd /home/seba/Escritorio/hackathon/ferIA-Salta && npm install react-router-dom`

Expected: el comando termina sin error y `package.json` queda con `"react-router-dom"` en `dependencies`.

- [ ] **Step 2: Verificar que se agregó correctamente**

Run: `grep '"react-router-dom"' package.json`

Expected: una línea con `"react-router-dom": "^..."`.

- [ ] **Step 3: Editar `src/main.tsx` para envolver `<App />` con `<BrowserRouter>`**

Reemplazar el contenido completo de `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`

Expected: termina sin errores de TypeScript ni de Vite (puede haber warnings de bundle size, eso es aceptable).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/main.tsx
git commit -m "Add react-router-dom and wrap App in BrowserRouter"
```

---

### Task 2: PublicLandingPage — botones "Ingresar" navegan a /login

**Files:**
- Modify: `src/components/PublicLandingPage.tsx:1` (imports)
- Modify: `src/components/PublicLandingPage.tsx:119-195` (función `PublicLandingPage`, agregar `useNavigate` y reemplazar usos de `scrollToLogin`)
- Modify: `src/components/PublicLandingPage.tsx:166-168` (eliminar función `scrollToLogin`)
- Modify: `src/components/PublicLandingPage.tsx:228` (botón hero)

**Interfaces:**
- Consumes: `useNavigate` de `react-router-dom` (disponible desde Task 1, ya que `PublicLandingPage` se renderiza dentro de `<BrowserRouter>`).
- Produces: sin cambios de firma pública — `PublicLandingPage` sigue sin props.

- [ ] **Step 1: Agregar el import de `useNavigate`**

En `src/components/PublicLandingPage.tsx`, línea 1, cambiar:

```tsx
import { useEffect, useMemo, useState } from "react";
```

por:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
```

- [ ] **Step 2: Agregar `const navigate = useNavigate();` y eliminar `scrollToLogin`**

Dentro de la función `PublicLandingPage()`, reemplazar:

```tsx
  const [form, setForm] = useState<ContactPayload>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [contactResult, setContactResult] = useState<"idle" | "ok" | "error">("idle");
```

por:

```tsx
  const [form, setForm] = useState<ContactPayload>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [contactResult, setContactResult] = useState<"idle" | "ok" | "error">("idle");
  const navigate = useNavigate();
```

Y eliminar por completo esta función (ya no se usa):

```tsx
  function scrollToLogin() {
    document.getElementById("login-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
```

- [ ] **Step 3: Reemplazar los dos usos de `scrollToLogin` por navegación a `/login`**

Cambiar:

```tsx
      <LandingNav onLoginClick={scrollToLogin} />
```

por:

```tsx
      <LandingNav onLoginClick={() => navigate("/login")} />
```

Y cambiar:

```tsx
            <button type="button" className="lv2-btn-ghost" onClick={scrollToLogin}>
              Ingresar al sistema →
            </button>
```

por:

```tsx
            <button type="button" className="lv2-btn-ghost" onClick={() => navigate("/login")}>
              Ingresar al sistema →
            </button>
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`

Expected: sin errores de TypeScript (en particular, que no quede ninguna referencia suelta a `scrollToLogin`).

Run: `grep -n "scrollToLogin\|login-card" src/components/PublicLandingPage.tsx`

Expected: sin resultados (0 matches).

- [ ] **Step 5: Commit**

```bash
git add src/components/PublicLandingPage.tsx
git commit -m "Navigate to /login instead of scrolling on the landing page"
```

---

### Task 3: App.tsx — separar LoginScreen de la landing y rutear / vs /login

**Files:**
- Modify: `src/App.tsx:1` (imports)
- Modify: `src/App.tsx:242-372` (componente `LoginScreen`, quitar `<PublicLandingPage />` embebida)
- Modify: `src/App.tsx:441-452` (función `App`, agregar `useNavigate`)
- Modify: `src/App.tsx:545-552` (función `handleLogout`, navegar a `/` al cerrar sesión)
- Modify: `src/App.tsx:554-560` (función `handleLogin`, navegar a `/` tras loguearse)
- Modify: `src/App.tsx:941-958` (render final de `App`, reemplazar `if/return` por `<Routes>`)

**Interfaces:**
- Consumes: `Routes`, `Route`, `Navigate`, `useNavigate` de `react-router-dom` (Task 1); `navigate("/login")` ya está cableado desde `PublicLandingPage` (Task 2).
- Produces: `/` renderiza `PublicLandingPage` (sin sesión) o el dashboard (con sesión); `/login` renderiza `LoginScreen` (sin sesión) o redirige a `/` (con sesión).

- [ ] **Step 1: Agregar los imports de react-router-dom**

En `src/App.tsx`, línea 1, cambiar:

```tsx
import { type FormEvent, useEffect, useMemo, useState } from "react";
```

por:

```tsx
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
```

- [ ] **Step 2: Quitar `<PublicLandingPage />` del return de `LoginScreen`**

En `src/App.tsx`, dentro de `function LoginScreen(...)`, reemplazar el `return` completo:

```tsx
  return (
    <>
      <PublicLandingPage />

      <div id="login-card" className="login-section">
        <section className="login-card">
```

por:

```tsx
  return (
    <div className="login-section">
      <section className="login-card">
```

Y al final del mismo `return`, reemplazar:

```tsx
        </section>
      </div>
    </>
  );
}
```

por:

```tsx
        </section>
    </div>
  );
}
```

(El contenido interno de `<section className="login-card">` —el `<h1>FerIA</h1>`, el `<form>`, la grilla de usuarios demo— no cambia.)

- [ ] **Step 3: Verificar que no quedan referencias a `PublicLandingPage` dentro de `LoginScreen`**

Run: `sed -n '242,372p' src/App.tsx | grep -n "PublicLandingPage\|login-card"`

Expected: sin resultados (0 matches). El import de `PublicLandingPage` en la cabecera del archivo se mantiene — se usa en el Step 5.

- [ ] **Step 4: Agregar `useNavigate` en `App()`, y navegar a `/` desde `handleLogin` y `handleLogout`**

En `src/App.tsx`, dentro de `function App()`, reemplazar:

```tsx
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSyncFuente, setLastSyncFuente] = useState("Sin sincronizar");
```

por:

```tsx
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSyncFuente, setLastSyncFuente] = useState("Sin sincronizar");
  const navigate = useNavigate();
```

Reemplazar `handleLogout`:

```tsx
  function handleLogout() {
    clearAuthUser();
    clearAuthToken();
    setAuthUser(null);
    setEntities([]);
    setHasInitialSyncRun(false);
    setActiveSection("entrepreneur");
  }
```

por:

```tsx
  function handleLogout() {
    clearAuthUser();
    clearAuthToken();
    setAuthUser(null);
    setEntities([]);
    setHasInitialSyncRun(false);
    setActiveSection("entrepreneur");
    navigate("/");
  }
```

Y reemplazar `handleLogin`:

```tsx
  function handleLogin(user: AuthUser) {
    setAuthUser(user);
    setEntities([]);
    setHasInitialSyncRun(false);
setActiveSection(getDefaultSectionForRol(user.role));
  }
```

por:

```tsx
  function handleLogin(user: AuthUser) {
    setAuthUser(user);
    setEntities([]);
    setHasInitialSyncRun(false);
    setActiveSection(getDefaultSectionForRol(user.role));
    navigate("/");
  }
```

- [ ] **Step 5: Reemplazar el render final por `<Routes>`**

En `src/App.tsx`, al final de `function App()`, reemplazar:

```tsx
  if (!authUsuario) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <main className="app-shell">
      {renderHeader()}
{errorMessage && <div className="error-banner">{errorMessage}</div>}

      {renderStats()}

      {canAccessSectionByRole(getAuthToken(), "entrepreneur" as AppSection) && activeSection === "entrepreneur" && renderEntrepreneurPanel()}
      {canAccessSectionByRole(getAuthToken(), "fair_organizer" as AppSection) && activeSection === "fair_organizer" && renderFairOrganizerPanel()}
      {activeSection === "municipality" && renderMunicipalidadPanel()}
      {canAccessSectionByRole(getAuthToken(), "all" as AppSection) && activeSection === "all" && renderAllPanel()}
    </main>
  );
}
```

por:

```tsx
  return (
    <Routes>
      <Route
        path="/login"
        element={
          authUsuario ? (
            <Navigate to="/" replace />
          ) : (
            <LoginScreen onLogin={handleLogin} />
          )
        }
      />
      <Route
        path="/"
        element={
          !authUsuario ? (
            <PublicLandingPage />
          ) : (
            <main className="app-shell">
              {renderHeader()}
              {errorMessage && <div className="error-banner">{errorMessage}</div>}

              {renderStats()}

              {canAccessSectionByRole(getAuthToken(), "entrepreneur" as AppSection) && activeSection === "entrepreneur" && renderEntrepreneurPanel()}
              {canAccessSectionByRole(getAuthToken(), "fair_organizer" as AppSection) && activeSection === "fair_organizer" && renderFairOrganizerPanel()}
              {activeSection === "municipality" && renderMunicipalidadPanel()}
              {canAccessSectionByRole(getAuthToken(), "all" as AppSection) && activeSection === "all" && renderAllPanel()}
            </main>
          )
        }
      />
    </Routes>
  );
}
```

- [ ] **Step 6: Verificar que compila**

Run: `npm run build`

Expected: sin errores de TypeScript. En particular, sin warning de `PublicLandingPage` importado-pero-no-usado (sigue usándose en la ruta `/`).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "Route / and /login separately instead of a single login-gated view"
```

---

### Task 4: Verificación manual end-to-end en navegador

**Files:** ninguno (solo verificación; no se espera código nuevo).

**Interfaces:**
- Consumes: servidor de desarrollo backend (`npm run dev:backend`, puerto 4100) y frontend (`npm run dev`, puerto 5173) corriendo; usuarios demo del seeder (`emprendedor`/`emprendedor123`, `feriante`/`feriante123`, `municipalidad`/`muni123`).

- [ ] **Step 1: Confirmar que backend y frontend están corriendo**

Run: `curl -s http://localhost:4100/health && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/`

Expected: `{"ok":true,...}` y luego `200`. Si no están arriba, levantarlos con `npm run dev:backend` (en `backend/`) y `npm run dev` (en la raíz).

- [ ] **Step 2: Landing sin sesión no muestra login**

Con el navegador (Playwright/chromium-cli u otra herramienta de browser disponible):
- Navegar a `http://localhost:5173/`.
- Verificar que se ve la landing pública (`lv2-hero`, ferias, sponsors, contacto) y que **no** hay ningún `<form>` de login visible en esa página.
- Screenshot.

- [ ] **Step 3: Botón "Ingresar" navega a /login**

- Click en el botón "Ingresar →" del nav (o "Ingresar al sistema →" del hero).
- Verificar que la URL del navegador pasa a `http://localhost:5173/login`.
- Verificar que se ve el formulario de login (usuario/contraseña + grilla de usuarios demo) y **no** se ve el contenido de la landing (hero, ferias, sponsors) en esta página.
- Screenshot.

- [ ] **Step 4: Login exitoso redirige a / y muestra el dashboard**

- Completar el formulario con `emprendedor` / `emprendedor123` (o usar el botón de autocompletado "Emprendedor" de la grilla de usuarios demo) y enviar.
- Verificar que la URL vuelve a `http://localhost:5173/` y se ve el dashboard (header con "Cerrar sesion", panel de emprendedor).
- Screenshot.
- Run: revisar la consola del navegador por errores (`console --errors` si se usa chromium-cli, o el panel de consola del navegador) — no debe haber excepciones no capturadas.

- [ ] **Step 5: Visitar /login estando logueado redirige a /**

- Con la sesión activa del Step 4, navegar manualmente a `http://localhost:5173/login`.
- Verificar que la URL vuelve automáticamente a `http://localhost:5173/` y se ve el dashboard (no el formulario de login).

- [ ] **Step 6: Cerrar sesión vuelve a la landing pública**

- Click en "Cerrar sesion" en el header del dashboard.
- Verificar que la URL queda en `http://localhost:5173/` y se ve nuevamente la landing pública (sin formulario de login embebido).
- Screenshot.

- [ ] **Step 7: Reportar resultado**

Si los 6 pasos anteriores pasan sin errores de consola ni comportamiento inesperado, la feature está verificada end-to-end. Si algo falla, anotar el paso exacto y el mensaje de error antes de continuar.
