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
}

export const SKINS: SkinDef[] = [
  { id: 'patient-default', name: '初始病号服', color: 0xe7c28b, category: 'basic', cost: 0, startingUnlocked: true },
  { id: 'investigator-normal', name: '调查员男·正常版', color: 0x8b6a49, category: 'store', cost: 0, artId: 'investigator-normal', setName: '调查员常服', setBuff: '纯外观' },
  { id: 'investigator-female-normal', name: '调查员女·正常版', color: 0x8c5c78, category: 'store', cost: 0, artId: 'investigator-female-normal', setName: '调查员女常服', setBuff: '纯外观' },
  { id: 'investigator-mutated', name: '调查员男·异化版', color: 0x9a3846, category: 'store', cost: 0, artId: 'investigator-mutated', setName: '调查员异化装束', setBuff: '纯外观' },
  { id: 'moon-moth-queen', name: '月蚀蝶后', color: 0xb798e2, category: 'boss', cost: 0, assetPrefix: 'moon-moth-queen', setName: '月蚀蝶后皮肤', setBuff: '纯外观' },
  { id: 'street-runner', name: '夜行校服', color: 0x2b7880, category: 'store', cost: 25, assetPrefix: 'street-runner', coverPath: '/assets/art/skins/street-runner/cover.jpg', setName: '街区夜行套装', setBuff: '移速 +5%' },
  { id: 'cthulhu-dark', name: '深潜祭服', color: 0x573a6b, category: 'store', cost: 40, assetPrefix: 'cthulhu-dark', coverPath: '/assets/art/skins/cthulhu-dark/cover.jpg', setName: '深潜祭服套装', setBuff: '伤害 +8' },
];

export const DEFAULT_UNLOCKED_SKIN_IDS = SKINS.filter((skin) => skin.startingUnlocked).map((skin) => skin.id);

export function skinDefForId(id: string) {
  return SKINS.find((skin) => skin.id === id);
}
