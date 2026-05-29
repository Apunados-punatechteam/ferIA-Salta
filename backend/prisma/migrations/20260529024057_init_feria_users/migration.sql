-- CreateEnum
CREATE TYPE "FeriaUserRole" AS ENUM ('ENTREPRENEUR', 'FAIR_ORGANIZER', 'MUNICIPALITY');

-- CreateTable
CREATE TABLE "feria_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "role" "FeriaUserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feria_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feria_users_username_key" ON "feria_users"("username");
