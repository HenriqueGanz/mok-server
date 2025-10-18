import { Room, Client } from "colyseus";

interface PlayerState {
  id: string;
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
  players: Map<string, PlayerState> = new Map();
  mobs: Map<string, MobState> = new Map();
  tickInterval?: NodeJS.Timeout;

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
      this.mobs.set(id, { id, x: (Math.random() - 0.5) * 40, y: 0, z: (Math.random() - 0.5) * 40, hp: 30 });
    }


    // Tick loop
    this.tickInterval = setInterval(() => this.tick(), 1000 / 12); // 12 Hz
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined");
    const newPlayer: PlayerState = {
      id: client.sessionId,
      x: options.pos?.x ?? (Math.random() - 0.5) * 10,
      y: options.pos?.y ?? 0,
      z: options.pos?.z ?? (Math.random() - 0.5) * 10,
      hp: 100,
      class: options.class ?? "warrior",
    };
    this.players.set(client.sessionId, newPlayer);


    // Send initial state to the joining client
    client.send("init", {
      id: client.sessionId,
      players: Array.from(this.players.values()),
      mobs: Array.from(this.mobs.values()),
    });
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