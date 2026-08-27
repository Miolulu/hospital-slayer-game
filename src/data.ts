export type MaterialId = 'hood' | 'heart' | 'bean' | 'fang' | 'thread' | 'crown' | 'shoe';
export type ArmorId = 'scarlet-string' | 'tower-puppet' | 'thorn-wolf' | 'moon-string' | 'vine-puppet' | 'scarlet-giant';
export type Grade = 'S' | 'A' | 'B';

export interface MaterialDef {
  id: MaterialId;
  name: string;
  source: string;
  keywords: string;
  color: number;
  shape: 'hood' | 'heart' | 'bean' | 'fang' | 'thread' | 'crown' | 'shoe';
}

export interface ArmorDef {
  id: ArmorId;
  name: string;
  ingredients: [MaterialId, MaterialId];
  role: string;
  finisher: string;
  tier: 1 | 2;
  color: number;
  accent: number;
  silhouette: 'ranger' | 'tank' | 'beast';
}

export interface LevelDef {
  id: number;
  chapter: string;
  title: string;
  subtitle: string;
  enemy: string;
  keywords: string[];
  preferred: ArmorId[];
  disadvantaged: ArmorId[];
  duration: number;
  boss: boolean;
  colors: [number, number, number];
  reward?: MaterialId;
  awakening?: MaterialId;
}

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  hood: { id: 'hood', name: '赤红兜帽', source: '迷途红林', keywords: '追猎 · 速度 · 狼性', color: 0xb5293c, shape: 'hood' },
  heart: { id: 'heart', name: '木偶心核', source: '断线剧场', keywords: '机关 · 丝线 · 延伸', color: 0xd79a42, shape: 'heart' },
  bean: { id: 'bean', name: '通天魔豆', source: '云上王庭', keywords: '生长 · 巨力 · 荆棘', color: 0x5f9e67, shape: 'bean' },
  fang: { id: 'fang', name: '月蚀狼牙', source: '吞月小屋', keywords: '月影 · 闪避 · 猎杀', color: 0x7db4bd, shape: 'fang' },
  thread: { id: 'thread', name: '谎言黑线', source: '谎言舞台', keywords: '控制 · 复制 · 反伤', color: 0x8a5aa3, shape: 'thread' },
  crown: { id: 'crown', name: '云冠碎片', source: '云上餐桌', keywords: '雷霆 · 巨化 · 爆发', color: 0xe3d675, shape: 'crown' },
  shoe: { id: 'shoe', name: '破碎玻璃鞋', source: '午夜舞会', keywords: '未知 · 午夜 · 下一章', color: 0x9ddbea, shape: 'shoe' },
};

export const ARMORS: Record<ArmorId, ArmorDef> = {
  'scarlet-string': { id: 'scarlet-string', name: '绯线猎装', ingredients: ['hood', 'heart'], role: '群攻 · 连击', finisher: '百线追猎', tier: 1, color: 0xc92f45, accent: 0xf2c66d, silhouette: 'ranger' },
  'tower-puppet': { id: 'tower-puppet', name: '参天傀装', ingredients: ['heart', 'bean'], role: '护盾 · 承伤', finisher: '通天巨拳', tier: 1, color: 0x69946c, accent: 0xd7a455, silhouette: 'tank' },
  'thorn-wolf': { id: 'thorn-wolf', name: '荆棘狼装', ingredients: ['bean', 'hood'], role: '单体爆发 · 吸血', finisher: '赤月狼群', tier: 1, color: 0x8f263c, accent: 0x6dad77, silhouette: 'beast' },
  'moon-string': { id: 'moon-string', name: '月线猎装', ingredients: ['fang', 'heart'], role: '闪避反击 · 猎杀', finisher: '蚀月断罪', tier: 2, color: 0x5e91a1, accent: 0xe7de9d, silhouette: 'ranger' },
  'vine-puppet': { id: 'vine-puppet', name: '魔藤傀装', ingredients: ['thread', 'bean'], role: '控制 · 护盾反伤', finisher: '谎言绞刑架', tier: 2, color: 0x684f87, accent: 0x79b36c, silhouette: 'tank' },
  'scarlet-giant': { id: 'scarlet-giant', name: '赤冠巨装', ingredients: ['crown', 'hood'], role: '高阶范围爆发', finisher: '云冠天坠', tier: 2, color: 0xb63342, accent: 0xeadb79, silhouette: 'beast' },
};

export const LEVELS: LevelDef[] = [
  { id: 1, chapter: '红帽篇', title: '迷途红林', subtitle: '每一条路，都通向狼的嘴里。', enemy: '迷途狼群', keywords: ['数量多', '怕丝线'], preferred: ['scarlet-string'], disadvantaged: ['tower-puppet'], duration: 180, boss: false, colors: [0x101d20, 0x254448, 0xa02538] },
  { id: 2, chapter: '红帽篇', title: '吞月小屋', subtitle: '敲门声来自屋内，也来自你的身后。', enemy: '吞月巨狼', keywords: ['单体巨兽', '惧爆发'], preferred: ['thorn-wolf'], disadvantaged: ['scarlet-string'], duration: 240, boss: true, colors: [0x10171b, 0x303c40, 0xb52d40], reward: 'fang', awakening: 'hood' },
  { id: 3, chapter: '木偶篇', title: '断线剧场', subtitle: '谢幕以后，木偶仍在跳舞。', enemy: '黑线傀儡', keywords: ['连续攻击', '需护盾'], preferred: ['tower-puppet'], disadvantaged: ['thorn-wolf'], duration: 180, boss: false, colors: [0x16131b, 0x4f3554, 0xc89543] },
  { id: 4, chapter: '木偶篇', title: '谎言舞台', subtitle: '每句谎言，都让王子的影子更长。', enemy: '长鼻木偶王子', keywords: ['诡计', '惧闪避'], preferred: ['moon-string'], disadvantaged: ['tower-puppet'], duration: 240, boss: true, colors: [0x18131d, 0x624067, 0xd49f48], reward: 'thread', awakening: 'heart' },
  { id: 5, chapter: '魔豆篇', title: '通天藤路', subtitle: '云端的脚步声，正沿藤蔓落下。', enemy: '云端甲虫', keywords: ['重甲群体', '怕控制'], preferred: ['vine-puppet'], disadvantaged: ['scarlet-string'], duration: 180, boss: false, colors: [0x11201c, 0x3f705a, 0xdde2be] },
  { id: 6, chapter: '魔豆篇', title: '云上餐桌', subtitle: '巨人的晚餐，少了一只黑猫。', enemy: '饥饿云巨人', keywords: ['范围重击', '需反伤'], preferred: ['vine-puppet'], disadvantaged: ['thorn-wolf'], duration: 240, boss: true, colors: [0x132422, 0x527d68, 0xe5e6c6], reward: 'crown', awakening: 'bean' },
  { id: 7, chapter: '终章', title: '失落结局之庭', subtitle: '王冠是空的，因为所有结局都在角上。', enemy: '空冠鹿王', keywords: ['两阶段', '童话终结者'], preferred: ['moon-string', 'vine-puppet', 'scarlet-giant'], disadvantaged: [], duration: 300, boss: true, colors: [0x0b1016, 0x354958, 0xc0444e], reward: 'shoe' },
];

export const findRecipe = (a: MaterialId, b: MaterialId) => Object.values(ARMORS).find((armor) => armor.ingredients.includes(a) && armor.ingredients.includes(b));
export const hasPair = (armor: ArmorDef, a: MaterialId, b: MaterialId) => armor.ingredients.includes(a) && armor.ingredients.includes(b);
