import { assetUrl } from '../../infrastructure/assets/assetUrl';

export type PlayerSkinDirection = 'down' | 'up' | 'left' | 'right';

export interface PlayerSkinArtImageSpec {
  key: string;
  path: string;
}

export interface PlayerSkinArtSheetSpec {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
}

export interface PlayerSkinArtSpec {
  portraitKey: string;
  idleKeys: Record<PlayerSkinDirection, string>;
  walkKeys: Record<PlayerSkinDirection, string>;
}

const INVESTIGATOR_NORMAL_ART: PlayerSkinArtSpec = {
  portraitKey: 'investigator-normal-idle-down',
  idleKeys: {
    down: 'investigator-normal-idle-down',
    up: 'investigator-normal-idle-up',
    left: 'investigator-normal-idle-left',
    right: 'investigator-normal-idle-right',
  },
  walkKeys: {
    down: 'investigator-normal-walk-down',
    up: 'investigator-normal-walk-up',
    left: 'investigator-normal-walk-left',
    right: 'investigator-normal-walk-right',
  },
};

const INVESTIGATOR_FEMALE_NORMAL_ART: PlayerSkinArtSpec = {
  portraitKey: 'investigator-female-normal-idle-down',
  idleKeys: {
    down: 'investigator-female-normal-idle-down',
    up: 'investigator-female-normal-idle-up',
    left: 'investigator-female-normal-idle-left',
    right: 'investigator-female-normal-idle-right',
  },
  walkKeys: {
    down: 'investigator-female-normal-walk-down',
    up: 'investigator-female-normal-walk-up',
    left: 'investigator-female-normal-walk-left',
    right: 'investigator-female-normal-walk-right',
  },
};

const INVESTIGATOR_MUTATED_ART: PlayerSkinArtSpec = {
  portraitKey: 'investigator-mutated-idle-down',
  idleKeys: {
    down: 'investigator-mutated-idle-down',
    up: 'investigator-mutated-idle-up',
    left: 'investigator-mutated-idle-left',
    right: 'investigator-mutated-idle-right',
  },
  walkKeys: {
    down: 'investigator-mutated-walk-down',
    up: 'investigator-mutated-walk-up',
    left: 'investigator-mutated-walk-left',
    right: 'investigator-mutated-walk-right',
  },
};

export const PLAYER_SKIN_ART_IMAGES: PlayerSkinArtImageSpec[] = [
  { key: INVESTIGATOR_NORMAL_ART.portraitKey, path: assetUrl('/assets/art/player-skins/investigator-normal/idle-down.webp') },
  { key: INVESTIGATOR_NORMAL_ART.idleKeys.up, path: assetUrl('/assets/art/player-skins/investigator-normal/idle-up.webp') },
  { key: INVESTIGATOR_NORMAL_ART.idleKeys.left, path: assetUrl('/assets/art/player-skins/investigator-normal/idle-left.webp') },
  { key: INVESTIGATOR_NORMAL_ART.idleKeys.right, path: assetUrl('/assets/art/player-skins/investigator-normal/idle-right.webp') },
  { key: INVESTIGATOR_FEMALE_NORMAL_ART.portraitKey, path: assetUrl('/assets/art/player-skins/investigator-female-normal/idle-down.webp') },
  { key: INVESTIGATOR_FEMALE_NORMAL_ART.idleKeys.up, path: assetUrl('/assets/art/player-skins/investigator-female-normal/idle-up.webp') },
  { key: INVESTIGATOR_FEMALE_NORMAL_ART.idleKeys.left, path: assetUrl('/assets/art/player-skins/investigator-female-normal/idle-left.webp') },
  { key: INVESTIGATOR_FEMALE_NORMAL_ART.idleKeys.right, path: assetUrl('/assets/art/player-skins/investigator-female-normal/idle-right.webp') },
  { key: INVESTIGATOR_MUTATED_ART.portraitKey, path: assetUrl('/assets/art/player-skins/investigator-mutated/idle-down.webp') },
  { key: INVESTIGATOR_MUTATED_ART.idleKeys.up, path: assetUrl('/assets/art/player-skins/investigator-mutated/idle-up.webp') },
  { key: INVESTIGATOR_MUTATED_ART.idleKeys.left, path: assetUrl('/assets/art/player-skins/investigator-mutated/idle-left.webp') },
  { key: INVESTIGATOR_MUTATED_ART.idleKeys.right, path: assetUrl('/assets/art/player-skins/investigator-mutated/idle-right.webp') },
];

export const PLAYER_SKIN_ART_SHEETS: PlayerSkinArtSheetSpec[] = [
  { key: INVESTIGATOR_NORMAL_ART.walkKeys.down, path: assetUrl('/assets/art/player-skins/investigator-normal/walk-down.webp'), frameWidth: 192, frameHeight: 192 },
  { key: INVESTIGATOR_NORMAL_ART.walkKeys.up, path: assetUrl('/assets/art/player-skins/investigator-normal/walk-up.webp'), frameWidth: 192, frameHeight: 192 },
  { key: INVESTIGATOR_NORMAL_ART.walkKeys.left, path: assetUrl('/assets/art/player-skins/investigator-normal/walk-left.webp'), frameWidth: 192, frameHeight: 192 },
  { key: INVESTIGATOR_NORMAL_ART.walkKeys.right, path: assetUrl('/assets/art/player-skins/investigator-normal/walk-right.webp'), frameWidth: 192, frameHeight: 192 },
  { key: INVESTIGATOR_FEMALE_NORMAL_ART.walkKeys.down, path: assetUrl('/assets/art/player-skins/investigator-female-normal/walk-down.webp'), frameWidth: 192, frameHeight: 192 },
  { key: INVESTIGATOR_FEMALE_NORMAL_ART.walkKeys.up, path: assetUrl('/assets/art/player-skins/investigator-female-normal/walk-up.webp'), frameWidth: 192, frameHeight: 192 },
  { key: INVESTIGATOR_FEMALE_NORMAL_ART.walkKeys.left, path: assetUrl('/assets/art/player-skins/investigator-female-normal/walk-left.webp'), frameWidth: 192, frameHeight: 192 },
  { key: INVESTIGATOR_FEMALE_NORMAL_ART.walkKeys.right, path: assetUrl('/assets/art/player-skins/investigator-female-normal/walk-right.webp'), frameWidth: 192, frameHeight: 192 },
  { key: INVESTIGATOR_MUTATED_ART.walkKeys.down, path: assetUrl('/assets/art/player-skins/investigator-mutated/walk-down.webp'), frameWidth: 192, frameHeight: 192 },
  { key: INVESTIGATOR_MUTATED_ART.walkKeys.up, path: assetUrl('/assets/art/player-skins/investigator-mutated/walk-up.webp'), frameWidth: 192, frameHeight: 192 },
  { key: INVESTIGATOR_MUTATED_ART.walkKeys.left, path: assetUrl('/assets/art/player-skins/investigator-mutated/walk-left.webp'), frameWidth: 192, frameHeight: 192 },
  { key: INVESTIGATOR_MUTATED_ART.walkKeys.right, path: assetUrl('/assets/art/player-skins/investigator-mutated/walk-right.webp'), frameWidth: 192, frameHeight: 192 },
];

export function playerSkinArtForId(id: string): PlayerSkinArtSpec | undefined {
  if (id === 'investigator-normal') return INVESTIGATOR_NORMAL_ART;
  if (id === 'investigator-female-normal') return INVESTIGATOR_FEMALE_NORMAL_ART;
  if (id === 'investigator-mutated') return INVESTIGATOR_MUTATED_ART;
  return undefined;
}
