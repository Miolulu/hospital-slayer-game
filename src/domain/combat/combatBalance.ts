export type CombatEnemyKind = 'chaser' | 'shooter' | 'disruptor' | 'tentacle' | 'bomber' | 'eye' | 'miniBoss' | 'boss';

export interface EnemyCombatStats {
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  coinChance: number;
  coinValue: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface AttackStatusGrowth {
  level: number;
  damageIncrease: number;
  durationIncrease: number;
  spreadTargets: number;
  spreadRadius: number;
}

export const MAX_WEAPON_ROTATION_SPEED = 9.5;

export const MAX_ENEMY_HEALTH_MULTIPLIER = 2.8;

const SMALL_ENEMY_SPEED_MULTIPLIER = 1.5;

export const DEFAULT_PICKUP_RADIUS = 132;

export type WeaponRangeClass = 'sword' | 'whip' | 'gun' | 'cannon';

/** Keep ranged weapons outside the melee envelope even when a legacy config has a low range. */
export function weaponAttackRange(type: 'melee' | 'ranged', weaponClass: WeaponRangeClass, configuredRange: number) {
  const safeRange = Math.max(0, Math.round(configuredRange));
  if (type === 'melee') return safeRange;
  return Math.max(safeRange, weaponClass === 'gun' ? 420 : 500);
}

export const FREE_UPGRADE_REFRESHES = 2;

export interface DailyWaveScaling {
  wave: number;
  stage: number;
  healthMultiplier: number;
  damageMultiplier: number;
  spawnIntervalMultiplier: number;
  baseBudget: number;
}

/** 每日挑战的波次压力曲线。所有倍率都按波次单调增加，便于验收和后续调参。 */
export function dailyWaveScaling(wave: number): DailyWaveScaling {
  const safeWave = Math.max(1, Math.min(50, Math.round(wave)));
  const stage = Math.ceil(safeWave / 10);
  const step = safeWave - 1;
  return {
    wave: safeWave,
    stage,
    healthMultiplier: Math.round((1 + step * 0.018) * 1000) / 1000,
    damageMultiplier: Math.round((1 + step * 0.012) * 1000) / 1000,
    spawnIntervalMultiplier: Math.max(0.66, Math.round((1 - step * 0.007) * 1000) / 1000),
    baseBudget: 42 + safeWave * 1.5 + (stage - 1) * 4,
  };
}

/** Builda 草稿中配置的付费刷新商品标识。价格由平台发布配置决定。 */
export const PAID_UPGRADE_REFRESH_SALE_ID = 'upgrade_refresh';

export const TOTAL_HOSPITAL_FLOORS = 30;

export function wavesPerFloorForFloor(floor: number) {
  // 主线每层固定 10 波，第 10 波为本层唯一小首领。
  void floor;
  return 10;
}

export const WEAPON_DAMAGE = {
  knife: 18,
  wardLantern: 28,
  thorn: 38,
  echo: 50,
  crown: 64,
  fleshTentacle: 78,
  laserEye: 94,
  sanityBomb: 112,
  voidScissors: 132,
  neonOrbit: 154,
  abyssDrill: 178,
  starCannon: 204,
  dreamMine: 232,
  eldritchWhip: 262,
  skullRail: 294,
  cosmicMortar: 330,
  godEye: 370,
  hospitalCore: 420,
} as const;

/** 前三波作为教学段，普通敌人生命不超过初始病院刀的 18 点伤害。 */
const normalEnemyHp = (wave: number) => {
  const safeWave = Math.max(1, Math.round(wave));
  if (safeWave <= 3) return 12 + safeWave * 2;
  return 28 + safeWave * 4;
};
const normalEnemyDamage = (wave: number) => 1.55 + Math.max(1, wave) * 0.35;

const openingWaveHp = (hp: number, wave: number) => Math.min(hp, wave <= 3 ? 18 : hp);

export function enemyCombatStats(kind: CombatEnemyKind, wave: number): EnemyCombatStats {
  const safeWave = Math.max(1, Math.min(20, Math.round(wave)));
  const baseHp = normalEnemyHp(safeWave);
  const baseDamage = normalEnemyDamage(safeWave);

  if (kind === 'shooter') {
    return {
      hp: openingWaveHp(Math.round(baseHp * 1.55), safeWave),
      speed: (28 + safeWave * 0.4) * SMALL_ENEMY_SPEED_MULTIPLIER,
      damage: baseDamage + 0.8,
      radius: 16,
      xp: 8,
      coinChance: 0.14,
      coinValue: 1,
    };
  }

  if (kind === 'disruptor') {
    return {
      hp: openingWaveHp(Math.round(baseHp * 2.35), safeWave),
      speed: (24 + safeWave * 0.35) * SMALL_ENEMY_SPEED_MULTIPLIER,
      damage: baseDamage + 0.6,
      radius: 18,
      xp: 10,
      coinChance: 0.18,
      coinValue: 1,
    };
  }

  if (kind === 'tentacle') {
    return {
      hp: openingWaveHp(Math.round(baseHp * 1.9), safeWave),
      speed: (34 + safeWave * 0.45) * SMALL_ENEMY_SPEED_MULTIPLIER,
      damage: baseDamage + 1.1,
      radius: 20,
      xp: 12,
      coinChance: 0.2,
      coinValue: 1,
    };
  }

  if (kind === 'bomber') {
    return {
      hp: openingWaveHp(Math.round(baseHp * 2.05), safeWave),
      speed: (30 + safeWave * 0.25) * SMALL_ENEMY_SPEED_MULTIPLIER,
      damage: baseDamage + 1.6,
      radius: 19,
      xp: 14,
      coinChance: 0.22,
      coinValue: 1,
    };
  }

  if (kind === 'eye') {
    return {
      hp: openingWaveHp(Math.round(baseHp * 2.25), safeWave),
      speed: (26 + safeWave * 0.2) * SMALL_ENEMY_SPEED_MULTIPLIER,
      damage: baseDamage + 2.2,
      radius: 21,
      xp: 16,
      coinChance: 0.25,
      coinValue: 2,
    };
  }

  if (kind === 'miniBoss') {
    return {
      hp: 500 + safeWave * 28,
      speed: 24,
      damage: 11.5 + safeWave * 0.3,
      radius: 28,
      xp: 60,
      coinChance: 1,
      coinValue: 4,
    };
  }

  if (kind === 'boss') {
    return {
      hp: 1700 + safeWave * 38,
      speed: 22,
      damage: 15.5,
      radius: 36,
      xp: 180,
      coinChance: 1,
      coinValue: 12,
    };
  }

  return {
    hp: openingWaveHp(baseHp, safeWave),
    speed: (47 + safeWave * 1.8) * SMALL_ENEMY_SPEED_MULTIPLIER,
    damage: baseDamage,
    radius: 15,
    xp: 6,
    coinChance: 0.11,
    coinValue: 1,
  };
}

export function pointToSegmentDistance(point: Point, start: Point, end: Point) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared));
  const closestX = start.x + segmentX * projection;
  const closestY = start.y + segmentY * projection;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

export function bladeTouchesCircle(start: Point, end: Point, center: Point, radius: number, bladeHalfWidth = 4) {
  return pointToSegmentDistance(center, start, end) <= radius + bladeHalfWidth;
}

export function enemyVisualRadius(kind: CombatEnemyKind, radius: number) {
  return kind === 'chaser' ? radius * Math.SQRT2 : radius;
}

export function effectiveRotationSpeed(baseSpeed: number, multiplier: number) {
  return Math.min(MAX_WEAPON_ROTATION_SPEED, baseSpeed * multiplier);
}

export function upgradedRotationMultiplier(baseSpeed: number, multiplier: number) {
  if (baseSpeed <= 0) return multiplier;
  return Math.min(MAX_WEAPON_ROTATION_SPEED / baseSpeed, multiplier * 1.15);
}

export function rotationsPerSecond(speed: number) {
  return speed / (Math.PI * 2);
}

export function weaponDamageAtLevel(baseDamage: number, level: number, globalBonus = 0, typeBonus = 0) {
  return Math.round(baseDamage + globalBonus + typeBonus + Math.max(0, level - 1) * 2);
}

/** Returns the total XP needed to move from the given level to the next level. */
export function experienceRequiredForLevel(level: number) {
  const safeLevel = Math.max(1, Math.floor(level));
  const step = safeLevel - 1;
  return Math.round(50 + step * 18 + Math.pow(step, 1.55) * 4);
}

/** Returns true once free level-up card refreshes have been used. */
export function upgradeRefreshRequiresPayment(refreshCount: number) {
  return Math.max(0, Math.floor(refreshCount)) >= FREE_UPGRADE_REFRESHES;
}

/** Returns the next permanent-in-run growth step for an attack status card. */
export function attackStatusGrowth(currentLevel: number, cardTier: number): AttackStatusGrowth {
  const level = Math.max(0, Math.floor(currentLevel)) + 1;
  const tier = Math.max(1, Math.min(3, Math.floor(cardTier)));
  const damageIncrease = [2, 3.5, 5][tier - 1];
  const durationIncrease = [0.8, 1.2, 1.6][tier - 1];
  const spreadTargets = level < 3 ? 0 : Math.min(3, 1 + Math.floor((level - 3) / 2));
  const spreadRadius = spreadTargets === 0 ? 0 : Math.min(180, 96 + (level - 3) * 14);
  return { level, damageIncrease, durationIncrease, spreadTargets, spreadRadius };
}

/** Returns true once the current wave must stop creating new enemies. */
export function waveSpawningComplete(waveTimer: number, waveLength: number, waveSpawned: number, waveBudget: number) {
  return waveTimer >= Math.max(0, waveLength) || waveSpawned >= Math.max(0, waveBudget);
}

export function volleyDamageMultiplier(index: number) {
  return index === 0 ? 1 : 0.55;
}

export function meleeTargetLimit(ammo: number) {
  return Math.max(2, Math.floor(ammo) * 2);
}

export function isWithinPickupRange(distanceToDrop: number, pickupRadius: number, magnet = 0) {
  return distanceToDrop <= pickupRadius + magnet;
}

/** Returns the current pull speed for a drop once it enters the magnet field. */
export function pickupPullSpeed(distanceToDrop: number, pickupRadius: number) {
  const distance = Math.max(0, distanceToDrop);
  const radius = Math.max(1, pickupRadius);
  return 300 + Math.max(0, radius - distance) * 5;
}

/** Keeps stronger builds from one-shotting the same wave of enemies. */
export function enemyHealthMultiplier(level: number, weaponTier: number, ammo: number) {
  const levelScale = 1 + Math.max(0, level - 1) * 0.06;
  const weaponScale = 1 + Math.max(0, weaponTier) * 0.2;
  const ammoScale = 1 + Math.max(0, ammo - 1) * 0.05;
  return Math.min(MAX_ENEMY_HEALTH_MULTIPLIER, levelScale * weaponScale * ammoScale);
}

/** 主线前三波普通敌人的实际生命上限，保证初始武器一击可击倒。 */
export function openingWaveEnemyHealthCap(kind: CombatEnemyKind, wave: number, weaponDamage: number) {
  const safeWave = Math.max(1, Math.round(wave));
  if (safeWave > 3 || kind === 'miniBoss' || kind === 'boss') return Number.POSITIVE_INFINITY;
  return Math.max(1, Math.round(weaponDamage));
}
