import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import { listEntities } from "../entityStore.js";

export async function entitiesRoutes(app: FastifyInstance) {
  app.get(
    "/entities",
    {
      preHandler: [requireAuth],
    },
    async () => {
      const entities = await listEntities();

      return {
        ok: true,
        source: "database",
        entities,
      };
    }
  );
}
