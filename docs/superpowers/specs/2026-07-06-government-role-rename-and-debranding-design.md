# Rename de rol Municipalidad → Gobierno + eliminar branding PunaTech/Hackathon

## Contexto

Este proyecto (FerIA) originalmente se armó para el hackathon PunaTech, con
un rol "Municipalidad" como uno de los tres actores (Emprendedor, Feriante,
Municipalidad). El proyecto ahora pertenece al Gobierno de la Provincia de
Salta, no a una municipalidad puntual, y ya no debe mostrar ninguna
referencia a PunaTech ni a "hackathon".

Este es el primero de cuatro cambios pedidos por el usuario (los otros tres
— quitar Stellar, quitar Arkiv, y cualquier ajuste adicional — se abordan
como sub-proyectos separados, cada uno con su propio spec y plan). Este
spec cubre únicamente: (1) el rename técnico completo del rol
`MUNICIPALITY` → `GOVERNMENT`, y (2) la eliminación del texto de branding
"PunaTech"/"Hackathon".

## Objetivo

- En todo el código (backend y frontend), el rol que hoy se llama
  `MUNICIPALITY`/"Municipalidad" pasa a llamarse `GOVERNMENT`/"Gobierno de
  la Provincia de Salta" — a nivel de enum de base de datos, tipos,
  nombres de archivo/componente, rutas del backend y texto visible.
- Ningún texto visible en la app (landing, login, footer) ni en el README
  menciona "PunaTech" o "hackathon".

## Fuera de alcance (con justificación)

- **Campos específicos de Stellar que contienen la palabra "municipality"**:
  `municipalityPublicationFeeXlm`, `municipalityReceiverPublicKey`
  (`FairOrganizerPanel.tsx`, `backendApi.ts`, `fairs.routes.ts`) y la env
  var `STELLAR_MUNICIPALITY_RECEIVER_PUBLIC_KEY` (`fairs.routes.ts`,
  `env.ts`). Son parte del flujo de pago Stellar, que se elimina por
  completo en un sub-proyecto aparte — renombrarlos ahora es trabajo que
  se descarta pronto.
- **`src/lib/arkiv.ts`**: contiene el identificador interno
  `"feria-arkiv-punatech26-salta-7x9k"` (un tag usado al publicar
  entidades en la blockchain Arkiv). No es texto visible al usuario, y
  este archivo completo se elimina cuando se saque Arkiv en su propio
  sub-proyecto.
- **Eliminar Stellar o Arkiv en sí**: sub-proyectos separados, no cubiertos
  por este spec.
- **Compatibilidad con entidades Arkiv ya publicadas** con el tag antiguo
  `"municipality_decision"`: dado que Arkiv se elimina pronto, no se hace
  ningún trabajo de migración/compatibilidad para datos ya publicados en
  la chain con el nombre viejo.

## Diseño

### Rol: `MUNICIPALITY` → `GOVERNMENT`

**Backend:**
- `backend/prisma/schema.prisma`: enum `FeriaUserRole.MUNICIPALITY` →
  `GOVERNMENT`, con una migración nueva
  (`ALTER TYPE "FeriaUserRole" RENAME VALUE 'MUNICIPALITY' TO 'GOVERNMENT';`).
- `backend/src/seed.ts`: usuario demo pasa de
  `username: "municipalidad"`, `password: "muni123"`,
  `fullName: "Municipalidad de Salta"`, `role: MUNICIPALITY` a
  `username: "gobierno"`, `password: "gobierno123"`,
  `fullName: "Gobierno de la Provincia de Salta"`, `role: GOVERNMENT`.
- `backend/src/auth.ts`, `backend/src/fastify.d.ts`: la unión de tipos de
  rol (`"ENTREPRENEUR" | "FAIR_ORGANIZER" | "MUNICIPALITY"`) pasa a incluir
  `"GOVERNMENT"` en lugar de `"MUNICIPALITY"`.
- `backend/src/routes/fairRegistrations.routes.ts`: los chequeos
  `requireRole(["MUNICIPALITY"])` y el texto por defecto
  `"Cancelled by municipality."` pasan a `GOVERNMENT` /
  `"Cancelled by government."`.
- `backend/src/routes/fairs.routes.ts`: los chequeos de rol
  (`requireRole([...])`, la comparación `role === "MUNICIPALITY"`) pasan a
  `GOVERNMENT`. Los campos `municipalityPublicationFeeXlm`/
  `municipalityReceiverPublicKey` de este mismo archivo NO se tocan (ver
  "Fuera de alcance").
- `backend/src/routes/stellarPayments.routes.ts`: los chequeos de rol
  (`requireRole([...])`, comparaciones `user.role === "MUNICIPALITY"`)
  pasan a `GOVERNMENT`.
- `backend/src/arkivService.ts`: el entityType `"municipality_decision"`
  pasa a `"government_decision"`.

**Frontend:**
- `src/types/feria.ts`: `UserRole` (`"municipality"` → `"government"`),
  `MunicipalityDecisionValue`/`MunicipalityDecision` →
  `GovernmentDecisionValue`/`GovernmentDecision`, y el literal de
  entityType correspondiente.
- Renombro de archivos: `src/components/MunicipalityApprovalPanel.tsx` →
  `src/components/GovernmentApprovalPanel.tsx`,
  `src/components/MunicipalityRegistrationsPanel.tsx` →
  `src/components/GovernmentRegistrationsPanel.tsx` (con el componente
  interno renombrado igual, y los imports en `App.tsx` actualizados).
- `src/components/ProfileScopedDashboard.tsx`: `DashboardMode`
  (`"municipality"` → `"government"`), y las dos etiquetas
  `<p className="eyebrow">Municipalidad</p>` pasan a
  `Gobierno de la Provincia de Salta`.
- `src/services/feriaAssistant.ts`: `answerMunicipalityQuestion` →
  `answerGovernmentQuestion` (y su único caller actualizado).
- `src/services/backendApi.ts`: el mapeo de rol para display
  (`"MUNICIPALITY"` → `"municipality"`) pasa a `"GOVERNMENT"` →
  `"government"`. Los campos `municipalityPublicationFeeXlm`/
  `municipalityReceiverPublicKey` de este archivo NO se tocan.
- `src/components/RegisterAccountPanel.tsx` (línea 94): el texto
  "Registrate como emprendedor o feriante. La municipalidad se crea solo
  desde administracion." pasa a "...El gobierno se crea solo desde
  administracion."
- `src/App.tsx`: `roleLabel()` (nueva rama para `"government"` →
  `"Gobierno"`), el label del botón de mode-toggle
  (`"Municipalidad"` → texto corto `"Gobierno"`), `AppSection`/
  `activeSection` (`"municipality"` → `"government"`),
  `renderMunicipalidadPanel` → `renderGovernmentPanel`,
  `canAccessSectionByRole`/`decodeTokenRole`, y el import de los
  componentes renombrados.
- `src/index.css`: todas las clases `.municipality-*` (alrededor de 50
  ocurrencias: `.municipality-actions`, `.municipality-fair-list`,
  `.municipality-fair-card*`, `.municipality-registration-list`,
  `.municipality-registration-card*`, `.municipality-audit-visible`) pasan
  a `.government-*`, coordinado con los `className` usados en
  `GovernmentApprovalPanel.tsx`/`GovernmentRegistrationsPanel.tsx`/
  `App.tsx`.

**Etiquetas de texto:** se usan dos formas del nombre — la forma larga
"Gobierno de la Provincia de Salta" para el `fullName` del usuario demo,
los eyebrows de `ProfileScopedDashboard`, y cualquier título prominente; y
la forma corta "Gobierno" para espacios acotados como el botón del
mode-toggle y `roleLabel()`.

### Branding: quitar "PunaTech"/"Hackathon"

- `src/App.tsx` (líneas 298 y 567): eyebrow
  `"PunaTech Hackathon - Arkiv Track"` → `"Gobierno de la Provincia de
  Salta"`.
- `src/components/PublicLandingPage.tsx` (footer): 
  `"© 2025 FerIA · PunaTech Hackathon · Arkiv Track"` → 
  `"© 2025 FerIA · Gobierno de la Provincia de Salta"`.
- `README.md` (línea 117): la mención "Para hackathon/demo con Braga,
  cargar una wallet con GLM del faucet." se reformula sin la palabra
  "hackathon" (ej. "Para publicar en producción con Braga, cargar una
  wallet con GLM del faucet.").

## Testing / verificación

- `npm run build` en la raíz y en `backend/` (typecheck — no hay test
  runner en este proyecto).
- `npx prisma migrate deploy` aplica la migración del enum sin error.
- Grep final de `MUNICIPALITY|Municipalidad|municipality` y
  `PunaTech|[Hh]ackathon` sobre `backend/src` y `src` — sin resultados
  excepto los ítems marcados como fuera de alcance (`municipalityPublicationFeeXlm`,
  `municipalityReceiverPublicKey`, `STELLAR_MUNICIPALITY_RECEIVER_PUBLIC_KEY`,
  y el identificador en `src/lib/arkiv.ts`).
- Verificación manual en navegador: login con `gobierno`/`gobierno123`,
  confirmar que el panel de aprobación (renombrado) funciona igual que
  antes y que las etiquetas visibles dicen "Gobierno de la Provincia de
  Salta" / "Gobierno", no "Municipalidad".
