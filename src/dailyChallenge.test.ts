import { describe, expect, it } from 'vitest';
import {
  monthlyChallengeForMonth,
  monthlyRewardIdsForRank,
  MONTHLY_CHALLENGE_CONFIGS,
  rollMonthlyWeaponDrop,
} from './dailyChallenge';

describe('monthly challenge configuration', () => {
  it('keeps the boss silhouette and three drops bound together', () => {
    const config = monthlyChallengeForMonth('2026-08');
    expect(config).toBe(MONTHLY_CHALLENGE_CONFIGS[0]);
    expect(config.portraitKey).toBe('moon-moth-queen-portrait');
    expect(config.drops).toEqual({
      playerSkinId: 'moon-moth-queen',
      meleeWeaponSkinId: 'sword-cthulhu',
      rangedWeaponSkinId: 'gun-cthulhu',
    });
  });

  it('maps the documented top-20 reward tiers', () => {
    const config = monthlyChallengeForMonth('2026-08');
    expect(monthlyRewardIdsForRank(config, 1)).toEqual(['moon-moth-queen', 'sword-cthulhu', 'gun-cthulhu']);
    expect(monthlyRewardIdsForRank(config, 2)).toEqual(['moon-moth-queen']);
    expect(monthlyRewardIdsForRank(config, 3)).toEqual(['gun-cthulhu']);
    expect(monthlyRewardIdsForRank(config, 4)).toEqual(['title-moon-moth-queen-top20']);
    expect(monthlyRewardIdsForRank(config, 21)).toEqual([]);
  });

  it('rolls the configurable weapon drop chance', () => {
    const config = monthlyChallengeForMonth('2026-08');
    expect(rollMonthlyWeaponDrop(config, 0)).toEqual(['sword-cthulhu', 'gun-cthulhu']);
    expect(rollMonthlyWeaponDrop(config, 0.35)).toEqual([]);
    expect(rollMonthlyWeaponDrop(config, 0.99)).toEqual([]);
  });
});
