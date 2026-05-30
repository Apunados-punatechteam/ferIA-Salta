import type { FastifyInstance } from "fastify";
import { getProjectEntitiesCached } from "../arkivCache.js";

type ArkivAttribute = {
  key?: string;
  value?: unknown;
};

type ArkivEntity = {
  entityKey?: string;
  payload?: unknown;
  attributes?: ArkivAttribute[];
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

function asArkivEntities(value: unknown): ArkivEntity[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is ArkivEntity => {
    return Boolean(item && typeof item === "object");
  });
}

function getPayloadObject(entity: ArkivEntity): Record<string, unknown> {
  if (entity.payload && typeof entity.payload === "object") {
    return entity.payload as Record<string, unknown>;
  }

  return {};
}

function getAttr(entity: ArkivEntity, key: string): unknown {
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

function getEntityType(entity: ArkivEntity): string {
  const payload = getPayloadObject(entity);

  return getText(
    getAttr(entity, "entityType"),
    payload.entityType,
    payload.type,
    payload.kind
  ).toLowerCase();
}

function isApprovedFair(entity: ArkivEntity): boolean {
  const payload = getPayloadObject(entity);
  const entityType = getEntityType(entity);

  const looksLikeFair =
    entityType === "fair_event" ||
    entityType === "fair" ||
    entityType === "fairEvent" ||
    Boolean(payload.fairName || payload.name || payload.title);

  if (!looksLikeFair) return false;

  const approved = getBool(
    payload.approved,
    getAttr(entity, "approved"),
    payload.isApproved
  );

  const status = getText(
    payload.status,
    getAttr(entity, "status"),
    payload.approvalStatus
  ).toLowerCase();

  if (approved === true) return true;

  return ["approved", "aprobada", "aprobado", "published", "active", "vigente"].some(
    (token) => status.includes(token)
  );
}

function isRegistrationEntity(entity: ArkivEntity): boolean {
  const entityType = getEntityType(entity);
  const payload = getPayloadObject(entity);

  return (
    entityType === "fair_registration" ||
    entityType === "registration" ||
    Boolean(payload.registrationKey || payload.entrepreneurName || payload.businessName)
  );
}

function buildEntrepreneur(registration: ArkivEntity): PublicEntrepreneur {
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

function buildFair(entity: ArkivEntity, registrations: ArkivEntity[]): PublicFair {
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
    availableSlots: getNumber(
      payload.availableSlots,
      payload.remainingSlots
    ),
    totalSlots: getNumber(
      payload.totalSlots,
      payload.capacity,
      payload.slots
    ),
    registeredCount: entrepreneurs.length,
    entrepreneurs,
  };
}

export async function publicFairsRoutes(app: FastifyInstance) {
  app.get("/public/fairs/approved", async (request, reply) => {
    try {
      const cached = await getProjectEntitiesCached();

      const rawEntities = asArkivEntities(cached.entities);

      const fairs = rawEntities.filter(isApprovedFair);
      const registrations = rawEntities.filter(isRegistrationEntity);

      const result = fairs
        .map((fair) => buildFair(fair, registrations))
        .filter((fair) => fair.fairKey)
        .sort((a, b) => a.fairName.localeCompare(b.fairName, "es"));

      if (cached.warning) {
        request.log.warn(
          {
            warning: cached.warning,
            source: cached.source,
            cache: cached.cache,
          },
          "Public fairs served with Arkiv cache warning"
        );
      }

      return {
        ok: true,
        source: cached.source,
        warning: cached.warning ?? null,
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
