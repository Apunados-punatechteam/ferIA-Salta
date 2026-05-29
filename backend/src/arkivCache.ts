import { listProjectEntities } from "./arkivService.js";

type CacheSource = "fresh" | "stale" | "empty";

type ArkivEntitiesCacheEntry = {
  entities: unknown[];
  fetchedAt: number;
};

export type ArkivEntitiesCacheResult = {
  ok: true;
  entities: unknown[];
  source: CacheSource;
  cache: {
    hit: boolean;
    fetchedAt: number | null;
    ageMs: number | null;
    ttlMs: number;
    staleTtlMs: number;
  };
  warning?: string;
};

const CACHE_TTL_MS = Number(process.env.ARKIV_ENTITIES_CACHE_TTL_MS ?? 20_000);
const STALE_TTL_MS = Number(
  process.env.ARKIV_ENTITIES_STALE_TTL_MS ?? 15 * 60_000
);

let cacheEntry: ArkivEntitiesCacheEntry | null = null;
let inFlightFetch: Promise<ArkivEntitiesCacheResult> | null = null;

function nowMs() {
  return Date.now();
}

function getCacheAgeMs(entry: ArkivEntitiesCacheEntry | null) {
  if (!entry) return null;
  return Math.max(nowMs() - entry.fetchedAt, 0);
}

function isFresh(entry: ArkivEntitiesCacheEntry | null) {
  const ageMs = getCacheAgeMs(entry);
  return ageMs !== null && ageMs <= CACHE_TTL_MS;
}

function isUsableStale(entry: ArkivEntitiesCacheEntry | null) {
  const ageMs = getCacheAgeMs(entry);
  return ageMs !== null && ageMs <= STALE_TTL_MS;
}

function buildResult(params: {
  entities: unknown[];
  source: CacheSource;
  hit: boolean;
  fetchedAt: number | null;
  warning?: string;
}): ArkivEntitiesCacheResult {
  const ageMs =
    params.fetchedAt === null ? null : Math.max(nowMs() - params.fetchedAt, 0);

  return {
    ok: true,
    entities: params.entities,
    source: params.source,
    cache: {
      hit: params.hit,
      fetchedAt: params.fetchedAt,
      ageMs,
      ttlMs: CACHE_TTL_MS,
      staleTtlMs: STALE_TTL_MS,
    },
    ...(params.warning ? { warning: params.warning } : {}),
  };
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Arkiv RPC temporarily unavailable.";
}

async function fetchFreshEntities(): Promise<ArkivEntitiesCacheResult> {
  try {
    const entities = await listProjectEntities();

    cacheEntry = {
      entities,
      fetchedAt: nowMs(),
    };

    return buildResult({
      entities,
      source: "fresh",
      hit: false,
      fetchedAt: cacheEntry.fetchedAt,
    });
  } catch (error) {
    const warning = getSafeErrorMessage(error);

    if (isUsableStale(cacheEntry)) {
      return buildResult({
        entities: cacheEntry?.entities ?? [],
        source: "stale",
        hit: true,
        fetchedAt: cacheEntry?.fetchedAt ?? null,
        warning,
      });
    }

    return buildResult({
      entities: [],
      source: "empty",
      hit: false,
      fetchedAt: null,
      warning,
    });
  }
}

export async function getProjectEntitiesCached(params?: {
  forceRefresh?: boolean;
}): Promise<ArkivEntitiesCacheResult> {
  const forceRefresh = params?.forceRefresh ?? false;

  if (!forceRefresh && isFresh(cacheEntry)) {
    return buildResult({
      entities: cacheEntry?.entities ?? [],
      source: "fresh",
      hit: true,
      fetchedAt: cacheEntry?.fetchedAt ?? null,
    });
  }

  if (inFlightFetch) {
    return inFlightFetch;
  }

  inFlightFetch = fetchFreshEntities();

  try {
    return await inFlightFetch;
  } finally {
    inFlightFetch = null;
  }
}

/**
 * Invalidación suave:
 * no borra la última respuesta buena.
 * Solo fuerza que el próximo GET intente refrescar desde Arkiv.
 * Si Arkiv falla, todavía puede devolver stale cache.
 */
export function invalidateProjectEntitiesCache() {
  if (!cacheEntry) return;

  cacheEntry = {
    ...cacheEntry,
    fetchedAt: 0,
  };
}

export function clearProjectEntitiesCache() {
  cacheEntry = null;
  inFlightFetch = null;
}
