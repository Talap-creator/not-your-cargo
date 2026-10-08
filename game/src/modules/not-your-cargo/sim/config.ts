// Starting balance from docs/TZ-STEPPE-RAIDERS.md (G01, G02, P02–P04, N02). Test numbers, not final.
// Any change to gameplay numbers bumps RULES_VERSION: peers with different versions refuse to start.
export const RULES_VERSION = "nyc-p1-1";

export const TICK_HZ = 30;
export const DT = 1 / TICK_HZ;
export const SNAPSHOT_HZ = 15;
export const INPUT_HZ = 30;

export const VIEW_W = 960;
export const VIEW_H = 540;

export const BIKE = {
  radius: 16,
  hp: 100,
  speed: 240,
  cargoSlow: 0.85,
  dashSpeed: 600,
  dashTime: 0.18,
  dashCooldown: 4,
};

export type WeaponId = "mg" | "shotgun" | "laser" | "rocket";
export const ALL_WEAPONS: WeaponId[] = ["mg", "shotgun", "laser", "rocket"];

export interface WeaponSpec {
  id: WeaponId;
  damage: number;
  pellets: number;
  spread: number; // radians, total cone
  interval: number; // seconds between shots
  magazine: number;
  reload: number;
  bulletSpeed: number;
  ttl: number;
  /** Area damage radius (rockets); each target is hit at most once per explosion. */
  splash?: number;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  mg: {
    id: "mg",
    damage: 8,
    pellets: 1,
    spread: 0.05,
    interval: 1 / 8,
    magazine: 24,
    reload: 1.4,
    bulletSpeed: 750,
    ttl: 0.9,
  },
  shotgun: {
    id: "shotgun",
    damage: 7,
    pellets: 5,
    spread: 0.42,
    interval: 0.8,
    magazine: 4,
    reload: 1.6,
    bulletSpeed: 650,
    ttl: 0.45,
  },
  // Pulse beam: a very fast projectile swept per tick = hitscan within 600 units; the first wall or
  // target stops it (G02).
  laser: {
    id: "laser",
    damage: 18,
    pellets: 1,
    spread: 0,
    interval: 0.45,
    magazine: 8,
    reload: 1.8,
    bulletSpeed: 6000,
    ttl: 0.1,
  },
  rocket: {
    id: "rocket",
    damage: 28,
    pellets: 1,
    spread: 0.02,
    interval: 1,
    magazine: 3,
    reload: 2,
    bulletSpeed: 420,
    ttl: 1.8,
    splash: 55,
  },
};

export const CARGO = {
  radius: 12,
  pickupRange: 48,
  pickupHold: 0.5,
  deliverHold: 1.5,
  respawnDelay: 3,
};

export const PVP = {
  arenaW: 1600,
  arenaH: 1000,
  winDeliveries: 3,
  matchTime: 240,
  suddenDeath: 60,
  respawn: 3,
  spawnShield: 1,
  repairEvery: 20,
  repairHp: 25,
  repairRadius: 22,
  inputTimeout: 0.25,
  countdown: 3,
};

export const ENEMY = {
  raiderHp: 40,
  raiderSpeed: 150,
  raiderRadius: 15,
  raiderBurst: 3,
  raiderBurstGap: 0.15,
  raiderCooldown: 1.8,
  raiderDamage: 5,
  raiderRange: 380,
  raiderBulletSpeed: 480,
  minSpawnDistance: 180,
  spawnWarning: 1.2,
};

export const MISSION = {
  quietStart: 20, // C01: no enemy fire during the first 20 s
};
