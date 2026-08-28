import { describe, expect, it } from 'vitest';
import {
  monthlyChallengeForMonth,
  monthlyRewardIdsForRank,
  MONTHLY_CHALLENGE_CONFIGS,
  rollMonthlyBossDrops,
  rollMonthlyWeaponDrop,
} from './dailyChallenge';

describe('monthly challenge configuration', () => {
  it('keeps the boss silhouette and three drops bound together', () => {
    const config = monthlyChallengeForMonth('2026-08');
    expect(config).toBe(MONTHLY_CHALLENGE_CONFIGS[0]);
    expect(config.portraitKey).toBe('moon-moth-queen-portrait');
    expect(config.drops).toEqual({
      playerSkinId: 'moon-moth-queen',
      meleeWeaponSkinId: 'sword-moon-moth',
      rangedWeaponSkinId: 'gun-moon-moth',
    });
    expect(config.playerSkinDropChance).toBe(0.015);
    expect(config.meleeWeaponDropChance).toBe(0.01);
    expect(config.rangedWeaponDropChance).toBe(0.01);
  });

  it('maps the documented top-20 reward tiers', () => {
    const config = monthlyChallengeForMonth('2026-08');
    expect(monthlyRewardIdsForRank(config, 1)).toEqual(['moon-moth-queen', 'sword-moon-moth', 'gun-moon-moth']);
    expect(monthlyRewardIdsForRank(config, 2)).toEqual(['moon-moth-queen']);
    expect(monthlyRewardIdsForRank(config, 3)).toEqual(['gun-moon-moth']);
    expect(monthlyRewardIdsForRank(config, 4)).toEqual(['title-moon-moth-queen-top20']);
    expect(monthlyRewardIdsForRank(config, 21)).toEqual([]);
  });

  it('rolls each monthly boss drop independently', () => {
    const config = monthlyChallengeForMonth('2026-08');
    expect(rollMonthlyBossDrops(config, { playerSkin: 0, meleeWeapon: 0, rangedWeapon: 0 })).toEqual([
      'moon-moth-queen',
      'sword-moon-moth',
      'gun-moon-moth',
    ]);
    expect(rollMonthlyBossDrops(config, { playerSkin: 0.015, meleeWeapon: 0.01, rangedWeapon: 0.01 })).toEqual([]);
    expect(rollMonthlyBossDrops(config, { playerSkin: 0, meleeWeapon: 0.5, rangedWeapon: 0.5 })).toEqual(['moon-moth-queen']);
  });

  it('keeps the legacy weapon-only helper deterministic', () => {
    const config = monthlyChallengeForMonth('2026-08');
    expect(rollMonthlyWeaponDrop(config, 0)).toEqual(['sword-moon-moth', 'gun-moon-moth']);
    expect(rollMonthlyWeaponDrop(config, 0.01)).toEqual([]);
  });
});
