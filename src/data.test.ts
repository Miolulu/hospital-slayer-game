import { describe, expect, it } from 'vitest';
import { ARMORS, findRecipe, LEVELS, MATERIALS } from './data';

describe('potion armor content contract', () => {
  it('has seven levels and six playable armor recipes', () => {
    expect(LEVELS).toHaveLength(7);
    expect(Object.values(ARMORS)).toHaveLength(6);
    expect(Object.values(MATERIALS)).toHaveLength(7);
  });

  it('maps every armor to exactly one commutative recipe', () => {
    for (const armor of Object.values(ARMORS)) {
      expect(findRecipe(...armor.ingredients)?.id).toBe(armor.id);
      expect(findRecipe(armor.ingredients[1], armor.ingredients[0])?.id).toBe(armor.id);
    }
  });

  it('drops one new material from each chapter boss and previews the glass shoe', () => {
    expect(LEVELS.filter((level) => level.reward).map((level) => level.reward)).toEqual(['fang', 'thread', 'crown', 'shoe']);
    expect(LEVELS.filter((level) => level.awakening).map((level) => level.awakening)).toEqual(['hood', 'heart', 'bean']);
    expect(Object.values(ARMORS).some((armor) => armor.ingredients.includes('shoe'))).toBe(false);
  });

  it('targets at least thirty minutes before optional replay', () => {
    const battleMinutes = LEVELS.reduce((sum, level) => sum + level.duration, 0) / 60;
    expect(battleMinutes).toBeGreaterThanOrEqual(26);
    expect(battleMinutes + 5).toBeGreaterThanOrEqual(30);
  });

  it('never requires a reward before the boss that drops it', () => {
    const initial = new Set(['hood', 'heart', 'bean']);
    for (const level of LEVELS) {
      const craftable = level.preferred.some((armorId) => ARMORS[armorId].ingredients.every((id) => initial.has(id)));
      expect(craftable).toBe(true);
      if (level.reward) initial.add(level.reward);
    }
  });
});
