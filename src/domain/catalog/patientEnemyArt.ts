import type { CombatEnemyKind } from '../combat/combatBalance';
import { assetUrl } from '../../infrastructure/assets/assetUrl';

export type SmallEnemyKind = Exclude<CombatEnemyKind, 'miniBoss' | 'boss'>;

export interface SmallEnemyArtSheet {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
}

const sheet = (key: string, file: string, frameWidth: number, frameHeight: number): SmallEnemyArtSheet => ({
  key,
  path: assetUrl(`/assets/art/enemies/patients/${file}`),
  frameWidth,
  frameHeight,
});

export const SMALL_ENEMY_ART_SHEETS = [
  sheet('bone-stage3', 'bone-stage3.webp', 514, 580),
  sheet('bone-stage4', 'bone-stage4.webp', 542, 675),
  sheet('bone-stage5', 'bone-stage5.webp', 662, 631),
  sheet('tide-stage3', 'tide-stage3.webp', 683, 717),
  sheet('tide-stage4', 'tide-stage4.webp', 663, 676),
  sheet('tide-stage5', 'tide-stage5.webp', 657, 576),
  sheet('female-tide-stage3', 'female-tide-stage3.webp', 443, 613),
  sheet('female-tide-stage4', 'female-tide-stage4.webp', 438, 691),
  sheet('female-tide-stage5', 'female-tide-stage5.webp', 574, 748),
  sheet('dream-stage3', 'dream-stage3.webp', 402, 591),
  sheet('dream-stage4', 'dream-stage4.webp', 344, 675),
  sheet('dream-stage5', 'dream-stage5.webp', 632, 702),
] as const satisfies readonly SmallEnemyArtSheet[];

export const SMALL_ENEMY_ART_SHEET_BY_KEY = new Map(
  SMALL_ENEMY_ART_SHEETS.map((entry) => [entry.key, entry] as const),
);

export const SMALL_ENEMY_ART_VARIANTS: Record<SmallEnemyKind, readonly string[]> = {
  chaser: ['bone-stage3', 'bone-stage4'],
  shooter: ['dream-stage3', 'dream-stage4'],
  disruptor: ['female-tide-stage3', 'female-tide-stage4'],
  tentacle: ['tide-stage3', 'tide-stage4'],
  bomber: ['bone-stage5', 'tide-stage5'],
  eye: ['dream-stage5', 'female-tide-stage5'],
};

/** 为楼层预览稳定选择变体，避免页面每次刷新都随机跳动。 */
export function smallEnemyArtForFloor(kind: SmallEnemyKind, floor: number): string | undefined {
  const variants = SMALL_ENEMY_ART_VARIANTS[kind] ?? [];
  if (variants.length === 0) return undefined;
  return variants[Math.abs(Math.floor(floor)) % variants.length];
}

export const SMALL_ENEMY_ART_FRAME_RATE = 6;
