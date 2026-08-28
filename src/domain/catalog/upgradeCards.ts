/**
 * 升级卡牌的可编辑目录。
 *
 * 卡牌名称、说明模板、稀有度权重、分档数值和展示元数据集中在这里；实际效果仍由战斗场景执行。
 * 颜色使用 Phaser 的 0xRRGGBB 数字格式，改动后会同时影响卡牌光环和图标。
 */
export type UpgradeAttackStatus = 'poison' | 'burn' | 'weaken';

export type UpgradeCardRarity = 'blue' | 'purple' | 'gold';

export type UpgradeIconKind =
  | 'move'
  | 'damage'
  | 'sustain'
  | 'growth'
  | 'effect'
  | 'copies'
  | 'resonance'
  | 'shield'
  | 'magnet'
  | 'pulse'
  | 'mirror'
  | 'blood'
  | 'nova'
  | 'slow';

export interface UpgradeCardConfig {
  id: string;
  /** Supports {status} for the current attack status name. */
  title: string;
  /** Optional title used after the attack status has already been learned. */
  activeTitle?: string;
  /** Description template. Values such as {value}, {duration}, or {status} are filled at runtime. */
  description: string;
  color: number;
  /** Optional color override for status variants of the attack-effect card. */
  colorByStatus?: Partial<Record<UpgradeAttackStatus, number>>;
  icon: UpgradeIconKind;
  /** Daily challenge cards are excluded from the mainline pool. */
  dailyOnly?: boolean;
  /** The card is shown only while another weapon copy can still be added. */
  requiresWeaponCopies?: boolean;
  /** Fixed rarity for special cards; ordinary cards use the current tier. */
  rarity?: UpgradeCardRarity;
  /** Values for the three rarity tiers. Ordinary cards must provide all three entries. */
  tiers?: Readonly<Record<UpgradeCardRarity, UpgradeCardTier>>;
}

export interface UpgradeCardTier {
  /** Primary value used by movement, damage, SAN, and attack-speed cards. */
  value?: number;
  /** Damage-over-time increase used by attack-effect cards. */
  damageIncrease?: number;
  /** Duration increase used by attack-effect cards. */
  durationIncrease?: number;
}

export const UPGRADE_RARITY_WEIGHTS = [
  { rarity: 'blue', weight: 70 },
  { rarity: 'purple', weight: 20 },
  { rarity: 'gold', weight: 10 },
] as const satisfies readonly { rarity: UpgradeCardRarity; weight: number }[];

export function rollUpgradeCardRarity(randomValue = Math.random()): UpgradeCardRarity {
  const roll = Math.max(0, Math.min(0.999999, randomValue)) * 100;
  let cumulative = 0;
  for (const entry of UPGRADE_RARITY_WEIGHTS) {
    cumulative += entry.weight;
    if (roll < cumulative) return entry.rarity;
  }
  return 'gold';
}

export function upgradeCardTierForRarity(rarity: UpgradeCardRarity) {
  return rarity === 'gold' ? 3 : rarity === 'purple' ? 2 : 1;
}

export function formatUpgradeCardDescription(template: string, values: Readonly<Record<string, string | number>>) {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export const UPGRADE_CARD_CONFIGS = [
  {
    id: 'move-speed',
    title: '移速提升',
    description: '移动速度 +{value}%',
    color: 0x7ab9d0,
    icon: 'move',
    tiers: {
      blue: { value: 8 },
      purple: { value: 12 },
      gold: { value: 18 },
    },
  },
  {
    id: 'weapon-damage',
    title: '武器强化',
    description: '当前武器伤害 +{value}，持续本层',
    color: 0xed716e,
    icon: 'damage',
    tiers: {
      blue: { value: 8 },
      purple: { value: 14 },
      gold: { value: 22 },
    },
  },
  {
    id: 'san-shield',
    title: 'SAN / 护盾',
    description: 'SAN 不足时恢复 {value}；SAN 满时转为护盾',
    color: 0x8fd17c,
    icon: 'sustain',
    tiers: {
      blue: { value: 20 },
      purple: { value: 32 },
      gold: { value: 48 },
    },
  },
  {
    id: 'attack-speed',
    title: '攻速提升',
    description: '当前武器转速 +{value}%',
    color: 0xb798e2,
    icon: 'growth',
    tiers: {
      blue: { value: 10 },
      purple: { value: 15 },
      gold: { value: 22 },
    },
  },
  {
    id: 'attack-effect',
    title: '攻击特效：{status}',
    activeTitle: '强化{status}',
    description: '{weakenPrefix}每 0.8 秒 {tickDamage} 伤害 · 持续 {duration} 秒{spread}',
    color: 0xb798e2,
    colorByStatus: {
      poison: 0x8fd17c,
      burn: 0xe78a57,
      weaken: 0xb798e2,
    },
    icon: 'effect',
    tiers: {
      blue: { damageIncrease: 2, durationIncrease: 0.8 },
      purple: { damageIncrease: 3.5, durationIncrease: 1.2 },
      gold: { damageIncrease: 5, durationIncrease: 1.6 },
    },
  },
  {
    id: 'twin-echo',
    title: '双生回响',
    description: '武器数量 +1，攻击速度 +{speed}%',
    color: 0xb798e2,
    icon: 'copies',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'shield-retaliation',
    title: '护盾反击',
    description: '护盾吸收伤害时反击 {retaliation} 点',
    color: 0x7ab9d0,
    icon: 'shield',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'magnetic-harvest',
    title: '磁场收割',
    description: '移动速度 +6%，拾取范围 +28，吸附速度提升',
    color: 0xf2bf62,
    icon: 'magnet',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'rift-pulse',
    title: '裂隙脉冲',
    description: '每 {interval} 秒释放虚空环，最多命中 {targets} 个目标',
    color: 0xb798e2,
    icon: 'pulse',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'mirror-barrage',
    title: '镜像弹幕',
    description: '远程每次齐射追加 {shots} 发；近战额外命中目标',
    color: 0x7ab9d0,
    icon: 'mirror',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'blood-moon-pact',
    title: '血月契约',
    description: '武器伤害 +16，受到伤害 +{taken}%',
    color: 0xed716e,
    icon: 'blood',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'hunt-nova',
    title: '猎杀爆裂',
    description: '每 {kills} 次击杀触发范围爆裂',
    color: 0xf2bf62,
    icon: 'nova',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'stasis-field',
    title: '静滞力场',
    description: '靠近主角的敌人减速 {slow}%，范围扩大',
    color: 0x7ab9d0,
    icon: 'slow',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'weapon-copies',
    title: '升级武器数',
    description: '当前武器数量 {current} -> {next}，围绕主角均匀旋转',
    color: 0x7ab9d0,
    icon: 'copies',
    requiresWeaponCopies: true,
    rarity: 'gold',
  },
] as const satisfies readonly UpgradeCardConfig[];

export type UpgradeCardId = (typeof UPGRADE_CARD_CONFIGS)[number]['id'];

export const UPGRADE_ICON_KINDS: UpgradeIconKind[] = Array.from(
  new Set(UPGRADE_CARD_CONFIGS.map((config) => config.icon)),
);

export const upgradeCardConfig = (id: UpgradeCardId) => UPGRADE_CARD_CONFIGS.find((config) => config.id === id);

export const upgradeCardColor = (
  config: UpgradeCardConfig,
  status?: UpgradeAttackStatus,
) => config.colorByStatus?.[status ?? 'poison'] ?? config.color;
