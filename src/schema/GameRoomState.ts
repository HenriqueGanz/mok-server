import { Schema, type, MapSchema } from "@colyseus/schema";

// Player State
export class PlayerState extends Schema {
  @type("string") id: string;
  @type("string") email: string;
  @type("number") x: number = 400;
  @type("number") y: number = 300;
  @type("number") z: number = 0;

  @type("number") hp: number = 100;
  @type("number") maxHp: number = 100;
  @type("number") xp: number = 0;
  @type("number") level: number = 1;

  @type("number") attackPower: number = 10;
  @type("number") defense: number = 5;
  @type("number") attackRange: number = 50;

  @type("number") lastAttackTime: number = 0;
}

// Mob State
export class MobState extends Schema {
  @type("string") id: string;
  @type("string") type: string = "slime";
  @type("number") x: number;
  @type("number") y: number;
  @type("number") z: number = 0;

  @type("number") hp: number;
  @type("number") maxHp: number;
  @type("number") level: number = 1;

  @type("number") attackPower: number = 5;
  @type("number") xpReward: number = 10;

  @type("boolean") isDead: boolean = false;
  @type("number") spawnTime: number;
  @type("number") lastMoveTime: number = 0;
}

// Main Room State
export class GameRoomState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: MobState }) mobs = new MapSchema<MobState>();

  @type("number") mapWidth: number = 1200;
  @type("number") mapHeight: number = 800;
  @type("number") serverTime: number = 0;
}
