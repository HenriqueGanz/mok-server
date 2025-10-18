/*
  Warnings:

  - Added the required column `updatedAt` to the `Character` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Character" DROP CONSTRAINT "Character_userId_fkey";

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "attackPower" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "attackRange" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
ADD COLUMN     "attackSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "defense" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "hp" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "lastLogin" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "maxHp" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "x" DOUBLE PRECISION NOT NULL DEFAULT 400.0,
ADD COLUMN     "y" DOUBLE PRECISION NOT NULL DEFAULT 300.0,
ADD COLUMN     "z" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "class" SET DEFAULT 'warrior',
ALTER COLUMN "mapId" SET DEFAULT 'main_map';

-- CreateTable
CREATE TABLE "MobTemplate" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "hp" INTEGER NOT NULL,
    "attackPower" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "spawnRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobTemplate_type_key" ON "MobTemplate"("type");

-- CreateIndex
CREATE INDEX "Character_userId_idx" ON "Character"("userId");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
