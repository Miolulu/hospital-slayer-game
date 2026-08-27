import { describe, expect, it } from 'vitest';
import { getRewardCards, getStarterDeck } from './cards';

describe('armor deck progression', () => {
  it('starts with a compact loop and leaves finishers for rewards', () => {
    const deck = getStarterDeck('scarlet-string');
    expect(deck).toHaveLength(7);
    expect(deck).not.toContain('scarlet-finisher');
  });

  it('offers three distinct armor cards as a post-battle choice', () => {
    const rewards = getRewardCards('tower-puppet', 2);
    expect(rewards).toHaveLength(3);
    expect(new Set(rewards.map((card) => card.id)).size).toBe(3);
    expect(rewards.every((card) => card.armor === 'tower-puppet')).toBe(true);
  });
});
