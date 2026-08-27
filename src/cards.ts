import type { ArmorId } from './data';

export type CardKind = 'attack' | 'skill' | 'defense' | 'finisher';
export type CardTarget = 'enemy' | 'self' | 'all';
export type CardEffect =
  | { type: 'damage'; amount: number }
  | { type: 'block'; amount: number }
  | { type: 'bleed'; amount: number }
  | { type: 'poison'; amount: number }
  | { type: 'mark'; amount: number }
  | { type: 'heal'; amount: number }
  | { type: 'draw'; amount: number }
  | { type: 'energy'; amount: number }
  | { type: 'counter'; amount: number };

export interface CardDef {
  id: string;
  armor: ArmorId | 'basic';
  name: string;
  kind: CardKind;
  cost: number;
  target: CardTarget;
  description: string;
  color: number;
  effect: CardEffect;
}

const basic: CardDef[] = [
  { id: 'basic-slash', armor: 'basic', name: '短刃', kind: 'attack', cost: 1, target: 'enemy', description: '造成 8 点伤害', color: 0xb7a36c, effect: { type: 'damage', amount: 8 } },
  { id: 'basic-guard', armor: 'basic', name: '收势', kind: 'defense', cost: 1, target: 'self', description: '获得 9 点护盾', color: 0x7baea5, effect: { type: 'block', amount: 9 } },
  { id: 'basic-focus', armor: 'basic', name: '凝神', kind: 'skill', cost: 0, target: 'self', description: '抽 1 张牌', color: 0x9a88b8, effect: { type: 'draw', amount: 1 } },
];

const armorCards: Record<ArmorId, CardDef[]> = {
  'scarlet-string': [
    { id: 'scarlet-thread', armor: 'scarlet-string', name: '绯线缠击', kind: 'attack', cost: 1, target: 'enemy', description: '造成 7 伤害，施加 2 流血', color: 0xc83248, effect: { type: 'bleed', amount: 2 } },
    { id: 'scarlet-combo', armor: 'scarlet-string', name: '三段追猎', kind: 'attack', cost: 2, target: 'enemy', description: '造成 16 伤害；本回合每出过 1 张牌再 +3', color: 0xe0a950, effect: { type: 'damage', amount: 16 } },
    { id: 'scarlet-reel', armor: 'scarlet-string', name: '回线', kind: 'skill', cost: 0, target: 'self', description: '抽 2 张牌，获得 1 点能量', color: 0xd46875, effect: { type: 'draw', amount: 2 } },
    { id: 'scarlet-mark', armor: 'scarlet-string', name: '红印', kind: 'skill', cost: 1, target: 'enemy', description: '标记目标；下次攻击造成双倍伤害', color: 0xb82e43, effect: { type: 'mark', amount: 2 } },
    { id: 'scarlet-finisher', armor: 'scarlet-string', name: '百线追猎', kind: 'finisher', cost: 3, target: 'enemy', description: '造成 32 点伤害', color: 0xf0c96c, effect: { type: 'damage', amount: 32 } },
  ],
  'thorn-wolf': [
    { id: 'thorn-bite', armor: 'thorn-wolf', name: '荆棘撕咬', kind: 'attack', cost: 1, target: 'enemy', description: '造成 9 伤害，施加 2 中毒', color: 0x6e9f65, effect: { type: 'poison', amount: 2 } },
    { id: 'thorn-rage', armor: 'thorn-wolf', name: '低血狂奔', kind: 'attack', cost: 2, target: 'enemy', description: '造成 20 伤害', color: 0xb63342, effect: { type: 'damage', amount: 20 } },
    { id: 'thorn-hide', armor: 'thorn-wolf', name: '狼皮', kind: 'defense', cost: 1, target: 'self', description: '获得 7 护盾，反伤 4', color: 0x8cb66c, effect: { type: 'counter', amount: 4 } },
    { id: 'thorn-spore', armor: 'thorn-wolf', name: '毒孢飞散', kind: 'skill', cost: 1, target: 'enemy', description: '施加 5 中毒', color: 0x8a6f40, effect: { type: 'poison', amount: 5 } },
    { id: 'thorn-finisher', armor: 'thorn-wolf', name: '赤月狼群', kind: 'finisher', cost: 3, target: 'enemy', description: '造成 25 伤害并施加 8 中毒', color: 0xe2c06e, effect: { type: 'poison', amount: 8 } },
  ],
  'tower-puppet': [
    { id: 'tower-plate', armor: 'tower-puppet', name: '木偶装甲', kind: 'defense', cost: 1, target: 'self', description: '获得 15 护盾', color: 0x69946c, effect: { type: 'block', amount: 15 } },
    { id: 'tower-punch', armor: 'tower-puppet', name: '通天重拳', kind: 'attack', cost: 2, target: 'enemy', description: '造成 13 伤害；护盾越高伤害越高', color: 0xd7a455, effect: { type: 'damage', amount: 13 } },
    { id: 'tower-counter', armor: 'tower-puppet', name: '反弹关节', kind: 'skill', cost: 1, target: 'self', description: '获得 8 护盾和 8 反击', color: 0x8fbd90, effect: { type: 'counter', amount: 8 } },
    { id: 'tower-repair', armor: 'tower-puppet', name: '缝合修复', kind: 'skill', cost: 1, target: 'self', description: '回复 8 生命', color: 0x9ccbb5, effect: { type: 'heal', amount: 8 } },
    { id: 'tower-finisher', armor: 'tower-puppet', name: '通天巨拳', kind: 'finisher', cost: 3, target: 'enemy', description: '造成 28 点伤害并获得 12 护盾', color: 0xf0cf72, effect: { type: 'damage', amount: 28 } },
  ],
  'moon-string': [
    { id: 'moon-fang', armor: 'moon-string', name: '月牙闪击', kind: 'attack', cost: 1, target: 'enemy', description: '造成 10 伤害，若有月痕则暴击', color: 0x7db4bd, effect: { type: 'damage', amount: 10 } },
    { id: 'moon-step', armor: 'moon-string', name: '月影步', kind: 'defense', cost: 1, target: 'self', description: '获得 10 闪避护盾', color: 0xa4d8db, effect: { type: 'block', amount: 10 } },
    { id: 'moon-mark', armor: 'moon-string', name: '冷月标记', kind: 'skill', cost: 1, target: 'enemy', description: '施加 3 月痕', color: 0x5e91a1, effect: { type: 'mark', amount: 3 } },
    { id: 'moon-draw', armor: 'moon-string', name: '折月回身', kind: 'skill', cost: 0, target: 'self', description: '抽 1 张牌并获得 1 能量', color: 0xc3d6c3, effect: { type: 'energy', amount: 1 } },
    { id: 'moon-finisher', armor: 'moon-string', name: '蚀月断网', kind: 'finisher', cost: 3, target: 'enemy', description: '造成 35 点伤害', color: 0xe9de9d, effect: { type: 'damage', amount: 35 } },
  ],
  'vine-puppet': [
    { id: 'vine-root', armor: 'vine-puppet', name: '根缚', kind: 'skill', cost: 1, target: 'enemy', description: '施加 3 中毒并削弱下次攻击', color: 0x79b36c, effect: { type: 'poison', amount: 3 } },
    { id: 'vine-wall', armor: 'vine-puppet', name: '藤墙', kind: 'defense', cost: 1, target: 'self', description: '获得 12 护盾', color: 0x8abf78, effect: { type: 'block', amount: 12 } },
    { id: 'vine-copy', armor: 'vine-puppet', name: '复写枝条', kind: 'skill', cost: 2, target: 'self', description: '抽 2 张牌', color: 0x9e85bf, effect: { type: 'draw', amount: 2 } },
    { id: 'vine-punish', armor: 'vine-puppet', name: '缠绕反噬', kind: 'attack', cost: 2, target: 'enemy', description: '造成 18 伤害', color: 0x6d4e88, effect: { type: 'damage', amount: 18 } },
    { id: 'vine-finisher', armor: 'vine-puppet', name: '谎言绞刑架', kind: 'finisher', cost: 3, target: 'enemy', description: '造成 26 伤害并施加 10 中毒', color: 0xe0c076, effect: { type: 'poison', amount: 10 } },
  ],
  'scarlet-giant': [
    { id: 'giant-stomp', armor: 'scarlet-giant', name: '赤冠践踏', kind: 'attack', cost: 2, target: 'enemy', description: '造成 22 点伤害', color: 0xb63342, effect: { type: 'damage', amount: 22 } },
    { id: 'giant-charge', armor: 'scarlet-giant', name: '蓄力', kind: 'skill', cost: 1, target: 'self', description: '下一张攻击牌伤害 +10', color: 0xe6d27a, effect: { type: 'energy', amount: 1 } },
    { id: 'giant-guard', armor: 'scarlet-giant', name: '王冠护壁', kind: 'defense', cost: 1, target: 'self', description: '获得 14 护盾', color: 0xd2aa51, effect: { type: 'block', amount: 14 } },
    { id: 'giant-burst', armor: 'scarlet-giant', name: '王座爆裂', kind: 'attack', cost: 3, target: 'enemy', description: '造成 30 点伤害', color: 0xc77f49, effect: { type: 'damage', amount: 30 } },
    { id: 'giant-finisher', armor: 'scarlet-giant', name: '云冠天坠', kind: 'finisher', cost: 3, target: 'enemy', description: '造成 42 点伤害', color: 0xf3dc92, effect: { type: 'damage', amount: 42 } },
  ],
};

export const getCard = (id: string) => [...basic, ...Object.values(armorCards).flat()].find((card) => card.id === id);
export const getArmorCards = (armor: ArmorId) => armorCards[armor];
export const getStarterDeck = (armor: ArmorId) => [
  // The first three cards define the starter loop; later cards must be earned
  // from battle rewards so choosing a reward has a real deck-building impact.
  ...armorCards[armor].slice(0, 3).map((card) => card.id),
  'basic-slash', 'basic-slash', 'basic-guard', 'basic-focus',
];
export const getRewardCards = (armor: ArmorId, level: number) => {
  const cards = armorCards[armor];
  const start = (level - 1) % cards.length;
  return [cards[start], cards[(start + 1) % cards.length], cards[(start + 2) % cards.length]];
};
