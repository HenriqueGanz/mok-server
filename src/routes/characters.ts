import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware de autenticação
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido" });
    }
    req.userId = decoded.userId;
    next();
  });
}

// Configuração das classes
const CLASS_CONFIGS: Record<string, any> = {
  warrior: {
    name: "Guerreiro",
    description: "Tanque com alta defesa e HP",
    baseStats: {
      hp: 150,
      maxHp: 150,
      attackPower: 15,
      defense: 10,
      attackRange: 60,
      attackSpeed: 0.8,
      moveSpeed: 180,
    },
    hpPerLevel: 15,
    attackPerLevel: 2,
    defensePerLevel: 2,
  },
  mage: {
    name: "Mago",
    description: "Dano mágico de longo alcance",
    baseStats: {
      hp: 80,
      maxHp: 80,
      attackPower: 25,
      defense: 3,
      attackRange: 120,
      attackSpeed: 1.2,
      moveSpeed: 200,
    },
    hpPerLevel: 8,
    attackPerLevel: 4,
    defensePerLevel: 1,
  },
  rogue: {
    name: "Ladino",
    description: "Ataques rápidos e alta mobilidade",
    baseStats: {
      hp: 100,
      maxHp: 100,
      attackPower: 20,
      defense: 5,
      attackRange: 50,
      attackSpeed: 1.5,
      moveSpeed: 250,
    },
    hpPerLevel: 10,
    attackPerLevel: 3,
    defensePerLevel: 1,
  },
  archer: {
    name: "Arqueiro",
    description: "Dano físico de longo alcance",
    baseStats: {
      hp: 90,
      maxHp: 90,
      attackPower: 22,
      defense: 4,
      attackRange: 150,
      attackSpeed: 1.0,
      moveSpeed: 220,
    },
    hpPerLevel: 9,
    attackPerLevel: 3,
    defensePerLevel: 1,
  },
};

// GET /characters - Listar personagens do usuário
router.get("/", authenticateToken, async (req: any, res) => {
  try {
    const characters = await prisma.character.findMany({
      where: { userId: req.userId },
      orderBy: { lastLogin: "desc" },
    });

    const formattedCharacters = characters.map((char) => ({
      id: char.id,
      name: char.name,
      class: char.class,
      level: char.level,
      hp: char.hp,
      maxHp: char.maxHp,
      xp: char.xp,
      attackPower: char.attackPower,
      defense: char.defense,
      moveSpeed: char.moveSpeed,
      lastLogin: char.lastLogin,
      isActive: char.isActive,
    }));

    res.json({ characters: formattedCharacters });
  } catch (error) {
    console.error("Erro ao buscar personagens:", error);
    res.status(500).json({ error: "Erro ao buscar personagens" });
  }
});

// POST /characters - Criar novo personagem
router.post("/", authenticateToken, async (req: any, res) => {
  try {
    const { name, class: characterClass } = req.body;

    if (!name || !characterClass) {
      return res
        .status(400)
        .json({ error: "Nome e classe são obrigatórios" });
    }

    // Validar classe
    const validClasses = ["warrior", "mage", "rogue", "archer"];
    if (!validClasses.includes(characterClass)) {
      return res.status(400).json({ error: "Classe inválida" });
    }

    // Verificar se o usuário já tem um personagem com esse nome
    const existingChar = await prisma.character.findFirst({
      where: {
        userId: req.userId,
        name: name,
      },
    });

    if (existingChar) {
      return res
        .status(400)
        .json({ error: "Você já possui um personagem com esse nome" });
    }

    // Obter configuração da classe
    const classConfig = CLASS_CONFIGS[characterClass];
    const stats = classConfig.baseStats;

    // Criar personagem
    const character = await prisma.character.create({
      data: {
        userId: req.userId,
        name: name,
        class: characterClass,
        level: 1,
        xp: 0,
        hp: stats.hp,
        maxHp: stats.maxHp,
        attackPower: stats.attackPower,
        defense: stats.defense,
        attackRange: stats.attackRange,
        attackSpeed: stats.attackSpeed,
        moveSpeed: stats.moveSpeed,
        x: 0,
        y: 0,
        z: 0,
        posX: 0,
        posY: 0,
        posZ: 0,
        mapId: "main",
        inventory: [],
        isActive: false,
      },
    });

    console.log(`✅ Personagem criado: ${name} (${characterClass})`);

    res.json({
      character: {
        id: character.id,
        name: character.name,
        class: character.class,
        level: character.level,
        hp: character.hp,
        maxHp: character.maxHp,
        xp: character.xp,
        attackPower: character.attackPower,
        defense: character.defense,
        attackRange: character.attackRange,
        attackSpeed: character.attackSpeed,
        moveSpeed: character.moveSpeed,
      },
    });
  } catch (error) {
    console.error("Erro ao criar personagem:", error);
    res.status(500).json({ error: "Erro ao criar personagem" });
  }
});

// POST /characters/:id/select - Selecionar personagem para jogar
router.post("/:id/select", authenticateToken, async (req: any, res) => {
  try {
    const characterId = parseInt(req.params.id);

    // Verificar se o personagem pertence ao usuário
    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        userId: req.userId,
      },
    });

    if (!character) {
      return res.status(404).json({ error: "Personagem não encontrado" });
    }

    // Desativar todos os outros personagens do usuário
    await prisma.character.updateMany({
      where: { userId: req.userId },
      data: { isActive: false },
    });

    // Ativar o personagem selecionado
    const updatedCharacter = await prisma.character.update({
      where: { id: characterId },
      data: {
        isActive: true,
        lastLogin: new Date(),
      },
    });

    console.log(`🎮 Personagem selecionado: ${updatedCharacter.name}`);

    res.json({
      success: true,
      character: {
        id: updatedCharacter.id,
        name: updatedCharacter.name,
        class: updatedCharacter.class,
        level: updatedCharacter.level,
        hp: updatedCharacter.hp,
        maxHp: updatedCharacter.maxHp,
        xp: updatedCharacter.xp,
        attackPower: updatedCharacter.attackPower,
        defense: updatedCharacter.defense,
        attackRange: updatedCharacter.attackRange,
        attackSpeed: updatedCharacter.attackSpeed,
        moveSpeed: updatedCharacter.moveSpeed,
        x: updatedCharacter.x,
        y: updatedCharacter.y,
        z: updatedCharacter.z,
        mapId: updatedCharacter.mapId,
      },
    });
  } catch (error) {
    console.error("Erro ao selecionar personagem:", error);
    res.status(500).json({ error: "Erro ao selecionar personagem" });
  }
});

// GET /characters/:id/inventory - Ver inventário
router.get("/:id/inventory", authenticateToken, async (req: any, res) => {
  try {
    const characterId = parseInt(req.params.id);

    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        userId: req.userId,
      },
    });

    if (!character) {
      return res.status(404).json({ error: "Personagem não encontrado" });
    }

    const inventory = (character.inventory as any[]) || [];

    res.json({ inventory });
  } catch (error) {
    console.error("Erro ao buscar inventário:", error);
    res.status(500).json({ error: "Erro ao buscar inventário" });
  }
});

// POST /characters/:id/equip - Equipar item
router.post("/:id/equip", authenticateToken, async (req: any, res) => {
  try {
    const characterId = parseInt(req.params.id);
    const { itemId, slot } = req.body;

    if (!itemId || !slot) {
      return res.status(400).json({ error: "itemId e slot são obrigatórios" });
    }

    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        userId: req.userId,
      },
    });

    if (!character) {
      return res.status(404).json({ error: "Personagem não encontrado" });
    }

    let inventory = (character.inventory as any[]) || [];

    // Encontrar o item no inventário
    const itemIndex = inventory.findIndex((item) => item.itemId === itemId);

    if (itemIndex === -1) {
      return res.status(404).json({ error: "Item não encontrado no inventário" });
    }

    // Desequipar qualquer item neste slot
    inventory = inventory.map((item) => {
      if (item.equippedAt === slot) {
        return { ...item, equippedAt: null };
      }
      return item;
    });

    // Equipar o novo item
    inventory[itemIndex].equippedAt = slot;

    // Calcular stats com bônus
    const equipped = inventory.filter((item) => item.equippedAt);
    let attackPower = character.attackPower;
    let defense = character.defense;
    let maxHp = character.maxHp;

    equipped.forEach((item) => {
      const bonus = item.data?.bonus || {};
      if (bonus.attack) attackPower += bonus.attack;
      if (bonus.defense) defense += bonus.defense;
      if (bonus.hp) maxHp += bonus.hp;
    });

    // Atualizar personagem
    await prisma.character.update({
      where: { id: characterId },
      data: { inventory },
    });

    res.json({
      success: true,
      equippedItem: inventory[itemIndex],
      updatedStats: {
        attackPower,
        defense,
        maxHp,
      },
    });
  } catch (error) {
    console.error("Erro ao equipar item:", error);
    res.status(500).json({ error: "Erro ao equipar item" });
  }
});

export { CLASS_CONFIGS };
export default router;
