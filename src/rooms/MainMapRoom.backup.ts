import { Room, Client } from "colyseus";
import { User, PrismaClient } from "@prisma/client"; // Importar tipo User do Prisma
import jwt from "jsonwebtoken";

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
  x: number;
  y: number;
  z: number;
  hp: number;
}

export class MainMapRoom extends Room<any> {
  // Estado do jogo (poderia ser um State no Colyseus para auto-sincronização)
  players: Map<string, PlayerState> = new Map();
  mobs: Map<string, MobState> = new Map();
  tickInterval?: NodeJS.Timeout;

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

  onCreate(options: any) {
    console.log("MainMapRoom created with options:", options);

    // Receive messages from client (input)
    this.onMessage("input", (client: Client, data: any) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;
      // Expected data: { vx, vy, vz, action }
      // For simplicity apply directly (server authoritative movement)
      if (data.vx !== undefined) player.x += data.vx;
      if (data.vy !== undefined) player.y += data.vy;
      if (data.vz !== undefined) player.z += data.vz;

      if (data.action === "attack") {
        // handle simple attack: damage nearest mob in range
        for (const mob of this.mobs.values()) {
          const dx = mob.x - player.x;
          const dy = mob.y - player.y;
          const dz = mob.z - player.z;
          const dist2 = dx * dx + dy * dy + dz * dz;
          if (dist2 < 4) {
            mob.hp -= 10;
            if (mob.hp <= 0) {
              this.mobs.delete(mob.id);
              // notify clients of mob death and possible drop
              this.broadcast("mob_dead", { id: mob.id });
            }
            break;
          }
        }
      }
    });

    // Spawn simple mobs
    for (let i = 0; i < 10; i++) {
      const id = `mob_${i}`;
      this.mobs.set(id, {
        id,
        x: (Math.random() - 0.5) * 40,
        y: 0,
        z: (Math.random() - 0.5) * 40,
        hp: 30,
      });
    }

    // Tick loop
    this.tickInterval = setInterval(() => this.tick(), 1000 / 12); // 12 Hz
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

    const newPlayer: PlayerState = {
      id: client.sessionId,
      userId: user.id, // Armazenar o ID do usuário autenticado
      email: user.email, // Armazenar o email para identificação
      x: options.pos?.x ?? (Math.random() - 0.5) * 10,
      y: options.pos?.y ?? 0,
      z: options.pos?.z ?? (Math.random() - 0.5) * 10,
      hp: 100,
      class: options.class ?? "warrior",
    };
    this.players.set(client.sessionId, newPlayer);

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
    console.log(client.sessionId, "left");
    this.players.delete(client.sessionId);
    this.broadcast("player_left", { id: client.sessionId });
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