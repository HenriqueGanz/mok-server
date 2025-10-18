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

  // 3) Create a test user
  const passwordHash = await bcrypt.hash("123456", 10);
  const user = await prisma.user.create({
    data: {
      email: "henrique@example.com",
      password: passwordHash,
    },
  });

  console.log("-> User created id:", user.id);

  // 4) Create a character for that user
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
