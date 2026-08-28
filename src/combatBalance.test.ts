import { describe, expect, it } from 'vitest';
import {
  attackStatusGrowth,
  bladeTouchesCircle,
  DEFAULT_PICKUP_RADIUS,
  dailyWaveScaling,
  enemyHealthMultiplier,
  effectiveRotationSpeed,
  enemyCombatStats,
  enemyVisualRadius,
  experienceRequiredForLevel,
  isWithinPickupRange,
  meleeTargetLimit,
  MAX_WEAPON_ROTATION_SPEED,
  MAX_ENEMY_HEALTH_MULTIPLIER,
  openingWaveEnemyHealthCap,
  PAID_UPGRADE_REFRESH_SALE_ID,
  pickupPullSpeed,
  rotationsPerSecond,
  TOTAL_HOSPITAL_FLOORS,
  upgradeRefreshRequiresPayment,
  upgradedRotationMultiplier,
  volleyDamageMultiplier,
  waveSpawningComplete,
  wavesPerFloorForFloor,
  weaponAttackRange,
  weaponDamageAtLevel,
  WEAPON_DAMAGE,
} from './combatBalance';

describe('hospital battle balance', () => {
  it('lets the first three waves regular enemies fall to one basic knife hit', () => {
    const knifeDamage = WEAPON_DAMAGE.knife;
    [1, 2, 3].forEach((wave) => {
      expect(enemyCombatStats('chaser', wave).hp).toBeLessThanOrEqual(knifeDamage);
    });
    expect(enemyCombatStats('shooter', 3).hp).toBeLessThanOrEqual(knifeDamage);
    expect(enemyCombatStats('chaser', 4).hp).toBeGreaterThan(knifeDamage);
    expect(openingWaveEnemyHealthCap('chaser', 3, knifeDamage)).toBe(knifeDamage);
    expect(openingWaveEnemyHealthCap('miniBoss', 3, knifeDamage)).toBe(Number.POSITIVE_INFINITY);
  });

  it('gives each regular enemy a distinct durability role', () => {
    const chaser = enemyCombatStats('chaser', 4).hp;
    const shooter = enemyCombatStats('shooter', 4).hp;
    const disruptor = enemyCombatStats('disruptor', 4).hp;
    expect(chaser).toBeLessThan(shooter);
    expect(shooter).toBeLessThan(disruptor);
  });

  it('keeps later special enemies durable across the 20-wave floor range', () => {
    const tentacle = enemyCombatStats('tentacle', 9);
    const bomber = enemyCombatStats('bomber', 12);
    const eye = enemyCombatStats('eye', 15);
    expect(tentacle.hp).toBeGreaterThan(enemyCombatStats('chaser', 9).hp);
    expect(bomber.hp).toBeGreaterThan(tentacle.hp);
    expect(eye.hp).toBeGreaterThan(bomber.hp);
    expect(enemyCombatStats('chaser', 18).hp).toBeGreaterThan(enemyCombatStats('chaser', 13).hp);
  });

  it('keeps boss durability clearly above regular enemies', () => {
    const regular = enemyCombatStats('disruptor', 5).hp;
    const miniBoss = enemyCombatStats('miniBoss', 5).hp;
    const boss = enemyCombatStats('boss', 13).hp;
    expect(miniBoss).toBeGreaterThan(regular * 5);
    expect(boss).toBeGreaterThan(miniBoss * 3);
  });

  it('only hits circles that touch the visible blade segment', () => {
    const start = { x: 16, y: 0 };
    const end = { x: 72, y: 0 };
    expect(bladeTouchesCircle(start, end, { x: 54, y: 10 }, 7)).toBe(true);
    expect(bladeTouchesCircle(start, end, { x: 0, y: 0 }, 15)).toBe(true);
    expect(bladeTouchesCircle(start, end, { x: -6, y: 0 }, 15)).toBe(false);
    expect(bladeTouchesCircle(start, end, { x: 94, y: 0 }, 15)).toBe(false);
  });

  it('uses the visible corner radius for rotated chasers', () => {
    expect(enemyVisualRadius('chaser', 15)).toBeCloseTo(15 * Math.SQRT2);
    expect(enemyVisualRadius('shooter', 16)).toBe(16);
  });

  it('raises rotation speed by fifteen percent and respects the cap', () => {
    const upgraded = upgradedRotationMultiplier(4.8, 1);
    expect(effectiveRotationSpeed(4.8, upgraded)).toBeCloseTo(5.52);
    expect(rotationsPerSecond(5.52)).toBeGreaterThan(rotationsPerSecond(4.8));
    expect(effectiveRotationSpeed(5.6, 20)).toBe(MAX_WEAPON_ROTATION_SPEED);
  });

  it('keeps weapon upgrades on a gradual damage curve', () => {
    expect(WEAPON_DAMAGE.knife).toBe(18);
    expect(WEAPON_DAMAGE.crown).toBeLessThan(70);
    expect(WEAPON_DAMAGE.hospitalCore).toBeGreaterThan(WEAPON_DAMAGE.godEye);
    expect(Object.keys(WEAPON_DAMAGE)).toHaveLength(18);
    expect(weaponDamageAtLevel(18, 1)).toBe(18);
    expect(weaponDamageAtLevel(18, 4, 6)).toBe(30);
    expect(volleyDamageMultiplier(0)).toBe(1);
    expect(volleyDamageMultiplier(1)).toBe(0.55);
    expect(meleeTargetLimit(1)).toBe(2);
    expect(meleeTargetLimit(2)).toBe(4);
  });

  it('keeps melee attacks close while giving guns and cannons a clear reach advantage', () => {
    expect(weaponAttackRange('melee', 'sword', 90)).toBe(90);
    expect(weaponAttackRange('melee', 'whip', 138)).toBe(138);
    expect(weaponAttackRange('ranged', 'gun', 120)).toBe(420);
    expect(weaponAttackRange('ranged', 'cannon', 120)).toBe(500);
    expect(weaponAttackRange('ranged', 'gun', 620)).toBe(620);
    expect(weaponAttackRange('ranged', 'gun', 120)).toBeGreaterThan(weaponAttackRange('melee', 'whip', 138));
    expect(weaponAttackRange('ranged', 'cannon', 120)).toBeGreaterThan(weaponAttackRange('melee', 'whip', 138));
  });

  it('uses a rising XP curve instead of one fixed level cost', () => {
    const costs = [1, 2, 3, 4, 5, 10].map(experienceRequiredForLevel);
    expect(costs[0]).toBe(50);
    expect(costs[1]).toBeGreaterThan(costs[0]);
    expect(costs[2]).toBeGreaterThan(costs[1]);
    expect(costs[5]).toBeGreaterThan(costs[4]);
    expect(costs[4] - costs[3]).toBeGreaterThan(costs[1] - costs[0]);
  });

  it('keeps the first two level-up card refreshes free and routes later ones to the platform', () => {
    expect(upgradeRefreshRequiresPayment(0)).toBe(false);
    expect(upgradeRefreshRequiresPayment(1)).toBe(false);
    expect(upgradeRefreshRequiresPayment(2)).toBe(true);
    expect(upgradeRefreshRequiresPayment(5)).toBe(true);
    expect(PAID_UPGRADE_REFRESH_SALE_ID).toBe('upgrade_refresh');
  });

  it('turns repeated attack-effect cards into a long-term damage, duration, and spread path', () => {
    const first = attackStatusGrowth(0, 1);
    const second = attackStatusGrowth(first.level, 1);
    const third = attackStatusGrowth(second.level, 1);
    const fifth = attackStatusGrowth(4, 3);
    expect(first.level).toBe(1);
    expect(second.damageIncrease).toBeGreaterThan(0);
    expect(second.durationIncrease).toBeGreaterThan(0);
    expect(second.spreadTargets).toBe(0);
    expect(third.spreadTargets).toBe(1);
    expect(third.spreadRadius).toBeGreaterThan(0);
    expect(fifth.spreadTargets).toBe(2);
    expect(fifth.damageIncrease).toBeGreaterThan(third.damageIncrease);
  });

  it('stops spawning when a wave timer ends even if its budget is not full', () => {
    expect(waveSpawningComplete(30, 30, 24, 66)).toBe(true);
    expect(waveSpawningComplete(29.9, 30, 66, 66)).toBe(true);
    expect(waveSpawningComplete(29.9, 30, 24, 66)).toBe(false);
  });

  it('keeps every mainline floor at the 10-wave contract across the 30-floor plan', () => {
    expect(TOTAL_HOSPITAL_FLOORS).toBe(30);
    expect(wavesPerFloorForFloor(1)).toBe(10);
    expect(wavesPerFloorForFloor(10)).toBe(10);
    expect(wavesPerFloorForFloor(11)).toBe(10);
    expect(wavesPerFloorForFloor(20)).toBe(10);
    expect(wavesPerFloorForFloor(21)).toBe(10);
    expect(wavesPerFloorForFloor(30)).toBe(10);
  });

  it('collects every drop inside the pickup radius without a second interaction', () => {
    expect(DEFAULT_PICKUP_RADIUS).toBeGreaterThan(76);
    expect(isWithinPickupRange(76, 76)).toBe(true);
    expect(isWithinPickupRange(77, 76)).toBe(false);
    expect(isWithinPickupRange(90, 76, 14)).toBe(true);
  });

  it('pulls drops faster as they get closer to the player', () => {
    expect(pickupPullSpeed(76, 76)).toBe(300);
    expect(pickupPullSpeed(20, 76)).toBeGreaterThan(pickupPullSpeed(76, 76));
    expect(pickupPullSpeed(0, 76)).toBe(680);
  });

  it('raises enemy health for stronger player builds and caps the result', () => {
    expect(enemyHealthMultiplier(1, 0, 1)).toBe(1);
    expect(enemyHealthMultiplier(5, 2, 3)).toBeGreaterThan(enemyHealthMultiplier(1, 0, 1));
    expect(enemyHealthMultiplier(99, 99, 99)).toBe(MAX_ENEMY_HEALTH_MULTIPLIER);
  });

  it('ramps daily challenge pressure on every wave', () => {
    const opening = dailyWaveScaling(1);
    const middle = dailyWaveScaling(25);
    const finale = dailyWaveScaling(50);
    expect(opening.stage).toBe(1);
    expect(middle.stage).toBe(3);
    expect(finale.stage).toBe(5);
    expect(middle.healthMultiplier).toBeGreaterThan(opening.healthMultiplier);
    expect(finale.damageMultiplier).toBeGreaterThan(middle.damageMultiplier);
    expect(finale.spawnIntervalMultiplier).toBeLessThan(middle.spawnIntervalMultiplier);
    expect(finale.baseBudget).toBeGreaterThan(middle.baseBudget);
    expect(dailyWaveScaling(999).wave).toBe(50);
  });
});
