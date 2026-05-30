import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { FastifyReply, FastifyRequest } from "fastify";
import { authRoutes } from "./routes/auth.routes.js";
import { arkivRoutes } from "./routes/arkiv.routes.js";
import { fairsRoutes } from "./routes/fairs.routes.js";
import { fairRegistrationsRoutes } from "./routes/fairRegistrations.routes.js";
import { registerRoutes } from "./routes/register.routes.js";
import { stellarPaymentsRoutes } from "./routes/stellarPayments.routes.js";
import { publicFairsRoutes } from "./routes/publicFairs.routes.js";

const app = Fastify({
  logger: true,
});

await mkdir(path.join(process.cwd(), "uploads"), { recursive: true });
await mkdir(path.join(process.cwd(), "uploads", "registrations"), {
  recursive: true,
});

await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? "feria-arkiv-dev-secret-change-me",
});

app.decorate(
  "authenticate",
  async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({
        ok: false,
        error: "Unauthorized.",
      });
    }
  }
);

await app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 4,
  },
});

// Servir uploads
await app.register(fastifyStatic, {
  root: path.join(process.cwd(), "uploads"),
  prefix: "/uploads/",
});

// Servir frontend estático
await app.register(fastifyStatic, {
  root: path.join(process.cwd(), "public"),
  prefix: "/",
  decorateReply: false,
});

app.get("/health", async () => {
  return {
    ok: true,
    service: "feria-arkiv-backend",
  };
});

await app.register(authRoutes, { prefix: "/api" });
app.register(registerRoutes);
await app.register(arkivRoutes, { prefix: "/api" });
await app.register(fairsRoutes, { prefix: "/api" });
await app.register(fairRegistrationsRoutes, { prefix: "/api" });
aw
