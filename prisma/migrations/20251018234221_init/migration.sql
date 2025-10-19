-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "hp" INTEGER NOT NULL DEFAULT 100,
    "maxHp" INTEGER NOT NULL DEFAULT 100,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 400.0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 300.0,
    "z" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "mapId" TEXT NOT NULL DEFAULT 'main_map',
    "attackPower" INTEGER NOT NULL DEFAULT 10,
    "defense" INTEGER NOT NULL DEFAULT 5,
    "attackRange" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "attackSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "moveSpeed" DOUBLE PRECISION NOT NULL DEFAULT 200.0,
    "class" TEXT NOT NULL DEFAULT 'warrior',
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inventory" JSONB DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "data" JSONB,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "rewardItem" INTEGER,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

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
    "attackRange" DOUBLE PRECISION NOT NULL DEFAULT 60.0,
    "attackSpeed" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "moveSpeed" DOUBLE PRECISION NOT NULL DEFAULT 150.0,
    "spawnRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "dropRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "possibleDrops" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Character_userId_idx" ON "Character"("userId");

-- CreateIndex
CREATE INDEX "Character_userId_isActive_idx" ON "Character"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MobTemplate_type_key" ON "MobTemplate"("type");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
