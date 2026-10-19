-- Reemplaza Arkiv por una tabla propia y elimina los pagos Stellar y las tablas legacy.
CREATE TABLE IF NOT EXISTS "feria_entities" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feria_entities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "feria_entities_entity_type_idx" ON "feria_entities"("entity_type");

DROP TABLE IF EXISTS "feria_stellar_payments";
DROP TYPE IF EXISTS "StellarPaymentStatus";

DROP TABLE IF EXISTS "PaymentIntent";
DROP TABLE IF EXISTS "Inscripcion";
DROP TABLE IF EXISTS "EntrepreneurProfile";
DROP TABLE IF EXISTS "Feria";
DROP TABLE IF EXISTS "User";
DROP TYPE IF EXISTS "InscripcionStatus";
DROP TYPE IF EXISTS "FeriaStatus";
DROP TYPE IF EXISTS "Role";
