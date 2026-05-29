import { PrismaClient, FeriaUserRole } from "@prisma/client";
import { hashPassword } from "./auth.js";

const prisma = new PrismaClient();

async function upsertUser(params: {
  username: string;
  password: string;
  fullName: string;
  document: string;
  role: FeriaUserRole;
}) {
  await prisma.feriaUser.upsert({
    where: {
      username: params.username,
    },
    update: {
      passwordHash: await hashPassword(params.password),
      fullName: params.fullName,
      document: params.document,
      role: params.role,
      isActive: true,
    },
    create: {
      username: params.username,
      passwordHash: await hashPassword(params.password),
      fullName: params.fullName,
      document: params.document,
      role: params.role,
      isActive: true,
    },
  });
}

await upsertUser({
  username: "emprendedor",
  password: "emprendedor123",
  fullName: "Nicolás Mattioli",
  document: "31193300",
  role: FeriaUserRole.ENTREPRENEUR,
});

await upsertUser({
  username: "feriante",
  password: "feriante123",
  fullName: "Organizador de Ferias Salta",
  document: "feriante-salta",
  role: FeriaUserRole.FAIR_ORGANIZER,
});

await upsertUser({
  username: "municipalidad",
  password: "muni123",
  fullName: "Municipalidad de Salta",
  document: "muni-salta",
  role: FeriaUserRole.MUNICIPALITY,
});

console.log("Usuarios demo creados correctamente en feria_users.");

await prisma.$disconnect();
