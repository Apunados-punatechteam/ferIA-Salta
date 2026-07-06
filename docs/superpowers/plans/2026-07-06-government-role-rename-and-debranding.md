# Government Role Rename + Debranding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `MUNICIPALITY` role to `GOVERNMENT` end-to-end (DB enum, backend types/routes, frontend types/components/CSS) and remove all "PunaTech"/"Hackathon" branding text, per the approved spec.

**Architecture:** Three sequential passes — backend role rename (DB migration + types + routes), frontend role rename (types + two renamed components + their CSS + App.tsx wiring), then a final pass for remaining copy/branding text that has no type dependency on the rename. A fourth task verifies everything end-to-end in the browser plus a final repo-wide grep.

**Tech Stack:** Prisma/PostgreSQL (backend), Fastify, React + TypeScript (frontend), plain CSS.

## Global Constraints

- Exact new role name: `GOVERNMENT` (enum/type value), display forms: long "Gobierno de la Provincia de Salta" (demo fullName, prominent eyebrows/titles), short "Gobierno" (mode-toggle button, `roleLabel()`, compact payment displays).
- Demo user credentials: `username: "gobierno"`, `password: "gobierno123"`.
- **Do NOT touch** these Stellar-specific fields/vars (they're deleted in a future, separate Stellar-removal sub-project): `municipalityPublicationFeeXlm`, `municipalityReceiverPublicKey` (wherever they appear as object keys/params), and the env var `STELLAR_MUNICIPALITY_RECEIVER_PUBLIC_KEY`.
- **Do NOT touch** `src/lib/arkiv.ts`'s `PROJECT_ATTRIBUTE.value` (`"feria-arkiv-punatech26-salta-7x9k"`) — internal Arkiv tag, not user-facing, removed when Arkiv itself is removed in a separate sub-project.
- No test runner in this project (no `test` script in `package.json`) — verification is `npm run build` (root and `backend/`), `npx prisma migrate deploy`, and a final grep sweep, not automated tests.
- No unrelated refactoring: only rename/replace what's listed below.

---

## File Structure

- **Modify `backend/prisma/schema.prisma`** + **create a new migration folder** — renames the `FeriaUserRole.MUNICIPALITY` enum value to `GOVERNMENT`.
- **Modify `backend/src/seed.ts`, `backend/src/auth.ts`, `backend/src/fastify.d.ts`, `backend/src/routes/fairs.routes.ts`, `backend/src/routes/fairRegistrations.routes.ts`, `backend/src/routes/stellarPayments.routes.ts`, `backend/src/arkivService.ts`, `backend/src/stellarPricingService.ts`** — role-check logic, demo seed, and the payload fields that identify who acted (not the Stellar fee/key fields).
- **Modify `src/types/feria.ts`, `src/services/feriaAssistant.ts`, `src/services/backendApi.ts`, `src/services/arkivService.ts`, `src/lib/arkiv.ts`, `src/components/StellarPaymentsPanel.tsx`, `src/components/ProfileScopedDashboard.tsx`, `src/components/RegisterAccountPanel.tsx`, `src/App.tsx`** + **rename `src/components/MunicipalityApprovalPanel.tsx` → `GovernmentApprovalPanel.tsx`, `src/components/MunicipalityRegistrationsPanel.tsx` → `GovernmentRegistrationsPanel.tsx`** + **`src/index.css`** — the frontend half of the same rename, done atomically since TypeScript's type system and the file renames couple all of this together.
- **Modify `src/components/FairOrganizerPanel.tsx`, `src/components/PublicLandingPage.tsx`, `README.md`** — remaining copy text (role-name mentions with no type dependency, plus the PunaTech/Hackathon branding removal). No build coupling with Task 2, so it's its own task.

---

### Task 1: Backend — rename MUNICIPALITY role to GOVERNMENT

**Files:**
- Modify: `backend/prisma/schema.prisma:13`
- Create: `backend/prisma/migrations/20260706120000_rename_municipality_to_government/migration.sql`
- Modify: `backend/src/seed.ts:51-57`
- Modify: `backend/src/auth.ts:7`
- Modify: `backend/src/fastify.d.ts:7`
- Modify: `backend/src/routes/fairs.routes.ts:32-34,68,141`
- Modify: `backend/src/routes/fairRegistrations.routes.ts:43,356`
- Modify: `backend/src/routes/stellarPayments.routes.ts:200,228,293,339,355,392,412`
- Modify: `backend/src/arkivService.ts:19,175,247,257(context only, no change),261,370`
- Modify: `backend/src/stellarPricingService.ts:21,142,163-178,205,207`

**Interfaces:**
- Produces: Prisma `FeriaUserRole` enum with values `ENTREPRENEUR | FAIR_ORGANIZER | GOVERNMENT`; backend JWT role type `"ENTREPRENEUR" | "FAIR_ORGANIZER" | "GOVERNMENT"` (from `backend/src/auth.ts`'s `JwtUser["role"]` and `backend/src/fastify.d.ts`'s `FeriaJwtUser["role"]`); Arkiv entity field `decidedByRole`/`cancelledByRole` now emit `"government"` (lowercase) instead of `"municipality"`.
- Consumes: nothing from other tasks (this task is backend-only and self-contained).

- [ ] **Step 1: Update the Prisma schema enum**

In `backend/prisma/schema.prisma`, change:

```prisma
enum FeriaUserRole {
  ENTREPRENEUR
  FAIR_ORGANIZER
  MUNICIPALITY
}
```

to:

```prisma
enum FeriaUserRole {
  ENTREPRENEUR
  FAIR_ORGANIZER
  GOVERNMENT
}
```

- [ ] **Step 2: Create the migration**

```bash
mkdir -p backend/prisma/migrations/20260706120000_rename_municipality_to_government
cat > backend/prisma/migrations/20260706120000_rename_municipality_to_government/migration.sql <<'EOF'
-- RenameEnumValue
ALTER TYPE "FeriaUserRole" RENAME VALUE 'MUNICIPALITY' TO 'GOVERNMENT';
EOF
```

- [ ] **Step 3: Regenerate the Prisma client and apply the migration**

Run (from `backend/`):

```bash
npx prisma generate
npx prisma migrate deploy
```

Expected: `Generated Prisma Client` succeeds, and `migrate deploy` reports the new migration applied with no errors.

- [ ] **Step 4: Update the seed script**

In `backend/src/seed.ts`, change:

```ts
await upsertUser({
  username: "municipalidad",
  password: "muni123",
  fullName: "Municipalidad de Salta",
  document: "muni-salta",
  role: FeriaUserRole.MUNICIPALITY,
});
```

to:

```ts
await upsertUser({
  username: "gobierno",
  password: "gobierno123",
  fullName: "Gobierno de la Provincia de Salta",
  document: "gobierno-salta",
  role: FeriaUserRole.GOVERNMENT,
});
```

- [ ] **Step 5: Re-run the seeder**

Run (from `backend/`):

```bash
npm run seed
```

Expected: `Usuarios demo creados correctamente en feria_users.` with no errors (the `upsert` on the new `gobierno` username creates it; the old `municipalidad` row from a previous seed run, if any, is simply left alone in the DB — that's fine, since login only ever looks up by username and no route or UI will reference `"municipalidad"` after this plan is done).

- [ ] **Step 6: Update `backend/src/auth.ts`**

Change:

```ts
export type JwtUser = {
  sub: string;
  username: string;
  role: "ENTREPRENEUR" | "FAIR_ORGANIZER" | "MUNICIPALITY";
};
```

to:

```ts
export type JwtUser = {
  sub: string;
  username: string;
  role: "ENTREPRENEUR" | "FAIR_ORGANIZER" | "GOVERNMENT";
};
```

- [ ] **Step 7: Update `backend/src/fastify.d.ts`**

Change:

```ts
export type FeriaJwtUser = {
  sub: string;
  username: string;
  role: "ENTREPRENEUR" | "FAIR_ORGANIZER" | "MUNICIPALITY";
  document?: string;
  fullName?: string;
};
```

to:

```ts
export type FeriaJwtUser = {
  sub: string;
  username: string;
  role: "ENTREPRENEUR" | "FAIR_ORGANIZER" | "GOVERNMENT";
  document?: string;
  fullName?: string;
};
```

- [ ] **Step 8: Update `backend/src/routes/fairs.routes.ts`**

Change:

```ts
function normalizeCreatorRole(role: string) {
  return role === "MUNICIPALITY" ? "MUNICIPALITY" : "FAIR_ORGANIZER";
}
```

to:

```ts
function normalizeCreatorRole(role: string) {
  return role === "GOVERNMENT" ? "GOVERNMENT" : "FAIR_ORGANIZER";
}
```

Change (line 68):

```ts
      preHandler: [requireRole(["FAIR_ORGANIZER", "MUNICIPALITY"])],
```

to:

```ts
      preHandler: [requireRole(["FAIR_ORGANIZER", "GOVERNMENT"])],
```

Change (line 141):

```ts
      preHandler: [requireRole(["MUNICIPALITY"])],
```

to:

```ts
      preHandler: [requireRole(["GOVERNMENT"])],
```

Leave lines 50-51 (`municipalityPublicationFeeXlm`/`municipalityReceiverPublicKey` schema fields), 89-90, 101-107, 125-126 untouched — these are the excluded Stellar fields.

- [ ] **Step 9: Update `backend/src/routes/fairRegistrations.routes.ts`**

Change:

```ts
const CancelRegistrationSchema = z.object({
  fairKey: z.string().min(10),
  registrationKey: z.string().min(10),
  notes: z.string().default("Cancelled by municipality."),
});
```

to:

```ts
const CancelRegistrationSchema = z.object({
  fairKey: z.string().min(10),
  registrationKey: z.string().min(10),
  notes: z.string().default("Cancelled by government."),
});
```

Change (line 356):

```ts
      preHandler: [requireRole(["MUNICIPALITY"])],
```

to:

```ts
      preHandler: [requireRole(["GOVERNMENT"])],
```

- [ ] **Step 10: Update `backend/src/routes/stellarPayments.routes.ts`**

Change all 6 occurrences of `"MUNICIPALITY"` to `"GOVERNMENT"` (they keep the exact same surrounding structure — only the string literal changes):

Line 200 and 339 (identical pattern, both `preHandler`):

```ts
      preHandler: [requireRole(["ENTREPRENEUR", "MUNICIPALITY"])],
```

→

```ts
      preHandler: [requireRole(["ENTREPRENEUR", "GOVERNMENT"])],
```

Line 228:

```ts
      if (user.role !== "MUNICIPALITY" && payment.userId !== user.sub) {
```

→

```ts
      if (user.role !== "GOVERNMENT" && payment.userId !== user.sub) {
```

Line 293:

```ts
      preHandler: [requireRole(["MUNICIPALITY"])],
```

→

```ts
      preHandler: [requireRole(["GOVERNMENT"])],
```

Line 392 (same pattern as 200/339):

```ts
      preHandler: [requireRole(["ENTREPRENEUR", "MUNICIPALITY"])],
```

→

```ts
      preHandler: [requireRole(["ENTREPRENEUR", "GOVERNMENT"])],
```

Line 355 and 412 (identical pattern, both inline conditionals):

```ts
          ...(user.role === "MUNICIPALITY"
```

→

```ts
          ...(user.role === "GOVERNMENT"
```

- [ ] **Step 11: Update `backend/src/arkivService.ts`**

Change:

```ts
export const ENTITY_TYPES = {
  FAIR_EVENT: "fair_event",
  FAIR_EVENT_DECISION: "fair_event_decision",
  FAIR_REGISTRATION: "fair_registration",
  FAIR_REGISTRATION_CANCELLATION: "fair_registration_cancellation",
  FAIR_CERTIFICATE: "fair_certificate",
  MUNICIPALITY_DECISION: "municipality_decision",
} as const;
```

to:

```ts
export const ENTITY_TYPES = {
  FAIR_EVENT: "fair_event",
  FAIR_EVENT_DECISION: "fair_event_decision",
  FAIR_REGISTRATION: "fair_registration",
  FAIR_REGISTRATION_CANCELLATION: "fair_registration_cancellation",
  FAIR_CERTIFICATE: "fair_certificate",
  GOVERNMENT_DECISION: "government_decision",
} as const;
```

Change:

```ts
  createdByRole: "FAIR_ORGANIZER" | "MUNICIPALITY";
```

to:

```ts
  createdByRole: "FAIR_ORGANIZER" | "GOVERNMENT";
```

(Leave the two lines right below it — `municipalityPublicationFeeXlm?: string;` / `municipalityReceiverPublicKey?: string;` — and their usages further down in this function untouched; those are the excluded Stellar fields.)

Change (inside `createFairEventDecision`, two occurrences of the same literal):

```ts
    decidedByRole: "municipality",
```

→

```ts
    decidedByRole: "government",
```

and:

```ts
      { key: "decidedByRole", value: "municipality" },
```

→

```ts
      { key: "decidedByRole", value: "government" },
```

Change (inside `createFairRegistrationCancellation`):

```ts
    cancelledByRole: "municipality",
```

→

```ts
    cancelledByRole: "government",
```

- [ ] **Step 12: Update `backend/src/stellarPricingService.ts`**

Change the type:

```ts
  payeeRole: "MUNICIPALITY" | "FAIR_ORGANIZER";
```

to:

```ts
  payeeRole: "GOVERNMENT" | "FAIR_ORGANIZER";
```

Change:

```ts
  const municipalityReceiver =
    getPublicKey(
      payload.municipalityReceiverPublicKey,
      getAttr(fair, "municipalityReceiverPublicKey")
    ) ||
    env.STELLAR_MUNICIPALITY_RECEIVER_PUBLIC_KEY ||
    env.STELLAR_RECEIVER_PUBLIC_KEY;
```

to (only the variable name changes — the Stellar field names it reads stay the same, per the exclusion rule):

```ts
  const governmentReceiver =
    getPublicKey(
      payload.municipalityReceiverPublicKey,
      getAttr(fair, "municipalityReceiverPublicKey")
    ) ||
    env.STELLAR_MUNICIPALITY_RECEIVER_PUBLIC_KEY ||
    env.STELLAR_RECEIVER_PUBLIC_KEY;
```

Change:

```ts
  const fairWasCreatedByMunicipality =
    createdByRole === "MUNICIPALITY" ||
    createdByRole === "MUNICIPALIDAD";

  if (fairWasCreatedByMunicipality || !fairOrganizerReceiver) {
    return {
      amountXlm,
      receiverPublicKey: municipalityReceiver,
      paymentConcept: "ENTREPRENEUR_REGISTRATION_FEE",
      payerRole: "ENTREPRENEUR",
      payeeRole: "MUNICIPALITY",
      payeeDocument: getText(
        payload.createdByDocument,
        payload.municipalityDocument
      ),
      payeeName: getText(payload.createdByName, "Municipalidad"),
    };
  }
```

to:

```ts
  const fairWasCreatedByGovernment =
    createdByRole === "GOVERNMENT" ||
    createdByRole === "GOBIERNO";

  if (fairWasCreatedByGovernment || !fairOrganizerReceiver) {
    return {
      amountXlm,
      receiverPublicKey: governmentReceiver,
      paymentConcept: "ENTREPRENEUR_REGISTRATION_FEE",
      payerRole: "ENTREPRENEUR",
      payeeRole: "GOVERNMENT",
      payeeDocument: getText(
        payload.createdByDocument,
        payload.governmentDocument
      ),
      payeeName: getText(payload.createdByName, "Gobierno"),
    };
  }
```

Change (inside `resolveFairPublicationPricing`):

```ts
  return {
    amountXlm,
    receiverPublicKey:
      env.STELLAR_MUNICIPALITY_RECEIVER_PUBLIC_KEY ||
      env.STELLAR_RECEIVER_PUBLIC_KEY,
    paymentConcept: "FAIR_PUBLICATION_FEE",
    payerRole: "FAIR_ORGANIZER",
    payeeRole: "MUNICIPALITY",
    payeeDocument: "",
    payeeName: "Municipalidad",
  };
```

to:

```ts
  return {
    amountXlm,
    receiverPublicKey:
      env.STELLAR_MUNICIPALITY_RECEIVER_PUBLIC_KEY ||
      env.STELLAR_RECEIVER_PUBLIC_KEY,
    paymentConcept: "FAIR_PUBLICATION_FEE",
    payerRole: "FAIR_ORGANIZER",
    payeeRole: "GOVERNMENT",
    payeeDocument: "",
    payeeName: "Gobierno",
  };
```

- [ ] **Step 13: Verify the backend builds**

Run (from `backend/`):

```bash
npm run build
```

Expected: `tsc -p tsconfig.json` completes with no errors.

- [ ] **Step 14: Grep check for leftover MUNICIPALITY role references in backend**

Run:

```bash
grep -rn "MUNICIPALITY\b" backend/src --include="*.ts"
```

Expected: only matches inside `municipalityPublicationFeeXlm`, `municipalityReceiverPublicKey`, and `STELLAR_MUNICIPALITY_RECEIVER_PUBLIC_KEY` (the explicitly excluded Stellar fields) — no bare `"MUNICIPALITY"` role-check string remains.

- [ ] **Step 15: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260706120000_rename_municipality_to_government backend/src/seed.ts backend/src/auth.ts backend/src/fastify.d.ts backend/src/routes/fairs.routes.ts backend/src/routes/fairRegistrations.routes.ts backend/src/routes/stellarPayments.routes.ts backend/src/arkivService.ts backend/src/stellarPricingService.ts
git commit -m "Rename MUNICIPALITY role to GOVERNMENT across backend"
```

---

### Task 2: Frontend — rename municipality role/components/CSS to government

**Files:**
- Modify: `src/types/feria.ts:11,22,69,123,125,133`
- Modify: `src/services/feriaAssistant.ts:1`
- Modify: `src/services/backendApi.ts:12,47,264-265(no change, excluded)`
- Modify: `src/services/arkivService.ts:22,279,296,322,324-325,415,426,429,445,449`
- Modify: `src/lib/arkiv.ts:20,32`
- Modify: `src/components/StellarPaymentsPanel.tsx:392`
- Rename: `src/components/MunicipalityApprovalPanel.tsx` → `src/components/GovernmentApprovalPanel.tsx`
- Rename: `src/components/MunicipalityRegistrationsPanel.tsx` → `src/components/GovernmentRegistrationsPanel.tsx`
- Modify: `src/components/ProfileScopedDashboard.tsx:5,385,416`
- Modify: `src/components/RegisterAccountPanel.tsx:94`
- Modify: `src/index.css` (all `.municipality-*` selectors)
- Modify: `src/App.tsx:7-8,26,83,169,175,208,248-249,301,314,359,361-362,434,480,509,593-597,777-778,787,790,797,806,915,967`

**Interfaces:**
- Consumes: nothing from Task 1 at the TypeScript level (frontend and backend types are independent literal unions, not shared) — but functionally depends on Task 1's backend being deployed with the `gobierno`/`gobierno123` seed user for end-to-end login to work (verified in Task 4).
- Produces: `UserRole` = `"entrepreneur" | "fair_organizer" | "government"`; components `GovernmentApprovalPanel`, `GovernmentRegistrationsPanel` (same props as before, only the name changed); `App.tsx`'s `AppSection` = `"entrepreneur" | "fair_organizer" | "government" | "all"`.

- [ ] **Step 1: Update `src/types/feria.ts`**

Change:

```ts
export type EntityType =
  | "entrepreneur_profile"
  | "fair_application"
  | "fair_certificate"
  | "assistant_message"
  | "payment_record"
  | "user_profile"
  | "fair_event"
  | "fair_event_decision"
  | "fair_registration"
  | "municipality_decision";
```

to:

```ts
export type EntityType =
  | "entrepreneur_profile"
  | "fair_application"
  | "fair_certificate"
  | "assistant_message"
  | "payment_record"
  | "user_profile"
  | "fair_event"
  | "fair_event_decision"
  | "fair_registration"
  | "government_decision";
```

Change:

```ts
export type UserRole = "entrepreneur" | "fair_organizer" | "municipality";
```

to:

```ts
export type UserRole = "entrepreneur" | "fair_organizer" | "government";
```

Change (in `FairCertificate`):

```ts
  approvedBy?: string;
  municipalApprovalAt?: number;
  issuedAt: number;
```

to:

```ts
  approvedBy?: string;
  governmentApprovalAt?: number;
  issuedAt: number;
```

Change:

```ts
export type MunicipalityDecisionValue = "approved" | "rejected";

export type MunicipalityDecision = {
  registrationKey: string;
  fairKey: string;
  fairSlug: string;
  fairName: string;
  entrepreneurName: string;
  documentNumber: string;
  businessName: string;
  decision: MunicipalityDecisionValue;
  decidedBy: string;
  notes: string;
  decidedAt: number;
};
```

to:

```ts
export type GovernmentDecisionValue = "approved" | "rejected";

export type GovernmentDecision = {
  registrationKey: string;
  fairKey: string;
  fairSlug: string;
  fairName: string;
  entrepreneurName: string;
  documentNumber: string;
  businessName: string;
  decision: GovernmentDecisionValue;
  decidedBy: string;
  notes: string;
  decidedAt: number;
};
```

- [ ] **Step 2: Update `src/services/feriaAssistant.ts`**

Change:

```ts
export function answerMunicipalityQuestion(message: string): string {
```

to:

```ts
export function answerGovernmentQuestion(message: string): string {
```

(This function has no callers anywhere in the codebase — renaming it alone is sufficient, there's nothing else to update.)

- [ ] **Step 3: Update `src/services/backendApi.ts`**

Change:

```ts
export type BackendRole = "ENTREPRENEUR" | "FAIR_ORGANIZER" | "MUNICIPALITY";
```

to:

```ts
export type BackendRole = "ENTREPRENEUR" | "FAIR_ORGANIZER" | "GOVERNMENT";
```

Change:

```ts
export function mapBackendRoleToUserRole(role: BackendRole): UserRole {
  if (role === "MUNICIPALITY") return "municipality";
  if (role === "FAIR_ORGANIZER") return "fair_organizer";
  return "entrepreneur";
}
```

to:

```ts
export function mapBackendRoleToUserRole(role: BackendRole): UserRole {
  if (role === "GOVERNMENT") return "government";
  if (role === "FAIR_ORGANIZER") return "fair_organizer";
  return "entrepreneur";
}
```

Leave `municipalityPublicationFeeXlm?: string;` / `municipalityReceiverPublicKey?: string;` (lines 264-265) untouched — excluded Stellar fields.

- [ ] **Step 4: Update `src/lib/arkiv.ts`**

Change:

```ts
export const ENTITY_TYPES = {
  PROFILE: "entrepreneur_profile",
  APPLICATION: "fair_application",
  CERTIFICATE: "fair_certificate",
  ASSISTANT_MESSAGE: "assistant_message",
  PAYMENT_RECORD: "payment_record",
  USER_PROFILE: "user_profile",
  FAIR_EVENT: "fair_event",
  FAIR_REGISTRATION: "fair_registration",
  MUNICIPALITY_DECISION: "municipality_decision",
} as const;

export const EXPIRATION_SECONDS = {
  ASSISTANT_MESSAGE: 60 * 60 * 24 * 7,
  PROFILE: 60 * 60 * 24 * 180,
  APPLICATION: 60 * 60 * 24 * 90,
  CERTIFICATE: 60 * 60 * 24 * 365,
  PAYMENT_RECORD: 60 * 60 * 24 * 120,
  USER_PROFILE: 60 * 60 * 24 * 180,
  FAIR_EVENT: 60 * 60 * 24 * 120,
  FAIR_REGISTRATION: 60 * 60 * 24 * 90,
  MUNICIPALITY_DECISION: 60 * 60 * 24 * 365,
} as const;
```

to:

```ts
export const ENTITY_TYPES = {
  PROFILE: "entrepreneur_profile",
  APPLICATION: "fair_application",
  CERTIFICATE: "fair_certificate",
  ASSISTANT_MESSAGE: "assistant_message",
  PAYMENT_RECORD: "payment_record",
  USER_PROFILE: "user_profile",
  FAIR_EVENT: "fair_event",
  FAIR_REGISTRATION: "fair_registration",
  GOVERNMENT_DECISION: "government_decision",
} as const;

export const EXPIRATION_SECONDS = {
  ASSISTANT_MESSAGE: 60 * 60 * 24 * 7,
  PROFILE: 60 * 60 * 24 * 180,
  APPLICATION: 60 * 60 * 24 * 90,
  CERTIFICATE: 60 * 60 * 24 * 365,
  PAYMENT_RECORD: 60 * 60 * 24 * 120,
  USER_PROFILE: 60 * 60 * 24 * 180,
  FAIR_EVENT: 60 * 60 * 24 * 120,
  FAIR_REGISTRATION: 60 * 60 * 24 * 90,
  GOVERNMENT_DECISION: 60 * 60 * 24 * 365,
} as const;
```

Leave `PROJECT_ATTRIBUTE.value: "feria-arkiv-punatech26-salta-7x9k"` (near the top of the file) untouched.

- [ ] **Step 5: Update `src/services/arkivService.ts`**

Change the import:

```ts
  MunicipalityDecision,
```

to:

```ts
  GovernmentDecision,
```

Change (in the certificate-creation function's params and payload):

```ts
  approvedBy?: string;
  municipalApprovalAt?: number;
}): Promise<LocalArkivEntity<FairCertificate>> {
```

to:

```ts
  approvedBy?: string;
  governmentApprovalAt?: number;
}): Promise<LocalArkivEntity<FairCertificate>> {
```

and:

```ts
    approvedBy: params.approvedBy,
    municipalApprovalAt: params.municipalApprovalAt,
    issuedAt,
```

to:

```ts
    approvedBy: params.approvedBy,
    governmentApprovalAt: params.governmentApprovalAt,
    issuedAt,
```

and:

```ts
  if (params.municipalApprovalAt) {
    attributes.push({
      key: "municipalApprovalAt",
      value: params.municipalApprovalAt,
    });
  }
```

to:

```ts
  if (params.governmentApprovalAt) {
    attributes.push({
      key: "governmentApprovalAt",
      value: params.governmentApprovalAt,
    });
  }
```

Change:

```ts
export async function createArkivMunicipalityDecisionEntity(params: {
  registrationKey: string;
  fairKey: string;
  fairSlug: string;
  fairName: string;
  entrepreneurName: string;
  documentNumber: string;
  businessName: string;
  decision: "approved" | "rejected";
  decidedBy: string;
  notes: string;
}): Promise<LocalArkivEntity<MunicipalityDecision>> {
  const decidedAt = Date.now();

  const payload: MunicipalityDecision = {
```

to:

```ts
export async function createArkivGovernmentDecisionEntity(params: {
  registrationKey: string;
  fairKey: string;
  fairSlug: string;
  fairName: string;
  entrepreneurName: string;
  documentNumber: string;
  businessName: string;
  decision: "approved" | "rejected";
  decidedBy: string;
  notes: string;
}): Promise<LocalArkivEntity<GovernmentDecision>> {
  const decidedAt = Date.now();

  const payload: GovernmentDecision = {
```

Change:

```ts
    expiresIn: EXPIRATION_SECONDS.MUNICIPALITY_DECISION,
    createdAt: decidedAt,
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPES.MUNICIPALITY_DECISION },
```

to:

```ts
    expiresIn: EXPIRATION_SECONDS.GOVERNMENT_DECISION,
    createdAt: decidedAt,
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPES.GOVERNMENT_DECISION },
```

(This function and file have no callers elsewhere in the frontend — it's dead code kept in sync for consistency, per the spec.)

- [ ] **Step 6: Update `src/components/StellarPaymentsPanel.tsx`**

Change:

```tsx
                {activePayment.payeeRole ?? "MUNICIPALITY"}
```

to:

```tsx
                {activePayment.payeeRole ?? "GOVERNMENT"}
```

- [ ] **Step 7: Rename the two panel components and their CSS classes**

```bash
git mv src/components/MunicipalityApprovalPanel.tsx src/components/GovernmentApprovalPanel.tsx
git mv src/components/MunicipalityRegistrationsPanel.tsx src/components/GovernmentRegistrationsPanel.tsx
sed -i 's/municipality-/government-/g' src/components/GovernmentApprovalPanel.tsx src/components/GovernmentRegistrationsPanel.tsx src/index.css
```

Then, in `src/components/GovernmentApprovalPanel.tsx`, change the component name and remaining text:

```tsx
export function MunicipalityApprovalPanel({
```

to:

```tsx
export function GovernmentApprovalPanel({
```

```tsx
    const notes =
      notesByFairKey[fairKey]?.trim() ||
      (decision === "approved"
        ? "Aprobado por la municipalidad."
        : "Rechazado por la municipalidad.");
```

to:

```tsx
    const notes =
      notesByFairKey[fairKey]?.trim() ||
      (decision === "approved"
        ? "Aprobado por el gobierno."
        : "Rechazado por el gobierno.");
```

```tsx
          ? "No se pudo registrar la decision municipal.";
```

to:

```tsx
          ? "No se pudo registrar la decision del gobierno.";
```

```tsx
              Observacion municipal
```

to:

```tsx
              Observacion del gobierno
```

```tsx
      title="Gestion de ferias municipales"
      subtitle="Aproba, rechaza y revisa el historial municipal sin perder contexto."
```

to:

```tsx
      title="Gestion de ferias del gobierno"
      subtitle="Aproba, rechaza y revisa el historial del gobierno sin perder contexto."
```

```tsx
                    <p className="eyebrow">Municipalidad</p>
                    <h2>Ferias pendientes</h2>
```

to:

```tsx
                    <p className="eyebrow">Gobierno de la Provincia de Salta</p>
                    <h2>Ferias pendientes</h2>
```

(two more `<p className="eyebrow">Historial municipal</p>` occurrences — one before "Ferias aprobadas", one before "Ferias rechazadas" — both change to:)

```tsx
                    <p className="eyebrow">Historial del gobierno</p>
```

- [ ] **Step 8: Update text inside `src/components/GovernmentRegistrationsPanel.tsx`**

Change the component name:

```tsx
export function MunicipalityRegistrationsPanel({
```

to:

```tsx
export function GovernmentRegistrationsPanel({
```

Change:

```tsx
    const notes =
      notesByRegistrationKey[registrationKey]?.trim() ||
      "Baja municipal. Se libera cupo.";
```

to:

```tsx
    const notes =
      notesByRegistrationKey[registrationKey]?.trim() ||
      "Baja del gobierno. Se libera cupo.";
```

Change:

```tsx
            <strong>{item.isCancelled ? "Baja municipal" : "Activa"}</strong>
```

to:

```tsx
            <strong>{item.isCancelled ? "Baja del gobierno" : "Activa"}</strong>
```

Change:

```tsx
      subtitle="Selecciona una feria aprobada, revisa inscripciones activas y libera cupos con baja municipal."
```

to:

```tsx
      subtitle="Selecciona una feria aprobada, revisa inscripciones activas y libera cupos con baja del gobierno."
```

Change:

```tsx
                    <p className="eyebrow">Municipalidad</p>
                    <h2>Seleccionar feria aprobada</h2>
```

to:

```tsx
                    <p className="eyebrow">Gobierno de la Provincia de Salta</p>
                    <h2>Seleccionar feria aprobada</h2>
```

Change:

```tsx
                    <p className="eyebrow">Auditoria municipal</p>
```

to:

```tsx
                    <p className="eyebrow">Auditoria del gobierno</p>
```

- [ ] **Step 9: Verify no `municipality` text remains in the two renamed panels or `src/index.css`**

Run:

```bash
grep -in "municipal" src/components/GovernmentApprovalPanel.tsx src/components/GovernmentRegistrationsPanel.tsx src/index.css
```

Expected: no matches.

- [ ] **Step 10: Update `src/components/ProfileScopedDashboard.tsx`**

Change:

```ts
type DashboardMode = "entrepreneur" | "fair_organizer" | "municipality";
```

to:

```ts
type DashboardMode = "entrepreneur" | "fair_organizer" | "government";
```

Change (first occurrence, inside the `fair_organizer` mode block, section "Decisiones sobre mis ferias"):

```tsx
              <p className="eyebrow">Municipalidad</p>
              <h2>Decisiones sobre mis ferias</h2>
```

to:

```tsx
              <p className="eyebrow">Gobierno de la Provincia de Salta</p>
              <h2>Decisiones sobre mis ferias</h2>
```

Change:

```tsx
            <p className="empty-state">Todavia no hay decisiones municipales sobre tus ferias.</p>
```

to:

```tsx
            <p className="empty-state">Todavia no hay decisiones del gobierno sobre tus ferias.</p>
```

Change (second occurrence, inside the default/"all" mode block, section "Vista total del sistema"):

```tsx
            <p className="eyebrow">Municipalidad</p>
            <h2>Vista total del sistema</h2>
```

to:

```tsx
            <p className="eyebrow">Gobierno de la Provincia de Salta</p>
            <h2>Vista total del sistema</h2>
```

Change:

```tsx
          subtitle="Vista municipal completa de certificados emitidos."
```

to:

```tsx
          subtitle="Vista del gobierno completa de certificados emitidos."
```

- [ ] **Step 11: Update `src/components/RegisterAccountPanel.tsx`**

Change:

```tsx
                Registrate como emprendedor o feriante. La municipalidad se crea solo desde administracion.
```

to:

```tsx
                Registrate como emprendedor o feriante. El gobierno se crea solo desde administracion.
```

- [ ] **Step 12: Update `src/App.tsx`**

Change the imports:

```tsx
import { MunicipalityApprovalPanel } from "./components/MunicipalityApprovalPanel";
import { MunicipalityRegistrationsPanel } from "./components/MunicipalityRegistrationsPanel";
```

to:

```tsx
import { GovernmentApprovalPanel } from "./components/GovernmentApprovalPanel";
import { GovernmentRegistrationsPanel } from "./components/GovernmentRegistrationsPanel";
```

Change:

```tsx
type AppSection = "entrepreneur" | "fair_organizer" | "municipality" | "all";
```

to:

```tsx
type AppSection = "entrepreneur" | "fair_organizer" | "government" | "all";
```

Change:

```tsx
  if (role === "MUNICIPALITY" || activeSection === "all") {
```

to:

```tsx
  if (role === "GOVERNMENT" || activeSection === "all") {
```

Change:

```ts
function roleLabel(role: UserRole): string {
  if (role === "municipality") return "Municipalidad";
  if (role === "fair_organizer") return "Feriante";
  return "Emprendedor";
}

function getDefaultSectionForRol(role?: UserRole): AppSection {
  if (role === "municipality") return "municipality";
  if (role === "fair_organizer") return "fair_organizer";
  return "entrepreneur";
}
```

to:

```ts
function roleLabel(role: UserRole): string {
  if (role === "government") return "Gobierno";
  if (role === "fair_organizer") return "Feriante";
  return "Emprendedor";
}

function getDefaultSectionForRol(role?: UserRole): AppSection {
  if (role === "government") return "government";
  if (role === "fair_organizer") return "fair_organizer";
  return "entrepreneur";
}
```

Change:

```ts
    municipality_decision: "Decision municipal",
```

to:

```ts
    government_decision: "Decision del gobierno",
```

Change (demo login defaults and hero copy inside `LoginScreen`):

```tsx
  const [username, setUsuarioname] = useState("municipalidad");
  const [password, setContrasena] = useState("muni123");
```

to:

```tsx
  const [username, setUsuarioname] = useState("gobierno");
  const [password, setContrasena] = useState("gobierno123");
```

Change:

```tsx
              Flujo productivo para feriantes, emprendedores y municipalidad.
```

to:

```tsx
              Flujo productivo para feriantes, emprendedores y el gobierno provincial.
```

Change:

```tsx
                placeholder="municipalidad"
```

to:

```tsx
                placeholder="gobierno"
```

Change:

```tsx
              <button
                type="button"
                className="demo-user-button"
                onClick={() => fillDemoUsuario("municipalidad", "muni123")}
              >
                <span>Municipalidad</span>
                <code>municipalidad / muni123</code>
              </button>
```

to:

```tsx
              <button
                type="button"
                className="demo-user-button"
                onClick={() => fillDemoUsuario("gobierno", "gobierno123")}
              >
                <span>Gobierno</span>
                <code>gobierno / gobierno123</code>
              </button>
```

Change:

```ts
function canAccessSectionByRole(token: string | null, section: AppSection): boolean {
  const role = decodeTokenRole(token);

  if (role === "municipality") return true;
```

to:

```ts
function canAccessSectionByRole(token: string | null, section: AppSection): boolean {
  const role = decodeTokenRole(token);

  if (role === "government") return true;
```

Change:

```ts
        if (type === "municipality_decision") acc.decisions += 1;
```

to:

```ts
        if (type === "government_decision") acc.decisions += 1;
```

Change:

```ts
      ["municipality_decision", "fair_event_decision"].includes(
```

to:

```ts
      ["government_decision", "fair_event_decision"].includes(
```

Change the mode-toggle button:

```tsx
            <button
              type="button"
              className={activeSection === "municipality" ? "mode-active" : "ghost"}
              disabled={!canAccessSectionByRole(getAuthToken(), "municipality" as AppSection)} onClick={() => canAccessSectionByRole(getAuthToken(), "municipality" as AppSection) && setActiveSection("municipality" as AppSection)}
            >
              Municipalidad
            </button>
```

to:

```tsx
            <button
              type="button"
              className={activeSection === "government" ? "mode-active" : "ghost"}
              disabled={!canAccessSectionByRole(getAuthToken(), "government" as AppSection)} onClick={() => canAccessSectionByRole(getAuthToken(), "government" as AppSection) && setActiveSection("government" as AppSection)}
            >
              Gobierno
            </button>
```

Change the roadmap copy:

```tsx
              <div>
                <strong>4. Decision municipal</strong>
                <span>Municipalidad approves or rejects.</span>
              </div>
```

to:

```tsx
              <div>
                <strong>4. Decision del gobierno</strong>
                <span>Gobierno approves or rejects.</span>
              </div>
```

Change:

```tsx
  function renderMunicipalidadPanel() {
    return (
      <>
        <MunicipalityApprovalPanel
          token={getAuthToken()}
          entities={entities}
          onDecisionCreated={handleSyncFromBackend}
        />


        <MunicipalityRegistrationsPanel
          token={getAuthToken()}
          entities={entities}
          onCancelled={handleSyncFromBackend}
        />

        <ProfileScopedDashboard
          token={getAuthToken()}
          entities={entities}
          mode="municipality"
        />
```

to:

```tsx
  function renderGovernmentPanel() {
    return (
      <>
        <GovernmentApprovalPanel
          token={getAuthToken()}
          entities={entities}
          onDecisionCreated={handleSyncFromBackend}
        />


        <GovernmentRegistrationsPanel
          token={getAuthToken()}
          entities={entities}
          onCancelled={handleSyncFromBackend}
        />

        <ProfileScopedDashboard
          token={getAuthToken()}
          entities={entities}
          mode="government"
        />
```

Change:

```tsx
                <h2>municipality_decision / fair_event_decision</h2>
```

to:

```tsx
                <h2>government_decision / fair_event_decision</h2>
```

Change the final route's dashboard body:

```tsx
              {activeSection === "municipality" && renderMunicipalidadPanel()}
```

to:

```tsx
              {activeSection === "government" && renderGovernmentPanel()}
```

- [ ] **Step 13: Verify the frontend builds**

Run (from the repo root):

```bash
npm run build
```

Expected: `tsc -b && vite build` completes with no errors.

- [ ] **Step 14: Grep check for leftover municipality references in the frontend (excluding the Stellar-field exclusions)**

Run:

```bash
grep -rin "municipal" src --include="*.ts" --include="*.tsx" --include="*.css" | grep -v "municipalityPublicationFeeXlm\|municipalityReceiverPublicKey\|punatech26"
```

Expected: no matches (the excluded Stellar fields and the Arkiv tag are filtered out of this check on purpose — they're handled by Step 9's narrower check plus the exclusion rule, not touched here).

- [ ] **Step 15: Commit**

```bash
git add src/types/feria.ts src/services/feriaAssistant.ts src/services/backendApi.ts src/services/arkivService.ts src/lib/arkiv.ts src/components/StellarPaymentsPanel.tsx src/components/GovernmentApprovalPanel.tsx src/components/GovernmentRegistrationsPanel.tsx src/components/ProfileScopedDashboard.tsx src/components/RegisterAccountPanel.tsx src/index.css src/App.tsx
git status --short
```

Confirm `git status --short` no longer lists `MunicipalityApprovalPanel.tsx`/`MunicipalityRegistrationsPanel.tsx` as deleted-and-untracked-pair (they should show as renames, `R`, given the `git mv` in Step 7), then:

```bash
git commit -m "Rename municipality role, components, and CSS to government across frontend"
```

---

### Task 3: Remaining copy cleanup — FairOrganizerPanel labels, landing sponsor card, PunaTech/Hackathon branding

**Files:**
- Modify: `src/components/FairOrganizerPanel.tsx:24,114,159,166,300,319,328,399`
- Modify: `src/components/PublicLandingPage.tsx:16-20` (sponsor card), footer line (`© 2025 FerIA · PunaTech Hackathon · Arkiv Track`)
- Modify: `src/App.tsx:298,567` (the two `PunaTech Hackathon - Arkiv Track` eyebrows)
- Modify: `README.md:3,117`

**Interfaces:**
- Consumes: nothing from Task 1 or Task 2 (pure text, no shared types).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Update `src/components/FairOrganizerPanel.tsx`**

Change:

```ts
const initialForm: OrganizerFairForm = {
  name: "Feria Emprende Salta",
  description: "Feria creada por un feriante y enviada a aprobación municipal.",
```

to:

```ts
const initialForm: OrganizerFairForm = {
  name: "Feria Emprende Salta",
  description: "Feria creada por un feriante y enviada a aprobación del gobierno.",
```

Change:

```tsx
    if (!isOptionalValidStellarPublicKey(form.municipalityReceiverPublicKey)) {
      alert("La wallet de municipalidad debe ser una public key Stellar válida que empieza con G.");
      return;
    }
```

to:

```tsx
    if (!isOptionalValidStellarPublicKey(form.municipalityReceiverPublicKey)) {
      alert("La wallet del gobierno debe ser una public key Stellar válida que empieza con G.");
      return;
    }
```

Change:

```tsx
            <p className="eyebrow">Feriante</p>
            <h2>Crear feria para aprobación municipal</h2>
          </div>
          <span className="status-pill">Mapa editable</span>
        </div>

        <p className="empty-state">
          Cargá los datos de la feria, definí el monto de inscripción y la wallet
          Stellar que cobrará. La municipalidad debe aprobar la feria antes de que
          quede disponible para emprendedores.
        </p>
```

to:

```tsx
            <p className="eyebrow">Feriante</p>
            <h2>Crear feria para aprobación del gobierno</h2>
          </div>
          <span className="status-pill">Mapa editable</span>
        </div>

        <p className="empty-state">
          Cargá los datos de la feria, definí el monto de inscripción y la wallet
          Stellar que cobrará. El gobierno debe aprobar la feria antes de que
          quede disponible para emprendedores.
        </p>
```

Change:

```tsx
              placeholder="G... wallet del feriante. Si se deja vacío, cobra municipalidad."
```

to:

```tsx
              placeholder="G... wallet del feriante. Si se deja vacío, cobra el gobierno."
```

Change:

```tsx
            Wallet Stellar municipalidad
            <input
              value={form.municipalityReceiverPublicKey}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  municipalityReceiverPublicKey: event.target.value,
                }))
              }
              placeholder="G... wallet de municipalidad"
            />
```

to:

```tsx
            Wallet Stellar del gobierno
            <input
              value={form.municipalityReceiverPublicKey}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  municipalityReceiverPublicKey: event.target.value,
                }))
              }
              placeholder="G... wallet del gobierno"
            />
```

Change:

```tsx
            <p className="empty-state">
              Estado inicial: pending. La municipalidad debe aprobar la feria
              antes de que aparezca como feria disponible para emprendedores.
            </p>
```

to:

```tsx
            <p className="empty-state">
              Estado inicial: pending. El gobierno debe aprobar la feria
              antes de que aparezca como feria disponible para emprendedores.
            </p>
```

(The `form.municipalityPublicationFeeXlm`/`form.municipalityReceiverPublicKey` field names and the `OrganizerFairForm` type itself are untouched — excluded Stellar fields.)

- [ ] **Step 2: Update `src/components/PublicLandingPage.tsx`**

Change:

```tsx
const SPONSORS = [
  {
    id: "muni",
    name: "Municipalidad de Salta",
    category: "Gobierno Municipal",
    description: "Apoyo institucional al emprendedorismo local y gestión de ferias urbanas.",
    icon: "🏛️",
  },
```

to:

```tsx
const SPONSORS = [
  {
    id: "muni",
    name: "Gobierno de la Provincia de Salta",
    category: "Gobierno Provincial",
    description: "Apoyo institucional al emprendedorismo local y gestión de ferias en toda la provincia.",
    icon: "🏛️",
  },
```

Change the footer:

```tsx
          <p className="lv2-footer__copy">
            © 2025 FerIA · PunaTech Hackathon · Arkiv Track
          </p>
```

to:

```tsx
          <p className="lv2-footer__copy">
            © 2025 FerIA · Gobierno de la Provincia de Salta
          </p>
```

- [ ] **Step 3: Update `src/App.tsx`'s two branding eyebrows**

Change (inside `LoginScreen`):

```tsx
            <p className="eyebrow">PunaTech Hackathon - Arkiv Track</p>
```

to:

```tsx
            <p className="eyebrow">Gobierno de la Provincia de Salta</p>
```

Change (inside `renderHeader`, the dashboard header):

```tsx
          <p className="eyebrow">PunaTech Hackathon - Arkiv Track</p>
```

to:

```tsx
          <p className="eyebrow">Gobierno de la Provincia de Salta</p>
```

- [ ] **Step 4: Update `README.md`**

Change:

```md
> Sistema integral para emprendedores, organizadores y administración municipal
```

to:

```md
> Sistema integral para emprendedores, organizadores y el gobierno provincial
```

Change:

```md
Durante desarrollo, si no se configura ARKIV_PRIVATE_KEY, el sistema sigue funcionando con PostgreSQL y marca Arkiv como omitido. Para hackathon/demo con Braga, cargar una wallet con GLM del faucet.
```

to:

```md
Durante desarrollo, si no se configura ARKIV_PRIVATE_KEY, el sistema sigue funcionando con PostgreSQL y marca Arkiv como omitido. Para publicar en producción con Braga, cargar una wallet con GLM del faucet.
```

- [ ] **Step 5: Verify the frontend still builds**

Run (from the repo root):

```bash
npm run build
```

Expected: completes with no errors.

- [ ] **Step 6: Full-repo grep for both PunaTech/Hackathon and any leftover role text**

Run:

```bash
grep -rni "punatech\|hackathon" backend/src src README.md --include="*.ts" --include="*.tsx" --include="*.css" --include="*.md"
```

Expected: no matches.

Run:

```bash
grep -rn "MUNICIPALITY\|Municipalidad" backend/src src --include="*.ts" --include="*.tsx" | grep -v "municipalityPublicationFeeXlm\|municipalityReceiverPublicKey\|STELLAR_MUNICIPALITY_RECEIVER_PUBLIC_KEY"
```

Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add src/components/FairOrganizerPanel.tsx src/components/PublicLandingPage.tsx src/App.tsx README.md
git commit -m "Remove PunaTech/Hackathon branding and remaining municipality copy"
```

---

### Task 4: Manual verification end-to-end

**Files:** none (verification only).

**Interfaces:**
- Consumes: backend running on `http://localhost:4100` (with Task 1's migration applied and seeder re-run), frontend running on `http://localhost:5173`; the new demo credentials `gobierno` / `gobierno123` from Task 1's Step 4.

- [ ] **Step 1: Confirm backend and frontend are running with the new code**

If the dev servers from a previous session are still running the pre-rename code, restart them so the rename takes effect:

```bash
pkill -f "tsx watch src/server.ts" || true
pkill -f "node_modules/.bin/vite" || true
```

Then, from `backend/`:

```bash
npm run dev > /tmp/backend.log 2>&1 &
```

And from the repo root:

```bash
npm run dev > /tmp/frontend.log 2>&1 &
```

Poll until both respond:

```bash
timeout 30 bash -c 'until curl -sf http://localhost:4100/health >/dev/null; do sleep 1; done'
timeout 30 bash -c 'until curl -sf http://localhost:5173/ >/dev/null; do sleep 1; done'
```

- [ ] **Step 2: Log in as the renamed demo user and verify the panel**

Using a browser driver (Playwright, since `chromium-cli` is not installed in this environment — write a small script the same way as the prior login-routing feature's Task 4 did):

- Navigate to `http://localhost:5173/login`.
- Fill in `gobierno` / `gobierno123` (or click the "Gobierno" demo-user autofill button) and submit.
- Verify the URL returns to `http://localhost:5173/` and the dashboard shows the "Gobierno" mode-toggle button active, with the approval panel (`GovernmentApprovalPanel`) rendering pending/approved/rejected fair tabs correctly (same behavior as the old Municipality panel).
- Screenshot.

- [ ] **Step 3: Verify no visible "Municipalidad"/"PunaTech"/"Hackathon" text remains**

With the same session, visit each dashboard mode (Emprendedor, Feriante, Gobierno, Ver todo) and the public landing page (log out first to see it), taking a screenshot of each. Confirm none of them show "Municipalidad", "PunaTech", or "Hackathon" anywhere, and that the landing's Sponsors section shows "Gobierno de la Provincia de Salta" instead of the old municipality card.

- [ ] **Step 4: Report results**

Summarize pass/fail for each step above, list screenshot paths, and note any console errors encountered (unrelated pre-existing issues, like the previously-known missing `feria_stellar_payments` table 500, are not blockers for this plan — note them but don't treat them as failures).
