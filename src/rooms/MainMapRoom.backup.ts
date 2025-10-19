import { Room, Client } from "colyseus";
import { User, PrismaClient, MobTemplate, Character } from "@prisma/client";
import jwt from "jsonwebtoken";
import { CLASS_CONFIGS } from "../routes/characters";

// Constantes do Sistema de Biomas
const ZONE_WIDTH = 24;  // 1200 pixels / 50 scale = 24 unidades do servidor
const ZONE_HEIGHT = 16; // 800 pixels / 50 scale = 16 unidades do servidor

const MAP_BOUNDS = {
  minX: -24,  // Zona -1 (Neve)
  maxX: 48,   // Zona 1 (Deserto) = 24 + 24
  minZ: -16,  // Zona -1 (Pântano)
  maxZ: 32    // Zona 1 (Vulcão) = 16 + 16
};

// Determinar bioma baseado nas coordenadas
function getBiomeAt(x: number, z: number): string {
  const zoneX = Math.floor(x / ZONE_WIDTH);
  const zoneY = Math.floor(z / ZONE_HEIGHT);

  // Determinar bioma baseado na zona
  if (zoneX === 0 && zoneY === 0) return "forest";
  if (zoneX === 1 && zoneY === 0) return "desert";
  if (zoneX === 0 && zoneY === -1) return "swamp";
  if (zoneX === -1 && zoneY === 0) return "snow";
  if (zoneX === 0 && zoneY === 1) return "volcano";

  return "forest"; // Padrão
}

// Limitar coordenadas aos limites do mapa
function clampToMap(x: number, z: number): { x: number, z: number } {
  return {
    x: Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, x)),
    z: Math.max(MAP_BOUNDS.minZ, Math.min(MAP_BOUNDS.maxZ, z))
  };
}

interface PlayerState {
  id: string;
  userId: number; // Adicionar userId para identificar o usuário autenticado
  email: string; // Adicionar email para exibir ou usar
  x: number;
  y: number;
  z: number;
  hp: number;
  class: string;
}

interface MobState {
  id: string;
  type: string; // IMPORTANTE: tipo do mob para o cliente determinar cor
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  level: number;
  xpReward: number;
}

export class MainMapRoom extends Room<any> {
  // Estado do jogo (poderia ser um State no Colyseus para auto-sincronização)
  players: Map<string, PlayerState> = new Map();
  mobs: Map<string, MobState> = new Map();
  tickInterval?: NodeJS.Timeout;

  // Mapa para controlar sessões únicas: userId -> sessionId
  userSessions: Map<number, string> = new Map();

  // Templates de mobs carregados do banco
  mobTemplates: Map<string, MobTemplate> = new Map();
  prisma: PrismaClient;

  // Implementar onAuth diretamente na classe Room
  async onAuth(client: Client, options: any) {
    console.log("🔐 MainMapRoom.onAuth chamado para client:", client.sessionId);
    console.log("🔐 Opções recebidas:", options);

    const prisma: PrismaClient = (global as any).prisma;
    const JWT_SECRET: string = (global as any).JWT_SECRET;

    if (options && typeof options.token === 'string' && options.token) {
      console.log("🔐 Token recebido:", options.token);
      try {
        const decodedToken: any = jwt.verify(options.token, JWT_SECRET);
        console.log("✅ Token decodificado:", decodedToken);

        const userId = typeof decodedToken.userId === 'string'
          ? parseInt(decodedToken.userId, 10)
          : decodedToken.userId;
        console.log("🔍 Buscando userId:", userId);

        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (user) {
          console.log("✅ Usuário autenticado no Colyseus:", user.email);
          return user; // Retorna o objeto do usuário que será armazenado em client.auth
        } else {
          console.log("❌ Usuário não encontrado para o token (ID:", userId, ")");
          throw new Error("Usuário não encontrado.");
        }
      } catch (error: any) {
        console.error("❌ Erro na validação do token JWT:", error.message);
        if (error.name === 'TokenExpiredError') {
          throw new Error("Token JWT expirado.");
        } else if (error.name === 'JsonWebTokenError') {
          throw new Error("Token JWT inválido.");
        } else {
          throw new Error("Erro de autenticação: " + error.message);
        }
      }
    } else {
      console.log("❌ Token ausente ou formato incorreto");
      throw new Error("Autenticação necessária. Token JWT ausente ou inválido.");
    }
  }

  async onCreate(options: any) {
    console.log("🎮 MainMapRoom criada - Sistema de Biomas ativo");

    this.prisma = (global as any).prisma;

    // Define taxa de sincronização do estado (10 Hz para evitar conflitos com movimento)
    this.setPatchRate(100); // 100ms = 10 vezes por segundo

    // Carregar templates de mobs do banco
    await this.loadMobTemplates();

    // Receive messages from client (input)
    this.onMessage("input", (client: Client, data: any) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;

      // Movimento com limites do mapa
      if (data.vx !== undefined || data.vy !== undefined) {
        // Cliente envia velocidade em pixels/segundo
        // Servidor usa escala 1:50 (1 unidade servidor = 50 pixels cliente)
        // Delta time é assumido como ~16ms (60 FPS)
        const delta = 0.016; // 1/60 segundos

        // Converter velocidade do cliente (pixels/seg) para servidor (unidades/seg)
        const serverVx = (data.vx || 0) / 50; // Dividir por worldScale
        const serverVy = (data.vy || 0) / 50;

        let newX = player.x + serverVx * delta;
        let newZ = player.z + serverVy * delta;

        console.log(`📥 Input: vx=${data.vx}, vy=${data.vy} | Pos: (${player.x.toFixed(2)}, ${player.z.toFixed(2)}) → (${newX.toFixed(2)}, ${newZ.toFixed(2)})`);

        // Aplicar limites do mapa
        const clamped = clampToMap(newX, newZ);
        player.x = clamped.x;
        player.z = clamped.z;
      } if (data.action === "attack") {
        // handle simple attack: damage nearest mob in range
        for (const mob of this.mobs.values()) {
          const dx = mob.x - player.x;
          const dz = mob.z - player.z;
          const dist2 = dx * dx + dz * dz;
          if (dist2 < 4) {
            mob.hp -= 10;
            if (mob.hp <= 0) {
              this.mobs.delete(mob.id);
              this.broadcast("mob_dead", { id: mob.id });
              // Respawn mob na mesma zona após delay
              setTimeout(() => this.respawnMob(mob.x, mob.z), 30000);
            }
            break;
          }
        }
      }
    });

    // Spawn mobs distribuídos por bioma
    await this.spawnMobsByBiome();

    // Tick loop
    this.tickInterval = setInterval(() => this.tick(), 1000 / 12); // 12 Hz

    console.log("✅ MainMapRoom inicializada com sucesso");
  }

  async loadMobTemplates() {
    const templates = await this.prisma.mobTemplate.findMany();
    templates.forEach(template => {
      this.mobTemplates.set(template.type, template);
    });
    console.log(`📦 Carregados ${templates.length} templates de mobs:`,
      templates.map(t => t.type).join(", "));
  }

  async spawnMobsByBiome() {
    // Floresta (centro) - 10 mobs
    await this.spawnMobsInZone(0, 0, 10);

    // Deserto - 8 mobs
    await this.spawnMobsInZone(1, 0, 8);

    // Pântano - 6 mobs
    await this.spawnMobsInZone(0, -1, 6);

    // Neve - 5 mobs
    await this.spawnMobsInZone(-1, 0, 5);

    // Vulcão - 4 mobs (mais difícil)
    await this.spawnMobsInZone(0, 1, 4);

    console.log(`🐛 Total de ${this.mobs.size} mobs spawnados no mapa`);
  }

  async spawnMobsInZone(zoneX: number, zoneY: number, count: number) {
    for (let i = 0; i < count; i++) {
      // Posição aleatória dentro da zona
      const localX = Math.random() * ZONE_WIDTH;
      const localZ = Math.random() * ZONE_HEIGHT;

      // Converter para coordenadas mundiais
      const worldX = (zoneX * ZONE_WIDTH) + localX;
      const worldZ = (zoneY * ZONE_HEIGHT) + localZ;

      await this.spawnMob(worldX, worldZ);
    }
  }

  async spawnMob(x: number, z: number) {
    const biome = getBiomeAt(x, z);
    const mobId = `mob_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Determinar tipo de mob baseado no bioma
    let mobType = "slime";
    switch (biome) {
      case "desert": mobType = "desert_slime"; break;
      case "swamp": mobType = "swamp_slime"; break;
      case "snow": mobType = "ice_slime"; break;
      case "volcano": mobType = "fire_slime"; break;
      default: mobType = "slime"; break;
    }

    // Buscar template do banco
    const template = this.mobTemplates.get(mobType);
    if (!template) {
      console.warn(`⚠️ Template não encontrado para ${mobType}, usando slime padrão`);
      return;
    }

    const mob: MobState = {
      id: mobId,
      type: mobType,
      x,
      y: 0,
      z,
      hp: template.hp,
      maxHp: template.hp,
      level: template.level,
      xpReward: template.xpReward
    };

    this.mobs.set(mobId, mob);

    console.log(`🐛 Spawned ${mobType} at (${x.toFixed(1)}, ${z.toFixed(1)}) in ${biome}`);
  }

  async respawnMob(x: number, z: number) {
    // Respawn mob na mesma zona
    const zoneX = Math.floor(x / ZONE_WIDTH);
    const zoneZ = Math.floor(z / ZONE_HEIGHT);

    const localX = Math.random() * ZONE_WIDTH;
    const localZ = Math.random() * ZONE_HEIGHT;

    const newX = (zoneX * ZONE_WIDTH) + localX;
    const newZ = (zoneZ * ZONE_HEIGHT) + localZ;

    await this.spawnMob(newX, newZ);
    console.log(`🔄 Mob respawnado em (${newX.toFixed(1)}, ${newZ.toFixed(1)})`);
  }

  // onAuth do Colyseus já validou o token e retornou o objeto User
  // que estará disponível em client.auth
  async onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined MainMapRoom. Auth data:", client.auth);

    const user = client.auth as User; // O tipo User deve vir do Prisma

    if (!user) {
      console.error("Usuário não autenticado tentando entrar na sala.");
      client.leave(); // Força o cliente a sair se não estiver autenticado
      return;
    }

    // Verificar se o usuário já está logado em outra sessão
    const existingSessionId = this.userSessions.get(user.id);
    if (existingSessionId && existingSessionId !== client.sessionId) {
      console.log(`⚠️ ${user.email} já está logado na sessão ${existingSessionId}. Desconectando sessão anterior...`);

      // Buscar o cliente anterior e forçar desconexão
      const existingClient = Array.from(this.clients).find(c => c.sessionId === existingSessionId);
      if (existingClient) {
        // Enviar mensagem avisando que foi desconectado
        existingClient.send("kicked", {
          reason: "Nova sessão detectada. Você foi desconectado porque fez login em outro lugar."
        });

        // Forçar desconexão após pequeno delay para garantir que a mensagem foi enviada
        setTimeout(() => {
          existingClient.leave(4000); // Código 4000 = kicked/duplicated session
        }, 100);
      }

      // Remover o jogador anterior do mapa
      this.players.delete(existingSessionId);
    }

    // Registrar nova sessão
    this.userSessions.set(user.id, client.sessionId);
    console.log(`✅ Sessão registrada para ${user.email}: ${client.sessionId}`);

    // Jogadores sempre spawnam no CENTRO da FLORESTA
    const newPlayer: PlayerState = {
      id: client.sessionId,
      userId: user.id,
      email: user.email,
      x: 0, // Centro da floresta
      y: 0,
      z: 0, // Centro da floresta
      hp: 100,
      class: options.class ?? "warrior",
    };
    this.players.set(client.sessionId, newPlayer);

    console.log(`👤 ${user.email} spawnou na Floresta (0, 0)`);

    // Enviar estado inicial para o cliente que acabou de entrar
    client.send("init", {
      id: client.sessionId,
      players: Array.from(this.players.values()),
      mobs: Array.from(this.mobs.values()),
    });

    // Avisar os outros clientes que um novo jogador entrou
    this.broadcast("player_joined", {
      id: client.sessionId,
      x: newPlayer.x,
      y: newPlayer.y,
      z: newPlayer.z,
      email: newPlayer.email, // Enviar o email para identificação visual
    }, { except: client }); // Não enviar para o próprio cliente
  }

  onLeave(client: Client, consented: boolean) {
    const player = this.players.get(client.sessionId);

    if (player) {
      console.log(`👋 ${player.email} (${client.sessionId}) saiu da sala`);

      // Remover a sessão do usuário apenas se for a sessão atual
      const currentSessionId = this.userSessions.get(player.userId);
      if (currentSessionId === client.sessionId) {
        this.userSessions.delete(player.userId);
        console.log(`🔓 Sessão liberada para userId: ${player.userId}`);
      }

      this.players.delete(client.sessionId);
      this.broadcast("player_left", { id: client.sessionId });
    } else {
      console.log(client.sessionId, "left (no player data)");
    }
  }

  onDispose() {
    console.log("Disposing MainMapRoom");
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  tick() {
    // simple mob AI: move randomly or chase nearest player
    for (const mob of this.mobs.values()) {
      // pick a random nearby direction
      mob.x += (Math.random() - 0.5) * 0.4;
      mob.z += (Math.random() - 0.5) * 0.4;
    }

    // broadcast simplified snapshot: list of players and mobs
    this.broadcast("snapshot", {
      players: Array.from(this.players.values()),
      mobs: Array.from(this.mobs.values()),
    });
  }
}