import type {
  AuthUser,
  FairMapEvent,
  LocalArkivEntity,
  UserRole,
} from "../types/feria";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4100/api";

const TOKEN_STORAGE_KEY = "feria_backend_token";

export type BackendRole = "ENTREPRENEUR" | "FAIR_ORGANIZER" | "MUNICIPALITY";

export type BackendUser = {
  id: string;
  username: string;
  fullName: string;
  document: string;
  role: BackendRole;
};

export type BackendLoginResponse = {
  ok: boolean;
  token: string;
  user: BackendUser;
};

export type BackendFairCreateResponse = {
  ok: boolean;
  fair: {
    ok: boolean;
    entityKey: string;
    txHash?: string;
  };
};

export type BackendFairDecisionResponse = {
  ok: boolean;
  decision: {
    ok: boolean;
    entityKey: string;
    txHash?: string;
  };
};

export function mapBackendRoleToUserRole(role: BackendRole): UserRole {
  if (role === "MUNICIPALITY") return "municipality";
  if (role === "FAIR_ORGANIZER") return "fair_organizer";
  return "entrepreneur";
}

export function mapBackendUserToAuthUser(user: BackendUser): AuthUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    documentNumber: user.document,
    role: mapBackendRoleToUserRole(user.role),
    createdAt: Date.now(),
  };
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function storeAuthToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function requestJson<TResponse>(params: {
  path: string;
  method?: "GET" | "POST";
  token?: string | null;
  body?: unknown;
}): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${params.path}`, {
    method: params.method ?? "GET",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(params.token
        ? {
            Authorization: `Bearer ${params.token}`,
          }
        : {}),
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `HTTP error ${response.status}`;

    throw new Error(message);
  }

  return data as TResponse;
}

export async function backendLogin(params: {
  username: string;
  password: string;
}): Promise<{
  token: string;
  user: AuthUser;
}> {
  const data = await requestJson<BackendLoginResponse>({
    path: "/auth/login",
    method: "POST",
    body: params,
  });

  return {
    token: data.token,
    user: mapBackendUserToAuthUser(data.user),
  };
}

function getEntityKey(raw: Record<string, unknown>): string {
  return String(
    raw.entityKey ??
      raw.key ??
      raw.id ??
      `backend_entity_${crypto.randomUUID()}`
  );
}

function getEntityAttributes(
  raw: Record<string, unknown>
): Array<{ key: string; value: string | number }> {
  if (Array.isArray(raw.attributes)) {
    return raw.attributes
      .map((item) => {
        if (item && typeof item === "object") {
          const attr = item as Record<string, unknown>;

          return {
            key: String(attr.key ?? ""),
            value:
              typeof attr.value === "number"
                ? attr.value
                : String(attr.value ?? ""),
          };
        }

        return null;
      })
      .filter(Boolean) as Array<{ key: string; value: string | number }>;
  }

  return [];
}

function getPayloadCreatedAt(raw: Record<string, unknown>): number | null {
  const payload =
    raw.payload && typeof raw.payload === "object"
      ? (raw.payload as Record<string, unknown>)
      : {};

  for (const key of ["createdAt", "decidedAt", "issuedAt"]) {
    const value = payload[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function getCreatedAt(
  raw: Record<string, unknown>,
  attributes: Array<{ key: string; value: string | number }>
): number {
  if (typeof raw.createdAt === "number") {
    return raw.createdAt;
  }

  const payloadCreatedAt = getPayloadCreatedAt(raw);
  if (payloadCreatedAt !== null) return payloadCreatedAt;

  const attr = attributes.find((item) =>
    ["createdAt", "decidedAt", "issuedAt"].includes(item.key)
  )?.value;

  if (typeof attr === "number") {
    return attr;
  }

  if (typeof attr === "string") {
    const parsed = Number(attr);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

function normalizeBackendArkivEntity(rawEntity: unknown): LocalArkivEntity<unknown> {
  const raw =
    rawEntity && typeof rawEntity === "object"
      ? (rawEntity as Record<string, unknown>)
      : {};

  const attributes = getEntityAttributes(raw);

  return {
    entityKey: getEntityKey(raw),
    txHash: typeof raw.txHash === "string" ? raw.txHash : undefined,
    payload: raw.payload ?? {},
    contentType: "application/json",
    attributes,
    expiresIn: typeof raw.expiresIn === "number" ? raw.expiresIn : 0,
    createdAt: getCreatedAt(raw, attributes),
    source: "arkiv_real",
  };
}

export async function backendListArkivEntities(
  token: string
): Promise<LocalArkivEntity<unknown>[]> {
  const data = await requestJson<{
    ok: boolean;
    entities: unknown[];
  }>({
    path: "/arkiv/entities",
    token,
  });

  return data.entities
    .map(normalizeBackendArkivEntity)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function backendCreateFair(params: {
  token: string;
  fair: Pick<
    FairMapEvent,
    | "name"
    | "description"
    | "address"
    | "city"
    | "category"
    | "startDate"
    | "endDate"
    | "availableSlots"
    | "latitude"
    | "longitude"
  >;
}): Promise<BackendFairCreateResponse["fair"]> {
  const data = await requestJson<BackendFairCreateResponse>({
    path: "/fairs",
    method: "POST",
    token: params.token,
    body: params.fair,
  });

  return data.fair;
}

export async function backendCreateFairDecision(params: {
  token: string;
  fairKey: string;
  fairName: string;
  fairAddress: string;
  fairCategory: string;
  fairCity: string;
  decision: "approved" | "rejected";
  notes: string;
}): Promise<BackendFairDecisionResponse["decision"]> {
  const data = await requestJson<BackendFairDecisionResponse>({
    path: "/fairs/decision",
    method: "POST",
    token: params.token,
    body: {
      fairKey: params.fairKey,
      fairName: params.fairName,
      fairAddress: params.fairAddress,
      fairCategory: params.fairCategory,
      fairCity: params.fairCity,
      decision: params.decision,
      notes: params.notes,
    },
  });

  return data.decision;
}
export type BackendFairRegistrationResponse = {
  ok: boolean;
  registration: {
    ok: boolean;
    entityKey: string;
    txHash?: string;
  };
  certificate: {
    ok: boolean;
    entityKey: string;
    txHash?: string;
    certificateNumber: string;
  };
  remainingSlots: number;
};

export async function backendCreateFairRegistration(params: {
  token: string;
  formData: FormData;
}): Promise<BackendFairRegistrationResponse> {
  const response = await fetch(`${API_BASE_URL}/fair-registrations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
    },
    body: params.formData,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `HTTP error ${response.status}`;

    throw new Error(message);
  }

  return data as BackendFairRegistrationResponse;
}

export async function backendCancelFairRegistration(params: {
  token: string;
  fairKey: string;
  registrationKey: string;
  notes: string;
}) {
  return requestJson<{
    ok: boolean;
    cancellation: {
      ok: boolean;
      entityKey: string;
      txHash?: string;
    };
  }>({
    path: "/fair-registrations/cancel",
    method: "POST",
    token: params.token,
    body: {
      fairKey: params.fairKey,
      registrationKey: params.registrationKey,
      notes: params.notes,
    },
  });
}

export type RegisterAccountRole = "entrepreneur" | "fair_organizer";

export type RegisterAccountInput = {
  username: string;
  password: string;
  fullName: string;
  document: string;
  role: RegisterAccountRole;
};

export type RegisterAccountResponse = {
  ok: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    fullName: string;
    document: string;
    role: RegisterAccountRole;
    isActive: boolean;
    createdAt: string;
  };
  message?: string;
};

function getPublicBackendBaseUrl(): string {
  const envValue =
    import.meta.env.VITE_BACKEND_URL ??
    import.meta.env.VITE_API_URL ??
    "http://localhost:4100";

  return String(envValue).replace(/\/$/, "");
}

export async function backendRegisterAccount(
  input: RegisterAccountInput
): Promise<RegisterAccountResponse> {
  const response = await fetch(`${getPublicBackendBaseUrl()}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as RegisterAccountResponse;

  if (!response.ok) {
    return {
      ok: false,
      message: data.message ?? "No se pudo registrar la cuenta.",
    };
  }

  return data;
}
export type StellarPaymentStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "EXPIRED";

export type StellarPayment = {
  id: string;
  registrationKey?: string | null;
  fairKey?: string | null;
  userUsername?: string;
  userDocument?: string;
  amountXlm: string;
  assetCode: string;
  network: string;
  receiverPublicKey: string;
  sourcePublicKey?: string | null;
  memo: string;
  txHash?: string | null;
  status: StellarPaymentStatus;
  createdAt?: string;
  confirmedAt?: string | null;
};

export async function backendCreateStellarPaymentIntent(params: {
  token: string;
  registrationKey?: string;
  fairKey?: string;
}): Promise<StellarPayment> {
  const data = await requestJson<{
    ok: boolean;
    payment: StellarPayment;
  }>({
    path: "/stellar/payments/intents",
    method: "POST",
    token: params.token,
    body: {
      registrationKey: params.registrationKey,
      fairKey: params.fairKey,
    },
  });

  return data.payment;
}

export async function backendVerifyStellarPayment(params: {
  token: string;
  paymentIntentId: string;
  txHash: string;
}): Promise<StellarPayment> {
  const data = await requestJson<{
    ok: boolean;
    payment: StellarPayment;
  }>({
    path: "/stellar/payments/verify",
    method: "POST",
    token: params.token,
    body: {
      paymentIntentId: params.paymentIntentId,
      txHash: params.txHash,
    },
  });

  return data.payment;
}

export async function backendListStellarPayments(params: {
  token: string;
}): Promise<StellarPayment[]> {
  const data = await requestJson<{
    ok: boolean;
    payments: StellarPayment[];
  }>({
    path: "/stellar/payments",
    method: "GET",
    token: params.token,
  });

  return data.payments;
}
