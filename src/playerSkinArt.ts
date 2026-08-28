import { assetUrl } from './assetUrl';

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

export const PLAYER_SKIN_ART_IMAGES: PlayerSkinArtImageSpec[] = [
  { key: INVESTIGATOR_NORMAL_ART.portraitKey, path: assetUrl('/assets/art/player-skins/investigator-normal/idle-down.png') },
  { key: INVESTIGATOR_NORMAL_ART.idleKeys.up, path: assetUrl('/assets/art/player-skins/investigator-normal/idle-up.png') },
  { key: INVESTIGATOR_NORMAL_ART.idleKeys.left, path: assetUrl('/assets/art/player-skins/investigator-normal/idle-left.png') },
  { key: INVESTIGATOR_NORMAL_ART.idleKeys.right, path: assetUrl('/assets/art/player-skins/investigator-normal/idle-right.png') },
];

export const PLAYER_SKIN_ART_SHEETS: PlayerSkinArtSheetSpec[] = [
  { key: INVESTIGATOR_NORMAL_ART.walkKeys.down, path: assetUrl('/assets/art/player-skins/investigator-normal/walk-down.png'), frameWidth: 513, frameHeight: 828 },
  { key: INVESTIGATOR_NORMAL_ART.walkKeys.up, path: assetUrl('/assets/art/player-skins/investigator-normal/walk-up.png'), frameWidth: 513, frameHeight: 828 },
  { key: INVESTIGATOR_NORMAL_ART.walkKeys.left, path: assetUrl('/assets/art/player-skins/investigator-normal/walk-left.png'), frameWidth: 655, frameHeight: 940 },
  { key: INVESTIGATOR_NORMAL_ART.walkKeys.right, path: assetUrl('/assets/art/player-skins/investigator-normal/walk-right.png'), frameWidth: 655, frameHeight: 940 },
];

export function playerSkinArtForId(id: string): PlayerSkinArtSpec | undefined {
  return id === 'investigator-normal' ? INVESTIGATOR_NORMAL_ART : undefined;
}
