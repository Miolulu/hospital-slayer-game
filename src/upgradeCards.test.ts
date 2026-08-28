import { describe, expect, it } from 'vitest';
import {
  formatUpgradeCardDescription,
  rollUpgradeCardRarity,
  UPGRADE_CARD_CONFIGS,
  UPGRADE_RARITY_WEIGHTS,
  upgradeCardColor,
  upgradeCardConfig,
  upgradeCardTierForRarity,
} from './upgradeCards';

describe('upgrade card catalog', () => {
  it('keeps one editable entry for every selectable upgrade', () => {
    expect(UPGRADE_CARD_CONFIGS).toHaveLength(14);
    expect(new Set(UPGRADE_CARD_CONFIGS.map((card) => card.id)).size).toBe(UPGRADE_CARD_CONFIGS.length);
    expect(UPGRADE_CARD_CONFIGS.map((card) => String(card.id))).not.toContain('infection-resonance');
    expect(UPGRADE_CARD_CONFIGS.filter((card) => 'dailyOnly' in card && card.dailyOnly)).toHaveLength(8);
    expect(UPGRADE_CARD_CONFIGS.every((card) => card.description.length > 0)).toBe(true);
    expect(UPGRADE_CARD_CONFIGS.filter((card) => !('tiers' in card)).every((card) => 'rarity' in card && card.rarity === 'gold')).toBe(true);
  });

  it('preserves the current card colors, including status variants', () => {
    expect(upgradeCardConfig('move-speed')?.color).toBe(0x7ab9d0);
    expect(upgradeCardConfig('weapon-damage')?.color).toBe(0xed716e);
    expect(upgradeCardConfig('san-shield')?.color).toBe(0x8fd17c);
    expect(upgradeCardConfig('attack-speed')?.color).toBe(0xb798e2);
    const effect = upgradeCardConfig('attack-effect');
    expect(effect && upgradeCardColor(effect, 'poison')).toBe(0x8fd17c);
    expect(effect && upgradeCardColor(effect, 'burn')).toBe(0xe78a57);
    expect(effect && upgradeCardColor(effect, 'weaken')).toBe(0xb798e2);
  });

  it('uses the requested rarity probabilities and tier ladder', () => {
    expect(UPGRADE_RARITY_WEIGHTS).toEqual([
      { rarity: 'blue', weight: 70 },
      { rarity: 'purple', weight: 20 },
      { rarity: 'gold', weight: 10 },
    ]);
    expect(rollUpgradeCardRarity(0)).toBe('blue');
    expect(rollUpgradeCardRarity(0.69999)).toBe('blue');
    expect(rollUpgradeCardRarity(0.7)).toBe('purple');
    expect(rollUpgradeCardRarity(0.89999)).toBe('purple');
    expect(rollUpgradeCardRarity(0.9)).toBe('gold');
    expect(upgradeCardTierForRarity('blue')).toBe(1);
    expect(upgradeCardTierForRarity('purple')).toBe(2);
    expect(upgradeCardTierForRarity('gold')).toBe(3);

    for (const id of ['move-speed', 'weapon-damage', 'san-shield', 'attack-speed'] as const) {
      const card = upgradeCardConfig(id);
      const tiers = card && 'tiers' in card
        ? card.tiers as Readonly<Record<'blue' | 'purple' | 'gold', { value?: number }>>
        : undefined;
      expect(tiers?.blue.value).toBeLessThan(tiers?.purple.value ?? 0);
      expect(tiers?.purple.value).toBeLessThan(tiers?.gold.value ?? 0);
    }
    const effectCard = upgradeCardConfig('attack-effect');
    const effectTiers = effectCard && 'tiers' in effectCard
      ? effectCard.tiers as Readonly<Record<'blue' | 'purple' | 'gold', { damageIncrease?: number; durationIncrease?: number }>>
      : undefined;
    expect(effectTiers?.blue.damageIncrease).toBeLessThan(effectTiers?.purple.damageIncrease ?? 0);
    expect(effectTiers?.purple.damageIncrease).toBeLessThan(effectTiers?.gold.damageIncrease ?? 0);
    expect(effectTiers?.blue.durationIncrease).toBeLessThan(effectTiers?.purple.durationIncrease ?? 0);
    expect(effectTiers?.purple.durationIncrease).toBeLessThan(effectTiers?.gold.durationIncrease ?? 0);
  });

  it('keeps descriptions editable through token replacement', () => {
    expect(formatUpgradeCardDescription('当前武器伤害 +{value}，持续本层', { value: 22 })).toBe('当前武器伤害 +22，持续本层');
    expect(formatUpgradeCardDescription('未知 {missing}', {})).toBe('未知 {missing}');
  });
});
