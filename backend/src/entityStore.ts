import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const ENTITY_TYPES = {
  FAIR_EVENT: "fair_event",
  FAIR_EVENT_DECISION: "fair_event_decision",
  FAIR_REGISTRATION: "fair_registration",
  FAIR_REGISTRATION_CANCELLATION: "fair_registration_cancellation",
  FAIR_CERTIFICATE: "fair_certificate",
} as const;

export type EntityAttribute = {
  key: string;
  value: string | number;
};

export type StoredEntity = {
  entityKey: string;
  payload: Record<string, unknown>;
  attributes: EntityAttribute[];
  createdAt: number;
};

function toStoredEntity(row: {
  id: string;
  payload: Prisma.JsonValue;
  attributes: Prisma.JsonValue;
  createdAt: Date;
}): StoredEntity {
  return {
    entityKey: row.id,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    attributes: Array.isArray(row.attributes)
      ? (row.attributes as EntityAttribute[])
      : [],
    createdAt: row.createdAt.getTime(),
  };
}

export async function createEntity(params: {
  entityType: string;
  payload: object;
  attributes: EntityAttribute[];
  fixedId?: string;
}) {
  const created = await prisma.fairEntity.create({
    data: {
      id: params.fixedId ?? randomUUID(),
      entityType: params.entityType,
      payload: params.payload as Prisma.InputJsonValue,
      attributes: [
        { key: "entityType", value: params.entityType },
        ...params.attributes.filter((item) => item.key !== "entityType"),
      ],
    },
  });

  return {
    ok: true,
    entityKey: created.id,
  };
}

export async function listEntities(): Promise<StoredEntity[]> {
  const rows = await prisma.fairEntity.findMany({
    orderBy: { createdAt: "asc" },
  });

  return rows.map(toStoredEntity);
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
  createdByRole: "FAIR_ORGANIZER" | "GOVERNMENT";
  createdByName: string;
  createdByDocument: string;
}) {
  const createdAt = Date.now();

  return createEntity({
    entityType: ENTITY_TYPES.FAIR_EVENT,
    payload: {
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
      createdByRole: params.createdByRole,
      createdByName: params.createdByName,
      createdByDocument: params.createdByDocument,
      createdAt,
    },
    attributes: [
      { key: "status", value: "pending" },
      { key: "createdByRole", value: params.createdByRole },
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

  return createEntity({
    entityType: ENTITY_TYPES.FAIR_EVENT_DECISION,
    payload: {
      fairKey: params.fairKey,
      fairName: params.fairName,
      fairAddress: params.fairAddress,
      fairCategory: params.fairCategory,
      fairCity: params.fairCity,
      decision: params.decision,
      notes: params.notes,
      decidedByRole: "government",
      decidedByName: params.decidedByName,
      decidedByDocument: params.decidedByDocument,
      decidedAt,
    },
    attributes: [
      { key: "fairKey", value: params.fairKey },
      { key: "decision", value: params.decision },
      { key: "status", value: params.decision },
      { key: "decidedByRole", value: "government" },
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

  return createEntity({
    entityType: ENTITY_TYPES.FAIR_REGISTRATION,
    payload: {
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
    },
    attributes: [
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

  const created = await createEntity({
    entityType: ENTITY_TYPES.FAIR_CERTIFICATE,
    payload: {
      certificateNumber,
      fairKey: params.fairKey,
      registrationKey: params.registrationKey,
      fairName: params.fairName,
      entrepreneurName: params.entrepreneurName,
      entrepreneurDocument: params.entrepreneurDocument,
      businessName: params.businessName,
      status: "issued",
      issuedAt,
    },
    attributes: [
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

  return createEntity({
    entityType: ENTITY_TYPES.FAIR_REGISTRATION_CANCELLATION,
    payload: {
      fairKey: params.fairKey,
      registrationKey: params.registrationKey,
      notes: params.notes,
      status: "cancelled",
      cancelledByRole: "government",
      cancelledByName: params.cancelledByName,
      cancelledByDocument: params.cancelledByDocument,
      cancelledAt,
    },
    attributes: [
      { key: "fairKey", value: params.fairKey },
      { key: "registrationKey", value: params.registrationKey },
      { key: "status", value: "cancelled" },
      { key: "cancelledAt", value: cancelledAt },
    ],
  });
}

export async function getFairEvent(id: string) {
  const row = await prisma.fairEntity.findUnique({ where: { id } });

  if (!row || row.entityType !== ENTITY_TYPES.FAIR_EVENT) return null;

  return toStoredEntity(row);
}

export async function updateFairEvent(
  id: string,
  data: {
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
  }
) {
  const current = await getFairEvent(id);

  if (!current) return null;

  const attributes = current.attributes.map((item) =>
    item.key === "category"
      ? { ...item, value: data.category }
      : item.key === "city"
        ? { ...item, value: data.city }
        : item
  );

  const updated = await prisma.fairEntity.update({
    where: { id },
    data: {
      payload: { ...current.payload, ...data } as Prisma.InputJsonValue,
      attributes: attributes as Prisma.InputJsonValue,
    },
  });

  return toStoredEntity(updated);
}

// Borra la feria y todo lo que depende de ella (decisiones, inscripciones, cancelaciones y certificados).
export async function deleteFairEvent(id: string) {
  const rows = await prisma.fairEntity.findMany({
    where: { entityType: { not: ENTITY_TYPES.FAIR_EVENT } },
  });

  const relatedIds = rows
    .filter((row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      return payload.fairKey === id;
    })
    .map((row) => row.id);

  await prisma.fairEntity.deleteMany({
    where: { id: { in: [id, ...relatedIds] } },
  });

  return { deletedRelated: relatedIds.length };
}

// Una feria está aprobada si su última decisión de gobierno es "approved".
export async function isFairApproved(id: string) {
  const rows = await prisma.fairEntity.findMany({
    where: { entityType: ENTITY_TYPES.FAIR_EVENT_DECISION },
  });

  const decisions = rows
    .map((row) => row.payload as Record<string, unknown>)
    .filter((payload) => payload.fairKey === id)
    .sort((a, b) => Number(b.decidedAt ?? 0) - Number(a.decidedAt ?? 0));

  return decisions[0]?.decision === "approved";
}
