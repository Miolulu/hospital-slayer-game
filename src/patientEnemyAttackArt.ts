import type { CombatEnemyKind } from './combatBalance';
import { assetUrl } from './assetUrl';

export type SmallEnemyAttackKind = Exclude<CombatEnemyKind, 'miniBoss' | 'boss'>;

export interface SmallEnemyAttackArt {
  kind: SmallEnemyAttackKind;
  key: string;
  path: string;
}

const attack = (kind: SmallEnemyAttackKind, file: string): SmallEnemyAttackArt => ({
  kind,
  key: `enemy-attack-${kind}`,
  path: assetUrl(`/assets/art/enemies/patients/attacks/${file}`),
});

export const SMALL_ENEMY_ATTACK_ARTS = [
  attack('chaser', 'chaser-attack.png'),
  attack('shooter', 'shooter-attack.png'),
  attack('disruptor', 'disruptor-attack.png'),
  attack('tentacle', 'tentacle-attack.png'),
  attack('bomber', 'bomber-attack.png'),
  attack('eye', 'eye-attack.png'),
] as const satisfies readonly SmallEnemyAttackArt[];

export const SMALL_ENEMY_ATTACK_ART_BY_KIND = Object.fromEntries(
  SMALL_ENEMY_ATTACK_ARTS.map((entry) => [entry.kind, entry] as const),
) as Record<SmallEnemyAttackKind, SmallEnemyAttackArt>;