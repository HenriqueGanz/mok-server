// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // 1) Create some items (amulets + starter weapons if you want)
  const amuletHope = await prisma.item.create({
    data: {
      name: "Amulet of Hope",
      type: "amulet",
      rarity: "common",
      data: { bonus: { xp: 10 } },
    },
  });

  const amuletPower = await prisma.item.create({
    data: {
      name: "Amulet of Power",
      type: "amulet",
      rarity: "rare",
      data: { bonus: { attack: 3 } },
    },
  });

  const longsword = await prisma.item.create({
    data: {
      name: "Longsword",
      type: "weapon",
      rarity: "common",
      data: { attack: 5, class: "Warrior" },
    },
  });

  console.log("-> Items created:", amuletHope.id, amuletPower.id, longsword.id);

  // 2) Create a few quests, referencing rewardItem by id (Int) or null
  await prisma.quest.createMany({
    data: [
      {
        title: "The Lost Amulet",
        description: "Encontre o amuleto perdido no norte da vila.",
        rewardXp: 50,
        rewardItem: amuletHope.id, // integer FK
        hidden: true,
      },
      {
        title: "Defeat the Slimes",
        description: "Elimine 10 slimes no campo oeste.",
        rewardXp: 30,
        rewardItem: null,
        hidden: true,
      },
      {
        title: "The Hidden Cave",
        description: "Descubra a caverna escondida e fale com o velho mago.",
        rewardXp: 100,
        rewardItem: amuletPower.id,
        hidden: true,
      },
    ],
  });

  console.log("-> Quests created");

  // 3) Create or find test user
  const passwordHash = await bcrypt.hash("123456", 10);
  let user = await prisma.user.findUnique({
    where: { email: "henrique@example.com" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "henrique@example.com",
        password: passwordHash,
      },
    });
    console.log("-> User created id:", user.id);
  } else {
    console.log("-> User already exists id:", user.id);
  }

  // 4) Create a character for that user if doesn't exist
  const existingCharacter = await prisma.character.findFirst({
    where: { userId: user.id },
  });

  if (!existingCharacter) {
    await prisma.character.create({
      data: {
        userId: user.id,
        name: "Henro",
        class: "Warrior",
        level: 1,
        xp: 0,
        posX: 0,
        posY: 0,
        posZ: 0,
        mapId: "main",
        inventory: [], // será salvo como JSON vazio
      },
    });
    console.log("-> Character created");
  } else {
    console.log("-> Character already exists id:", existingCharacter.id);
  }

  // 5) Create Mob Templates (Biomes System)
  await prisma.mobTemplate.deleteMany(); // Limpar templates existentes

  await prisma.mobTemplate.createMany({
    data: [
      // FLORESTA (Centro - Fácil)
      {
        type: "slime",
        name: "Slime da Floresta",
        level: 1,
        hp: 30,
        attackPower: 5,
        defense: 2,
        xpReward: 10,
        spawnRate: 1.0,
      },
      // DESERTO (Direita - Médio)
      {
        type: "desert_slime",
        name: "Slime do Deserto",
        level: 2,
        hp: 40,
        attackPower: 8,
        defense: 3,
        xpReward: 15,
        spawnRate: 0.8,
      },
      // PÂNTANO (Cima - Médio-Difícil)
      {
        type: "swamp_slime",
        name: "Slime do Pântano",
        level: 3,
        hp: 50,
        attackPower: 10,
        defense: 4,
        xpReward: 20,
        spawnRate: 0.6,
      },
      // NEVE (Esquerda - Difícil)
      {
        type: "ice_slime",
        name: "Slime de Gelo",
        level: 4,
        hp: 60,
        attackPower: 12,
        defense: 5,
        xpReward: 25,
        spawnRate: 0.4,
      },
      // VULCÃO (Baixo - Muito Difícil)
      {
        type: "fire_slime",
        name: "Slime de Fogo",
        level: 5,
        hp: 80,
        attackPower: 15,
        defense: 6,
        xpReward: 35,
        spawnRate: 0.3,
      },
    ],
  });

  console.log("-> Mob templates created");

  console.log("✅ Seed finished.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
