import { Room, Client } from "colyseus";
import { User, PrismaClient, MobTemplate, Character } from "@prisma/client";
import jwt from "jsonwebtoken";
import { CLASS_CONFIGS } from "../routes/characters";
import { GameRoomState, PlayerState, MobState } from "../schema/GameRoomState";

// Constantes do Sistema de Biomas (9 Zonas)
const ZONE_WIDTH = 24;  // 1200 pixels / 50 scale
const ZONE_HEIGHT = 16; // 800 pixels / 50 scale

const MAP_BOUNDS = {
  minX: -ZONE_WIDTH * 1.5,  // -36 (zona -1)
  maxX: ZONE_WIDTH * 1.5,   //  36 (zona 1)
  minZ: -ZONE_HEIGHT * 1.5, // -24 (zona -1)
  maxZ: ZONE_HEIGHT * 1.5   //  24 (zona 1)
};

// Mapeamento zona -> tipo de mob
const BIOME_MOBS: Record<string, string> = {
  "0,0": "slime",           // Floresta (centro)
  "1,0": "desert_slime",    // Deserto
  "0,-1": "swamp_slime",    // Pântano
  "-1,0": "ice_slime",      // Neve
  "0,1": "fire_slime",      // Vulcão
  "1,-1": "rock_golem",     // Montanhas
  "-1,-1": "frost_wolf",    // Tundra
  "-1,1": "shadow_bat",     // Caverna
  "1,1": "crab",            // Praia
};

function getBiomeAt(x: number, z: number): string {
  const zoneX = Math.floor(x / ZONE_WIDTH);
  const zoneY = Math.floor(z / ZONE_HEIGHT);
  return BIOME_MOBS[`${zoneX},${zoneY}`] || "slime";
}

function clampToMap(x: number, z: number): { x: number, z: number } {
  return {
    x: Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, x)),
    z: Math.max(MAP_BOUNDS.minZ, Math.min(MAP_BOUNDS.maxZ, z))
  };
}

export class MainMapRoom extends Room<GameRoomState> {
  mobTemplates: Map<string, MobTemplate> = new Map();
  prisma: PrismaClient;
  userSessions: Map<number, string> = new Map();
  tickInterval?: NodeJS.Timeout;

  async onAuth(client: Client, options: any) {
    console.log("🔐 MainMapRoom.onAuth chamado para client:", client.sessionId);

    const prisma: PrismaClient = (global as any).prisma;
    const JWT_SECRET: string = (global as any).JWT_SECRET;

    if (options && typeof options.token === 'string' && options.token) {
      try {
        const decodedToken: any = jwt.verify(options.token, JWT_SECRET);
        const userId = typeof decodedToken.userId === 'string'
          ? parseInt(decodedToken.userId, 10)
          : decodedToken.userId;

        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (user) {
          // Buscar personagem ativo
          const character = await prisma.character.findFirst({
            where: { 
              userId: user.id,
              isActive: true
            },
          });

          if (!character) {
            throw new Error("Nenhum personagem selecionado. Selecione um personagem antes de entrar no jogo.");
          }

          console.log(`✅ Usuário autenticado: ${user.email} com personagem ${character.name}`);
          return { user, character };
        } else {
          throw new Error("Usuário não encontrado.");
        }
      } catch (error: any) {
        console.error("❌ Erro na validação do token JWT:", error.message);
        throw error;
      }
    } else {
      throw new Error("Autenticação necessária. Token JWT ausente ou inválido.");
    }
  }

  async onCreate(options: any) {
    console.log("🎮 MainMapRoom criada - Sistema Completo");

    this.setState(new GameRoomState());
    this.prisma = (global as any).prisma;
    this.setPatchRate(100); // 10 Hz

    await this.loadMobTemplates();
    await this.spawnMobsByBiome();

    // Mensagens do cliente
    this.onMessage("input", (client: Client, data: any) => {
      this.handleInput(client, data);
    });

    // Loop de atualização
    this.tickInterval = setInterval(() => this.tick(), 100); // 10 Hz

    console.log("✅ MainMapRoom inicializada com sucesso");
  }

  async loadMobTemplates() {
    const templates = await this.prisma.mobTemplate.findMany();
    templates.forEach(template => {
      this.mobTemplates.set(template.type, template);
    });
    console.log(`📦 Carregados ${templates.length} templates de mobs`);
  }

  async spawnMobsByBiome() {
    const zones = [
      [0, 0, 10],    // Floresta
      [1, 0, 8],     // Deserto
      [0, -1, 6],    // Pântano
      [-1, 0, 5],    // Neve
      [0, 1, 4],     // Vulcão
      [1, -1, 4],    // Montanhas
      [-1, -1, 5],   // Tundra
      [-1, 1, 4],    // Caverna
      [1, 1, 6],     // Praia
    ];

    for (const [zoneX, zoneY, count] of zones) {
      await this.spawnMobsInZone(zoneX, zoneY, count);
    }

    console.log(`🐛 Total de ${this.state.mobs.size} mobs spawnados no mapa`);
  }

  async spawnMobsInZone(zoneX: number, zoneY: number, count: number) {
    for (let i = 0; i < count; i++) {
      const localX = Math.random() * ZONE_WIDTH;
      const localZ = Math.random() * ZONE_HEIGHT;
      const worldX = (zoneX * ZONE_WIDTH) + localX;
      const worldZ = (zoneY * ZONE_HEIGHT) + localZ;
      await this.spawnMob(worldX, worldZ);
    }
  }

  async spawnMob(x: number, z: number) {
    const mobType = getBiomeAt(x, z);
    const template = this.mobTemplates.get(mobType);

    if (!template) {
      console.warn(`⚠️ Template não encontrado para ${mobType}`);
      return;
    }

    const mobId = `mob_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mob = new MobState();
    
    mob.id = mobId;
    mob.type = mobType;
    mob.name = template.name;
    mob.x = x;
    mob.y = 0;
    mob.z = z;
    mob.hp = template.hp;
    mob.maxHp = template.hp;
    mob.level = template.level;
    mob.attackPower = template.attackPower;
    mob.defense = template.defense;
    mob.attackRange = template.attackRange;
    mob.attackSpeed = template.attackSpeed;
    mob.moveSpeed = template.moveSpeed;
    mob.xpReward = template.xpReward;
    mob.spawnTime = Date.now();
    mob.lastAttackTime = 0;

    this.state.mobs.set(mobId, mob);
  }

  async onJoin(client: Client, options: any) {
    const { user, character } = client.auth as { user: User; character: Character };

    if (!user || !character) {
      console.error("Usuário ou personagem não autenticado");
      client.leave();
      return;
    }

    // Verificar sessão única
    const existingSessionId = this.userSessions.get(user.id);
    if (existingSessionId && existingSessionId !== client.sessionId) {
      console.log(`⚠️ ${user.email} já está logado. Desconectando sessão anterior...`);
      const existingClient = Array.from(this.clients).find(c => c.sessionId === existingSessionId);
      if (existingClient) {
        existingClient.send("kicked", {
          reason: "Nova sessão detectada. Você foi desconectado."
        });
        setTimeout(() => existingClient.leave(4000), 100);
      }
      this.state.players.delete(existingSessionId);
    }

    this.userSessions.set(user.id, client.sessionId);

    // Criar jogador com stats da classe
    const classConfig = CLASS_CONFIGS[character.class] || CLASS_CONFIGS.warrior;
    const player = new PlayerState();
    
    player.id = client.sessionId;
    player.email = user.email;
    player.class = character.class;
    player.characterId = character.id;
    player.x = character.x;
    player.y = character.y;
    player.z = character.z;
    player.hp = character.hp;
    player.maxHp = character.maxHp;
    player.xp = character.xp;
    player.level = character.level;
    player.attackPower = character.attackPower;
    player.defense = character.defense;
    player.attackRange = character.attackRange;
    player.attackSpeed = character.attackSpeed;
    player.moveSpeed = character.moveSpeed;
    player.lastAttackTime = 0;

    this.state.players.set(client.sessionId, player);

    console.log(`👤 ${user.email} (${character.name} - ${character.class}) entrou no jogo`);

    // Notificar outros jogadores
    this.broadcast("player_joined", {
      id: client.sessionId,
      email: user.email,
      class: character.class,
      level: character.level,
    }, { except: client });
  }

  handleInput(client: Client, data: any) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // Movimento
    if (data.vx !== undefined || data.vy !== undefined) {
      const delta = 0.016;
      const serverVx = (data.vx || 0) / 50;
      const serverVy = (data.vy || 0) / 50;

      let newX = player.x + serverVx * delta;
      let newZ = player.z + serverVy * delta;

      const clamped = clampToMap(newX, newZ);
      player.x = clamped.x;
      player.z = clamped.z;
    }

    // Ataque
    if (data.action === "attack") {
      const now = Date.now();
      const attackCooldown = 1000 / player.attackSpeed;

      if (now - player.lastAttackTime >= attackCooldown) {
        this.playerAttackMob(player);
        player.lastAttackTime = now;
      }
    }
  }

  playerAttackMob(player: PlayerState) {
    let closestMob: MobState | null = null;
    let closestDist = Infinity;

    this.state.mobs.forEach((mob) => {
      const mobState = mob as MobState;
      if (mobState.hp <= 0) return;
      
      const dx = mobState.x - player.x;
      const dz = mobState.z - player.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= player.attackRange / 50 && dist < closestDist) {
        closestDist = dist;
        closestMob = mobState;
      }
    });

    if (!closestMob) return;

    const targetMob = closestMob as MobState;
    const baseDamage = player.attackPower;
    const damage = Math.max(1, baseDamage - targetMob.defense);
    targetMob.hp = Math.max(0, targetMob.hp - damage);

    console.log(`⚔️ ${player.email} atacou ${targetMob.name} por ${damage} de dano`);

    if (targetMob.hp <= 0) {
      this.handleMobDeath(targetMob, player);
    }
  }

  async handleMobDeath(mob: MobState, killerPlayer: PlayerState) {
    console.log(`💀 ${mob.name} morreu!`);

    // XP para o jogador
    killerPlayer.xp += mob.xpReward;

    this.broadcast("xp_gained", {
      playerId: killerPlayer.id,
      amount: mob.xpReward,
      newXp: killerPlayer.xp,
      level: killerPlayer.level
    });

    // Verificar level up
    await this.checkLevelUp(killerPlayer);

    // Sistema de drops
    const template = this.mobTemplates.get(mob.type);
    if (template && template.possibleDrops) {
      const dropRoll = Math.random();
      
      if (dropRoll <= template.dropRate) {
        await this.dropItem(mob, killerPlayer, template);
      }
    }

    // Remover mob
    this.state.mobs.delete(mob.id);
    this.broadcast("mob_dead", { id: mob.id });

    // Respawn após 30s
    setTimeout(() => this.respawnMob(mob.x, mob.z), 30000);

    // Salvar progresso do jogador
    await this.saveCharacter(killerPlayer);
  }

  async dropItem(mob: MobState, player: PlayerState, template: MobTemplate) {
    const possibleDrops = template.possibleDrops as number[];
    const randomItemId = possibleDrops[Math.floor(Math.random() * possibleDrops.length)];

    const item = await this.prisma.item.findUnique({
      where: { id: randomItemId }
    });

    if (item) {
      const character = await this.prisma.character.findUnique({
        where: { id: player.characterId }
      });

      if (character) {
        const inventory = (character.inventory as any[]) || [];
        inventory.push({
          itemId: item.id,
          name: item.name,
          type: item.type,
          rarity: item.rarity,
          data: item.data,
          equippedAt: null
        });

        await this.prisma.character.update({
          where: { id: player.characterId },
          data: { inventory: inventory }
        });

        this.clients.find(c => c.sessionId === player.id)?.send("item_dropped", {
          item: {
            id: item.id,
            name: item.name,
            type: item.type,
            rarity: item.rarity,
            data: item.data
          },
          mobId: mob.id,
          mobType: mob.type
        });

        console.log(`💎 ${player.email} recebeu ${item.name}!`);
      }
    }
  }

  async checkLevelUp(player: PlayerState) {
    const xpNeeded = player.level * 100;

    if (player.xp >= xpNeeded) {
      player.level += 1;
      player.xp -= xpNeeded;

      const classConfig = CLASS_CONFIGS[player.class] || CLASS_CONFIGS.warrior;
      player.maxHp += classConfig.hpPerLevel;
      player.hp = player.maxHp; // Curar completamente
      player.attackPower += classConfig.attackPerLevel;
      player.defense += classConfig.defensePerLevel;

      console.log(`⭐ ${player.email} alcançou level ${player.level}!`);

      this.broadcast("player_levelup", {
        playerId: player.id,
        playerName: player.email,
        newLevel: player.level,
        newStats: {
          hp: player.hp,
          maxHp: player.maxHp,
          attackPower: player.attackPower,
          defense: player.defense
        }
      });

      await this.saveCharacter(player);

      // Verificar múltiplos level ups
      if (player.xp >= player.level * 100) {
        await this.checkLevelUp(player);
      }
    }
  }

  async saveCharacter(player: PlayerState) {
    try {
      await this.prisma.character.update({
        where: { id: player.characterId },
        data: {
          x: player.x,
          y: player.y,
          z: player.z,
          hp: player.hp,
          maxHp: player.maxHp,
          xp: player.xp,
          level: player.level,
          attackPower: player.attackPower,
          defense: player.defense,
          lastLogin: new Date()
        }
      });
    } catch (error) {
      console.error(`Erro ao salvar personagem:`, error);
    }
  }

  tick() {
    const now = Date.now();

    // IA dos mobs: atacar jogadores
    this.state.mobs.forEach((mob: MobState) => {
      if (mob.hp <= 0) return;

      // Encontrar jogador mais próximo
      let closestPlayer: PlayerState | null = null;
      let closestDistance = Infinity;

      this.state.players.forEach((player: PlayerState) => {
        const dx = player.x - mob.x;
        const dz = player.z - mob.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPlayer = player;
        }
      });

      if (!closestPlayer) {
        // Movimento aleatório se não houver jogador próximo
        if (now - mob.lastMoveTime > 2000) {
          mob.x += (Math.random() - 0.5) * 0.5;
          mob.z += (Math.random() - 0.5) * 0.5;
          mob.lastMoveTime = now;
        }
        return;
      }

      const attackRangeServer = mob.attackRange / 50;

      // Se jogador está no alcance, atacar
      if (closestDistance <= attackRangeServer) {
        const timeSinceLastAttack = now - mob.lastAttackTime;
        const attackCooldown = 1000 / mob.attackSpeed;

        if (timeSinceLastAttack >= attackCooldown) {
          this.mobAttackPlayer(mob, closestPlayer);
          mob.lastAttackTime = now;
        }
      }
      // Se está próximo mas fora do alcance, mover em direção ao jogador
      else if (closestDistance < 5 && closestPlayer) { // Dentro de 5 unidades
        const targetPlayer = closestPlayer as PlayerState;
        const dirX = targetPlayer.x - mob.x;
        const dirZ = targetPlayer.z - mob.z;
        const length = Math.sqrt(dirX * dirX + dirZ * dirZ);

        if (length > 0) {
          const moveAmount = (mob.moveSpeed / 50) * 0.1; // Delta time
          mob.x += (dirX / length) * moveAmount;
          mob.z += (dirZ / length) * moveAmount;
        }
      }
      // Movimento aleatório se estiver longe
      else if (closestDistance > 5) {
        if (now - mob.lastMoveTime > 2000) {
          mob.x += (Math.random() - 0.5) * 0.5;
          mob.z += (Math.random() - 0.5) * 0.5;
          mob.lastMoveTime = now;
        }
      }
    });
  }

  mobAttackPlayer(mob: MobState, player: PlayerState) {
    const baseDamage = mob.attackPower;
    const damage = Math.max(1, baseDamage - player.defense);

    player.hp = Math.max(0, player.hp - damage);

    console.log(`🔥 ${mob.name} atacou ${player.email} por ${damage} de dano`);

    this.broadcast("player_damaged", {
      playerId: player.id,
      damage: damage,
      newHp: player.hp,
      maxHp: player.maxHp,
      attackerId: mob.id
    });

    if (player.hp <= 0) {
      this.handlePlayerDeath(player);
    }
  }

  async handlePlayerDeath(player: PlayerState) {
    console.log(`💀 ${player.email} morreu!`);

    this.broadcast("player_died", {
      playerId: player.id,
      playerName: player.email
    });

    // Respawn no centro da floresta
    player.x = 0;
    player.z = 0;
    player.hp = player.maxHp;

    // Penalidade de XP (perder 10%)
    const xpLoss = Math.floor(player.xp * 0.1);
    player.xp = Math.max(0, player.xp - xpLoss);

    console.log(`⚰️ ${player.email} respawnou, perdeu ${xpLoss} XP`);

    await this.saveCharacter(player);
  }

  async respawnMob(x: number, z: number) {
    const zoneX = Math.floor(x / ZONE_WIDTH);
    const zoneZ = Math.floor(z / ZONE_HEIGHT);

    const localX = Math.random() * ZONE_WIDTH;
    const localZ = Math.random() * ZONE_HEIGHT;

    const newX = (zoneX * ZONE_WIDTH) + localX;
    const newZ = (zoneZ * ZONE_HEIGHT) + localZ;

    await this.spawnMob(newX, newZ);
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);

    if (player) {
      console.log(`👋 ${player.email} saiu da sala`);

      // Salvar progresso
      await this.saveCharacter(player);

      // Remover sessão
      const currentSessionId = this.userSessions.get(player.characterId);
      if (currentSessionId === client.sessionId) {
        this.userSessions.delete(player.characterId);
      }

      this.state.players.delete(client.sessionId);
      this.broadcast("player_left", { id: client.sessionId });
    }
  }

  onDispose() {
    console.log("🧹 MainMapRoom disposed");
    if (this.tickInterval) clearInterval(this.tickInterval);
  }
}
