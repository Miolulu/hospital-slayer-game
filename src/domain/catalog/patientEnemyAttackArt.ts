import type { CombatEnemyKind } from '../combat/combatBalance';
import { assetUrl } from '../../infrastructure/assets/assetUrl';

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
  attack('chaser', 'chaser-attack.webp'),
  attack('shooter', 'shooter-attack.webp'),
  attack('disruptor', 'disruptor-attack.webp'),
  attack('tentacle', 'tentacle-attack.webp'),
  attack('bomber', 'bomber-attack.webp'),
  attack('eye', 'eye-attack.webp'),
] as const satisfies readonly SmallEnemyAttackArt[];

export const SMALL_ENEMY_ATTACK_ART_BY_KIND = Object.fromEntries(
  SMALL_ENEMY_ATTACK_ARTS.map((entry) => [entry.kind, entry] as const),
) as Record<SmallEnemyAttackKind, SmallEnemyAttackArt>;
