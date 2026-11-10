import { assetUrl } from '../../infrastructure/assets/assetUrl';

export type MainlineBossVariantId = 'pill-mouth' | 'bed-boss' | 'mercury-thermometer';

export interface MainlineBossArtVariant {
  id: MainlineBossVariantId;
  name: string;
  portraitKey: string;
  deathKey: string;
  walkKey: string;
  attackKey: string;
  walkFrameWidth: number;
  walkFrameHeight: number;
  attackFrameWidth: number;
  attackFrameHeight: number;
  walkFrameRate: number;
  attackFrameRate: number;
}

export const MAINLINE_BOSS_ART_VARIANTS: Record<MainlineBossVariantId, MainlineBossArtVariant> = {
  'pill-mouth': {
    id: 'pill-mouth',
    name: '药片嘴',
    portraitKey: 'mainline-boss-pill-mouth-portrait',
    deathKey: 'mainline-boss-pill-mouth-death',
    walkKey: 'mainline-boss-pill-mouth-walk',
    attackKey: 'mainline-boss-pill-mouth-attack',
    walkFrameWidth: 1254,
    walkFrameHeight: 1254,
    attackFrameWidth: 1254,
    attackFrameHeight: 1254,
    walkFrameRate: 7,
    attackFrameRate: 8,
  },
  'bed-boss': {
    id: 'bed-boss',
    name: '病床boss',
    portraitKey: 'mainline-boss-bed-portrait',
    deathKey: 'mainline-boss-bed-death',
    walkKey: 'mainline-boss-bed-walk',
    attackKey: 'mainline-boss-bed-attack',
    walkFrameWidth: 543,
    walkFrameHeight: 724,
    attackFrameWidth: 485,
    attackFrameHeight: 811,
    walkFrameRate: 7,
    attackFrameRate: 8,
  },
  'mercury-thermometer': {
    id: 'mercury-thermometer',
    name: '水银体温计',
    portraitKey: 'mainline-boss-thermometer-portrait',
    deathKey: 'mainline-boss-thermometer-death',
    walkKey: 'mainline-boss-thermometer-walk',
    attackKey: 'mainline-boss-thermometer-attack',
    walkFrameWidth: 1536,
    walkFrameHeight: 1024,
    attackFrameWidth: 1536,
    attackFrameHeight: 1024,
    walkFrameRate: 7,
    attackFrameRate: 8,
  },
};

export const MAINLINE_BOSS_ART_VARIANT_LIST = Object.values(MAINLINE_BOSS_ART_VARIANTS);
export const MAINLINE_BOSS_ART_VARIANT_BY_ID = MAINLINE_BOSS_ART_VARIANTS;

export const MAINLINE_BOSS_ART_IMAGES = MAINLINE_BOSS_ART_VARIANT_LIST.flatMap((variant) => ([
  { key: variant.portraitKey, path: assetUrl(`/assets/art/enemies/bosses/${variant.id}/portrait.webp`) },
  { key: variant.deathKey, path: assetUrl(`/assets/art/enemies/bosses/${variant.id}/death.webp`) },
]));

export const MAINLINE_BOSS_ART_SHEETS = MAINLINE_BOSS_ART_VARIANT_LIST.flatMap((variant) => ([
  { key: variant.walkKey, path: assetUrl(`/assets/art/enemies/bosses/${variant.id}/walk.webp`), frameWidth: variant.walkFrameWidth, frameHeight: variant.walkFrameHeight },
  { key: variant.attackKey, path: assetUrl(`/assets/art/enemies/bosses/${variant.id}/attack.webp`), frameWidth: variant.attackFrameWidth, frameHeight: variant.attackFrameHeight },
]));
