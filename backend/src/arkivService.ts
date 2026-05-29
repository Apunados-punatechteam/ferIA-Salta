import { createPublicClient, createWalletClient, http } from "@arkiv-network/sdk";
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts";
import { braga } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { jsonToPayload } from "@arkiv-network/sdk/utils";
import { env } from "./env.js";

export const PROJECT_ATTRIBUTE = {
  key: env.ARKIV_PROJECT_ATTRIBUTE_KEY,
  value: env.ARKIV_PROJECT_ATTRIBUTE_VALUE,
} as const;

export const ENTITY_TYPES = {
  FAIR_EVENT: "fair_event",
  FAIR_EVENT_DECISION: "fair_event_decision",
  FAIR_REGISTRATION: "fair_registration",
  FAIR_REGISTRATION_CANCELLATION: "fair_registration_cancellation",
  FAIR_CERTIFICATE: "fair_certificate",
  MUNICIPALITY_DECISION: "municipality_decision",
} as const;

const publicClient = createPublicClient({
  chain: braga,
  transport: http(),
});

function getWalletClient() {
  return createWalletClient({
    chain: braga,
    transport: http(),
    account: privateKeyToAccount(env.ARKIV_PRIVATE_KEY as `0x${string}`),
  });
}

export type ArkivAttribute = {
  key: string;
  value: string | number;
};

export async function createArkivJsonEntity<TPayload extends object>(params: {
  payload: TPayload;
  attributes: ArkivAttribute[];
  expiresIn: number;
}) {
  const walletClient = getWalletClient();

  const created = await walletClient.createEntity({
    payload: jsonToPayload(params.payload),
    contentType: "application/json",
    attributes: [PROJECT_ATTRIBUTE, ...params.attributes],
    expiresIn: params.expiresIn,
  });

  return {
    ok: true,
    entityKey: created.entityKey,
    txHash: created.txHash,
  };
}

function extractEntities(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;

  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;

    for (const key of ["entities", "items", "data", "results", "records", "rows"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }

    if (obj.result && typeof obj.result === "object") {
      const nested = obj.result as Record<string, unknown>;

      for (const key of ["entities", "items", "data", "results", "records", "rows"]) {
        if (Array.isArray(nested[key])) return nested[key] as unknown[];
      }
    }
  }

  return [];
}

function decodeNumericPayloadObject(payload: Record<string, unknown>): unknown {
  const numericKeys = Object.keys(payload).filter((key) => /^\d+$/.test(key));

  if (numericKeys.length === 0) return payload;

  const bytes = numericKeys
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => Number(payload[key]));

  if (bytes.some((value) => !Number.isFinite(value))) return payload;

  try {
    const text = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
    return JSON.parse(text);
  } catch {
    return payload;
  }
}

function normalizePayload(payload: unknown): unknown {
  if (!payload) return {};

  if (payload instanceof Uint8Array) {
    try {
      const text = new TextDecoder("utf-8").decode(payload);
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  if (Array.isArray(payload)) {
    try {
      const bytes = payload.map((item) => Number(item));
      const text = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
      return JSON.parse(text);
    } catch {
      return payload;
    }
  }

  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }

  if (typeof payload === "object") {
    return decodeNumericPayloadObject(payload as Record<string, unknown>);
  }

  return payload;
}

function normalizeEntity(rawEntity: unknown): Record<string, unknown> {
  const entity =
    rawEntity && typeof rawEntity === "object"
      ? (rawEntity as Record<string, unknown>)
      : {};

  return {
    ...entity,
    entityKey: entity.entityKey ?? entity.key ?? entity.id,
    payload: normalizePayload(entity.payload),
  };
}

export async function listProjectEntities() {
  const result = await publicClient
    .buildQuery()
    .where(eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value))
    .withAttributes(true)
    .withPayload(true)
    .limit(500)
    .fetch();

  return extractEntities(result).map(normalizeEntity);
}

export async function createFairEvent(params: {
  name: string;
  description: string;
  address: string;
  city: string;
  category: string;
  startDate: string;
  endDate: string;
  availableSlots: number;
  latitude: number;
  longitude: number;
  createdByName: string;
  createdByDocument: string;
}) {
  const createdAt = Date.now();

  const payload = {
    name: params.name,
    description: params.description,
    address: params.address,
    city: params.city,
    category: params.category,
    startDate: params.startDate,
    endDate: params.endDate,
    availableSlots: params.availableSlots,
    latitude: params.latitude,
    longitude: params.longitude,
    status: "pending",
    createdByRole: "fair_organizer",
    createdByName: params.createdByName,
    createdByDocument: params.createdByDocument,
    createdAt,
  };

  return createArkivJsonEntity({
    payload,
    expiresIn: 60 * 60 * 24 * 120,
    attributes: [
      { key: "entityType", value: ENTITY_TYPES.FAIR_EVENT },
      { key: "status", value: "pending" },
      { key: "createdByRole", value: "fair_organizer" },
      { key: "createdByDocument", value: params.createdByDocument },
      { key: "category", value: params.category },
      { key: "city", value: params.city },
      { key: "createdAt", value: createdAt },
    ],
  });
}

export async function createFairEventDecision(params: {
  fairKey: string;
  fairName: string;
  fairAddress: string;
  fairCategory: string;
  fairCity: string;
  decision: "approved" | "rejected";
  notes: string;
  decidedByName: string;
  decidedByDocument: string;
}) {
  const decidedAt = Date.now();

  const payload = {
    fairKey: params.fairKey,
    fairName: params.fairName,
    fairAddress: params.fairAddress,
    fairCategory: params.fairCategory,
    fairCity: params.fairCity,
    decision: params.decision,
    notes: params.notes,
    decidedByRole: "municipality",
    decidedByName: params.decidedByName,
    decidedByDocument: params.decidedByDocument,
    decidedAt,
  };

  return createArkivJsonEntity({
    payload,
    expiresIn: 60 * 60 * 24 * 365,
    attributes: [
      { key: "entityType", value: ENTITY_TYPES.FAIR_EVENT_DECISION },
      { key: "fairKey", value: params.fairKey },
      { key: "decision", value: params.decision },
      { key: "status", value: params.decision },
      { key: "decidedByRole", value: "municipality" },
      { key: "decidedByDocument", value: params.decidedByDocument },
      { key: "decidedAt", value: decidedAt },
    ],
  });
}

export async function createFairRegistration(params: {
  fairKey: string;
  fairName: string;
  fairAddress: string;
  fairCategory: string;
  entrepreneurName: string;
  entrepreneurDocument: string;
  businessName: string;
  phone: string;
  description: string;
  standPhotoUrl: string;
  articlePhotoUrls: string[];
}) {
  const registeredAt = Date.now();

  const payload = {
    fairKey: params.fairKey,
    fairName: params.fairName,
    fairAddress: params.fairAddress,
    fairCategory: params.fairCategory,
    entrepreneurName: params.entrepreneurName,
    entrepreneurDocument: params.entrepreneurDocument,
    businessName: params.businessName,
    phone: params.phone,
    description: params.description,
    standPhotoUrl: params.standPhotoUrl,
    articlePhotoUrls: params.articlePhotoUrls,
    status: "active",
    registeredAt,
  };

  return createArkivJsonEntity({
    payload,
    expiresIn: 60 * 60 * 24 * 180,
    attributes: [
      { key: "entityType", value: ENTITY_TYPES.FAIR_REGISTRATION },
      { key: "fairKey", value: params.fairKey },
      { key: "status", value: "active" },
      { key: "entrepreneurDocument", value: params.entrepreneurDocument },
      { key: "registeredAt", value: registeredAt },
    ],
  });
}

export async function createFairCertificate(params: {
  fairKey: string;
  registrationKey: string;
  fairName: string;
  entrepreneurName: string;
  entrepreneurDocument: string;
  businessName: string;
}) {
  const issuedAt = Date.now();
  const certificateNumber = `FERIA-${new Date().getFullYear()}-${String(
    Math.floor(Math.random() * 900000) + 100000
  )}`;

  const payload = {
    certificateNumber,
    fairKey: params.fairKey,
    registrationKey: params.registrationKey,
    fairName: params.fairName,
    entrepreneurName: params.entrepreneurName,
    entrepreneurDocument: params.entrepreneurDocument,
    businessName: params.businessName,
    status: "issued",
    issuedAt,
  };

  const created = await createArkivJsonEntity({
    payload,
    expiresIn: 60 * 60 * 24 * 365,
    attributes: [
      { key: "entityType", value: ENTITY_TYPES.FAIR_CERTIFICATE },
      { key: "fairKey", value: params.fairKey },
      { key: "registrationKey", value: params.registrationKey },
      { key: "certificateNumber", value: certificateNumber },
      { key: "status", value: "issued" },
      { key: "issuedAt", value: issuedAt },
    ],
  });

  return {
    ...created,
    certificateNumber,
  };
}

export async function createFairRegistrationCancellation(params: {
  fairKey: string;
  registrationKey: string;
  notes: string;
  cancelledByName: string;
  cancelledByDocument: string;
}) {
  const cancelledAt = Date.now();

  const payload = {
    fairKey: params.fairKey,
    registrationKey: params.registrationKey,
    notes: params.notes,
    status: "cancelled",
    cancelledByRole: "municipality",
    cancelledByName: params.cancelledByName,
    cancelledByDocument: params.cancelledByDocument,
    cancelledAt,
  };

  return createArkivJsonEntity({
    payload,
    expiresIn: 60 * 60 * 24 * 365,
    attributes: [
      { key: "entityType", value: ENTITY_TYPES.FAIR_REGISTRATION_CANCELLATION },
      { key: "fairKey", value: params.fairKey },
      { key: "registrationKey", value: params.registrationKey },
      { key: "status", value: "cancelled" },
      { key: "cancelledAt", value: cancelledAt },
    ],
  });
}