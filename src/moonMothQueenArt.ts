export interface BossArtImageSpec {
  key: string;
  path: string;
}

export interface BossArtSheetSpec {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
}

export const MOON_MOTH_QUEEN_ART = {
  name: '月蚀蝶后',
  portraitKey: 'moon-moth-queen-portrait',
  deathKey: 'moon-moth-queen-death',
  walkKey: 'moon-moth-queen-walk',
  attackKey: 'moon-moth-queen-attack',
  transformKeys: [
    'moon-moth-queen-transform-1',
    'moon-moth-queen-transform-2',
    'moon-moth-queen-transform-3',
    'moon-moth-queen-transform-4',
    'moon-moth-queen-transform-5',
  ] as const,
} as const;

export const MOON_MOTH_QUEEN_ART_IMAGES: BossArtImageSpec[] = [
  { key: MOON_MOTH_QUEEN_ART.portraitKey, path: '/assets/art/enemies/bosses/moon-moth-queen/portrait.png' },
  { key: MOON_MOTH_QUEEN_ART.deathKey, path: '/assets/art/enemies/bosses/moon-moth-queen/death-transparent.png' },
  ...MOON_MOTH_QUEEN_ART.transformKeys.map((key, index) => ({
    key,
    path: `/assets/art/enemies/bosses/moon-moth-queen/transform-${index + 1}.png`,
  })),
];

export const MOON_MOTH_QUEEN_ART_SHEETS: BossArtSheetSpec[] = [
  // The mobile-safe sheets keep the four 543x724 frames below the common
  // 2048px texture limit by arranging them in a 2x2 grid.
  { key: MOON_MOTH_QUEEN_ART.walkKey, path: '/assets/art/enemies/bosses/moon-moth-queen/walk-mobile.png', frameWidth: 543, frameHeight: 724 },
  { key: MOON_MOTH_QUEEN_ART.attackKey, path: '/assets/art/enemies/bosses/moon-moth-queen/attack-mobile.png', frameWidth: 543, frameHeight: 724 },
];

export const MOON_MOTH_QUEEN_WALK_FRAME_RATE = 7;
export const MOON_MOTH_QUEEN_ATTACK_FRAME_RATE = 8;
export const MOON_MOTH_QUEEN_TRANSFORM_FRAME_RATE = 7;
