import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import { getProjectEntitiesCached } from "../arkivCache.js";

export async function arkivRoutes(app: FastifyInstance) {
  app.get(
    "/arkiv/entities",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const query = request.query as {
        refresh?: string;
      };

      const forceRefresh = query.refresh === "1" || query.refresh === "true";

      const result = await getProjectEntitiesCached({
        forceRefresh,
      });

      reply.header("X-Arkiv-Cache-Source", result.source);
      reply.header("X-Arkiv-Cache-Hit", String(result.cache.hit));

      if (result.warning) {
        request.log.warn(
          {
            warning: result.warning,
            source: result.source,
            cache: result.cache,
          },
          "Arkiv entities request served with degraded cache mode"
        );
      }

      return result;
    }
  );
}
