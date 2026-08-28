import { describe, expect, it } from 'vitest';
import { UPGRADE_CARD_CONFIGS, upgradeCardColor, upgradeCardConfig } from './upgradeCards';

describe('upgrade card catalog', () => {
  it('keeps one editable entry for every selectable upgrade', () => {
    expect(UPGRADE_CARD_CONFIGS).toHaveLength(15);
    expect(new Set(UPGRADE_CARD_CONFIGS.map((card) => card.id)).size).toBe(UPGRADE_CARD_CONFIGS.length);
    expect(UPGRADE_CARD_CONFIGS.filter((card) => 'dailyOnly' in card && card.dailyOnly)).toHaveLength(9);
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
});
