import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ENTITY_TYPES, createEntity } from "./entityStore.js";

// Datos de demostración: ferias aprobadas, emprendedores inscriptos y certificados.
// Es re-ejecutable: borra antes las entidades marcadas con demo=seed y las vuelve a crear.

const prisma = new PrismaClient();
const DEMO = { key: "demo", value: "seed" } as const;

const GOVERNMENT = {
  name: "gobierno",
  document: "gobierno-demo",
};

type DemoFair = {
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
};

const FAIRS: DemoFair[] = [
  {
    name: "Feria Artesanal Plaza Güemes",
    description: "Feria permanente de la ciudad de Salta",
    address: "Balcarce 500 (Plaza Güemes), Salta Capital",
    city: "Salta",
    category: "artesania",
    startDate: "2026-11-14",
    endDate: "2026-11-15",
    availableSlots: 50,
    latitude: -24.7886,
    longitude: -65.4097,
  },
  {
    name: "Feria Artesanal Paseo Balcarce",
    description: "Feria permanente de la ciudad de Salta",
    address: "Paseo Balcarce, Salta Capital",
    city: "Salta",
    category: "artesania",
    startDate: "2026-11-21",
    endDate: "2026-11-22",
    availableSlots: 50,
    latitude: -24.7871,
    longitude: -65.4075,
  },
  {
    name: "Feria del Cerro San Bernardo",
    description: "Feria permanente de la ciudad de Salta",
    address: "Ascenso al Cerro San Bernardo, Salta Capital",
    city: "Salta",
    category: "gastronomia",
    startDate: "2026-12-05",
    endDate: "2026-12-06",
    availableSlots: 50,
    latitude: -24.7937,
    longitude: -65.4147,
  },
  {
    name: "Feria Potencia Salta",
    description: "Feria provincial de emprendedores",
    address: "Parque San Martín, Salta Capital",
    city: "Salta",
    category: "emprendimientos",
    startDate: "2026-12-12",
    endDate: "2026-12-13",
    availableSlots: 50,
    latitude: -24.7957,
    longitude: -65.4038,
  },
  {
    name: "Feria de Emprendedores Parque Sur",
    description: "Convocatoria de emprendedores de la zona sur",
    address: "Parque Sur, Salta Capital",
    city: "Salta",
    category: "emprendimientos",
    startDate: "2026-12-19",
    endDate: "2026-12-20",
    availableSlots: 50,
    latitude: -24.8204,
    longitude: -65.4292,
  },
];

type DemoEntrepreneur = {
  name: string;
  document: string;
  businessName: string;
  category: string;
  description: string;
  phone: string;
};

const ENTREPRENEURS: DemoEntrepreneur[] = [
  { name: "Lucía Fernández", document: "30111001", businessName: "Tejidos del Valle", category: "textil", description: "Ponchos y mantas artesanales tejidos a telar", phone: "3874000011" },
  { name: "Martín Gómez", document: "30111002", businessName: "Dulces Norteños", category: "gastronomia", description: "Dulces regionales y conservas caseras", phone: "3874000012" },
  { name: "Carla Rojas", document: "30111003", businessName: "Cerámica Calchaquí", category: "artesania", description: "Cerámica utilitaria y decorativa", phone: "3874000013" },
  { name: "Valeria Colque", document: "30111004", businessName: "Aromas de los Cerros", category: "gastronomia", description: "Panificados y empanadas salteñas", phone: "3874000014" },
  { name: "Diego Aramayo", document: "30111005", businessName: "Cuero y Tradición", category: "artesania", description: "Marroquinería y talabartería artesanal", phone: "3874000015" },
  { name: "Silvana Torres", document: "30111006", businessName: "Hilos del Norte", category: "textil", description: "Tejidos en lana de llama y alpaca", phone: "3874000016" },
  { name: "Rubén Cruz", document: "30111007", businessName: "Madera Viva", category: "artesania", description: "Tallados y utensilios en madera de algarrobo", phone: "3874000017" },
  { name: "Marina Ledesma", document: "30111008", businessName: "Mermeladas Valle Dulce", category: "gastronomia", description: "Mermeladas y licores regionales", phone: "3874000018" },
  { name: "Tomás Quispe", document: "30111009", businessName: "Plata Andina", category: "joyeria", description: "Joyería en plata y piedras del noroeste", phone: "3874000019" },
];

// índice de feria -> índices de emprendedores inscriptos
const REGISTRATIONS: Record<number, number[]> = {
  0: [0, 3, 4],
  1: [5, 6],
  2: [2, 7, 8],
  3: [1, 8],
  4: [5, 7],
};

async function main() {
  const removed = await prisma.fairEntity.deleteMany({
    where: { attributes: { array_contains: [DEMO] } },
  });
  console.log(`Entidades demo anteriores eliminadas: ${removed.count}`);

  const now = Date.now();
  let registrationCount = 0;

  for (const [fairIndex, fair] of FAIRS.entries()) {
    const fairKey = randomUUID();

    await createEntity({
      entityType: ENTITY_TYPES.FAIR_EVENT,
      fixedId: fairKey,
      payload: {
        ...fair,
        status: "pending",
        createdByRole: "GOVERNMENT",
        createdByName: GOVERNMENT.name,
        createdByDocument: GOVERNMENT.document,
        createdAt: now,
      },
      attributes: [
        { key: "status", value: "pending" },
        { key: "createdByRole", value: "GOVERNMENT" },
        { key: "createdByDocument", value: GOVERNMENT.document },
        { key: "category", value: fair.category },
        { key: "city", value: fair.city },
        { key: "createdAt", value: now },
        DEMO,
      ],
    });

    await createEntity({
      entityType: ENTITY_TYPES.FAIR_EVENT_DECISION,
      payload: {
        fairKey,
        fairName: fair.name,
        fairAddress: fair.address,
        fairCategory: fair.category,
        fairCity: fair.city,
        decision: "approved",
        notes: "Aprobada (datos de demostración)",
        decidedByRole: "government",
        decidedByName: GOVERNMENT.name,
        decidedByDocument: GOVERNMENT.document,
        decidedAt: now + 1,
      },
      attributes: [
        { key: "fairKey", value: fairKey },
        { key: "decision", value: "approved" },
        { key: "status", value: "approved" },
        { key: "decidedByRole", value: "government" },
        { key: "decidedByDocument", value: GOVERNMENT.document },
        { key: "decidedAt", value: now + 1 },
        DEMO,
      ],
    });

    for (const entrepreneurIndex of REGISTRATIONS[fairIndex] ?? []) {
      const entrepreneur = ENTREPRENEURS[entrepreneurIndex];
      const registrationKey = randomUUID();
      const registeredAt = now + 2 + registrationCount;
      registrationCount += 1;

      await createEntity({
        entityType: ENTITY_TYPES.FAIR_REGISTRATION,
        fixedId: registrationKey,
        payload: {
          fairKey,
          fairName: fair.name,
          fairAddress: fair.address,
          fairCategory: fair.category,
          entrepreneurName: entrepreneur.name,
          entrepreneurDocument: entrepreneur.document,
          businessName: entrepreneur.businessName,
          phone: entrepreneur.phone,
          description: entrepreneur.description,
          standPhotoUrl: "",
          articlePhotoUrls: [],
          status: "active",
          registeredAt,
        },
        attributes: [
          { key: "fairKey", value: fairKey },
          { key: "status", value: "active" },
          { key: "entrepreneurDocument", value: entrepreneur.document },
          { key: "registeredAt", value: registeredAt },
          DEMO,
        ],
      });

      const certificateNumber = `FERIA-2026-${String(100000 + registrationCount)}`;

      await createEntity({
        entityType: ENTITY_TYPES.FAIR_CERTIFICATE,
        payload: {
          certificateNumber,
          fairKey,
          registrationKey,
          fairName: fair.name,
          entrepreneurName: entrepreneur.name,
          entrepreneurDocument: entrepreneur.document,
          businessName: entrepreneur.businessName,
          status: "issued",
          issuedAt: registeredAt,
        },
        attributes: [
          { key: "fairKey", value: fairKey },
          { key: "registrationKey", value: registrationKey },
          { key: "certificateNumber", value: certificateNumber },
          { key: "status", value: "issued" },
          { key: "issuedAt", value: registeredAt },
          DEMO,
        ],
      });
    }
  }

  console.log(
    `Datos demo creados: ${FAIRS.length} ferias aprobadas, ${registrationCount} inscripciones con certificado.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
