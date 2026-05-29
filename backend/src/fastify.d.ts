import "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";

export type FeriaJwtUser = {
  sub: string;
  username: string;
  role: "ENTREPRENEUR" | "FAIR_ORGANIZER" | "MUNICIPALITY";
  document?: string;
  fullName?: string;
};

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: FeriaJwtUser;
    user: FeriaJwtUser;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}