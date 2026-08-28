export type ProfileSkinCategory = 'all' | 'basic' | 'store' | 'boss';

export interface SkinDef {
  id: string;
  name: string;
  color: number;
  category: Exclude<ProfileSkinCategory, 'all'>;
  cost: number;
  assetPrefix?: string;
  coverPath?: string;
  artId?: string;
  setName?: string;
  setBuff?: string;
  startingUnlocked?: boolean;
  unlockFloor?: number;
}

export const SKINS: SkinDef[] = [
  { id: 'patient-default', name: '初始病号服', color: 0xe7c28b, category: 'basic', cost: 0, startingUnlocked: true },
  { id: 'investigator-normal', name: '调查员男·正常版', color: 0x8b6a49, category: 'store', cost: 25, artId: 'investigator-normal', setName: '调查员常服', setBuff: '纯外观' },
  { id: 'investigator-female-normal', name: '调查员女·正常版', color: 0x8c5c78, category: 'store', cost: 30, artId: 'investigator-female-normal', setName: '调查员女常服', setBuff: '纯外观' },
  { id: 'investigator-mutated', name: '调查员男·异化版', color: 0x9a3846, category: 'store', cost: 40, artId: 'investigator-mutated', setName: '调查员异化装束', setBuff: '纯外观' },
  { id: 'moon-moth-queen', name: '月蚀蝶后', color: 0xb798e2, category: 'boss', cost: 0, assetPrefix: 'moon-moth-queen', coverPath: '/assets/art/skins/moon-moth-queen/cover.png', setName: '月蚀蝶后皮肤', setBuff: '纯外观' },
  { id: 'street-runner', name: '夜行校服', color: 0x2b7880, category: 'basic', cost: 0, assetPrefix: 'street-runner', coverPath: '/assets/art/skins/street-runner/cover.png', setName: '街区夜行套装', setBuff: '移速 +5%', unlockFloor: 5 },
  { id: 'cthulhu-dark', name: '深潜祭服', color: 0x573a6b, category: 'basic', cost: 0, assetPrefix: 'cthulhu-dark', coverPath: '/assets/art/skins/cthulhu-dark/cover.png', setName: '深潜祭服套装', setBuff: '伤害 +8', unlockFloor: 10 },
  { id: 'fairytale-stitch-prince', name: '缝线王子', color: 0xed716e, category: 'store', cost: 35, assetPrefix: 'fairytale-stitch-prince', coverPath: '/assets/art/skins/fairytale-stitch-prince/cover.png', setName: '怪诞童话套装', setBuff: '纯外观' },
  { id: 'obsidian-knight', name: '黑曜夜巡', color: 0x5fd7df, category: 'store', cost: 50, assetPrefix: 'obsidian-knight', coverPath: '/assets/art/skins/obsidian-knight/cover.png', setName: '黑曜骑士套装', setBuff: '纯外观' },
  { id: 'abyssal-oracle', name: '深渊祷告', color: 0x9a6bd1, category: 'store', cost: 60, assetPrefix: 'abyssal-oracle', coverPath: '/assets/art/skins/abyssal-oracle/cover.png', setName: '深渊访客套装', setBuff: '纯外观' },
];

export const DEFAULT_UNLOCKED_SKIN_IDS = SKINS.filter((skin) => skin.startingUnlocked).map((skin) => skin.id);

export function skinDefForId(id: string) {
  return SKINS.find((skin) => skin.id === id);
}
