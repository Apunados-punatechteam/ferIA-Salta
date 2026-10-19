import type { FastifyInstance } from "fastify";
import { listEntities } from "../entityStore.js";

type EntityAttribute = {
  key?: string;
  value?: unknown;
};

type EntityRecord = {
  entityKey?: string;
  payload?: unknown;
  attributes?: EntityAttribute[];
};

type PublicEntrepreneur = {
  registrationKey: string;
  entrepreneurName: string;
  businessName: string;
  category: string;
  phone: string;
  email: string;
  status: string;
};

type PublicFair = {
  fairKey: string;
  fairName: string;
  description: string;
  locationName: string;
  address: string;
  dateLabel: string;
  latitude: number | null;
  longitude: number | null;
  approved: boolean;
  availableSlots: number | null;
  totalSlots: number | null;
  registeredCount: number;
  entrepreneurs: PublicEntrepreneur[];
};

function asEntities(value: unknown): EntityRecord[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is EntityRecord => {
    return Boolean(item && typeof item === "object");
  });
}

function getPayloadObject(entity: EntityRecord): Record<string, unknown> {
  if (entity.payload && typeof entity.payload === "object") {
    return entity.payload as Record<string, unknown>;
  }

  return {};
}

function getAttr(entity: EntityRecord, key: string): unknown {
  return entity.attributes?.find((item) => item.key === key)?.value;
}

function getText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return "";
}

function getBool(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (["true", "1", "yes", "si", "sí", "aprobada", "approved"].includes(normalized)) {
        return true;
      }

      if (["false", "0", "no", "rechazada", "rejected"].includes(normalized)) {
        return false;
      }
    }

    if (typeof value === "number") return value !== 0;
  }

  return null;
}

function getNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(",", "."));

      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function getEntityType(entity: EntityRecord): string {
  const payload = getPayloadObject(entity);

  return getText(
    getAttr(entity, "entityType"),
    payload.entityType,
    payload.type,
    payload.kind
  ).toLowerCase();
}

function getApprovedFairKeys(entities: EntityRecord[]): Set<string> {
  const latestByFair = new Map<string, { decision: string; decidedAt: number }>();

  for (const entity of entities) {
    if (getEntityType(entity) !== "fair_event_decision") continue;

    const payload = getPayloadObject(entity);
    const fairKey = getText(payload.fairKey, getAttr(entity, "fairKey"));
    const decidedAt = getNumber(payload.decidedAt) ?? 0;
    const current = latestByFair.get(fairKey);

    if (fairKey && (!current || decidedAt >= current.decidedAt)) {
      latestByFair.set(fairKey, {
        decision: getText(payload.decision, getAttr(entity, "decision")),
        decidedAt,
      });
    }
  }

  return new Set(
    [...latestByFair.entries()]
      .filter(([, value]) => value.decision === "approved")
      .map(([fairKey]) => fairKey)
  );
}

function getCancelledRegistrationKeys(entities: EntityRecord[]): Set<string> {
  const keys = new Set<string>();

  for (const entity of entities) {
    if (getEntityType(entity) !== "fair_registration_cancellation") continue;

    const key = getText(getPayloadObject(entity).registrationKey);
    if (key) keys.add(key);
  }

  return keys;
}

function buildEntrepreneur(registration: EntityRecord): PublicEntrepreneur {
  const payload = getPayloadObject(registration);

  return {
    registrationKey: getText(registration.entityKey, payload.registrationKey, payload.id),
    entrepreneurName: getText(
      payload.entrepreneurName,
      payload.fullName,
      payload.personName,
      payload.name,
      payload.ownerName
    ),
    businessName: getText(
      payload.businessName,
      payload.ventureName,
      payload.standName,
      payload.tradeName
    ),
    category: getText(
      payload.category,
      payload.categoryName,
      payload.rubro
    ),
    phone: getText(payload.phone, payload.contactPhone, payload.telephone),
    email: getText(payload.email, payload.contactEmail),
    status: getText(payload.status, getAttr(registration, "status")),
  };
}

function buildFair(entity: EntityRecord, registrations: EntityRecord[]): PublicFair {
  const payload = getPayloadObject(entity);

  const fairKey = getText(
    entity.entityKey,
    payload.fairKey,
    payload.id
  );

  const fairRegistrations = registrations.filter((registration) => {
    const rPayload = getPayloadObject(registration);

    const linkedFairKey = getText(
      rPayload.fairKey,
      rPayload.fairId,
      getAttr(registration, "fairKey"),
      getAttr(registration, "fairId")
    );

    return linkedFairKey === fairKey;
  });

  const entrepreneurs = fairRegistrations.map(buildEntrepreneur);
  const totalSlots = getNumber(
    payload.availableSlots,
    payload.totalSlots,
    payload.capacity,
    payload.slots
  );

  return {
    fairKey,
    fairName: getText(
      payload.fairName,
      payload.name,
      payload.title,
      "Feria sin nombre"
    ),
    description: getText(
      payload.description,
      payload.summary
    ),
    locationName: getText(
      payload.locationName,
      payload.placeName,
      payload.location
    ),
    address: getText(
      payload.address,
      payload.streetAddress
    ),
    dateLabel: getText(
      payload.dateLabel,
      payload.scheduledAt,
      payload.startDate,
      payload.date
    ),
    latitude: getNumber(
      payload.latitude,
      payload.lat,
      getAttr(entity, "latitude"),
      getAttr(entity, "lat")
    ),
    longitude: getNumber(
      payload.longitude,
      payload.lng,
      payload.lon,
      getAttr(entity, "longitude"),
      getAttr(entity, "lng"),
      getAttr(entity, "lon")
    ),
    approved: true,
    availableSlots:
      totalSlots === null ? null : Math.max(totalSlots - entrepreneurs.length, 0),
    totalSlots,
    registeredCount: entrepreneurs.length,
    entrepreneurs,
  };
}

export async function publicFairsRoutes(app: FastifyInstance) {
  app.get("/public/fairs/approved", async (request, reply) => {
    try {
      const rawEntities = asEntities(await listEntities());

      const approvedFairKeys = getApprovedFairKeys(rawEntities);
      const cancelledKeys = getCancelledRegistrationKeys(rawEntities);

      const fairs = rawEntities.filter(
        (entity) =>
          getEntityType(entity) === "fair_event" &&
          approvedFairKeys.has(getText(entity.entityKey))
      );
      const registrations = rawEntities.filter(
        (entity) =>
          getEntityType(entity) === "fair_registration" &&
          !cancelledKeys.has(getText(entity.entityKey))
      );

      const result = fairs
        .map((fair) => buildFair(fair, registrations))
        .filter((fair) => fair.fairKey)
        .sort((a, b) => a.fairName.localeCompare(b.fairName, "es"));

      return {
        ok: true,
        source: "database",
        warning: null,
        fairs: result,
      };
    } catch (error) {
      request.log.error(
        {
          error,
        },
        "Public fairs endpoint failed"
      );

      reply.header("X-Public-Fairs-Degraded", "true");

      return {
        ok: true,
        source: "empty",
        warning: "No se pudieron cargar las ferias públicas en este momento.",
        fairs: [],
      };
    }
  });
}
