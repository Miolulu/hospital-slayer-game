/**
 * 升级卡牌的可编辑目录。
 *
 * 卡牌显示名称、颜色和展示元数据集中在这里；数值和实际效果仍由战斗场景计算。
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
}

export const UPGRADE_CARD_CONFIGS = [
  {
    id: 'move-speed',
    title: '移速提升',
    color: 0x7ab9d0,
    icon: 'move',
  },
  {
    id: 'weapon-damage',
    title: '武器强化',
    color: 0xed716e,
    icon: 'damage',
  },
  {
    id: 'san-shield',
    title: 'SAN / 护盾',
    color: 0x8fd17c,
    icon: 'sustain',
  },
  {
    id: 'attack-speed',
    title: '攻速提升',
    color: 0xb798e2,
    icon: 'growth',
  },
  {
    id: 'attack-effect',
    title: '攻击特效：{status}',
    activeTitle: '强化{status}',
    color: 0xb798e2,
    colorByStatus: {
      poison: 0x8fd17c,
      burn: 0xe78a57,
      weaken: 0xb798e2,
    },
    icon: 'effect',
  },
  {
    id: 'infection-resonance',
    title: '感染共振 · {status}',
    color: 0x8fd17c,
    icon: 'resonance',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'twin-echo',
    title: '双生回响',
    color: 0xb798e2,
    icon: 'copies',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'shield-retaliation',
    title: '护盾反击',
    color: 0x7ab9d0,
    icon: 'shield',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'magnetic-harvest',
    title: '磁场收割',
    color: 0xf2bf62,
    icon: 'magnet',
    dailyOnly: true,
    rarity: 'purple',
  },
  {
    id: 'rift-pulse',
    title: '裂隙脉冲',
    color: 0xb798e2,
    icon: 'pulse',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'mirror-barrage',
    title: '镜像弹幕',
    color: 0x7ab9d0,
    icon: 'mirror',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'blood-moon-pact',
    title: '血月契约',
    color: 0xed716e,
    icon: 'blood',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'hunt-nova',
    title: '猎杀爆裂',
    color: 0xf2bf62,
    icon: 'nova',
    dailyOnly: true,
    rarity: 'gold',
  },
  {
    id: 'stasis-field',
    title: '静滞力场',
    color: 0x7ab9d0,
    icon: 'slow',
    dailyOnly: true,
    rarity: 'purple',
  },
  {
    id: 'weapon-copies',
    title: '升级武器数',
    color: 0x7ab9d0,
    icon: 'copies',
    requiresWeaponCopies: true,
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
