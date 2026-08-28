/**
 * 每月挑战的可配置内容。
 *
 * 首领、剪影和三类掉落必须从同一条配置读取。后续增加新首领时只需要
 * 添加一条配置并提供对应素材，不需要改动每日挑战页面或结算逻辑。
 */
export interface MonthlyBossDrops {
  playerSkinId: string;
  meleeWeaponSkinId: string;
  rangedWeaponSkinId: string;
}

export interface MonthlyChallengeConfig {
  id: string;
  name: string;
  portraitKey: string;
  drops: MonthlyBossDrops;
  /** 通过挑战后额外获得两把武器皮肤的概率，范围 0 到 1。 */
  weaponDropChance: number;
}

/** 当前月度首领配置。新增月份时在这里追加配置即可轮换。 */
export const MONTHLY_CHALLENGE_CONFIGS: readonly MonthlyChallengeConfig[] = [
  {
    id: 'moon-moth-queen',
    name: '月蚀蝶后',
    portraitKey: 'moon-moth-queen-portrait',
    drops: {
      playerSkinId: 'moon-moth-queen',
      meleeWeaponSkinId: 'sword-cthulhu',
      rangedWeaponSkinId: 'gun-cthulhu',
    },
    weaponDropChance: 0.35,
  },
];

const fallbackChallenge = MONTHLY_CHALLENGE_CONFIGS[0];

/**
 * 通过月份稳定选择配置。配置数量增加后按月份轮换，页面刷新不会改变本月首领。
 */
export function monthlyChallengeForMonth(monthKey: string): MonthlyChallengeConfig {
  if (MONTHLY_CHALLENGE_CONFIGS.length === 0) {
    throw new Error('MONTHLY_CHALLENGE_CONFIGS must contain at least one entry');
  }
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) return fallbackChallenge;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return fallbackChallenge;
  const index = (year * 12 + month - 1) % MONTHLY_CHALLENGE_CONFIGS.length;
  return MONTHLY_CHALLENGE_CONFIGS[index] ?? fallbackChallenge;
}

/** 排行榜前 20 名的奖励映射，真实名次由平台榜单提供后再调用。 */
export function monthlyRewardIdsForRank(config: MonthlyChallengeConfig, rank: number): string[] {
  const safeRank = Math.floor(rank);
  if (safeRank === 1) return [config.drops.playerSkinId, config.drops.meleeWeaponSkinId, config.drops.rangedWeaponSkinId];
  if (safeRank === 2) return [config.drops.playerSkinId];
  if (safeRank === 3) return [config.drops.rangedWeaponSkinId];
  if (safeRank >= 4 && safeRank <= 20) return [`title-${config.id}-top20`];
  return [];
}

/** 额外武器掉落使用可测试的随机值，避免把概率逻辑写死在场景里。 */
export function rollMonthlyWeaponDrop(config: MonthlyChallengeConfig, randomValue = Math.random()): string[] {
  const roll = Math.max(0, Math.min(0.999999, randomValue));
  return roll < Math.max(0, Math.min(1, config.weaponDropChance))
    ? [config.drops.meleeWeaponSkinId, config.drops.rangedWeaponSkinId]
    : [];
}
