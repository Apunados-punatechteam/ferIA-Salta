import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

const prisma = new PrismaClient();

let tableEnsured = false;

async function ensureContactTable() {
  if (tableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "contact_messages" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "nombre" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "telefono" TEXT,
        "municipio" TEXT NOT NULL,
        "tipo_consulta" TEXT NOT NULL,
        "mensaje" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
      )
    `);
  } catch {
    // tabla ya existe o DB no disponible
  }
  tableEnsured = true;
}

type ContactBody = {
  nombre: string;
  email: string;
  telefono?: string;
  municipio: string;
  tipoConsulta: string;
  mensaje: string;
};

export async function contactRoutes(app: FastifyInstance) {
  app.post<{ Body: ContactBody }>("/public/contact", async (request, reply) => {
    const { nombre, email, telefono, municipio, tipoConsulta, mensaje } =
      request.body ?? {};

    if (
      !nombre?.trim() ||
      !email?.trim() ||
      !municipio?.trim() ||
      !tipoConsulta?.trim() ||
      !mensaje?.trim()
    ) {
      return reply
        .code(400)
        .send({ ok: false, error: "Todos los campos obligatorios son requeridos." });
    }

    try {
      await ensureContactTable();
      await prisma.contactMessage.create({
        data: {
          nombre: nombre.trim(),
          email: email.trim(),
          telefono: telefono?.trim() || null,
          municipio: municipio.trim(),
          tipoConsulta: tipoConsulta.trim(),
          mensaje: mensaje.trim(),
        },
      });
    } catch (error) {
      request.log.error({ error }, "Error guardando mensaje de contacto");
    }

    return { ok: true };
  });
}
