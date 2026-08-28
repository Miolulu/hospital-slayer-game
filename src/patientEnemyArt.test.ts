import { describe, expect, it } from 'vitest';
import { SMALL_ENEMY_ART_VARIANTS, smallEnemyArtForFloor } from './patientEnemyArt';

describe('floor enemy preview art', () => {
  it('rotates each enemy type by floor while remaining deterministic', () => {
    for (const [kind, variants] of Object.entries(SMALL_ENEMY_ART_VARIANTS)) {
      expect(smallEnemyArtForFloor(kind as keyof typeof SMALL_ENEMY_ART_VARIANTS, 1)).toBe(variants[1 % variants.length]);
      expect(smallEnemyArtForFloor(kind as keyof typeof SMALL_ENEMY_ART_VARIANTS, 2)).toBe(variants[2 % variants.length]);
      expect(smallEnemyArtForFloor(kind as keyof typeof SMALL_ENEMY_ART_VARIANTS, 3)).toBe(variants[3 % variants.length]);
    }
  });

  it('normalizes negative and fractional floor values', () => {
    expect(smallEnemyArtForFloor('chaser', -1.8)).toBe('bone-stage3');
    expect(smallEnemyArtForFloor('chaser', 2.9)).toBe('bone-stage3');
  });
});
