import Phaser from 'phaser';
import '../style.css';
import {
  attackStatusGrowth,
  bladeTouchesCircle,
  DEFAULT_PICKUP_RADIUS,
  enemyHealthMultiplier as calculateEnemyHealthMultiplier,
  effectiveRotationSpeed,
  dailyWaveScaling,
  enemyCombatStats,
  enemyVisualRadius,
  experienceRequiredForLevel,
  FREE_UPGRADE_REFRESHES,
  isWithinPickupRange,
  meleeTargetLimit,
  MAX_WEAPON_ROTATION_SPEED,
  openingWaveEnemyHealthCap,
  PAID_UPGRADE_REFRESH_SALE_ID,
  pickupPullSpeed,
  rotationsPerSecond,
  TUTORIAL_ENEMY_DAMAGE_FACTOR,
  TUTORIAL_INCOMING_DAMAGE_FACTOR,
  TUTORIAL_WAVE_BUDGETS,
  tutorialEnemyHealthMultiplier,
  TOTAL_HOSPITAL_FLOORS,
  volleyDamageMultiplier,
  waveSpawningComplete,
  wavesPerFloorForFloor,
  weaponAttackRange,
  weaponDamageAtLevel,
  WEAPON_DAMAGE,
  upgradeRefreshRequiresPayment,
  type CombatEnemyKind,
} from '../../domain/combat/combatBalance';
import {
  SMALL_ENEMY_ART_FRAME_RATE,
  SMALL_ENEMY_ART_SHEET_BY_KEY,
  SMALL_ENEMY_ART_SHEETS,
  SMALL_ENEMY_ART_VARIANTS,
  smallEnemyArtForFloor,
  type SmallEnemyKind,
} from '../../domain/catalog/patientEnemyArt';
import {
  SMALL_ENEMY_ATTACK_ARTS,
  SMALL_ENEMY_ATTACK_ART_BY_KIND,
  type SmallEnemyAttackKind,
} from '../../domain/catalog/patientEnemyAttackArt';
import {
  MOON_MOTH_QUEEN_ART,
  MOON_MOTH_QUEEN_ART_IMAGES,
  MOON_MOTH_QUEEN_ART_SHEETS,
  MOON_MOTH_QUEEN_ATTACK_FRAME_RATE,
  MOON_MOTH_QUEEN_TRANSFORM_FRAME_RATE,
  MOON_MOTH_QUEEN_WALK_FRAME_RATE,
} from '../../domain/catalog/moonMothQueenArt';
import {
  MAINLINE_BOSS_ART_IMAGES,
  MAINLINE_BOSS_ART_SHEETS,
  MAINLINE_BOSS_ART_VARIANT_BY_ID,
  MAINLINE_BOSS_ART_VARIANT_LIST,
  MAINLINE_BOSS_ART_VARIANTS,
  type MainlineBossVariantId,
} from '../../domain/catalog/mainlineBossArt';
import {
  monthlyChallengeForMonth,
  monthlyRewardIdsForRank,
  rollMonthlyBossDrops,
  type MonthlyChallengeConfig,
} from '../../domain/challenge/dailyChallenge';
import {
  PLAYER_SKIN_ART_IMAGES,
  PLAYER_SKIN_ART_SHEETS,
  playerSkinArtForId,
} from '../../domain/catalog/playerSkinArt';
import {
  DEFAULT_UNLOCKED_SKIN_IDS,
  SKINS,
  skinDefForId,
  type ProfileSkinCategory,
  type SkinDef,
} from '../../domain/catalog/skinCatalog';
import { audio } from '../../audio';
import { installUiTextTheme, UI_FONT_STACK } from '../ui/uiTheme';
import {
  UPGRADE_CARD_CONFIGS,
  UPGRADE_ICON_KINDS,
  formatUpgradeCardDescription,
  rollUpgradeCardRarity,
  upgradeCardTierForRarity,
  upgradeCardColor,
  type UpgradeAttackStatus,
  type UpgradeCardConfig,
  type UpgradeCardRarity,
  type UpgradeIconKind,
} from '../../domain/catalog/upgradeCards';
import { ProgressRepository } from '../../infrastructure/persistence/ProgressRepository';
import { buildaPlatform } from '../../infrastructure/platform/BuildaPlatformAdapter';
import { developerMode } from '../../infrastructure/developer/DeveloperMode';
import { assetUrl } from '../../infrastructure/assets/assetUrl';
import { PhaserAssetLoader, type PhaserAssetDefinition, type PhaserAssetLoadResult } from '../assets/PhaserAssetLoader';
import { isValidSaleId, paymentOrderKey, skinSaleId, weaponSkinSaleId } from '../../payment';

installUiTextTheme();

const W = 1280;
const H = 720;
const MAX_WEAPON_COPIES = 5;
const TOTAL_FLOORS = TOTAL_HOSPITAL_FLOORS;
const SKIN_TRIAL_DURATION_MS = 24 * 60 * 60 * 1000;
// 远程 DEMO 更新保留了首波首领测试开关，正式玩法仍可通过开发者模式覆盖波次。
// 正式关卡使用正常出怪节奏：主线小首领第 10 波，每日挑战首领第 50 波。
const TEMP_FIRST_WAVE_BOSS_TEST = false;
const FULL_TURN = Math.PI * 2;
const ARENA = { left: 160, right: 1120, top: 116, bottom: 642 };
const WORLD_BOUNDS = { left: -720, right: 2000, top: -520, bottom: 1700 };
const ARENA_IMAGE_SIZE = { width: 2048, height: 1152 };
const ARENA_WALKABLE_IMAGE_POINTS = [
  { x: 42, y: 585 },
  { x: 130, y: 525 },
  { x: 285, y: 476 },
  { x: 470, y: 416 },
  { x: 670, y: 344 },
  { x: 833, y: 260 },
  { x: 1008, y: 178 },
  { x: 1170, y: 258 },
  { x: 1355, y: 343 },
  { x: 1545, y: 424 },
  { x: 1760, y: 539 },
  { x: 1930, y: 690 },
  { x: 1775, y: 807 },
  { x: 1600, y: 885 },
  { x: 1405, y: 964 },
  { x: 1210, y: 1048 },
  { x: 1020, y: 1124 },
  { x: 835, y: 1098 },
  { x: 625, y: 1022 },
  { x: 430, y: 928 },
  { x: 278, y: 824 },
  { x: 152, y: 707 },
  { x: 62, y: 620 },
] as const;
const ARENA_WALKABLE_POINTS = ARENA_WALKABLE_IMAGE_POINTS.map((point) => ({
  x: WORLD_BOUNDS.left + (point.x / ARENA_IMAGE_SIZE.width) * (WORLD_BOUNDS.right - WORLD_BOUNDS.left),
  y: WORLD_BOUNDS.top + (point.y / ARENA_IMAGE_SIZE.height) * (WORLD_BOUNDS.bottom - WORLD_BOUNDS.top),
}));
const ARENA_WALKABLE_CENTER = ARENA_WALKABLE_POINTS.reduce((acc, point) => ({
  x: acc.x + point.x / ARENA_WALKABLE_POINTS.length,
  y: acc.y + point.y / ARENA_WALKABLE_POINTS.length,
}), { x: 0, y: 0 });

type Phase = 'start' | 'mainline-intro' | 'mainline-select' | 'weapon-select' | 'dialogue' | 'battle' | 'wave-cleanup' | 'wave-break' | 'upgrade' | 'boss-intro' | 'boss-death' | 'result';
type EnemyKind = CombatEnemyKind;
type DropKind = 'xp';
type WeaponType = 'melee' | 'ranged';
type WeaponEffect = 'slash' | 'spark' | 'burst' | 'beam' | 'tentacle' | 'laser' | 'bomb' | 'void' | 'neon';
type BuffKind = 'damage' | 'health' | 'shield';
type RunMode = 'mainline' | 'daily';
type WeaponClass = 'sword' | 'whip' | 'gun' | 'cannon';
type SkinAcquisitionCategory = 'basic' | 'store' | 'boss';
type AttackStatus = UpgradeAttackStatus;
type PlayerDirection = 'left' | 'right' | 'up' | 'down';
type PlayerAnimation = 'idle' | 'walk-left' | 'walk-right' | 'walk-up' | 'walk-down' | 'hit' | 'death';
type BossVisualState = 'transform' | 'walk' | 'attack' | 'death';
type MiniBossVisualState = 'walk' | 'attack' | 'death';
type LazyAssetGroup = 'profile' | 'mainline' | 'daily' | 'weapon' | 'battle';

const TUTORIAL_SHOWCASE_SKIN_ID = 'abyssal-oracle';
const TUTORIAL_SHOWCASE_WEAPON_SKIN_IDS: Record<WeaponClass, string> = {
  sword: 'sword-moon-moth-queen-gala',
  gun: 'gun-moon-moth-queen-gala',
  whip: 'whip-prism-energy',
  cannon: 'cannon-cthulhu-eye',
};
const TUTORIAL_SHOWCASE_LEVEL = 30;
const TUTORIAL_SHOWCASE_WEAPON_LEVEL = 20;
const TUTORIAL_SHOWCASE_DAMAGE_BONUS = 180;
const TUTORIAL_SHOWCASE_SHIELD = 999;
const TUTORIAL_SHOWCASE_RUN_SPEED = 560;
const TUTORIAL_SHOWCASE_PICKUP_RADIUS = 420;
const TUTORIAL_SHOWCASE_MAGNET = 420;
interface ProgressSave {
  maxFloor: number;
  mainlineIntroSeen?: boolean;
  tutorialCompleted?: boolean;
  unlockedWeaponIds: string[];
  unlockedWeaponSkinIds: string[];
  equippedWeaponSkinIds: Partial<Record<WeaponClass, string>>;
  unlockedSkinIds: string[];
  equippedSkinId: string;
  skinTrialExpiresAt?: Record<string, number>;
  weaponSkinTrialExpiresAt?: Record<string, number>;
  archiveKinds: string[];
  dailyCompletedDate?: string;
  dailyBestSeconds?: number;
  dailyAttemptDate?: string;
  dailyAttemptMonth?: string;
  dailyAttempts?: number;
  dailyAdTickets?: number;
  dailyRewardMonth?: string;
  dailyRewardIds?: string[];
  dailyRewardTitle?: string;
  metaCoins: number;
  /** 已经发放过的 Builda 支付订单号，用于跨重启幂等。 */
  processedPaymentOrderIds?: string[];
}

interface DailyBoardEntry {
  rank: number;
  name: string;
  score: number;
}

interface DailySelfRank {
  rank: number;
  score: number;
}

interface Enemy {
  kind: EnemyKind;
  node: Phaser.GameObjects.Container;
  body?: Phaser.GameObjects.Container;
  bossVisual?: {
    artId: string;
    introText: string;
    deathText: string;
    introDuration: number;
    state: BossVisualState;
    stateTimer: number;
    introComplete: boolean;
    shadow: Phaser.GameObjects.Ellipse;
    walkKey: string;
    attackKey: string;
    transformKey?: string;
    transform?: Phaser.GameObjects.Sprite;
    walk: Phaser.GameObjects.Sprite;
    attack: Phaser.GameObjects.Sprite;
    portrait: Phaser.GameObjects.Image;
    death: Phaser.GameObjects.Image;
    aura: Phaser.GameObjects.Ellipse;
  };
  miniBossVisual?: {
    artId: string;
    state: MiniBossVisualState;
    shadow: Phaser.GameObjects.Ellipse;
    walkKey: string;
    attackKey: string;
    deathKey: string;
    walk: Phaser.GameObjects.Sprite;
    attack: Phaser.GameObjects.Sprite;
    death: Phaser.GameObjects.Image;
    aura: Phaser.GameObjects.Ellipse;
  };
  baseHp: number;
  hpScale: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  attackCd: number;
  shootCd: number;
  areaCd: number;
  flash: number;
  meleeHitCd: number;
  deathTimer: number;
  status?: AttackStatus;
  statusTimer: number;
  statusTick: number;
  statusMarker?: Phaser.GameObjects.Text;
  visualWidth: number;
  visualHeight: number;
  facingRight?: boolean;
  dead?: boolean;
}

interface Projectile {
  node: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  damage: number;
  ttl: number;
  color: number;
}

interface Drop {
  node: Phaser.GameObjects.Container;
  kind: DropKind;
  value: number;
  ttl: number;
  attracted: boolean;
}

interface Weapon {
  id: string;
  name: string;
  glyph: string;
  type: WeaponType;
  weaponClass: WeaponClass;
  effect: WeaponEffect;
  color: number;
  damage: number;
  cooldown: number;
  range: number;
  rotationSpeed: number;
  level: number;
  copies: number;
  ammo: number;
  statusEffect?: AttackStatus;
  owned: boolean;
}

interface WeaponSkinDef {
  id: string;
  name: string;
  weaponClass: WeaponClass;
  color: number;
  cost: number;
  textureKey: string;
  assetPath?: string;
  dropOnly?: boolean;
  category: SkinAcquisitionCategory;
  unlockFloor?: number;
}

interface UpgradeDef {
  title: string;
  detail: string;
  apply: () => void;
  color: number;
  rarity?: UpgradeCardRarity;
  icon?: UpgradeIconKind;
}

interface UiActionRegion {
  phase: Phase;
  x: number;
  y: number;
  width: number;
  height: number;
  callback: () => void;
  setPressed: (pressed: boolean) => void;
}

const palette = {
  bg: 0x0b1117,
  panel: 0x16222b,
  panelLight: 0x20313a,
  line: 0x46636a,
  cream: '#f4e8c9',
  muted: '#92aaa9',
  teal: '#6bd3c1',
  amber: '#f2bf62',
  danger: '#ed716e',
  violet: '#b798e2',
  cyan: '#7ab9d0',
  green: '#8fd17c',
};

const paletteRgb = {
  amber: 0xf2bf62,
  danger: 0xed716e,
  cyan: 0x7ab9d0,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const hex = (color: number) => Phaser.Display.Color.IntegerToColor(color).rgba;
const pointInPolygon = (point: { x: number; y: number }, polygon: readonly { x: number; y: number }[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = (yi > point.y) !== (yj > point.y)
      && point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.000001) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

export class HospitalBattleScene extends Phaser.Scene {
  private readonly progressRepository = new ProgressRepository<ProgressSave>();
  private readonly developerMode = developerMode;
  private readonly assetLoader: PhaserAssetLoader;
  private lazyAssetRetry?: () => void;
  private lazyAssetError?: string;
  private developerGodMode = false;
  private developerAutoClear = false;
  private developerWaveOverride?: number;
  private developerPanel?: Phaser.GameObjects.Container;
  private phase: Phase = 'start';
  private loadingLayer?: Phaser.GameObjects.Container;
  private loadingProgress?: Phaser.GameObjects.Graphics;
  private loadingStatus?: Phaser.GameObjects.Text;
  private overlay?: Phaser.GameObjects.Container;
  private transientToast?: Phaser.GameObjects.Container;
  private canvasUiPointerDownHandler?: (event: PointerEvent) => void;
  private canvasUiPointerMoveHandler?: (event: PointerEvent) => void;
  private canvasUiPointerUpHandler?: (event: PointerEvent) => void;
  private canvasUiWheelHandler?: (event: WheelEvent) => void;
  private canvasPointerCancelHandler?: (event: PointerEvent) => void;
  private world!: Phaser.GameObjects.Container;
  private ui!: Phaser.GameObjects.Container;
  private arenaBackground?: Phaser.GameObjects.Image;
  private arenaBackgroundTransition?: Phaser.GameObjects.Image;
  private arenaBackgroundTexture = '';
  private player!: Phaser.GameObjects.Container;
  private playerBodyLayer?: Phaser.GameObjects.Container;
  private playerWeaponLayer?: Phaser.GameObjects.Container;
  private playerSprite?: Phaser.GameObjects.Sprite;
  private playerSpriteTargetHeight = 82;
  private playerSpriteScale = 2;
  private readonly smallEnemyScale = 1.2;
  private enemyVisualHeight = Math.round(164 * 1.2);
  private readonly gameplayCameraZoom = 2 / 3;
  private readonly joystickRingRadius = 66;
  private readonly joystickKnobRadius = 22;
  private readonly joystickMaxDistance = this.joystickRingRadius - this.joystickKnobRadius;
  private readonly joystickDeadzone = 8;
  private playerAnimation: PlayerAnimation = 'idle';
  private playerDirection: PlayerDirection = 'down';
  private playerHitTimer = 0;
  private playerDeathTimer = 0;
  private playerDeathPending = false;
  private playerGlow!: Phaser.GameObjects.Arc;
  private heldWeapon?: Phaser.GameObjects.Image;
  private heldWeapons: Phaser.GameObjects.Image[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private drops: Drop[] = [];
  private weapons: Weapon[] = [];
  private runMode: RunMode = 'mainline';
  private selectedWeaponId = 'knife';
  private weaponSelectPreviewSkinId = '';
  private selectedStartFloor = 1;
  private progress: ProgressSave = {
    maxFloor: 1,
    mainlineIntroSeen: false,
    tutorialCompleted: false,
    unlockedWeaponIds: ['knife', 'ward-lantern'],
    unlockedWeaponSkinIds: ['sword-default', 'gun-default', 'whip-default', 'cannon-default'],
    equippedWeaponSkinIds: { sword: 'sword-default', gun: 'gun-default', whip: 'whip-default', cannon: 'cannon-default' },
    unlockedSkinIds: ['patient-default'],
    equippedSkinId: 'patient-default',
    skinTrialExpiresAt: {},
    weaponSkinTrialExpiresAt: {},
    archiveKinds: [],
    dailyBestSeconds: undefined,
    dailyAttemptDate: undefined,
    dailyAttemptMonth: undefined,
    dailyAttempts: 0,
    dailyAdTickets: 0,
    dailyRewardMonth: undefined,
    dailyRewardIds: [],
    dailyRewardTitle: undefined,
    metaCoins: 0,
    processedPaymentOrderIds: [],
  };
  private playerNickname = '患者 0001';
  private playerIdentityLoaded = false;
  private profilePreviewSkinId = 'patient-default';
  private profileSkinCategory: ProfileSkinCategory = 'all';
  private profileSkinPage = 0;
  private weaponSkinPage = 0;
  private weaponSkinPageWeaponClass?: WeaponClass;
  private profileSkinPointer?: number;
  private profileSkinStartX = 0;
  private profileSkinMoved = false;
  private profileSkinViewport = { left: 0, right: 0, top: 0, bottom: 0 };
  private skinPaymentPending = false;
  private skinAdPending = false;
  private skinAdMessage = '';
  private weaponSkinPaymentPending = false;
  private weaponSkinAdPending = false;
  private weaponSkinAdMessage = '';
  private lastDailyBossDropIds: string[] = [];
  private dailyBoard: DailyBoardEntry[] = [];
  private dailySelfRank?: DailySelfRank;
  private dailyBoardLoaded = false;
  private skins: SkinDef[] = SKINS;
  private weaponSkins: WeaponSkinDef[] = [
    { id: 'sword-default', name: '基础病院刀', weaponClass: 'sword', color: 0xed716e, cost: 0, textureKey: 'weapon-sword', category: 'basic' },
    { id: 'sword-cthulhu', name: '深渊裂刃', weaponClass: 'sword', color: 0x6bd3c1, cost: 10000, textureKey: 'weapon-skin-sword-cthulhu', assetPath: '/assets/art/weapon-select/skin-sword-cthulhu-clean.png', category: 'store' },
    { id: 'sword-fairytale', name: '怪诞童话', weaponClass: 'sword', color: 0xed716e, cost: 30000, textureKey: 'weapon-skin-sword-fairytale', assetPath: '/assets/art/weapon-select/skin-sword-fairytale-clean.png', category: 'store' },
    { id: 'sword-hero-tech', name: '英雄科技', weaponClass: 'sword', color: 0x7ab9d0, cost: 40000, textureKey: 'weapon-skin-sword-hero-tech', assetPath: '/assets/art/weapon-select/skin-sword-hero-tech-clean.png', category: 'store' },
    { id: 'sword-black-tide', name: '黑潮断罪刃', weaponClass: 'sword', color: 0x3b5164, cost: 40000, textureKey: 'weapon-skin-sword-black-tide', assetPath: '/assets/art/weapon-select/skin-sword-black-tide-clean.png', category: 'store' },
    { id: 'sword-old-god-ritual', name: '旧神祭器刃', weaponClass: 'sword', color: 0x9a6bd1, cost: 40000, textureKey: 'weapon-skin-sword-old-god-ritual', assetPath: '/assets/art/weapon-select/skin-sword-old-god-ritual-clean.png', category: 'store' },
    { id: 'sword-abyss-mouth', name: '深渊口器刃', weaponClass: 'sword', color: 0xe78a57, cost: 40000, textureKey: 'weapon-skin-sword-abyss-mouth', assetPath: '/assets/art/weapon-select/skin-sword-abyss-mouth-clean.png', category: 'store' },
    { id: 'sword-moon-moth', name: '月蚀蝶刃', weaponClass: 'sword', color: 0xb798e2, cost: 0, textureKey: 'weapon-skin-sword-moon-moth', assetPath: '/assets/art/weapon-select/skin-sword-moon-moth-clean.png', dropOnly: true, category: 'boss' },
    { id: 'sword-moon-moth-queen', name: '月蚀蝶刃', weaponClass: 'sword', color: 0xb798e2, cost: 45000, textureKey: 'weapon-skin-sword-moon-moth-queen', assetPath: '/assets/art/weapon-select/skin-sword-moon-moth-queen-clean.png', category: 'store' },
    { id: 'sword-moon-moth-queen-gala', name: '月蚀蝶刃·华丽版', weaponClass: 'sword', color: 0xe8d4ff, cost: 50000, textureKey: 'weapon-skin-sword-moon-moth-queen-gala', assetPath: '/assets/art/weapon-select/skin-sword-moon-moth-queen-gala-clean.png', category: 'store' },
    { id: 'gun-default', name: '基础灯枪', weaponClass: 'gun', color: 0xf2bf62, cost: 0, textureKey: 'weapon-gun', category: 'basic' },
    { id: 'gun-cthulhu', name: '深渊灯枪', weaponClass: 'gun', color: 0x6bd3c1, cost: 30000, textureKey: 'weapon-skin-gun-cthulhu', assetPath: '/assets/art/weapon-select/skin-gun-cthulhu-clean.png', category: 'store' },
    { id: 'gun-fairytale', name: '童话脉冲枪', weaponClass: 'gun', color: 0xed716e, cost: 30000, textureKey: 'weapon-skin-gun-fairytale', assetPath: '/assets/art/weapon-select/skin-gun-fairytale-clean.png', category: 'store' },
    { id: 'gun-moon-moth', name: '蝶瞳脉冲枪', weaponClass: 'gun', color: 0xb798e2, cost: 0, textureKey: 'weapon-skin-gun-moon-moth', assetPath: '/assets/art/weapon-select/skin-gun-moon-moth-clean.png', dropOnly: true, category: 'boss' },
    { id: 'gun-ritual-relic', name: '教团遗物枪', weaponClass: 'gun', color: 0xe0c076, cost: 40000, textureKey: 'weapon-skin-gun-ritual-relic', assetPath: '/assets/art/weapon-select/skin-gun-ritual-relic-clean.png', category: 'store' },
    { id: 'gun-cthulhu-eye', name: '克苏鲁眼脉冲器', weaponClass: 'gun', color: 0x6bd3c1, cost: 40000, textureKey: 'weapon-skin-gun-cthulhu-eye', assetPath: '/assets/art/weapon-select/skin-gun-cthulhu-eye-clean.png', category: 'store' },
    { id: 'gun-abyss-machinery', name: '深渊机件射器', weaponClass: 'gun', color: 0x7ab9d0, cost: 40000, textureKey: 'weapon-skin-gun-abyss-machinery', assetPath: '/assets/art/weapon-select/skin-gun-abyss-machinery-clean.png', category: 'store' },
    { id: 'gun-moon-moth-queen', name: '蝶瞳脉冲枪', weaponClass: 'gun', color: 0xb798e2, cost: 45000, textureKey: 'weapon-skin-gun-moon-moth-queen', assetPath: '/assets/art/weapon-select/skin-gun-moon-moth-queen-clean.png', category: 'store' },
    { id: 'gun-moon-moth-queen-gala', name: '蝶瞳脉冲枪·华丽版', weaponClass: 'gun', color: 0xe8d4ff, cost: 50000, textureKey: 'weapon-skin-gun-moon-moth-queen-gala', assetPath: '/assets/art/weapon-select/skin-gun-moon-moth-queen-gala-clean.png', category: 'store' },
    { id: 'whip-default', name: '基础长鞭', weaponClass: 'whip', color: 0x8fd17c, cost: 0, textureKey: 'weapon-whip', category: 'basic' },
    { id: 'whip-cthulhu', name: '古神触须鞭', weaponClass: 'whip', color: 0x9a6bd1, cost: 30000, textureKey: 'weapon-skin-whip-cthulhu', assetPath: '/assets/art/weapon-select/skin-whip-cthulhu-clean.png', category: 'store' },
    { id: 'whip-fairytale', name: '梦魇童话鞭', weaponClass: 'whip', color: 0xed716e, cost: 30000, textureKey: 'weapon-skin-whip-fairytale', assetPath: '/assets/art/weapon-select/skin-whip-fairytale-clean.png', category: 'store' },
    { id: 'whip-bone-scale', name: '骨鳞祭鞭', weaponClass: 'whip', color: 0xd99263, cost: 40000, textureKey: 'weapon-skin-whip-bone-scale', assetPath: '/assets/art/weapon-select/skin-whip-bone-scale-clean.png', category: 'store' },
    { id: 'whip-living-crown', name: '活体王冠鞭', weaponClass: 'whip', color: 0xb798e2, cost: 40000, textureKey: 'weapon-skin-whip-living-crown', assetPath: '/assets/art/weapon-select/skin-whip-living-crown-clean.png', category: 'store' },
    { id: 'whip-prism-energy', name: '棱晶能量鞭', weaponClass: 'whip', color: 0x7ab9d0, cost: 40000, textureKey: 'weapon-skin-whip-prism-energy', assetPath: '/assets/art/weapon-select/skin-whip-prism-energy-clean.png', category: 'store' },
    { id: 'cannon-default', name: '基础回声炮', weaponClass: 'cannon', color: 0xb798e2, cost: 0, textureKey: 'weapon-cannon', category: 'basic' },
    { id: 'cannon-cthulhu', name: '深渊回声炮', weaponClass: 'cannon', color: 0x6bd3c1, cost: 30000, textureKey: 'weapon-skin-cannon-cthulhu', assetPath: '/assets/art/weapon-select/skin-cannon-cthulhu-clean.png', category: 'store' },
    { id: 'cannon-fairytale', name: '童话星陨炮', weaponClass: 'cannon', color: 0xed716e, cost: 30000, textureKey: 'weapon-skin-cannon-fairytale', assetPath: '/assets/art/weapon-select/skin-cannon-fairytale-clean.png', category: 'store' },
    { id: 'cannon-old-god-ring', name: '旧神骨环炮', weaponClass: 'cannon', color: 0xe5d47a, cost: 40000, textureKey: 'weapon-skin-cannon-old-god-ring', assetPath: '/assets/art/weapon-select/skin-cannon-old-god-ring-clean.png', category: 'store' },
    { id: 'cannon-cthulhu-eye', name: '克苏鲁之眼炮', weaponClass: 'cannon', color: 0x6bd3c1, cost: 40000, textureKey: 'weapon-skin-cannon-cthulhu-eye', assetPath: '/assets/art/weapon-select/skin-cannon-cthulhu-eye-clean.png', category: 'store' },
    { id: 'cannon-abyss-maw', name: '深渊巨口炮', weaponClass: 'cannon', color: 0xe78a57, cost: 40000, textureKey: 'weapon-skin-cannon-abyss-maw', assetPath: '/assets/art/weapon-select/skin-cannon-abyss-maw-clean.png', category: 'store' },
  ];
  private waveBreakTimer = 0;
  private dailyBossRewardGranted = false;
  private bossIntroActive = false;
  private bossIntroElapsed = 0;
  private bossDeathActive = false;
  private bossPreviewActive = false;
  private activeAttackStatus?: AttackStatus;
  private attackStatusLevel = 0;
  private attackStatusDuration = 0;
  private attackStatusDamage = 0;
  private attackStatusSpreadTargets = 0;
  private attackStatusSpreadRadius = 0;
  private joystickVisual?: Phaser.GameObjects.Container;
  private uiActionRegions: UiActionRegion[] = [];
  private pendingUiAction?: { pointerId: number; phase: Phase; region: UiActionRegion };
  private floor = 1;
  private wave = 1;
  private waveTimer = 0;
  private spawnTimer = 0;
  private waveSpawned = 0;
  private waveClearedMessage = '';
  private waveClearedTimer = 0;
  private pendingWaveBreak = false;
  private waveCleanupComplete = false;
  private upgradeRefreshCount = 0;
  private upgradePaymentPending = false;
  private upgradePaymentMessage = '';
  private upgradeChoices: UpgradeDef[] = [];
  private upgradeCardRefreshUsed = [false, false, false];
  private processedPaymentOrderIds = new Set<string>();
  private attackTimer = 0;
  private weaponAngle = 0;
  private previousWeaponAngle = 0;
  private weaponOrbitRadius = 0;
  private elapsed = 0;
  private hp = 100;
  private maxHp = 100;
  private shield = 0;
  private maxShield = 0;
  private san = 100;
  private xp = 0;
  private level = 1;
  private xpNeed = experienceRequiredForLevel(1);
  private kills = 0;
  private sanPulse = 0;
  private mutated = false;
  private runSpeed = 380;
  private damageBonus = 0;
  private roundDamageBonus = 0;
  private rotationSpeedMultiplier = 1;
  private rotationUpgradeStacks = 0;
  private rotationStacksConvertedToAmmo = 0;
  private waveBossSpawned = false;
  private pickupRadius = DEFAULT_PICKUP_RADIUS;
  private magnet = 0;
  private gameSpeed = 1;
  private dailyStatusSynergy = 0;
  private dailyShieldRetaliation = 0;
  private dailyMagnetSynergy = 0;
  private dailyVoidPulse = 0;
  private dailyVoidPulseTimer = 0;
  private dailyEchoShots = 0;
  private dailyBloodPact = 0;
  private dailyKillNova = 0;
  private dailySlowField = 0;
  private waveLength = 24;
  private playerRadius = 34;
  private readonly walls: Array<{ x: number; y: number; width: number; height: number }> = [];
  private dialogueIndex = 0;
  private dialogueTransitioning = false;
  private tutorialRun = false;
  private tutorialDialogueStage: 'intro' | 'outro' = 'intro';
  private tutorialGuide?: Phaser.GameObjects.Container;
  private tutorialGuideTimer = 0;
  private floorScrollContent?: Phaser.GameObjects.Container;
  private floorScrollRegions: Array<{ region: UiActionRegion; baseY: number }> = [];
  private floorScrollOffset = 0;
  private floorScrollMin = 0;
  private floorScrollMax = 0;
  private floorScrollPointer?: number;
  private floorScrollStartY = 0;
  private floorScrollStartOffset = 0;
  private floorScrollMoved = false;
  private readonly floorScrollViewport = { top: 174, bottom: 628 };
  private dailyRankingRows?: Phaser.GameObjects.Container;
  private dailyRankingEntries: DailyBoardEntry[] = [];
  private dailyRankingVisibleCount = 0;
  private dailyRankingOffset = 0;
  private dailyRankingMaxOffset = 0;
  private dailyRankingScrollThumb?: Phaser.GameObjects.Rectangle;
  private dailyRankingPointer?: number;
  private dailyRankingStartY = 0;
  private dailyRankingStartOffset = 0;
  private dailyRankingMoved = false;
  private dailyRankingViewport = { left: 0, right: 0, top: 0, bottom: 0 };
  private screenShakeEnabled = true;
  private damageNumbersEnabled = true;
  private buildaSafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
  private buildaCapsuleRect = { top: 0, right: 0, width: 0, height: 0 };
  private joystickPointer?: number;
  private joystickOrigin = { x: 104, y: 585 };
  private joystickVector = { x: 0, y: 0 };
  private keys!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };
  private hud = {
    panel: undefined as Phaser.GameObjects.Container | undefined,
    wavePanel: undefined as Phaser.GameObjects.Container | undefined,
    resourcePanel: undefined as Phaser.GameObjects.Container | undefined,
    wave: undefined as Phaser.GameObjects.Text | undefined,
    timer: undefined as Phaser.GameObjects.Text | undefined,
    waveCleared: undefined as Phaser.GameObjects.Text | undefined,
    hp: undefined as Phaser.GameObjects.Text | undefined,
    san: undefined as Phaser.GameObjects.Text | undefined,
    xp: undefined as Phaser.GameObjects.Text | undefined,
    weapon: undefined as Phaser.GameObjects.Text | undefined,
    kills: undefined as Phaser.GameObjects.Text | undefined,
    status: undefined as Phaser.GameObjects.Text | undefined,
    skill: undefined as Phaser.GameObjects.Text | undefined,
    skillIcon: undefined as Phaser.GameObjects.Image | undefined,
    hpLabel: undefined as Phaser.GameObjects.Text | undefined,
    xpLabel: undefined as Phaser.GameObjects.Text | undefined,
    sanLabel: undefined as Phaser.GameObjects.Text | undefined,
    weaponIcon: undefined as Phaser.GameObjects.Image | undefined,
    bar: undefined as Phaser.GameObjects.Graphics | undefined,
    sanBar: undefined as Phaser.GameObjects.Graphics | undefined,
    xpBar: undefined as Phaser.GameObjects.Graphics | undefined,
    sanOverlay: undefined as Phaser.GameObjects.Rectangle | undefined,
  };

  constructor() {
    super('hospital-battle');
    this.assetLoader = new PhaserAssetLoader(this);
  }

  preload() {
    this.createLoadingScreen();
    this.load.on('progress', (value: number) => {
      this.loadingProgress?.clear()
        .fillStyle(0x6bd3c1, 1)
        .fillRect(W / 2 - 210, H / 2 + 42, 420 * clamp(value, 0, 1), 8);
      this.loadingStatus?.setText(`正在加载病区资源  ${Math.round(value * 100)}%`);
      const progress = Math.round(clamp(value, 0, 1) * 100);
      document.getElementById('loading-progress-ring')?.style.setProperty('--progress', `${progress}%`);
      document.getElementById('loading-progress-fill')?.style.setProperty('width', `${progress}%`);
      const progressLabel = document.getElementById('loading-progress-value');
      if (progressLabel) progressLabel.textContent = `${progress}%`;
      const htmlStatus = document.getElementById('loading-status');
      if (htmlStatus) htmlStatus.textContent = `正在加载病区资源  ${progress}%`;
    });
    this.load.on('loaderror', (file: { key?: string }) => {
      const key = file.key || '未知资源';
      this.loadingStatus?.setText(`资源加载失败：${key}`.slice(0, 42)).setColor(palette.danger);
      const htmlStatus = document.getElementById('loading-status');
      if (htmlStatus) htmlStatus.textContent = `资源加载失败：${key}`.slice(0, 42);
      htmlStatus?.setAttribute('data-error', 'true');
    });
    this.load.once('complete', () => {
      this.loadingLayer?.destroy(true);
      this.loadingLayer = undefined;
      this.loadingProgress = undefined;
      this.loadingStatus = undefined;
    const loadingScreen = document.getElementById('loading-screen');
      loadingScreen?.setAttribute('aria-hidden', 'true');
      loadingScreen?.setAttribute('aria-busy', 'false');
      loadingScreen?.classList.add('hidden');
    });
    this.queueCoreAssets();
  }

  private queueCoreAssets() {
    const image = (key: string, path: string): PhaserAssetDefinition => ({ kind: 'image', key, url: assetUrl(path) });
    const sheet = (key: string, path: string, frameWidth: number, frameHeight: number): PhaserAssetDefinition => ({
      kind: 'spritesheet', key, url: assetUrl(path), frameWidth, frameHeight,
    });
    const core: PhaserAssetDefinition[] = [
      image('patient-boy', '/assets/art/patient-boy.png'),
      image('patient-idle-front', '/assets/art/animations/patient-idle-front.png'),
      ...(['left', 'right', 'up', 'down'] as PlayerDirection[]).map((direction) => sheet(`patient-walk-${direction}`, `/assets/art/animations/patient-walk-${direction}.png`, 192, 192)),
      sheet('patient-hit', '/assets/art/animations/patient-hit.png', 192, 192),
      sheet('patient-death', '/assets/art/animations/patient-death.png', 192, 192),
      image('menu-ward-night-v1', '/assets/art/menu-ward-night-v1.png'),
      image('menu-background-v1', '/assets/art/menu/menu-background-v1.png'),
      image('menu-title-v2', '/assets/art/menu/menu-title-v2.png'),
      image('menu-button-archive-v1', '/assets/art/menu/menu-button-archive-v1.png'),
      image('menu-button-mainline-v1', '/assets/art/menu/menu-button-mainline-v1.png'),
      image('menu-button-daily-v1', '/assets/art/menu/menu-button-daily-v1.png'),
      image('ward-day-v1', '/assets/art/ward-day-v1.png'),
      image('ward-night-v1', '/assets/art/ward-night-v1.png'),
      image('weapon-sword', '/assets/art/weapons/weapon-sword.png'),
      image('effect-sword-neon-v1', '/assets/art/weapons/effect-sword-neon-v1.png'),
      image('xp-drop-cthulhu-v1', '/assets/art/pickups/xp-drop-cthulhu-v1.png'),
      image('hud-status-frame-v2', '/assets/art/ui/hud-status-frame-v2.png'),
    ];
    core.forEach((definition) => {
      if (definition.kind === 'image') this.load.image(definition.key, definition.url);
      else this.load.spritesheet(definition.key, definition.url, { frameWidth: definition.frameWidth, frameHeight: definition.frameHeight });
    });
  }

  private delayedImage(key: string, path: string): PhaserAssetDefinition {
    return { kind: 'image', key, url: assetUrl(path) };
  }

  private delayedSheet(key: string, path: string, frameWidth: number, frameHeight: number): PhaserAssetDefinition {
    return { kind: 'spritesheet', key, url: assetUrl(path), frameWidth, frameHeight };
  }

  private delayedAssetDefinitions(group: LazyAssetGroup): PhaserAssetDefinition[] {
    const definitions: PhaserAssetDefinition[] = [];
    const image = (key: string, path: string) => definitions.push(this.delayedImage(key, path));
    const sheet = (key: string, path: string, frameWidth: number, frameHeight: number) => definitions.push(this.delayedSheet(key, path, frameWidth, frameHeight));
    const uiText = (names: readonly string[]) => names.forEach((name) => image(`ui-text-${name}-v1`, `/assets/art/ui/text/ui-text-${name}-v1.png`));

    if (group === 'profile') {
      [
        ['profile-hospital-photo-v1', '/assets/art/profile-hospital-photo-v1.png'],
        ['profile-case-sheet-v1', '/assets/art/profile-case-sheet-v1.png'],
        ['profile-case-sheet-v2', '/assets/art/profile-case-sheet-v2.png'],
        ['profile-barcode-v1', '/assets/art/profile-barcode-v1.png'],
        ['profile-skin-background-v1', '/assets/art/profile-skin-background-v1.png'],
        ['profile-skin-panel-frame-v1', '/assets/art/profile-skin-panel-frame-v1.png'],
        ['profile-evidence-corridor-v1', '/assets/art/profile-evidence-corridor-v1.png'],
        ['ad-reward-v1', '/assets/art/ui/ad-reward-v1.png'],
        ['back-icon-v1', '/assets/art/ui/back-icon-v1.png'],
        ['profile-arrow-left-v1', '/assets/art/ui/profile-arrow-left-v1.png'],
        ['profile-arrow-right-v1', '/assets/art/ui/profile-arrow-right-v1.png'],
        ['ui-text-profile-tabs-v1', '/assets/art/ui/text/ui-text-profile-tabs-v1.png'],
      ].forEach(([key, path]) => image(key, path));
      sheet('profile-skin-frame-v1', '/assets/art/profile-skin-frame-v1.png', 512, 1024);
      PLAYER_SKIN_ART_IMAGES.forEach(({ key, path }) => image(key, path));
      PLAYER_SKIN_ART_SHEETS.forEach(({ key, path, frameWidth, frameHeight }) => sheet(key, path, frameWidth, frameHeight));
      this.skins.filter((skin) => skin.assetPrefix).forEach((skin) => {
        const root = `/assets/art/skins/${skin.assetPrefix}`;
        image(this.skinFrontTextureKey(skin), `${root}/front.png`);
        (['left', 'right', 'up', 'down'] as PlayerDirection[]).forEach((direction) => {
          sheet(this.skinWalkTextureKey(skin, direction), `${root}/walk-${direction}.png`, 192, 192);
        });
        if (skin.coverPath) image(this.skinCoverTextureKey(skin), skin.coverPath);
      });
    }

    if (group === 'mainline') {
      [
        ['mainline-background-v1', '/assets/art/mainline-background-v1.png'],
        ['mainline-building-v1', '/assets/art/mainline-building-v1.png'],
        ['mainline-building-v2', '/assets/art/mainline-building-v2.png'],
        ['mainline-building-v3', '/assets/art/mainline-building-v3.png'],
        ['mainline-floor-select-background-v1', '/assets/art/mainline-floor-select-background-v1.png'],
        ['mainline-floor-locked-v1', '/assets/art/mainline-floor-locked-v1.png'],
        ['mainline-floor-locked-selected-v1', '/assets/art/mainline-floor-locked-selected-v1.png'],
        ['mainline-floor-unlocked-v1', '/assets/art/mainline-floor-unlocked-v1.png'],
        ['mainline-floor-selected-v1', '/assets/art/mainline-floor-selected-v1.png'],
        ['mainline-building-floor-shell-v1', '/assets/art/mainline-building-floor-shell-v1.png'],
        ['mainline-floor-enemy-frame-v1', '/assets/art/mainline-floor-enemy-frame-v1.png'],
      ].forEach(([key, path]) => image(key, path));
      uiText(['mainline', 'status-waiting', 'boss-name', 'start-challenge']);
      SMALL_ENEMY_ART_SHEETS.forEach(({ key, path, frameWidth, frameHeight }) => sheet(key, path, frameWidth, frameHeight));
      MAINLINE_BOSS_ART_IMAGES.forEach(({ key, path }) => image(key, path));
    }

    if (group === 'daily') {
      [
        ['daily-challenge-background-v1', '/assets/art/daily-challenge-background-v1.png'],
        ['daily-challenge-background-v2', '/assets/art/daily/daily-background-v2.png'],
        ['daily-ranking-frame-v1', '/assets/art/daily/daily-ranking-frame-v1.png'],
        ['daily-panel-frame-v1', '/assets/art/daily/daily-panel-frame-v1.png'],
        ['daily-start-button-v1', '/assets/art/daily/daily-start-button-v1.png'],
        ['daily-ad-icon-v1', '/assets/art/ui/daily-ad-icon-v1.png'],
        ['daily-ad-icon-monthly-v1', '/assets/art/ui/daily-ad-icon-monthly-v1.png'],
      ].forEach(([key, path]) => image(key, path));
      (['first', 'second', 'third'] as const).forEach((rank) => image(`daily-rank-${rank}-v1`, `/assets/art/daily/daily-rank-${rank}-v1.png`));
      uiText(['daily', 'boss-month', 'ranking', 'boss-drop', 'start-challenge']);
      MOON_MOTH_QUEEN_ART_IMAGES.forEach(({ key, path }) => image(key, path));
      MOON_MOTH_QUEEN_ART_SHEETS.forEach(({ key, path, frameWidth, frameHeight }) => sheet(key, path, frameWidth, frameHeight));
      // Relic assets are staged as WebP in the web bundle. Keep the runtime
      // paths aligned with the staged files so Daily Challenge does not
      // report missing relic-crown/relic-hood textures.
      (['relic-crown', 'relic-fang', 'relic-hood'] as const).forEach((relic) => image(relic, `/assets/art/${relic}.png`));
    }

    if (group === 'weapon') {
      [
        ['weapon-select-background-v1', '/assets/art/weapon-select/weapon-select-background-v1.png'],
        ['weapon-select-frame-skin-panel-v1', '/assets/art/weapon-select/weapon-select-frame-skin-panel-v1.png'],
        ['ad-reward-v1', '/assets/art/ui/ad-reward-v1.png'],
        // Weapon skin pagination uses the same mirrored arrow pair as the
        // profile archive. Load them with this group so page two never falls
        // back to Phaser's green missing-texture marker.
        ['profile-arrow-left-v1', '/assets/art/ui/profile-arrow-left-v1.png'],
        ['profile-arrow-right-v1', '/assets/art/ui/profile-arrow-right-v1.png'],
      ].forEach(([key, path]) => image(key, path));
      (['category', 'main', 'detail', 'skin-card', 'action-buy', 'action-equip', 'back'] as const).forEach((frame) => image(`weapon-select-frame-${frame}-v1`, `/assets/art/weapon-select/weapon-select-frame-${frame}-v1.png`));
      (['melee', 'ranged', 'magic', 'heavy'] as const).forEach((category) => image(`weapon-category-${category}`, `/assets/art/weapon-select/icons/weapon-category-${category}.png`));
      (['sword', 'gun', 'whip', 'cannon'] as const).forEach((weaponClass) => image(`weapon-${weaponClass}`, `/assets/art/weapons/weapon-${weaponClass}.png`));
      this.weaponSkins.filter((skin) => skin.assetPath).forEach((skin) => image(skin.textureKey, skin.assetPath!));
    }

    if (group === 'battle') {
      image('ward-night-deep-v1', '/assets/art/ward-night-deep-v1.png');
      MAINLINE_BOSS_ART_SHEETS.forEach(({ key, path, frameWidth, frameHeight }) => sheet(key, path, frameWidth, frameHeight));
      SMALL_ENEMY_ART_SHEETS.forEach(({ key, path, frameWidth, frameHeight }) => sheet(key, path, frameWidth, frameHeight));
      SMALL_ENEMY_ATTACK_ARTS.forEach(({ key, path }) => image(key, path));
      this.weaponSkins.filter((skin) => skin.assetPath).forEach((skin) => image(skin.textureKey, skin.assetPath!));
      const showcaseSkin = this.skins.find((skin) => skin.id === TUTORIAL_SHOWCASE_SKIN_ID);
      if (showcaseSkin?.assetPrefix) {
        const root = `/assets/art/skins/${showcaseSkin.assetPrefix}`;
        image(this.skinFrontTextureKey(showcaseSkin), `${root}/front.png`);
        (['left', 'right', 'up', 'down'] as PlayerDirection[]).forEach((direction) => {
          sheet(this.skinWalkTextureKey(showcaseSkin, direction), `${root}/walk-${direction}.png`, 192, 192);
        });
      }
      (['gun', 'whip', 'cannon'] as const).forEach((weaponClass) => image(`weapon-${weaponClass}`, `/assets/art/weapons/weapon-${weaponClass}.png`));
      image('effect-sword-neon-v1', '/assets/art/weapons/effect-sword-neon-v1.png');
      image('effect-gun-neon-v1', '/assets/art/weapons/effect-gun-neon-v1.png');
      image('effect-cannon-neon-v1', '/assets/art/weapons/effect-cannon-neon-v1.png');
      image('effect-whip-neon-v1', '/assets/art/weapons/effect-whip-neon-v1.png');
      image('ui-text-result-fail-v1', '/assets/art/ui/text/ui-text-result-fail-v1.png');
      UPGRADE_ICON_KINDS.forEach((kind) => image(`upgrade-icon-${kind}`, `/assets/art/cards/icons/upgrade-icon-${kind}.png`));
      image('upgrade-card-blue-v1', '/assets/art/cards/upgrade-card-blue-v1.png');
      image('upgrade-card-purple-v1', '/assets/art/cards/upgrade-card-purple-v1.png');
      image('upgrade-card-gold-v1', '/assets/art/cards/upgrade-card-gold-v1.png');
      image('xp-drop-cthulhu-v1', '/assets/art/pickups/xp-drop-cthulhu-v1.png');
      image('hud-status-frame-v2', '/assets/art/ui/hud-status-frame-v2.png');
      // The upgrade overlay is shown from the battle group. Keep its raster
      // frame in the same lazy-load group so the vector fallback is rarely used.
      image('profile-skin-panel-frame-v1', '/assets/art/profile-skin-panel-frame-v1.png');
    }
    return definitions;
  }

  private setLoadingScreenVisible(visible: boolean, status = '') {
    const screen = document.getElementById('loading-screen');
    if (!screen) return;
    screen.classList.toggle('hidden', !visible);
    screen.setAttribute('aria-hidden', visible ? 'false' : 'true');
    screen.setAttribute('aria-busy', visible ? 'true' : 'false');
    screen.removeAttribute('data-error');
    const statusNode = document.getElementById('loading-status');
    if (statusNode && status) statusNode.textContent = status;
    const retry = document.getElementById('loading-retry') as HTMLButtonElement | null;
    if (retry) retry.hidden = true;
  }

  private showAssetLoadError(group: LazyAssetGroup, result: PhaserAssetLoadResult, retry: () => void) {
    const message = result.failedKeys.length > 0
      ? `资源加载失败：${result.failedKeys.slice(0, 2).join('、')}`
      : `资源加载失败：${group}`;
    const screen = document.getElementById('loading-screen');
    screen?.setAttribute('data-error', 'true');
    const statusNode = document.getElementById('loading-status');
    if (statusNode) statusNode.textContent = `${message}，点击重试`;
    const retryButton = document.getElementById('loading-retry') as HTMLButtonElement | null;
    if (retryButton) {
      retryButton.hidden = false;
      retryButton.onclick = () => {
        retryButton.hidden = true;
        retry();
      };
    }
    this.lazyAssetRetry = retry;
    this.lazyAssetError = message;
  }

  private ensureAssetGroup(group: LazyAssetGroup, onReady: () => void) {
    if (this.assetLoader.has(group)) return true;
    this.setLoadingScreenVisible(true, `正在加载${group}资源  0%`);
    void this.assetLoader.ensure(group, this.delayedAssetDefinitions(group), (progress) => {
      const value = Math.round(clamp(progress, 0, 1) * 100);
      const statusNode = document.getElementById('loading-status');
      if (statusNode) statusNode.textContent = `正在加载${group}资源  ${value}%`;
      document.getElementById('loading-progress-ring')?.style.setProperty('--progress', `${value}%`);
      const progressLabel = document.getElementById('loading-progress-value');
      if (progressLabel) progressLabel.textContent = `${value}%`;
    }).then((result) => {
      if (!result.ok) {
        this.showAssetLoadError(group, result, () => { void this.ensureAssetGroup(group, onReady); });
        return;
      }
      this.lazyAssetError = undefined;
      this.lazyAssetRetry = undefined;
      this.setLoadingScreenVisible(false);
      if (group === 'profile' || group === 'mainline' || group === 'daily' || group === 'weapon' || group === 'battle') {
        this.createPlayerAnimations();
        this.createEnemyAnimations();
      }
      onReady();
    });
    return false;
  }

  private createLoadingScreen() {
    const layer = this.add.container(0, 0).setDepth(1000).setScrollFactor(0);
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, palette.bg, 1);
    const frame = this.add.rectangle(W / 2, H / 2, 660, 250, 0x071117, 0.98)
      .setStrokeStyle(1, 0x6bd3c1, 0.68);
    const title = this.add.text(W / 2, H / 2 - 58, '正在进入病区...', {
      fontFamily: UI_FONT_STACK,
      fontSize: '28px',
      color: palette.cream,
      stroke: '#071015',
      strokeThickness: 3,
    }).setOrigin(0.5).setFontStyle('bold');
    const status = this.add.text(W / 2, H / 2 - 10, '正在加载病区资源  0%', {
      fontFamily: UI_FONT_STACK,
      fontSize: '13px',
      color: palette.muted,
    }).setOrigin(0.5);
    const track = this.add.graphics().fillStyle(0x26383f, 1).fillRect(W / 2 - 210, H / 2 + 42, 420, 8);
    const progress = this.add.graphics();
    layer.add([backdrop, frame, title, status, track, progress]);
    this.loadingLayer = layer;
    this.loadingProgress = progress;
    this.loadingStatus = status;
  }

  create() {
    this.cameras.main.setBackgroundColor(palette.bg);
    this.loadProgress();
    this.createPlayerAnimations();
    this.createEnemyAnimations();
    this.applySkinTextureFilters();
    this.floor = this.progress.tutorialCompleted ? clamp(this.progress.maxFloor, 1, TOTAL_FLOORS) : 0;
    this.weapons = this.createWeaponRoster();
    this.configureDeveloperMode();
    this.requestLandscapeLock();
    this.world = this.add.container(0, 0);
    this.ui = this.add.container(0, 0).setDepth(100).setScrollFactor(0, 0, true);
    this.buildArena();
    this.buildHud();
    this.keys = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.input.keyboard!.on('keydown-ENTER', () => { if (this.phase === 'start') this.showMainline(this.floor); });
    this.input.keyboard!.on('keydown-SPACE', () => { if (this.phase === 'start') this.showMainline(this.floor); });
    this.input.keyboard!.on('keydown-F8', () => window.__BOSS_PREVIEW__?.());
    this.input.keyboard!.on('keydown', () => audio.unlock());
    this.input.on('pointerdown', () => audio.unlock());
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);
    this.canvasUiPointerDownHandler = (event: PointerEvent) => this.handleUiPointerDown(event);
    this.canvasUiPointerMoveHandler = (event: PointerEvent) => this.handleUiPointerMove(event);
    this.canvasUiPointerUpHandler = (event: PointerEvent) => this.handleUiPointerUp(event);
    this.canvasUiWheelHandler = (event: WheelEvent) => this.handleUiWheel(event);
    this.canvasPointerCancelHandler = (event: PointerEvent) => {
      event.preventDefault();
      this.releaseJoystick();
      this.releaseUiPointer();
      this.releaseFloorScroll();
    };
    this.game.canvas.addEventListener('pointerdown', this.canvasUiPointerDownHandler, true);
    this.game.canvas.addEventListener('pointermove', this.canvasUiPointerMoveHandler, true);
    this.game.canvas.addEventListener('pointerup', this.canvasUiPointerUpHandler, true);
    this.game.canvas.addEventListener('wheel', this.canvasUiWheelHandler, { passive: false });
    this.game.canvas.addEventListener('pointercancel', this.canvasPointerCancelHandler);
    this.game.canvas.addEventListener('lostpointercapture', this.canvasPointerCancelHandler);
    this.refreshBuildaLayout();
    // Read the host safe area before laying out the first screen. Builda may
    // resolve it asynchronously as well, so notifyBuildaReady refreshes it again.
    this.showStart();
    void this.hydrateProgress();
    void this.ensurePlayerIdentity();
    void this.notifyBuildaReady();
    window.__GAME_TEST_API__ = {
      ...(window.__GAME_TEST_API__ ?? {}),
      snapshot: () => ({
        phase: this.phase,
        floor: this.floor,
        totalFloors: TOTAL_FLOORS,
        wavesPerFloor: this.wavesPerFloor(),
        wave: this.wave,
        waveBreakTimer: this.waveBreakTimer,
        waveSpawned: this.waveSpawned,
         waveBudget: this.spawnBudgetForWave(),
         spawningStopped: waveSpawningComplete(this.waveTimer, this.waveLength, this.waveSpawned, this.spawnBudgetForWave()),
        // hp remains as a compatibility alias for older harness clients; SAN is the only survival value.
        hp: this.san,
        san: this.san,
        shield: this.shield,
        maxShield: this.maxShield,
        mutated: this.mutated,
        playerRadius: this.playerRadius,
        dailyAttemptsUsed: this.dailyAttemptsUsed(),
        dailyFreeAttemptsRemaining: Math.max(0, 3 - this.dailyAttemptsUsed()),
        waveCleanupComplete: this.waveCleanupComplete,
        upgradeRefreshCount: this.upgradeRefreshCount,
        upgradePaymentPending: this.upgradePaymentPending,
        dailySynergies: {
          status: this.dailyStatusSynergy,
          shieldRetaliation: this.dailyShieldRetaliation,
          magnet: this.dailyMagnetSynergy,
          voidPulse: this.dailyVoidPulse,
          echoShots: this.dailyEchoShots,
          bloodPact: this.dailyBloodPact,
          killNova: this.dailyKillNova,
          slowField: this.dailySlowField,
        },
        attackStatus: this.activeAttackStatus,
        attackStatusGrowth: {
          level: this.attackStatusLevel,
          damage: this.attackStatusDamage,
          duration: this.attackStatusDuration,
          spreadTargets: this.attackStatusSpreadTargets,
          spreadRadius: this.attackStatusSpreadRadius,
        },
        playerAnimation: this.playerAnimation,
        playerDeathPending: this.playerDeathPending,
        level: this.level,
        kills: this.kills,
        drops: this.drops.length,
        enemies: this.enemies.filter((enemy) => !enemy.dead).map((enemy) => ({ kind: enemy.kind, hp: enemy.hp, maxHp: enemy.maxHp })),
        weapon: this.currentWeapon() ? { id: this.currentWeapon()!.id, name: this.currentWeapon()!.name, type: this.currentWeapon()!.type, ammo: this.currentWeapon()!.ammo, copies: this.currentWeapon()!.copies, level: this.currentWeapon()!.level, damage: this.currentWeaponDamage(this.currentWeapon()!), skinId: this.equippedWeaponSkin(this.currentWeapon()!.weaponClass).id, rotationsPerSecond: rotationsPerSecond(this.currentRotationSpeed(this.currentWeapon()!)) } : undefined,
      }),
      bossPreview: () => window.__BOSS_PREVIEW__?.(),
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.canvasUiPointerDownHandler) this.game.canvas.removeEventListener('pointerdown', this.canvasUiPointerDownHandler, true);
      if (this.canvasUiPointerMoveHandler) this.game.canvas.removeEventListener('pointermove', this.canvasUiPointerMoveHandler, true);
      if (this.canvasUiPointerUpHandler) this.game.canvas.removeEventListener('pointerup', this.canvasUiPointerUpHandler, true);
      if (this.canvasUiWheelHandler) this.game.canvas.removeEventListener('wheel', this.canvasUiWheelHandler);
      if (this.canvasPointerCancelHandler) {
        this.game.canvas.removeEventListener('pointercancel', this.canvasPointerCancelHandler);
        this.game.canvas.removeEventListener('lostpointercapture', this.canvasPointerCancelHandler);
      }
      this.releaseJoystick();
      this.clearRunObjects();
    });
  }

  private createPlayerAnimations() {
    const definitions: Array<{ key: string; end: number; frameRate: number; repeat: number }> = [
      ...(['left', 'right', 'up', 'down'] as PlayerDirection[]).map((direction) => ({ key: `patient-walk-${direction}`, end: 3, frameRate: 9, repeat: -1 })),
      { key: 'patient-hit', end: 2, frameRate: 12, repeat: 0 },
      { key: 'patient-death', end: 4, frameRate: 8, repeat: 0 },
    ];
    this.skins.filter((skin) => skin.assetPrefix || skin.artId).forEach((skin) => {
      (['left', 'right', 'up', 'down'] as PlayerDirection[]).forEach((direction) => {
        definitions.push({ key: this.skinWalkAnimationKey(skin, direction), end: 3, frameRate: 9, repeat: -1 });
      });
    });
    PLAYER_SKIN_ART_SHEETS.forEach(({ key }) => {
      definitions.push({ key, end: 3, frameRate: 9, repeat: -1 });
    });
    definitions.forEach(({ key, end, frameRate, repeat }) => {
      if (!this.anims.exists(key) && this.textures.exists(key)) {
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(key, { start: 0, end }),
          frameRate,
          repeat,
        });
      }
    });
  }

  private skinArtSpec(skin: SkinDef) {
    return skin.artId ? playerSkinArtForId(skin.artId) : undefined;
  }

  private skinFrontTextureKey(skin: SkinDef) {
    const art = this.skinArtSpec(skin);
    if (art) return art.portraitKey;
    return skin.assetPrefix ? `skin-${skin.id}-front` : 'patient-idle-front';
  }

  private skinCoverTextureKey(skin: SkinDef) {
    return skin.coverPath ? `skin-${skin.id}-cover` : this.skinFrontTextureKey(skin);
  }

  private skinWalkTextureKey(skin: SkinDef, direction: PlayerDirection) {
    const art = this.skinArtSpec(skin);
    if (art) return art.walkKeys[direction];
    return skin.assetPrefix ? `skin-${skin.id}-walk-${direction}` : `patient-walk-${direction}`;
  }

  private skinWalkAnimationKey(skin: SkinDef, direction: PlayerDirection) {
    return this.skinWalkTextureKey(skin, direction);
  }

  private skinHasCustomArt(skin: SkinDef) {
    const art = this.skinArtSpec(skin);
    if (art) return this.textures.exists(art.portraitKey);
    return Boolean(skin.assetPrefix && this.textures.exists(this.skinFrontTextureKey(skin)));
  }

  private createEnemyAnimations() {
    SMALL_ENEMY_ART_SHEETS.forEach(({ key }) => {
      if (!this.anims.exists(key) && this.textures.exists(key)) {
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
          frameRate: SMALL_ENEMY_ART_FRAME_RATE,
          repeat: -1,
        });
      }
    });
    MAINLINE_BOSS_ART_VARIANT_LIST.forEach((variant) => {
      if (!this.anims.exists(variant.walkKey) && this.textures.exists(variant.walkKey)) {
        this.anims.create({
          key: variant.walkKey,
          frames: this.anims.generateFrameNumbers(variant.walkKey, { start: 0, end: 3 }),
          frameRate: variant.walkFrameRate,
          repeat: -1,
        });
      }
      if (!this.anims.exists(variant.attackKey) && this.textures.exists(variant.attackKey)) {
        this.anims.create({
          key: variant.attackKey,
          frames: this.anims.generateFrameNumbers(variant.attackKey, { start: 0, end: 3 }),
          frameRate: variant.attackFrameRate,
          repeat: 0,
        });
      }
    });
    if (!this.anims.exists(MOON_MOTH_QUEEN_ART.walkKey) && this.textures.exists(MOON_MOTH_QUEEN_ART.walkKey)) {
      this.anims.create({
        key: MOON_MOTH_QUEEN_ART.walkKey,
        frames: this.anims.generateFrameNumbers(MOON_MOTH_QUEEN_ART.walkKey, { start: 0, end: 3 }),
        frameRate: MOON_MOTH_QUEEN_WALK_FRAME_RATE,
        repeat: -1,
      });
    }
    if (!this.anims.exists(MOON_MOTH_QUEEN_ART.attackKey) && this.textures.exists(MOON_MOTH_QUEEN_ART.attackKey)) {
      this.anims.create({
        key: MOON_MOTH_QUEEN_ART.attackKey,
        frames: this.anims.generateFrameNumbers(MOON_MOTH_QUEEN_ART.attackKey, { start: 0, end: 3 }),
        frameRate: MOON_MOTH_QUEEN_ATTACK_FRAME_RATE,
        repeat: 0,
      });
    }
    if (!this.anims.exists('moon-moth-queen-transform') && MOON_MOTH_QUEEN_ART.transformKeys.every((key) => this.textures.exists(key))) {
      this.anims.create({
        key: 'moon-moth-queen-transform',
        frames: MOON_MOTH_QUEEN_ART.transformKeys.map((key) => ({ key, frame: 0 })),
        frameRate: MOON_MOTH_QUEEN_TRANSFORM_FRAME_RATE,
        repeat: 0,
      });
    }
  }

  private pickSmallEnemyArt(kind: SmallEnemyKind) {
    return Phaser.Utils.Array.GetRandom([...SMALL_ENEMY_ART_VARIANTS[kind]]);
  }

  private createSmallEnemyBody(kind: SmallEnemyKind, radius: number, color: number) {
    const artKey = this.pickSmallEnemyArt(kind);
    const sheet = SMALL_ENEMY_ART_SHEET_BY_KEY.get(artKey);
    if (!sheet || !this.textures.exists(artKey) || !this.anims.exists(artKey)) {
      const g = this.add.graphics();
      g.fillStyle(0x000000, .25);
      g.fillEllipse(0, radius * .75, radius * 2.5, radius * .48);
      g.fillStyle(color, .96);
      if (kind === 'chaser') g.fillRect(-radius, -radius, radius * 2, radius * 2);
      else if (kind === 'shooter') g.fillCircle(0, 0, radius);
      else if (kind === 'disruptor') g.fillTriangle(-radius, radius * .6, 0, -radius, radius, radius * .6);
      else if (kind === 'tentacle') g.fillEllipse(0, 0, radius * 2.2, radius * 1.5);
      else if (kind === 'bomber') { g.fillCircle(0, 0, radius * 1.05); g.fillCircle(-radius * .45, radius * .2, radius * .34); g.fillCircle(radius * .45, radius * .2, radius * .34); }
      else g.fillEllipse(0, 0, radius * 1.8, radius * 1.8);
      const visualHeight = this.enemyVisualHeight;
      return { body: this.add.container(0, 0, [g]), visualWidth: Math.round(visualHeight * .78), visualHeight };
    }

    const visualHeight = this.enemyVisualHeight;
    const visualWidth = Math.round(visualHeight * sheet.frameWidth / sheet.frameHeight);
    const body = this.add.container(0, 0);
    body.add(this.add.ellipse(0, visualHeight * .35, Math.max(24, visualWidth * .76), Math.max(10, visualHeight * .08), 0x000000, .28));
    const sprite = this.add.sprite(0, 0, artKey).setOrigin(.5).setDisplaySize(visualWidth, visualHeight);
    sprite.anims.play(artKey, true);
    body.add(sprite);
    return { body, visualWidth, visualHeight };
  }

  private createMiniBossBody(variantId: MainlineBossVariantId, radius: number, color: number) {
    const variant = MAINLINE_BOSS_ART_VARIANT_BY_ID[variantId];
    const bossVisualScale = 0.26;
    const visualHeight = Math.round(this.playerVisualHeight() * 2 * bossVisualScale);
    const visualWidth = Math.round(visualHeight * variant.walkFrameWidth / variant.walkFrameHeight);
    const body = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, visualHeight * 0.36, visualWidth * 0.54, Math.max(14, visualHeight * 0.08), 0x000000, 0.28);
    const aura = this.add.ellipse(0, -visualHeight * 0.02, visualWidth * 0.72, visualHeight * 0.68, color, 0.1).setStrokeStyle(2, color, 0.32);
    const walk = this.add.sprite(0, 0, variant.walkKey).setOrigin(0.5).setDisplaySize(visualWidth, visualHeight);
    const attack = this.add.sprite(0, 0, variant.attackKey).setOrigin(0.5).setDisplaySize(visualWidth, visualHeight);
    const death = this.add.image(0, 0, variant.deathKey).setOrigin(0.5).setDisplaySize(visualWidth, visualHeight);
    if (this.anims.exists(variant.walkKey)) walk.anims.play(variant.walkKey, true);
    attack.setVisible(false);
    death.setVisible(false);
    body.add([shadow, aura, walk, attack, death]);
    return {
      body,
      visualWidth,
      visualHeight,
      miniBossVisual: {
        artId: variant.id,
        state: 'walk' as MiniBossVisualState,
        shadow,
        walkKey: variant.walkKey,
        attackKey: variant.attackKey,
        deathKey: variant.deathKey,
        walk,
        attack,
        death,
        aura,
      },
    };
  }

  private createMoonMothQueenBody(radius: number, color: number) {
    const bossVisualScale = 0.26;
    const visualHeight = Math.round(this.playerVisualHeight() * 2 * bossVisualScale);
    const visualWidth = Math.round(visualHeight * 0.66);
    const body = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, visualHeight * 0.36, visualWidth * 0.54, Math.max(14, visualHeight * 0.08), 0x000000, 0.28);
    const aura = this.add.ellipse(0, -visualHeight * 0.02, visualWidth * 0.74, visualHeight * 0.72, color, 0.12).setStrokeStyle(2, color, 0.45);
    const transform = this.add.sprite(0, 0, MOON_MOTH_QUEEN_ART.transformKeys[0]).setOrigin(0.5).setDisplaySize(visualWidth, visualHeight);
    const walk = this.add.sprite(0, 0, MOON_MOTH_QUEEN_ART.walkKey).setOrigin(0.5).setDisplaySize(visualWidth, visualHeight);
    const attack = this.add.sprite(0, 0, MOON_MOTH_QUEEN_ART.attackKey).setOrigin(0.5).setDisplaySize(visualWidth, visualHeight);
    const portrait = this.add.image(0, 0, MOON_MOTH_QUEEN_ART.portraitKey).setOrigin(0.5).setDisplaySize(visualWidth, visualHeight);
    const death = this.add.image(0, 0, MOON_MOTH_QUEEN_ART.deathKey).setOrigin(0.5).setDisplaySize(visualWidth, visualHeight);
    [walk, attack, portrait, death].forEach((spriteNode) => spriteNode.setVisible(false));
    body.add([shadow, aura, transform, walk, attack, portrait, death]);
    return {
      body,
      visualWidth,
      visualHeight,
      bossVisual: {
        artId: 'moon-moth-queen',
        introText: '月蚀蝶后苏醒',
        deathText: '月蚀蝶后坠落',
        introDuration: 2.6,
        state: 'transform' as BossVisualState,
        stateTimer: 2.6,
        introComplete: false,
        shadow,
        walkKey: MOON_MOTH_QUEEN_ART.walkKey,
        attackKey: MOON_MOTH_QUEEN_ART.attackKey,
        transformKey: 'moon-moth-queen-transform',
        transform,
        walk,
        attack,
        portrait,
        death,
        aura,
      },
    };
  }

  private setBossVisualState(enemy: Enemy, state: BossVisualState) {
    const boss = enemy.bossVisual;
    if (!boss) return;
    if (boss.state === state && state !== 'transform') return;
    boss.state = state;
    boss.transform?.setVisible(state === 'transform');
    boss.walk.setVisible(state === 'walk');
    boss.attack.setVisible(state === 'attack');
    boss.portrait.setVisible(state === 'death');
    boss.death.setVisible(state === 'death');
    boss.aura.setVisible(state !== 'death');
    boss.shadow.setVisible(true);
    if (state === 'transform') {
      if (boss.transform && boss.transformKey && this.anims.exists(boss.transformKey)) {
        boss.transform.anims.play(boss.transformKey, true);
      } else {
        boss.portrait.setVisible(true);
      }
    }
    if (state === 'walk' && this.anims.exists(boss.walkKey)) {
      boss.walk.anims.play(boss.walkKey, true);
    }
    if (state === 'attack' && this.anims.exists(boss.attackKey)) {
      boss.attack.anims.play(boss.attackKey, true);
    }
  }

  private updateBossFacing(enemy: Enemy, movingRight: boolean) {
    const boss = enemy.bossVisual;
    if (!boss) return;
    const scaleX = movingRight ? -1 : 1;
    boss.shadow.setScale(Math.abs(scaleX), 1);
    boss.transform?.setScale(scaleX, 1);
    boss.walk.setScale(scaleX, 1);
    boss.attack.setScale(scaleX, 1);
    boss.portrait.setScale(scaleX, 1);
    boss.death.setScale(scaleX, 1);
  }

  private startBossEntrance(enemy: Enemy) {
    if (!enemy.bossVisual) return;
    audio.playBossEntrance();
    this.bossIntroActive = true;
    this.bossIntroElapsed = 0;
    this.phase = 'boss-intro';
    this.ui?.setVisible(true);
    enemy.bossVisual.stateTimer = enemy.bossVisual.introDuration;
    enemy.bossVisual.introComplete = false;
    enemy.node.setAlpha(1);
    enemy.node.setScale(1);
    enemy.node.setPosition(enemy.node.x, enemy.node.y);
    this.setBossVisualState(enemy, 'transform');
    this.updateBossFacing(enemy, false);
    this.cameras.main.flash(240, 182, 127, 198, false);
    this.tweens.add({ targets: enemy.bossVisual.aura, scale: { from: 0.74, to: 1.08 }, alpha: { from: 0.2, to: 0.6 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.floatText(enemy.node.x, enemy.node.y - enemy.visualHeight / 2 - 18, enemy.bossVisual.introText, palette.violet, 16, 22, 1000);
  }

  private updateBossIntro(dt: number) {
    const boss = this.enemies.find((enemy) => enemy.kind === 'boss' && !enemy.dead && enemy.bossVisual);
    if (!boss || !boss.bossVisual) {
      this.bossIntroActive = false;
      this.phase = 'battle';
      return;
    }
    const introDuration = Number.isFinite(boss.bossVisual.introDuration)
      ? Math.max(0.1, boss.bossVisual.introDuration)
      : 0.1;
    const stateTimer = Number.isFinite(boss.bossVisual.stateTimer) ? boss.bossVisual.stateTimer : 0;
    this.bossIntroElapsed += Math.max(0, dt);
    boss.bossVisual.stateTimer = Math.max(0, stateTimer - dt);
    const progress = 1 - clamp(boss.bossVisual.stateTimer / introDuration, 0, 1);
    boss.bossVisual.aura.setAlpha(0.15 + progress * 0.55);
    boss.bossVisual.aura.setScale(0.95 + progress * 0.18);
    if ((boss.bossVisual.stateTimer <= 0 || this.bossIntroElapsed >= introDuration + 0.35) && !boss.bossVisual.introComplete) {
      boss.bossVisual.introComplete = true;
      this.setBossVisualState(boss, 'walk');
      boss.bossVisual.walk.setAlpha(1);
      if (this.anims.exists(boss.bossVisual.walkKey)) boss.bossVisual.walk.anims.play(boss.bossVisual.walkKey, true);
      boss.bossVisual.transform?.anims.stop();
      boss.bossVisual.transform?.setVisible(false);
      this.bossIntroActive = false;
      this.bossIntroElapsed = 0;
      this.phase = 'battle';
      this.ui?.setVisible(true);
      this.floatText(boss.node.x, boss.node.y - boss.visualHeight / 2 - 8, boss.bossVisual.artId === 'moon-moth-queen' ? '变身完成' : '首领就位', palette.green, 14, 20, 800);
    }
  }

  private startBossDeath(enemy: Enemy) {
    if (!enemy.bossVisual) return;
    audio.playBossDeath();
    this.bossDeathActive = true;
    this.phase = 'boss-death';
    this.ui?.setVisible(true);
    enemy.dead = true;
    enemy.deathTimer = 3.4;
    this.projectiles.forEach((shot) => shot.node.destroy());
    this.projectiles = [];
    this.tweens.killTweensOf(enemy.bossVisual.aura);
    this.setBossVisualState(enemy, 'death');
    enemy.bossVisual.portrait.setVisible(true);
    enemy.bossVisual.death.setVisible(false);
    enemy.bossVisual.aura.setVisible(true);
    enemy.bossVisual.aura.setAlpha(0.2);
    enemy.bossVisual.aura.setScale(0.86);
    this.cameras.main.flash(180, 243, 214, 244, false);
    this.tweens.add({ targets: enemy.bossVisual.portrait, scale: { from: 0.94, to: 1.08 }, duration: 520, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
    this.time.delayedCall(760, () => {
      if (!enemy.bossVisual || !enemy.node.active) return;
      enemy.bossVisual.portrait.setVisible(false);
      enemy.bossVisual.death.setVisible(true);
      this.tweens.add({ targets: enemy.bossVisual.death, alpha: { from: 0, to: 1 }, duration: 220, yoyo: true, repeat: 1 });
    });
    this.time.delayedCall(1320, () => {
      if (!enemy.bossVisual || !enemy.node.active) return;
      this.tweens.add({ targets: enemy.bossVisual.aura, alpha: 0, scale: 1.18, duration: 760, ease: 'Sine.Out' });
    });
    this.floatText(enemy.node.x, enemy.node.y - enemy.visualHeight / 2 - 16, enemy.bossVisual.deathText, palette.amber, 16, 28, 1100);
  }

  private startBossPreviewShowcase() {
    this.bossPreviewActive = true;
    this.bossIntroActive = false;
    this.bossDeathActive = false;
    this.releaseJoystick();
    this.releaseUiPointer();
    this.releaseFloorScroll();
    this.clearOverlay();
    this.clearRunObjects();
    this.phase = 'battle';
    this.runMode = 'mainline';
    this.floor = 1;
    this.selectedWeaponId = 'knife';
    this.weapons = this.createWeaponRoster();
    this.weapons.forEach((weapon) => { weapon.owned = weapon.id === 'knife'; });
    this.createPlayer();
    this.cameras.main.setBounds(WORLD_BOUNDS.left, WORLD_BOUNDS.top, WORLD_BOUNDS.right - WORLD_BOUNDS.left, WORLD_BOUNDS.bottom - WORLD_BOUNDS.top);
    this.cameras.main.setZoom(this.gameplayCameraZoom);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.wave = this.wavesPerFloor();
    this.waveLength = this.durationForWave();
    this.waveTimer = this.waveLength;
    this.waveSpawned = this.spawnBudgetForWave();
    this.waveBossSpawned = true;
    this.spawnTimer = Number.POSITIVE_INFINITY;
    this.elapsed = 0;
    this.xp = 0;
    this.level = 1;
    this.xpNeed = experienceRequiredForLevel(this.level);
    this.updateHud();
    const stats = enemyCombatStats('boss', this.wave);
    const radius = stats.radius;
    const x = (WORLD_BOUNDS.left + WORLD_BOUNDS.right) / 2;
    const y = (WORLD_BOUNDS.top + WORLD_BOUNDS.bottom) / 2;
    const node = this.add.container(x, y).setDepth(7);
    const boss = this.createMoonMothQueenBody(radius, this.enemyColor('boss'));
    node.add(boss.body);
    this.world.add(node);
    const enemy: Enemy = {
      kind: 'boss',
      node,
      body: boss.body,
      baseHp: 999999,
      hpScale: 1,
      hp: 999999,
      maxHp: 999999,
      speed: stats.speed,
      damage: stats.damage,
      radius,
      visualWidth: boss.visualWidth,
      visualHeight: boss.visualHeight,
      facingRight: false,
      attackCd: 0.2,
      shootCd: 1.8,
      areaCd: 2.5,
      flash: 0,
      meleeHitCd: 0,
      deathTimer: 0,
      statusTimer: 0,
      statusTick: 0,
      bossVisual: boss.bossVisual,
    };
    (node as Phaser.GameObjects.Container & { hpBar?: Phaser.GameObjects.Graphics }).hpBar = this.add.graphics();
    this.enemies = [enemy];
    this.startBossEntrance(enemy);
    this.time.delayedCall(5200, () => {
      if (!this.bossPreviewActive) return;
      const previewBoss = this.enemies.find((candidate) => candidate.kind === 'boss' && candidate.bossVisual && !candidate.dead);
      if (previewBoss) this.startBossDeath(previewBoss);
    });
    this.time.delayedCall(9000, () => {
      if (!this.bossPreviewActive) return;
      this.bossPreviewActive = false;
      const previewBoss = this.enemies.find((candidate) => candidate.kind === 'boss' && candidate.bossVisual);
      previewBoss?.node.destroy();
      this.enemies = this.enemies.filter((candidate) => candidate !== previewBoss);
      this.bossDeathActive = false;
      this.showStart();
    });
  }

  private applySkinTextureFilters() {
    const textureKeys = new Set<string>([
      'patient-boy',
      'patient-idle-front',
      'patient-hit',
      'patient-death',
      ...(['left', 'right', 'up', 'down'] as PlayerDirection[]).flatMap((direction) => [`patient-walk-${direction}`]),
      ...PLAYER_SKIN_ART_IMAGES.map(({ key }) => key),
      ...PLAYER_SKIN_ART_SHEETS.map(({ key }) => key),
      ...this.skins.flatMap((skin) => skin.assetPrefix
        ? [
            this.skinFrontTextureKey(skin),
            ...(skin.coverPath ? [this.skinCoverTextureKey(skin)] : []),
            ...(['left', 'right', 'up', 'down'] as PlayerDirection[]).map((direction) => this.skinWalkTextureKey(skin, direction)),
          ]
        : []),
    ]);
    textureKeys.forEach((key) => {
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });
  }

  private updateBossDeath(dt: number) {
    const boss = this.enemies.find((enemy) => enemy.kind === 'boss' && enemy.dead && enemy.bossVisual);
    if (!boss || !boss.bossVisual) {
      this.bossDeathActive = false;
      this.phase = 'result';
      return;
    }
    boss.deathTimer = Math.max(0, boss.deathTimer - dt);
    const progress = 1 - clamp(boss.deathTimer / 3.4, 0, 1);
    boss.node.setAlpha(1);
    boss.bossVisual.aura.setAlpha(Math.max(0, 0.22 - progress * 0.22));
    boss.bossVisual.portrait.setAlpha(Math.max(0, 1 - progress * 1.1));
    boss.bossVisual.death.setAlpha(Math.min(1, progress * 1.4));
    boss.node.setScale(1 + progress * 0.02);
    if (boss.deathTimer <= 0) {
      if (this.bossPreviewActive) return;
      boss.node.destroy();
      this.enemies = this.enemies.filter((enemy) => enemy !== boss);
      this.bossDeathActive = false;
      this.showResult(true);
    }
  }

  private playerLabelY(extra = 0) {
    return this.player.y - this.playerVisualHeight() / 2 - extra;
  }

  private playerVisualHeight() {
    return this.playerSpriteTargetHeight * this.playerSpriteScale;
  }

  private smallEnemyDistance(value: number) {
    return Math.round(value * this.smallEnemyScale);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05) * this.gameSpeed;
    this.updateTutorialGuide(dt);
    if (this.phase === 'boss-intro') {
      // The entrance animation pauses attacks, but the player must still be
      // able to reposition with touch while the boss is revealed.
      this.elapsed += dt;
      this.updateBossIntro(dt);
      this.updatePlayer(dt);
      this.updateWeaponOrbit(dt);
      this.updateMutation(dt);
      this.updateHud();
      return;
    }
    if (this.phase === 'boss-death') {
      this.updateBossDeath(dt);
      this.updateHud();
      return;
    }
    if (this.phase === 'wave-break') {
      this.elapsed += dt;
      this.waveBreakTimer = Math.max(0, this.waveBreakTimer - dt);
      this.waveClearedTimer = Math.max(0, this.waveClearedTimer - dt);
      this.updatePlayer(dt);
      this.updateWeaponOrbit(dt);
      this.updateMutation(dt);
      if (this.waveBreakTimer <= 0) this.completeWaveBreak();
      this.updateHud();
      return;
    }
    if (this.phase === 'wave-cleanup') {
      this.elapsed += dt;
      this.waveClearedTimer = Math.max(0, this.waveClearedTimer - dt);
      this.updatePlayer(dt);
      this.updateWeaponOrbit(dt);
      this.updateEnemies(dt);
      this.updateDrops(dt, true);
      if (this.enemies.length === 0 && this.drops.length === 0) this.completeWaveCleanup();
      this.updateHud();
      return;
    }
    if (this.phase !== 'battle') return;
    if (this.playerDeathPending) {
      this.playerDeathTimer = Math.max(0, this.playerDeathTimer - dt);
      if (this.playerDeathTimer <= 0) this.showResult(false);
      this.updateHud();
      return;
    }
    this.elapsed += dt;
    this.waveTimer += dt;
    this.waveClearedTimer = Math.max(0, this.waveClearedTimer - dt);
    this.spawnTimer -= dt;
    this.attackTimer -= dt;
    this.updatePlayer(dt);
    this.updateWeaponOrbit(dt);
    this.updateEnemies(dt);
    if (this.developerMode.options.enabled && this.developerAutoClear) {
      this.enemies.filter((enemy) => !enemy.dead).forEach((enemy) => this.damageEnemy(enemy, enemy.hp + 999999, paletteRgb.amber));
    }
    this.updateProjectiles(dt);
    this.updateDrops(dt);
    this.updateMutation(dt);
    this.updateDailyAugments(dt);
    if (!waveSpawningComplete(this.waveTimer, this.waveLength, this.waveSpawned, this.spawnBudgetForWave()) && this.spawnTimer <= 0) {
      this.spawnWaveEnemy();
      this.spawnTimer = this.spawnIntervalForWave() * this.spawnRateMultiplier();
    }
    const weapon = this.currentWeapon();
    if (weapon?.type === 'melee') {
      this.autoAttack();
    } else if (this.attackTimer <= 0) {
      this.autoAttack();
      this.attackTimer = this.currentCooldown();
    }
    const spawningStopped = waveSpawningComplete(this.waveTimer, this.waveLength, this.waveSpawned, this.spawnBudgetForWave());
    if (spawningStopped && this.enemies.filter((enemy) => !enemy.dead).length === 0) this.beginWaveCleanup();
    this.updateHud();
  }

  private buildArena() {
    const mapKey = 'ward-night-v1';
    if (this.textures.exists(mapKey)) {
      this.arenaBackgroundTexture = mapKey;
      this.arenaBackground = this.add.image(
        (WORLD_BOUNDS.left + WORLD_BOUNDS.right) / 2,
        (WORLD_BOUNDS.top + WORLD_BOUNDS.bottom) / 2,
        mapKey,
      ).setOrigin(0.5).setDisplaySize(
        WORLD_BOUNDS.right - WORLD_BOUNDS.left,
        WORLD_BOUNDS.bottom - WORLD_BOUNDS.top,
      ).setAlpha(0.96);
      this.world.add(this.arenaBackground);
    }
    const bg = this.add.graphics();
    bg.fillStyle(palette.bg, 0.18).fillRect(WORLD_BOUNDS.left, WORLD_BOUNDS.top, WORLD_BOUNDS.right - WORLD_BOUNDS.left, WORLD_BOUNDS.bottom - WORLD_BOUNDS.top);
    bg.fillStyle(0x0e181d, 0.16).fillRect(WORLD_BOUNDS.left + 20, WORLD_BOUNDS.top + 20, WORLD_BOUNDS.right - WORLD_BOUNDS.left - 40, WORLD_BOUNDS.bottom - WORLD_BOUNDS.top - 40);
    bg.lineStyle(1, 0x29444b, 0.2);
    for (let x = WORLD_BOUNDS.left + 20; x <= WORLD_BOUNDS.right - 20; x += 35) bg.lineBetween(x, WORLD_BOUNDS.top + 20, x, WORLD_BOUNDS.bottom - 20);
    for (let y = WORLD_BOUNDS.top + 20; y <= WORLD_BOUNDS.bottom - 20; y += 35) bg.lineBetween(WORLD_BOUNDS.left + 20, y, WORLD_BOUNDS.right - 20, y);
    bg.lineStyle(2, 0x3b5b62, 0.55).strokeRect(WORLD_BOUNDS.left + 20, WORLD_BOUNDS.top + 20, WORLD_BOUNDS.right - WORLD_BOUNDS.left - 40, WORLD_BOUNDS.bottom - WORLD_BOUNDS.top - 40);
    this.world.add(bg);
  }

  private addHospitalBackdrop(layer: Phaser.GameObjects.Container, textureKey: string, shade = 0.58) {
    if (this.textures.exists(textureKey)) {
      layer.add(this.add.image(W / 2, H / 2, textureKey).setOrigin(0.5).setDisplaySize(W, H).setAlpha(0.96));
    }
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x05090f, shade));
  }

  private buildHud() {
    const text = (x: number, y: number, value: string, size = 16, color = palette.cream) => this.add.text(x, y, value, { fontFamily: 'Microsoft YaHei', fontSize: `${size}px`, color, lineSpacing: 3 });
    const safe = this.pageSafeBounds(0);
    const panelAnchor = this.cameraZoomAdjustedUiPoint(safe.left + 12, H - 120);
    // 固定 HUD 只保留 SAN、经验和当前武器，统一放进美术贴图预留区。
    // Keep the compact status group inside the left safe edge. The bars and
    // weapon slot are laid out from a single fixed anchor so no part clips on
    // narrow mobile canvases.
    const panel = this.add.container(panelAnchor.x, panelAnchor.y).setDepth(25).setScrollFactor(0, 0, true);
    this.hud.panel = panel;
    this.ui.add(panel);
    this.hud.sanOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xc44557, 0).setDepth(0);
    this.ui.add(this.hud.sanOverlay);
    const wavePanel = this.add.container(safe.centerX, this.safeTopY(14, 4)).setDepth(26).setScrollFactor(0, 0, true);
    this.hud.wavePanel = wavePanel;
    this.ui.add(wavePanel);
    this.hud.wave = text(0, -12, '第 1 / 10 波', this.uiFontSize(27, 1.65), palette.amber).setOrigin(0.5).setFontStyle('bold');
    this.hud.timer = text(0, 19, '倒计时 30 秒', this.uiFontSize(18, 1.7), palette.cream).setOrigin(0.5);
    this.hud.waveCleared = text(0, 47, '', this.uiFontSize(16, 1.55), palette.green).setOrigin(0.5).setFontStyle('bold');
    wavePanel.add(this.hud.wave);
    wavePanel.add(this.hud.timer);
    wavePanel.add(this.hud.waveCleared);
    this.hud.xpBar = this.add.graphics();
    this.hud.sanBar = this.add.graphics();
    if (this.textures.exists('hud-status-frame-v2')) {
      // The source frame is a 2:3 portrait asset. Keep its aspect ratio so the
      // two vertical slots and the lower weapon circle stay aligned.
      panel.add(this.add.image(120, -170, 'hud-status-frame-v2').setOrigin(0.5).setDisplaySize(250, 375).setAlpha(0.92).setDepth(0));
    }
    panel.add(this.hud.xpBar);
    panel.add(this.hud.sanBar);
    this.hud.xpBar.setDepth(1);
    this.hud.sanBar.setDepth(1);
    // 手机端把资源条改为横向，缩窄屏幕时仍能一眼分辨余量；状态面板不再叠加整块底框。
    const hudCenterX = 120;
    this.hud.xp = text(98, -337, 'XP 0%', this.uiFontSize(15, 1.55), palette.cyan).setOrigin(0.5).setDepth(4).setFontStyle('bold');
    this.hud.san = text(175, -337, 'SAN 100', this.uiFontSize(15, 1.55), palette.cream).setOrigin(0.5).setDepth(4).setFontStyle('bold');
    if (this.textures.exists('ui-round-frame')) {
      panel.add(this.add.image(hudCenterX, -26, 'ui-round-frame').setOrigin(0.5).setDisplaySize(78, 78).setDepth(2).setAlpha(0.96));
    }
    this.hud.weaponIcon = this.add.image(hudCenterX, -26, 'weapon-sword').setOrigin(0.5).setDepth(4);
    this.fitImageToBox(this.hud.weaponIcon, 46, 46);
    panel.add(this.hud.weaponIcon);
    this.hud.weapon = text(hudCenterX, 16, '病院刀', this.uiFontSize(18, 1.85), palette.cream).setOrigin(0.5).setFixedSize(196, 32).setAlign('center').setDepth(4).setFontStyle('bold');
    panel.add([this.hud.xp, this.hud.san, this.hud.weapon]);
    this.pinHudToViewport();
  }

  private currentWeapon() {
    return this.weapons.find((weapon) => weapon.owned);
  }

  /** Fit raster art into a fixed slot without distorting its aspect ratio. */
  private fitImageToBox(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) {
    const sourceWidth = Math.max(1, image.width);
    const sourceHeight = Math.max(1, image.height);
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    image.setDisplaySize(sourceWidth * scale, sourceHeight * scale);
    return image;
  }

  private compactUi() {
    const width = this.game?.canvas?.getBoundingClientRect().width ?? W;
    return width < 900;
  }

  private uiFontSize(size: number, compactScale = 1.55) {
    return this.compactUi() ? Math.max(size, Math.round(size * compactScale)) : size;
  }

  private uiLabel(value: string, compactChars = 5) {
    if (!this.compactUi() || !value) return value;
    return value.split('\n').flatMap((line) => {
      const chars = Array.from(line);
      const chunks: string[] = [];
      for (let index = 0; index < chars.length; index += compactChars) chunks.push(chars.slice(index, index + compactChars).join(''));
      return chunks;
    }).join('\n');
  }

  private weaponSkinsFor(weaponClass: WeaponClass) {
    return this.weaponSkins.filter((skin) => skin.weaponClass === weaponClass);
  }

  private weaponSkinTextureKey(skin: WeaponSkinDef) {
    return skin.textureKey && this.textures.exists(skin.textureKey) ? skin.textureKey : `weapon-${skin.weaponClass}`;
  }

  private equippedWeaponSkin(weaponClass: WeaponClass) {
    if (this.tutorialRun) {
      const showcaseId = TUTORIAL_SHOWCASE_WEAPON_SKIN_IDS[weaponClass];
      const showcaseSkin = this.weaponSkins.find((skin) => skin.id === showcaseId && skin.weaponClass === weaponClass);
      if (showcaseSkin) return showcaseSkin;
    }
    const equippedId = this.progress.equippedWeaponSkinIds?.[weaponClass] ?? `${weaponClass}-default`;
    return this.weaponSkins.find((skin) => skin.id === equippedId && skin.weaponClass === weaponClass)
      ?? this.weaponSkins.find((skin) => skin.id === `${weaponClass}-default`)!;
  }

  private activePlayerSkin() {
    if (this.tutorialRun) {
      return this.skins.find((skin) => skin.id === TUTORIAL_SHOWCASE_SKIN_ID) ?? this.skins[0];
    }
    return this.skins.find((skin) => skin.id === this.progress.equippedSkinId) ?? this.skins[0];
  }

  private weaponAssetKey(weapon?: Weapon) {
    return this.weaponSkinTextureKey(this.equippedWeaponSkin(weapon?.weaponClass ?? 'sword'));
  }

  private weaponVisualSpec(weapon: Weapon) {
    const specs: Record<WeaponClass, { width: number; height: number; originX: number; originY: number; rotation: number }> = {
      sword: { width: 92, height: 92, originX: 0.15, originY: 0.75, rotation: Math.PI / 4 },
      gun: { width: 106, height: 106, originX: 0.16, originY: 0.72, rotation: 0 },
      whip: { width: 100, height: 100, originX: 0.14, originY: 0.75, rotation: 0 },
      cannon: { width: 96, height: 96, originX: 0.15, originY: 0.74, rotation: Math.PI / 4 },
    };
    return specs[weapon.weaponClass];
  }

  private safeGameRect(padding = 0) {
    const canvasRect = this.game?.canvas?.getBoundingClientRect();
    const displayWidth = canvasRect?.width || this.scale?.displaySize?.width || 0;
    const displayHeight = canvasRect?.height || this.scale?.displaySize?.height || 0;
    const scaleX = displayWidth ? W / displayWidth : 1;
    const scaleY = displayHeight ? H / displayHeight : 1;
    const leftInset = Math.max(0, this.buildaSafeArea.left * scaleX);
    const rightInset = Math.max(0, this.buildaSafeArea.right * scaleX);
    const topInset = Math.max(0, this.buildaSafeArea.top * scaleY);
    const bottomInset = Math.max(0, this.buildaSafeArea.bottom * scaleY);
    // Phaser centers the FIT canvas inside the wider Builda viewport. Account
    // for that offset so logical UI coordinates are centered in the host safe area.
    const shellRect = this.game?.canvas?.parentElement?.getBoundingClientRect();
    const canvasLeft = canvasRect?.width ? canvasRect.left : this.scale?.canvasBounds?.x ?? 0;
    const canvasCenter = canvasLeft + displayWidth / 2;
    const shellCenter = shellRect ? shellRect.left + shellRect.width / 2 : canvasCenter;
    const centerShift = (shellCenter - canvasCenter) * scaleX;
    const left = clamp(leftInset + padding + centerShift, 0, W / 2 - 1);
    const right = clamp(W - rightInset - padding + centerShift, W / 2 + 1, W);
    const top = clamp(topInset + padding, 0, H / 2 - 1);
    const bottom = clamp(H - bottomInset - padding, H / 2 + 1, H);
    return { left, right, top, bottom, width: right - left, height: bottom - top, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
  }

  private safeBackButtonX() {
    return this.safeGameRect(16).left + 75;
  }

  private safeBackButtonY() {
    return this.safeGameRect(16).top + 21;
  }

  /** Keep page chrome inside the same logical safe rectangle as the title screen. */
  private pageSafeBounds(padding = 16) {
    return this.safeGameRect(padding);
  }

  private safeTopY(desired: number, margin = 10) {
    return Math.max(desired, this.pageSafeBounds(0).top + margin);
  }

  private safeBottomY(desired: number, margin = 12) {
    return Math.min(desired, this.pageSafeBounds(0).bottom - margin);
  }

  private refreshBuildaLayout() {
    this.buildaSafeArea = buildaPlatform.safeArea();
    this.buildaCapsuleRect = buildaPlatform.capsuleMenuRect();
    const canvasRect = this.game?.canvas?.getBoundingClientRect();
    const scaleX = canvasRect?.width ? W / canvasRect.width : 1;
    const scaleY = canvasRect?.height ? H / canvasRect.height : 1;
    const safeTop = Math.max(18, (this.buildaSafeArea.top + 8) * scaleY);
    const capsuleRight = this.buildaCapsuleRect.width > 0
      ? (this.buildaSafeArea.right + this.buildaCapsuleRect.right + this.buildaCapsuleRect.width + 12) * scaleX
      : this.buildaSafeArea.right * scaleX + 20;
    const safeBottom = this.buildaSafeArea.bottom * scaleY;
    const safe = this.pageSafeBounds(0);
    const panelAnchor = this.cameraZoomAdjustedUiPoint(safe.left + 12, H - 120 - safeBottom);
    this.hud.panel?.setPosition(panelAnchor.x, panelAnchor.y);
    this.hud.wavePanel?.setPosition(safe.centerX, this.safeTopY(14, 4));
    this.hud.resourcePanel?.setPosition(W - 122 - Math.max(0, capsuleRight - 20), safeTop + 36);
  }

  private async notifyBuildaReady() {
    const result = await buildaPlatform.ready();
    if (result && !result.ok) console.warn(`[Builda] runtime.ready failed: ${result.error.code}`);
    this.refreshBuildaLayout();
  }

  private setMiniBossVisualState(enemy: Enemy, state: MiniBossVisualState) {
    const boss = enemy.miniBossVisual;
    if (!boss || (boss.state === state && state !== 'death')) return;
    boss.state = state;
    boss.walk.setVisible(state === 'walk');
    boss.attack.setVisible(state === 'attack');
    boss.death.setVisible(state === 'death');
    boss.aura.setVisible(state !== 'death');
    boss.shadow.setVisible(true);
    if (state === 'walk' && this.anims.exists(boss.walkKey)) boss.walk.anims.play(boss.walkKey, true);
    if (state === 'attack' && this.anims.exists(boss.attackKey)) boss.attack.anims.play(boss.attackKey, true);
  }

  private updateMiniBossFacing(enemy: Enemy, movingRight: boolean) {
    const boss = enemy.miniBossVisual;
    if (!boss) return;
    const scaleX = movingRight ? -1 : 1;
    boss.shadow.setScale(Math.abs(scaleX), 1);
    boss.walk.setScale(scaleX, 1);
    boss.attack.setScale(scaleX, 1);
    boss.death.setScale(scaleX, 1);
  }

  private requestLandscapeLock() {
    const orientation = window.screen?.orientation as (ScreenOrientation & { lock?: (orientation: string) => Promise<void> }) | undefined;
    if (!orientation || typeof orientation.lock !== 'function') return;
    void orientation.lock('landscape').catch(() => undefined);
  }

  private updateHeldWeaponVisual() {
    const weapon = this.currentWeapon();
    if (!this.player || !weapon) return;
    const copies = clamp(Math.floor(weapon.copies), 1, MAX_WEAPON_COPIES);
    weapon.copies = copies;
    const spec = this.weaponVisualSpec(weapon);
    const assetKey = this.weaponAssetKey(weapon);
    const weaponParent = this.playerWeaponLayer ?? this.player;
    while (this.heldWeapons.length < copies) {
      const held = this.add.image(0, 0, assetKey).setOrigin(spec.originX, spec.originY);
      weaponParent.add(held);
      this.heldWeapons.push(held);
    }
    while (this.heldWeapons.length > copies) {
      this.heldWeapons.pop()?.destroy();
    }
    this.heldWeapon = this.heldWeapons[0];
    this.heldWeapons.forEach((held) => {
      held.setTexture(assetKey).setVisible(true).setOrigin(spec.originX, spec.originY).setDisplaySize(spec.width, spec.height);
    });
    this.updatePlayerLayerOrder(weapon);
  }

  private updatePlayerLayerOrder(weapon = this.currentWeapon()) {
    if (!this.player || !this.playerBodyLayer || !this.playerWeaponLayer) return;
    const weaponBehind = weapon?.weaponClass === 'sword';
    this.player.moveTo(weaponBehind ? this.playerWeaponLayer : this.playerBodyLayer, 0);
    this.player.moveTo(weaponBehind ? this.playerBodyLayer : this.playerWeaponLayer, 1);
  }

  private updateWeaponOrbit(dt: number) {
    const weapon = this.currentWeapon();
    if (!weapon || !this.player) return;
    this.updateHeldWeaponVisual();
    this.previousWeaponAngle = this.weaponAngle;
    this.weaponAngle = Phaser.Math.Angle.Wrap(this.weaponAngle + dt * this.currentRotationSpeed(weapon));
    const isGun = weapon.weaponClass === 'gun';
    const baseRadius = weapon.type === 'melee' ? 24 : isGun ? 34 : 48;
    const targetRadius = baseRadius + (this.enemies.some((enemy) => !enemy.dead) ? 18 : 0);
    this.weaponOrbitRadius = Phaser.Math.Linear(this.weaponOrbitRadius || baseRadius, targetRadius, Math.min(1, dt * 10));
    const innerRadius = this.weaponOrbitRadius;
    const orbitCenterY = isGun ? -42 : 0;
    const copies = Math.max(1, this.heldWeapons.length);
    this.heldWeapons.forEach((held, index) => {
      const angle = this.weaponAngle + (index * FULL_TURN) / copies;
      held.setPosition(Math.cos(angle) * innerRadius, orbitCenterY + Math.sin(angle) * innerRadius);
      held.setRotation(angle + this.weaponVisualSpec(weapon).rotation);
      const active = this.enemies.some((enemy) => !enemy.dead && distance(enemy.node, this.player) < weaponAttackRange(weapon.type, weapon.weaponClass, weapon.range) + 70);
      if (active) {
        held.setTint(weapon.color);
        held.setAlpha(0.84 + (Math.sin(this.elapsed * 14 + index) + 1) * 0.08);
      } else {
        held.clearTint();
        held.setAlpha(1);
      }
    });
  }

  private updateHud() {
    if (!this.hud.wave) return;
    this.pinHudToViewport();
    const bossLabel = this.isMiniBossWave() ? ' · 小首领' : this.isFloorBossWave() ? ' · 月度首领' : '';
    this.hud.wave.setText(`第 ${this.wave} / ${this.wavesPerFloor()} 波${bossLabel}`);
    const seconds = Math.max(0, Math.ceil(this.waveLength - this.waveTimer));
    this.hud.waveCleared?.setText(this.phase === 'wave-break' || this.waveClearedTimer > 0 ? this.waveClearedMessage : '');
    const remaining = this.enemies.filter((enemy) => !enemy.dead).length;
    this.hud.timer?.setText(this.phase === 'battle'
      ? seconds > 0 ? `倒计时 ${seconds} 秒 · 出怪 ${this.waveSpawned} / ${this.spawnBudgetForWave()}` : `停止出怪 · 场内敌人 ${remaining}`
      : this.phase === 'wave-cleanup'
        ? `波末清理 · 敌人 ${this.enemies.length} · 掉落 ${this.drops.length}`
        : this.phase === 'wave-break'
          ? `下一波倒计时 ${Math.max(1, Math.ceil(this.waveBreakTimer))} 秒`
          : '下一波准备中');
    const xpRatio = clamp(this.xp / Math.max(1, this.xpNeed), 0, 1);
    const sanRatio = clamp(this.san / 100, 0, 1);
    this.hud.xp?.setText(`XP ${Math.round(xpRatio * 100)}%`);
    this.hud.san?.setText(`SAN ${Math.ceil(this.san)}`);
    const weapon = this.currentWeapon();
    this.hud.weapon?.setText(weapon
      ? weapon.name
      : '未装备武器');
    if (this.hud.weaponIcon) {
      this.hud.weaponIcon.setTexture(this.weaponAssetKey(weapon)).setVisible(true);
      this.fitImageToBox(this.hud.weaponIcon, 46, 46);
    }
    this.hud.kills?.setText(`击破 ${this.kills}`);
    this.hud.san?.setColor(this.san < 30 ? palette.danger : palette.cream);
    const sanAlert = this.mutated;
    const pulse = 0.04 + (Math.sin(this.sanPulse * 8) + 1) * 0.025;
    this.hud.sanOverlay?.setAlpha(sanAlert ? pulse : this.san < 30 ? 0.025 : 0);
    const barTop = -300;
    const barHeight = 220;
    const barWidth = 30;
    const xpBarX = 83;
    const sanBarX = 127;
    this.hud.xpBar?.clear()
      .fillStyle(0x081116, 0.96).fillRect(xpBarX, barTop, barWidth, barHeight)
      .fillStyle(0x4b8ee8, 1).fillRect(xpBarX, barTop + barHeight * (1 - xpRatio), barWidth, barHeight * xpRatio)
      .lineStyle(2, 0x8ab8ff, 0.88).strokeRect(xpBarX, barTop, barWidth, barHeight);
    this.hud.sanBar?.clear()
      .fillStyle(0x12090d, 0.96).fillRect(sanBarX, barTop, barWidth, barHeight)
      .fillStyle(this.mutated ? 0xff4258 : 0xd85462, 1).fillRect(sanBarX, barTop + barHeight * (1 - sanRatio), barWidth, barHeight * sanRatio)
      .lineStyle(2, this.mutated ? 0xff91a0 : 0xffa3a9, 0.88).strokeRect(sanBarX, barTop, barWidth, barHeight);
    this.updateHeldWeaponVisual();
  }

  private pinHudToViewport() {
    if (!this.ui) return;
    // Re-apply the fixed layer contract because camera follow can change nested container state.
    const visible = this.phase === 'battle' || this.phase === 'boss-intro' || this.phase === 'boss-death' || this.phase === 'wave-cleanup' || this.phase === 'wave-break';
    const canvasRect = this.game?.canvas?.getBoundingClientRect();
    const scaleY = canvasRect?.height ? H / canvasRect.height : 1;
    const safeBottom = this.buildaSafeArea.bottom * scaleY;
    const safe = this.pageSafeBounds(0);
    const panelAnchor = this.cameraZoomAdjustedUiPoint(safe.left + 12, H - 120 - safeBottom);
    this.ui.setPosition(0, 0).setDepth(100).setAlpha(1).setScrollFactor(0, 0, true).setVisible(visible);
    this.hud.panel?.setPosition(panelAnchor.x, panelAnchor.y).setScrollFactor(0, 0, true).setDepth(25);
    this.hud.sanOverlay?.setScrollFactor(0, 0);
    this.hud.wave?.setScrollFactor(0, 0);
    this.hud.timer?.setScrollFactor(0, 0);
    this.hud.waveCleared?.setScrollFactor(0, 0);
    this.hud.wavePanel?.setPosition(safe.centerX, this.safeTopY(14, 4)).setScrollFactor(0, 0, true).setDepth(26);
    this.hud.resourcePanel?.setScrollFactor(0, 0, true).setDepth(26);
    this.hud.kills?.setScrollFactor(0, 0);
    this.hud.skillIcon?.setScrollFactor(0, 0);
    this.hud.skill?.setScrollFactor(0, 0);
  }

  private syncFloorUnlocks(clearedFloor: number) {
    const floor = Math.max(0, Math.floor(clearedFloor));
    this.skins
      .filter((skin) => skin.category === 'basic' && skin.unlockFloor !== undefined && floor >= skin.unlockFloor)
      .forEach((skin) => {
        if (!this.progress.unlockedSkinIds.includes(skin.id)) this.progress.unlockedSkinIds.push(skin.id);
      });
    this.weaponSkins
      .filter((skin) => skin.category === 'basic' && skin.unlockFloor !== undefined && floor >= skin.unlockFloor)
      .forEach((skin) => {
        if (!this.progress.unlockedWeaponSkinIds.includes(skin.id)) this.progress.unlockedWeaponSkinIds.push(skin.id);
      });
  }

  private isTemporaryUnlockActive(trials: Record<string, number> | undefined, id: string) {
    const expiresAt = trials?.[id];
    return typeof expiresAt === 'number'
      && Number.isFinite(expiresAt)
      && expiresAt > Date.now();
  }

  private isSkinAvailable(id: string) {
    return this.progress.unlockedSkinIds.includes(id) || this.isTemporaryUnlockActive(this.progress.skinTrialExpiresAt, id);
  }

  private isWeaponSkinAvailable(id: string) {
    const skin = this.weaponSkins.find((candidate) => candidate.id === id);
    const freeOpeningSkins = skin ? this.weaponSkinsFor(skin.weaponClass).slice(1, 4).map((candidate) => candidate.id) : [];
    return freeOpeningSkins.includes(id)
      || this.progress.unlockedWeaponSkinIds.includes(id)
      || this.isTemporaryUnlockActive(this.progress.weaponSkinTrialExpiresAt, id);
  }

  private normalizeTemporaryUnlocks() {
    const prune = (trials: Record<string, number> | undefined) => {
      if (!trials) return {};
      Object.keys(trials).forEach((id) => {
        if (!this.isTemporaryUnlockActive(trials, id)) delete trials[id];
      });
      return trials;
    };
    this.progress.skinTrialExpiresAt = prune(this.progress.skinTrialExpiresAt);
    this.progress.weaponSkinTrialExpiresAt = prune(this.progress.weaponSkinTrialExpiresAt);
    if (!this.isSkinAvailable(this.progress.equippedSkinId)) this.progress.equippedSkinId = 'patient-default';
    (['sword', 'gun', 'whip', 'cannon'] as WeaponClass[]).forEach((weaponClass) => {
      const equippedId = this.progress.equippedWeaponSkinIds[weaponClass] ?? `${weaponClass}-default`;
      if (!this.isWeaponSkinAvailable(equippedId)) this.progress.equippedWeaponSkinIds[weaponClass] = `${weaponClass}-default`;
    });
  }

  private loadProgress(raw?: string) {
    try {
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ProgressSave>;
      const defaultWeaponSkins = ['sword-default', 'gun-default', 'whip-default', 'cannon-default'];
      const availableSkinIds = new Set(this.skins.map((skin) => skin.id));
      const validTrialMap = (value: unknown) => {
        if (!value || typeof value !== 'object') return {};
        return Object.fromEntries(Object.entries(value).filter(([id, expiresAt]) => {
          const expiry = Number(expiresAt);
          return Boolean(id) && Number.isFinite(expiry) && expiry > Date.now();
        }).map(([id, expiresAt]) => [id, Number(expiresAt)]));
      };
      const validPaymentOrderIds = Array.isArray(parsed.processedPaymentOrderIds)
        ? Array.from(new Set(parsed.processedPaymentOrderIds
          .filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id.trim()))
          .map((id) => id.trim())))
          .slice(-200)
        : [];
      const equippedWeaponSkinIds = parsed.equippedWeaponSkinIds && typeof parsed.equippedWeaponSkinIds === 'object'
        ? parsed.equippedWeaponSkinIds
        : { sword: 'sword-default', gun: 'gun-default', whip: 'whip-default', cannon: 'cannon-default' };
      this.progress = {
        maxFloor: clamp(Number(parsed.maxFloor) || 1, 1, TOTAL_FLOORS),
        mainlineIntroSeen: parsed.mainlineIntroSeen === true,
        tutorialCompleted: parsed.tutorialCompleted === true || Number(parsed.maxFloor) > 1,
        unlockedWeaponIds: Array.isArray(parsed.unlockedWeaponIds) ? parsed.unlockedWeaponIds.filter((id): id is string => typeof id === 'string') : ['knife', 'ward-lantern'],
        unlockedWeaponSkinIds: Array.isArray(parsed.unlockedWeaponSkinIds) ? parsed.unlockedWeaponSkinIds.filter((id): id is string => typeof id === 'string') : defaultWeaponSkins,
        equippedWeaponSkinIds,
         unlockedSkinIds: Array.isArray(parsed.unlockedSkinIds) ? parsed.unlockedSkinIds.filter((id): id is string => typeof id === 'string' && availableSkinIds.has(id)) : DEFAULT_UNLOCKED_SKIN_IDS,
         equippedSkinId: typeof parsed.equippedSkinId === 'string' && availableSkinIds.has(parsed.equippedSkinId) ? parsed.equippedSkinId : 'patient-default',
         skinTrialExpiresAt: validTrialMap(parsed.skinTrialExpiresAt),
         weaponSkinTrialExpiresAt: validTrialMap(parsed.weaponSkinTrialExpiresAt),
        archiveKinds: Array.isArray(parsed.archiveKinds) ? parsed.archiveKinds.filter((id): id is string => typeof id === 'string') : [],
        dailyCompletedDate: typeof parsed.dailyCompletedDate === 'string' ? parsed.dailyCompletedDate : undefined,
        dailyBestSeconds: Number.isFinite(Number(parsed.dailyBestSeconds)) && Number(parsed.dailyBestSeconds) > 0 ? Number(parsed.dailyBestSeconds) : undefined,
        dailyAttemptDate: typeof parsed.dailyAttemptDate === 'string' ? parsed.dailyAttemptDate : undefined,
        dailyAttemptMonth: typeof parsed.dailyAttemptMonth === 'string' ? parsed.dailyAttemptMonth : undefined,
        dailyAttempts: Math.max(0, Math.floor(Number(parsed.dailyAttempts) || 0)),
        dailyAdTickets: Math.max(0, Math.floor(Number(parsed.dailyAdTickets) || 0)),
         dailyRewardMonth: typeof parsed.dailyRewardMonth === 'string' ? parsed.dailyRewardMonth : undefined,
         dailyRewardIds: Array.isArray(parsed.dailyRewardIds) ? parsed.dailyRewardIds.filter((id): id is string => typeof id === 'string') : [],
         dailyRewardTitle: typeof parsed.dailyRewardTitle === 'string' ? parsed.dailyRewardTitle : undefined,
         metaCoins: Math.max(0, Number(parsed.metaCoins) || 0),
         processedPaymentOrderIds: validPaymentOrderIds,
      };
      if (!this.progress.unlockedWeaponIds.includes('knife')) this.progress.unlockedWeaponIds.unshift('knife');
      if (!this.progress.unlockedWeaponIds.includes('ward-lantern')) this.progress.unlockedWeaponIds.push('ward-lantern');
      defaultWeaponSkins.forEach((id) => {
        if (!this.progress.unlockedWeaponSkinIds.includes(id)) this.progress.unlockedWeaponSkinIds.push(id);
      });
      (['sword', 'gun', 'whip', 'cannon'] as WeaponClass[]).forEach((weaponClass) => {
        const defaultId = `${weaponClass}-default`;
        const equipped = this.progress.equippedWeaponSkinIds[weaponClass];
        if (!equipped || !this.weaponSkins.some((skin) => skin.id === equipped && skin.weaponClass === weaponClass)) {
          this.progress.equippedWeaponSkinIds[weaponClass] = defaultId;
        }
      });
       if (!this.progress.unlockedSkinIds.includes('patient-default')) this.progress.unlockedSkinIds.unshift('patient-default');
       if (!this.progress.unlockedSkinIds.includes(this.progress.equippedSkinId)) this.progress.equippedSkinId = this.progress.unlockedSkinIds[0] ?? 'patient-default';
       this.syncFloorUnlocks(this.progress.maxFloor - 1);
       this.normalizeTemporaryUnlocks();
       this.processedPaymentOrderIds = new Set(this.progress.processedPaymentOrderIds ?? []);
     } catch {
       this.progress = { maxFloor: 1, mainlineIntroSeen: false, tutorialCompleted: false, unlockedWeaponIds: ['knife', 'ward-lantern'], unlockedWeaponSkinIds: ['sword-default', 'gun-default', 'whip-default', 'cannon-default'], equippedWeaponSkinIds: { sword: 'sword-default', gun: 'gun-default', whip: 'whip-default', cannon: 'cannon-default' }, unlockedSkinIds: DEFAULT_UNLOCKED_SKIN_IDS.slice(), equippedSkinId: 'patient-default', skinTrialExpiresAt: {}, weaponSkinTrialExpiresAt: {}, archiveKinds: [], dailyBestSeconds: undefined, dailyAttemptDate: undefined, dailyAttemptMonth: undefined, dailyAttempts: 0, dailyAdTickets: 0, dailyRewardMonth: undefined, dailyRewardIds: [], dailyRewardTitle: undefined, metaCoins: 0, processedPaymentOrderIds: [] };
       this.processedPaymentOrderIds.clear();
     }
  }

  private saveProgress() {
    if (this.developerMode.options.enabled) return;
    this.progress.processedPaymentOrderIds = Array.from(this.processedPaymentOrderIds).slice(-200);
    this.progressRepository.save(this.progress);
  }

  private async recordPaymentOrder(orderId: string) {
    const normalized = orderId.trim();
    if (!normalized) return false;
    const key = await paymentOrderKey(normalized);
    // Keep recognizing legacy raw IDs already present in older saves while
    // storing only the hashed key for new purchases.
    if (!key || this.processedPaymentOrderIds.has(key) || this.processedPaymentOrderIds.has(normalized)) return false;
    this.processedPaymentOrderIds.add(key);
    this.progress.processedPaymentOrderIds = Array.from(this.processedPaymentOrderIds).slice(-200);
    return true;
  }

  private async hydrateProgress() {
    const remote = await this.progressRepository.load();
    if (!remote) return;
    try {
      this.loadProgress(JSON.stringify(remote));
      this.floor = this.progress.tutorialCompleted ? clamp(this.progress.maxFloor, 1, TOTAL_FLOORS) : 0;
      this.weapons = this.createWeaponRoster();
      this.configureDeveloperMode();
      if (this.phase === 'start') this.showStart();
    } catch {
      // Invalid remote data must not prevent the default run from starting.
    }
  }

  private configureDeveloperMode() {
    if (!this.developerMode.options.enabled) return;
    const allWeaponIds = this.createWeaponRoster().map((weapon) => weapon.id);
    const allSkinIds = this.skins.map((skin) => skin.id);
    const allWeaponSkinIds = this.weaponSkins.map((skin) => skin.id);
    this.progress.maxFloor = TOTAL_FLOORS;
    this.progress.mainlineIntroSeen = true;
    this.progress.tutorialCompleted = true;
    this.progress.unlockedWeaponIds = allWeaponIds;
    this.progress.unlockedSkinIds = allSkinIds;
    this.progress.unlockedWeaponSkinIds = allWeaponSkinIds;
    this.progress.archiveKinds = ['chaser', 'shooter', 'disruptor', 'tentacle', 'bomber', 'eye', 'miniBoss', 'boss'];
    this.progress.equippedSkinId = this.progress.equippedSkinId && allSkinIds.includes(this.progress.equippedSkinId)
      ? this.progress.equippedSkinId
      : allSkinIds[0] ?? 'patient-default';
    this.floor = clamp(this.developerMode.options.initialFloor ?? TOTAL_FLOORS, 0, TOTAL_FLOORS);
    this.developerWaveOverride = this.developerMode.options.initialWave;
    this.developerGodMode = this.developerMode.options.godMode ?? true;
    this.developerAutoClear = this.developerMode.options.autoClear ?? false;
    if (this.developerMode.options.initialGameSpeed !== undefined) {
      this.gameSpeed = clamp(this.developerMode.options.initialGameSpeed, 0.25, 8);
    }
  }

  private addDeveloperPanel(parent: Phaser.GameObjects.Container, battle: boolean) {
    if (!this.developerMode.options.enabled) return;
    const safe = this.safeGameRect(10);
    const panelX = safe.right - (battle ? 126 : 152);
    const panelY = battle ? safe.bottom - 106 : safe.top + 72;
    const width = battle ? 238 : 286;
    const height = battle ? 98 : 118;
    const panel = this.add.container(panelX, panelY).setDepth(250).setScrollFactor(0);
    panel.add(this.add.rectangle(0, 0, width, height, 0x101b24, 0.94).setStrokeStyle(2, paletteRgb.amber, 0.86));
    panel.add(this.add.text(-width / 2 + 12, -height / 2 + 12, '开发者模式', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.amber }).setOrigin(0, 0.5));
    if (battle) {
      this.addButton(panel, -70, -12, 102, 30, '波次 -', () => this.setDeveloperWave(this.wave - 1), 'muted', 5);
      this.addButton(panel, 70, -12, 102, 30, '波次 +', () => this.setDeveloperWave(this.wave + 1), 'primary', 5);
      this.addButton(panel, -70, 28, 102, 30, '清空敌人', () => this.clearDeveloperWave(), 'danger', 5);
      this.addButton(panel, 70, 28, 102, 30, this.developerGodMode ? '无敌：开' : '无敌：关', () => {
        this.developerGodMode = !this.developerGodMode;
        this.showDeveloperBattlePanel();
      }, this.developerGodMode ? 'primary' : 'muted', 5);
    } else {
      this.addButton(panel, -72, -14, 120, 30, `楼层 ${this.floor}`, () => {
        this.floor = this.floor >= TOTAL_FLOORS ? 0 : this.floor + 1;
        this.showStart();
      }, 'muted', 5);
      this.addButton(panel, 72, -14, 120, 30, '进入测试战斗', () => this.startRun(this.floor, 'mainline', 'knife'), 'primary', 5);
      this.addButton(panel, -72, 28, 120, 30, 'Boss 预览', () => {
        if (this.assetLoader.has('battle')) this.startBossPreviewShowcase();
        else this.ensureAssetGroup('battle', () => this.startBossPreviewShowcase());
      }, 'muted', 5);
      this.addButton(panel, 72, 28, 120, 30, this.developerAutoClear ? '自动清场：开' : '自动清场：关', () => {
        this.developerAutoClear = !this.developerAutoClear;
        this.showStart();
      }, this.developerAutoClear ? 'primary' : 'muted', 5);
    }
    parent.add(panel);
    this.developerPanel = panel;
  }

  private showDeveloperBattlePanel() {
    if (this.phase !== 'battle' && this.phase !== 'wave-cleanup' && this.phase !== 'wave-break') return;
    this.developerPanel?.destroy(true);
    this.addDeveloperPanel(this.ui, true);
  }

  private setDeveloperWave(nextWave: number) {
    if (!this.developerMode.options.enabled || this.phase !== 'battle') return;
    this.wave = clamp(Math.floor(nextWave), 1, this.wavesPerFloor());
    this.developerWaveOverride = this.wave;
    this.waveTimer = 0;
    this.waveSpawned = 0;
    this.spawnTimer = 0.1;
    this.waveBossSpawned = false;
    this.enemies.forEach((enemy) => enemy.node.destroy());
    this.enemies = [];
    this.clearDrops();
    this.updateHud();
  }

  private clearDeveloperWave() {
    if (!this.developerMode.options.enabled || this.phase !== 'battle') return;
    this.enemies.forEach((enemy) => enemy.node.destroy());
    this.enemies = [];
    this.clearDrops();
    this.waveTimer = this.waveLength;
    this.waveSpawned = this.spawnBudgetForWave();
    this.beginWaveCleanup();
  }

  private setDeveloperControls(next: { floor?: number; wave?: number; godMode?: boolean; autoClear?: boolean; gameSpeed?: number }) {
    if (!this.developerMode.options.enabled) return { enabled: false };
    const normalized = this.developerMode.applyControls(next);
    if (normalized.floor !== undefined) {
      this.floor = normalized.floor;
      this.developerWaveOverride = normalized.wave;
    }
    if (normalized.wave !== undefined) {
      this.developerWaveOverride = normalized.wave;
      if (this.phase === 'battle') this.setDeveloperWave(normalized.wave);
    }
    if (normalized.godMode !== undefined) this.developerGodMode = normalized.godMode;
    if (normalized.autoClear !== undefined) this.developerAutoClear = normalized.autoClear;
    if (next.gameSpeed !== undefined && Number.isFinite(next.gameSpeed)) this.gameSpeed = clamp(next.gameSpeed, 0.25, 8);
    return {
      enabled: true,
      floor: this.floor,
      wave: this.wave,
      godMode: this.developerGodMode,
      autoClear: this.developerAutoClear,
      gameSpeed: this.gameSpeed,
    };
  }

  private async ensurePlayerIdentity() {
    if (this.playerIdentityLoaded) return this.playerNickname;
    try {
      const player = await buildaPlatform.whoami();
      if (player?.name.trim()) this.playerNickname = player.name.trim().slice(0, 14);
    } catch {
      // The standalone browser preview has no host identity; keep the local patient label.
    }
    this.playerIdentityLoaded = true;
    return this.playerNickname;
  }

  private async loadDailyBoard() {
    if (this.dailyBoardLoaded) return;
    this.dailyBoard = [];
    this.dailySelfRank = undefined;
    try {
      const result = await buildaPlatform.getRankList('daily_night', 20);
      const list = result && Array.isArray(result.list) ? result.list : [];
      if (result?.self && Number.isFinite(result.self.rank) && Number.isFinite(result.self.score)) {
        this.dailySelfRank = {
          rank: Math.max(1, Math.floor(result.self.rank)),
          score: Math.round(result.self.score),
        };
      }
      if (list.length > 0) {
        this.dailyBoard = list.slice(0, 20).flatMap((entry: { rank: number; player?: { name?: string }; score: number }) => {
          const name = entry.player?.name?.trim();
          if (!name || !Number.isFinite(entry.rank) || !Number.isFinite(entry.score)) return [];
          return [{
            rank: Math.max(1, Math.floor(entry.rank)),
            name: name.slice(0, 14),
            score: Math.round(entry.score),
          }];
        });
      }
    } catch {
      // Standalone previews have no host board; an empty board is intentional.
    }
    this.dailyBoardLoaded = true;
  }

  private dailyScoreForTime(seconds: number) {
    return Math.max(1, Math.round(100000 - Math.max(1, seconds) * 100));
  }

  private formatDailyTime(seconds?: number) {
    if (!seconds || !Number.isFinite(seconds)) return '未通关';
    const total = Math.max(0, Math.round(seconds));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  private dailyPlayerRankLabel(board: DailyBoardEntry[]) {
    if (this.dailySelfRank) return `第${this.dailySelfRank.rank}名`;
    const ownEntry = board.find((entry) => entry.name === this.playerNickname);
    return ownEntry ? `第${Math.max(1, ownEntry.rank)}名` : '未上榜';
  }

  private async submitDailyScore(seconds: number) {
    try {
      await buildaPlatform.submitScore('daily_night', this.dailyScoreForTime(seconds));
    } catch {
      // Score submission is best effort; the local fastest record is still stored.
    }
    this.dailyBoardLoaded = false;
  }

  private todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private monthKey() {
    return this.todayKey().slice(0, 7);
  }

  private monthlyChallenge(): MonthlyChallengeConfig {
    return monthlyChallengeForMonth(this.monthKey());
  }

  private rewardNameForId(id: string) {
    return this.skins.find((skin) => skin.id === id)?.name
      ?? this.weaponSkins.find((skin) => skin.id === id)?.name
      ?? id;
  }

  private applyMonthlyRankReward(rank: number) {
    const config = this.monthlyChallenge();
    const ids = monthlyRewardIdsForRank(config, rank);
    ids.forEach((id) => {
      if (this.skins.some((skin) => skin.id === id) && !this.progress.unlockedSkinIds.includes(id)) {
        this.progress.unlockedSkinIds.push(id);
      }
      if (this.weaponSkins.some((skin) => skin.id === id) && !this.progress.unlockedWeaponSkinIds.includes(id)) {
        this.progress.unlockedWeaponSkinIds.push(id);
      }
    });
    const title = ids.find((id) => id.startsWith('title-'));
    if (title) this.progress.dailyRewardTitle = title;
    return ids;
  }

  private isDailyCompleted() {
    return this.progress.dailyCompletedDate?.slice(0, 7) === this.monthKey();
  }

  private currentMonthDailyBestSeconds() {
    return this.isDailyCompleted() ? this.progress.dailyBestSeconds : undefined;
  }

  private dailyAttemptsUsed() {
    const currentMonth = this.monthKey();
    const attemptMonth = this.progress.dailyAttemptMonth ?? this.progress.dailyAttemptDate?.slice(0, 7);
    if (attemptMonth !== currentMonth) return 0;
    return Math.max(0, Math.floor(this.progress.dailyAttempts ?? 0));
  }

  private dailyAdTicketsAvailable() {
    return Math.max(0, Math.floor(this.progress.dailyAdTickets ?? 0));
  }

  private async startDailyAttempt(weaponId: string) {
    const today = this.todayKey();
    const month = this.monthKey();
    let attempts = this.dailyAttemptsUsed();
    if (attempts >= 3) {
      let adTickets = this.dailyAdTicketsAvailable();
      if (adTickets <= 0) {
        if (!buildaPlatform.sdk?.ad?.showRewardAd) {
          this.showDailyChallenge('免费次数已用完，当前环境未接入激励广告');
          return;
        }
        try {
          if (!await buildaPlatform.showRewardAd('daily_challenge_attempt')) {
            this.showDailyChallenge('广告未完成，本次未增加挑战次数');
            return;
          }
          adTickets += 1;
        } catch {
          this.showDailyChallenge('激励广告暂不可用，本次未进入');
          return;
        }
      }
      adTickets -= 1;
      this.progress.dailyAdTickets = adTickets;
    }
    attempts += 1;
    this.progress.dailyAttemptDate = today;
    this.progress.dailyAttemptMonth = month;
    this.progress.dailyAttempts = attempts;
    this.saveProgress();
    this.startRun(1, 'daily', weaponId);
  }

  private isWeaponUnlocked(id: string) {
    // 教程是展示局，临时开放武器成长路线，但不写入玩家档案。
    return this.tutorialRun || this.progress.unlockedWeaponIds.includes(id);
  }

  private createWeaponRoster(): Weapon[] {
    return [
      { id: 'knife', name: '病院刀', glyph: '刀', weaponClass: 'sword', type: 'melee', effect: 'slash', color: 0xed716e, damage: WEAPON_DAMAGE.knife, cooldown: 0.42, range: 90, rotationSpeed: 4.8, level: 1, copies: 1, ammo: 1, owned: true },
      { id: 'ward-lantern', name: '病房灯枪', glyph: '枪', weaponClass: 'gun', type: 'ranged', effect: 'spark', color: 0xf2bf62, damage: WEAPON_DAMAGE.wardLantern, cooldown: 0.72, range: 420, rotationSpeed: 3.8, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'thorn', name: '荆棘长鞭', glyph: '鞭', weaponClass: 'whip', type: 'melee', effect: 'tentacle', color: 0x8fd17c, damage: WEAPON_DAMAGE.thorn, cooldown: 0.64, range: 100, rotationSpeed: 5.6, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'echo', name: '回声炮', glyph: '炮', weaponClass: 'cannon', type: 'ranged', effect: 'burst', color: 0xb798e2, damage: WEAPON_DAMAGE.echo, cooldown: 0.62, range: 500, rotationSpeed: 4.4, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'crown', name: '冠冕雷炮', glyph: '雷', weaponClass: 'cannon', type: 'ranged', effect: 'beam', color: 0xe5d47a, damage: WEAPON_DAMAGE.crown, cooldown: 0.58, range: 560, rotationSpeed: 5.2, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'flesh-tentacle', name: '血肉触手', glyph: '触', weaponClass: 'whip', type: 'melee', effect: 'tentacle', color: 0x9a6bd1, damage: WEAPON_DAMAGE.fleshTentacle, cooldown: 0.58, range: 104, rotationSpeed: 5.1, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'laser-eye', name: '激光眼', glyph: '眼', weaponClass: 'gun', type: 'ranged', effect: 'laser', color: 0xf06eaa, damage: WEAPON_DAMAGE.laserEye, cooldown: 0.7, range: 560, rotationSpeed: 4.9, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'sanity-bomb', name: '理智炸弹', glyph: '弹', weaponClass: 'cannon', type: 'ranged', effect: 'bomb', color: 0xe78a57, damage: WEAPON_DAMAGE.sanityBomb, cooldown: 0.86, range: 520, rotationSpeed: 4.2, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'void-scissors', name: '虚空剪', glyph: '剪', weaponClass: 'sword', type: 'melee', effect: 'void', color: 0x6b83e8, damage: WEAPON_DAMAGE.voidScissors, cooldown: 0.52, range: 112, rotationSpeed: 6.0, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'neon-orbit', name: '霓虹轨道', glyph: '轨', weaponClass: 'gun', type: 'ranged', effect: 'neon', color: 0x49e5c2, damage: WEAPON_DAMAGE.neonOrbit, cooldown: 0.56, range: 620, rotationSpeed: 5.6, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'abyss-drill', name: '深渊钻', glyph: '钻', weaponClass: 'sword', type: 'melee', effect: 'burst', color: 0xd7d7e8, damage: WEAPON_DAMAGE.abyssDrill, cooldown: 0.5, range: 122, rotationSpeed: 6.4, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'star-cannon', name: '星骸炮', glyph: '星', weaponClass: 'cannon', type: 'ranged', effect: 'beam', color: 0x7ab9d0, damage: WEAPON_DAMAGE.starCannon, cooldown: 0.68, range: 700, rotationSpeed: 4.6, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'dream-mine', name: '梦魇雷', glyph: '雷', weaponClass: 'cannon', type: 'ranged', effect: 'bomb', color: 0xf2bf62, damage: WEAPON_DAMAGE.dreamMine, cooldown: 0.78, range: 620, rotationSpeed: 4.8, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'eldritch-whip', name: '古神鞭', glyph: '鞭', weaponClass: 'whip', type: 'melee', effect: 'tentacle', color: 0xb46be0, damage: WEAPON_DAMAGE.eldritchWhip, cooldown: 0.44, range: 138, rotationSpeed: 6.7, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'skull-rail', name: '颅骨轨炮', glyph: '轨', weaponClass: 'gun', type: 'ranged', effect: 'laser', color: 0xff8fba, damage: WEAPON_DAMAGE.skullRail, cooldown: 0.62, range: 760, rotationSpeed: 5.0, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'cosmic-mortar', name: '宇宙迫击炮', glyph: '陨', weaponClass: 'cannon', type: 'ranged', effect: 'bomb', color: 0xd99263, damage: WEAPON_DAMAGE.cosmicMortar, cooldown: 0.84, range: 820, rotationSpeed: 4.1, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'god-eye', name: '神之眼', glyph: '眼', weaponClass: 'gun', type: 'ranged', effect: 'laser', color: 0xffd86f, damage: WEAPON_DAMAGE.godEye, cooldown: 0.55, range: 860, rotationSpeed: 5.4, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'hospital-core', name: '医院核心', glyph: '核', weaponClass: 'cannon', type: 'ranged', effect: 'beam', color: 0xc7f4e8, damage: WEAPON_DAMAGE.hospitalCore, cooldown: 0.5, range: 920, rotationSpeed: 5.8, level: 0, copies: 0, ammo: 1, owned: false },
    ];
  }

  private showWeaponSelect(mode: RunMode, targetFloor = this.floor) {
    if (!this.ensureAssetGroup('weapon', () => this.showWeaponSelect(mode, targetFloor))) return;
    this.normalizeTemporaryUnlocks();
    this.phase = 'weapon-select';
    this.runMode = mode;
    this.selectedStartFloor = clamp(Math.round(targetFloor), mode === 'mainline' ? 0 : 1, TOTAL_FLOORS);
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    const background = this.textures.exists('weapon-select-background-v1')
      ? this.add.image(W / 2, H / 2, 'weapon-select-background-v1').setOrigin(0.5).setDisplaySize(W, H)
      : this.add.image(W / 2, H / 2, 'menu-ward-night-v1').setOrigin(0.5).setDisplaySize(W, H);
    layer.add(background.setAlpha(0.98));
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02070b, 0.16));

    const baseWeapons = this.createWeaponRoster().slice(0, 4);
    const categoryMeta: Record<WeaponClass, { label: string; icon: string }> = {
      sword: { label: '剑', icon: 'weapon-category-melee' },
      gun: { label: '枪', icon: 'weapon-category-ranged' },
      whip: { label: '鞭', icon: 'weapon-category-magic' },
      cannon: { label: '炮', icon: 'weapon-category-heavy' },
    };
    const selectedWeapon = baseWeapons.find((weapon) => weapon.id === this.selectedWeaponId) ?? baseWeapons[0];
    if (!selectedWeapon) return;
    if (this.weaponSkinPageWeaponClass !== selectedWeapon.weaponClass) {
      this.weaponSkinPageWeaponClass = selectedWeapon.weaponClass;
      this.weaponSkinPage = 0;
    }
    const weaponSkins = this.weaponSkinsFor(selectedWeapon.weaponClass);
    const weaponSkinPageCount = Math.max(1, Math.ceil(weaponSkins.length / 3));
    this.weaponSkinPage = clamp(this.weaponSkinPage, 0, weaponSkinPageCount - 1);
    const pageSkins = weaponSkins.slice(this.weaponSkinPage * 3, this.weaponSkinPage * 3 + 3);
    if (!this.weaponSelectPreviewSkinId || !this.weaponSkins.some((skin) => skin.id === this.weaponSelectPreviewSkinId && skin.weaponClass === selectedWeapon.weaponClass)) {
      this.weaponSelectPreviewSkinId = this.equippedWeaponSkin(selectedWeapon.weaponClass).id;
    }
    const selectedSkin = this.weaponSkins.find((skin) => skin.id === this.weaponSelectPreviewSkinId) ?? this.equippedWeaponSkin(selectedWeapon.weaponClass);
    const selectedSkinUnlocked = this.isWeaponSkinAvailable(selectedSkin.id);
    const equippedSkin = this.equippedWeaponSkin(selectedWeapon.weaponClass);
    const accent = mode === 'daily' ? 0xb798e2 : 0x6bd3c1;

    layer.add(this.add.text(centerX, this.safeTopY(48, 8), '武器皮肤', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '29px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));

    // Four weapon categories share one compact row above the preview. Keeping
    // the entries in a stable row makes the selection scanable on phones and
    // leaves the large weapon preview free of overlapping touch targets.
    baseWeapons.forEach((weapon, index) => {
      const meta = categoryMeta[weapon.weaponClass];
      const unlocked = this.isWeaponUnlocked(weapon.id) || (mode === 'mainline' && weapon.id === 'knife');
      const categoryStartX = 232 + layoutShift;
      const categoryGap = 144;
      const x = categoryStartX + index * categoryGap;
      const y = 112;
      const button = this.add.container(x, y);
      const selected = weapon.id === selectedWeapon.id;
      if (this.textures.exists(meta.icon)) {
        if (selected) {
          button.add(this.fitImageToBox(
            this.add.image(0, -11, meta.icon).setOrigin(0.5),
            104,
            104,
          ).setTint(accent).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD));
        }
        button.add(this.fitImageToBox(
          this.add.image(0, -11, meta.icon).setOrigin(0.5),
          92,
          92,
        ).setAlpha(unlocked ? 0.98 : 0.45));
      }
      button.add(this.add.text(0, 48, meta.label, { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(15)}px`, color: selected ? palette.cream : unlocked ? palette.muted : '#506167' }).setOrigin(0.5).setFontStyle('bold'));
      layer.add(button);
      this.uiActionRegions.push({
        phase: this.phase,
        x,
        y,
        width: 126,
        height: 116,
        callback: () => {
          if (!unlocked || (mode === 'daily' && !this.isWeaponUnlocked(weapon.id))) return;
          this.selectedWeaponId = weapon.id;
          this.weaponSkinPage = 0;
          this.weaponSkinPageWeaponClass = weapon.weaponClass;
          this.weaponSelectPreviewSkinId = this.equippedWeaponSkin(weapon.weaponClass).id;
          this.showWeaponSelect(mode, this.selectedStartFloor);
        },
        setPressed: (pressed) => button.setScale(pressed ? 0.96 : 1),
      });
    });

    const mainX = 510 + layoutShift;
    const mainFrame = this.add.image(0, 0, 'weapon-select-frame-main-v1').setOrigin(0.5);
    const mainFrameWidth = 520;
    const mainFrameScale = mainFrameWidth / Math.max(1, mainFrame.width);
    const mainFrameHeight = mainFrame.height * mainFrameScale;
    // 主预览框和右侧皮肤面板共享顶部基线，避免不同素材比例造成上下错位。
    const frameTopY = 170;
    const main = this.add.container(mainX, frameTopY + mainFrameHeight / 2);
    main.add(mainFrame.setScale(mainFrameScale).setAlpha(0.98));
    const mainImage = this.fitImageToBox(
      this.add.image(0, 0, this.weaponSkinTextureKey(selectedSkin)).setOrigin(0.5),
      300,
      300,
    );
    main.add(mainImage);
    layer.add(main);

    const skinPanelGap = 18;
    const mainFrameRight = mainX + mainFrameWidth / 2;
    const skinPanelWidth = Math.min(540, Math.max(320, safe.right - mainFrameRight - skinPanelGap));
    const skinPanelX = safe.right - skinPanelWidth / 2;
    const hasSkinPanelFrame = this.textures.exists('weapon-select-frame-skin-panel-v1');
    const skinPanelFrameImage = hasSkinPanelFrame
      ? this.add.image(0, 0, 'weapon-select-frame-skin-panel-v1').setOrigin(0.5)
      : undefined;
    const skinPanelScale = skinPanelFrameImage ? skinPanelWidth / skinPanelFrameImage.width : 1;
    const skinPanelHeight = skinPanelFrameImage ? skinPanelFrameImage.height * skinPanelScale : 296;
    const skinPanelTopY = frameTopY + 18;
    const skinPanelY = skinPanelTopY + skinPanelHeight / 2;
    const skinPanelFrame = this.add.container(skinPanelX, skinPanelY);
    skinPanelFrame.add(this.add.rectangle(0, 0, skinPanelWidth, skinPanelHeight, 0x071117, 0.74));
    if (skinPanelFrameImage) {
      skinPanelFrame.add(skinPanelFrameImage.setScale(skinPanelScale).setAlpha(0.98));
    } else {
      skinPanelFrame.add(this.add.rectangle(0, 0, skinPanelWidth, skinPanelHeight, 0x071117, 0).setStrokeStyle(2, accent, 0.9));
    }
    layer.add(skinPanelFrame);
    const skinGridColumnGap = Math.min(146, skinPanelWidth * 0.27);
    const skinGridTop = skinPanelTopY + 126;
    const skinGridRowGap = 104;
    const skinCardImageSize = this.compactUi() ? 122 : 142;
    pageSkins.forEach((skin, index) => {
      const column = index % 3;
      const row = 0;
      const x = skinPanelX - skinGridColumnGap + column * skinGridColumnGap;
      const y = skinGridTop + row * skinGridRowGap;
      const unlocked = this.isWeaponSkinAvailable(skin.id);
      const selected = skin.id === selectedSkin.id;
      const card = this.add.container(x, y);
      const weaponImage = this.add.image(0, -5, this.weaponSkinTextureKey(skin))
        .setOrigin(0.5)
        .setAlpha(unlocked ? 0.98 : 0.42);
      this.fitImageToBox(weaponImage, skinCardImageSize, skinCardImageSize);
      card.add(weaponImage);
      if (!unlocked) {
        card.add(this.add.rectangle(0, -4, 132, skinCardImageSize, 0x05090f, 0.36));
        card.add(this.add.text(0, -4, '锁定', { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(13)}px`, color: palette.amber }).setOrigin(0.5));
      }
      const skinLabelWidth = this.compactUi() ? Math.max(112, Math.round(skinGridColumnGap * 0.98)) : 184;
      const skinLabelOffset = this.compactUi() ? 16 : 30;
      card.add(this.add.text(0, skinCardImageSize / 2 + skinLabelOffset, this.uiLabel(skin.name, 4), {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${this.uiFontSize(19, 1.2)}px`,
        color: selected ? hex(accent) : unlocked ? palette.cream : palette.muted,
        wordWrap: { width: skinLabelWidth },
        align: 'center',
        lineSpacing: 1,
      }).setOrigin(0.5).setFixedSize(skinLabelWidth, 78).setFontStyle('bold'));
      layer.add(card);
      this.uiActionRegions.push({
        phase: this.phase,
        x,
        y,
        width: 150,
        height: 132,
        callback: () => { this.weaponSelectPreviewSkinId = skin.id; this.showWeaponSelect(mode, this.selectedStartFloor); },
        setPressed: (pressed) => card.setScale(pressed ? 0.96 : 1),
      });
    });
    if (weaponSkinPageCount > 1) {
      const pageY = skinPanelTopY + skinPanelHeight - (this.compactUi() ? 6 : 32);
      const pageControlOffset = Math.min(108, skinPanelWidth * 0.22);
      if (this.weaponSkinPage > 0) {
        this.addImageAction(layer, skinPanelX - pageControlOffset, pageY, 68, 68, 'profile-arrow-left-v1', () => this.setWeaponSkinPage(this.weaponSkinPage - 1, weaponSkinPageCount), 10, 1, 0.92);
      }
      if (this.weaponSkinPage < weaponSkinPageCount - 1) {
        this.addImageAction(layer, skinPanelX + pageControlOffset, pageY, 68, 68, 'profile-arrow-right-v1', () => this.setWeaponSkinPage(this.weaponSkinPage + 1, weaponSkinPageCount), 10, 1, 0.92);
      }
      layer.add(this.add.text(skinPanelX, pageY, `${this.weaponSkinPage + 1} / ${weaponSkinPageCount}`, {
        fontFamily: 'Courier New',
        fontSize: `${this.uiFontSize(16)}px`,
        color: palette.cream,
        stroke: '#071015',
        strokeThickness: 2,
      }).setOrigin(0.5).setFontStyle('bold'));
    }

    const actionY = this.safeBottomY(frameTopY + mainFrameHeight + 24, 40);
    const actionLeftX = mainX - 154;
    const actionRightX = mainX + 154;
    const adActionX = actionLeftX + 132;
    if (!selectedSkinUnlocked) {
      if (selectedSkin.category === 'boss') {
        this.addWeaponSelectImageButton(layer, actionLeftX, actionY, 212, 46, 'weapon-select-frame-action-buy-v1', '首领掉落', () => undefined, 0x46636a);
      } else {
        this.addWeaponSelectImageButton(layer, actionLeftX, actionY, 212, 46, 'weapon-select-frame-action-buy-v1', `购买 ${selectedSkin.cost}`, () => this.buyWeaponSkin(selectedSkin.id, mode), accent);
      }
      if (this.textures.exists('ad-reward-v1')) {
        this.addImageAction(layer, adActionX, actionY, 44, 44, 'ad-reward-v1', () => { void this.watchWeaponSkinAd(selectedSkin.id, mode); }, 10);
      }
      layer.add(this.add.text(adActionX, actionY + 34, '看广告免费体验一天', {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${this.uiFontSize(9)}px`,
        color: palette.amber,
        stroke: '#071015',
        strokeThickness: 2,
        wordWrap: { width: 120 },
        align: 'center',
      }).setOrigin(0.5));
      if (this.weaponSkinAdMessage) layer.add(this.add.text(adActionX, actionY + 54, this.weaponSkinAdMessage, {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${this.uiFontSize(9)}px`,
        color: palette.danger,
        stroke: '#071015',
        strokeThickness: 2,
        wordWrap: { width: 170 },
        align: 'center',
      }).setOrigin(0.5));
    } else {
      this.addWeaponSelectImageButton(layer, actionLeftX, actionY, 212, 46, 'weapon-select-frame-action-buy-v1', selectedSkin.id === equippedSkin.id ? '已装备' : '装备皮肤', () => {
        this.equipWeaponSkin(selectedSkin.id);
        this.showWeaponSelect(mode, this.selectedStartFloor);
      }, selectedSkin.id === equippedSkin.id ? 0x46636a : accent);
      this.addWeaponSelectImageButton(layer, actionRightX, actionY, 212, 46, 'weapon-select-frame-action-equip-v1', '进入战斗', () => {
        this.equipWeaponSkin(selectedSkin.id);
        if (mode === 'daily') void this.startDailyAttempt(selectedWeapon.id);
        else this.startRun(this.selectedStartFloor, mode, selectedWeapon.id);
      }, accent);
    }
    this.addButton(layer, 88, 38, 52, 44, '返回主界面', () => {
      if (mode === 'daily') this.showDailyChallenge();
      else this.showMainline(this.selectedStartFloor);
    }, 'muted', 12);
    this.overlay = layer;
  }

  private showStart() {
    // Menu pages are viewport UI. Reset the battle camera so a previous
    // follow/zoom state cannot leave the canvas visually reduced after exit.
    this.cameras.main.stopFollow();
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    this.phase = 'start';
    this.bossPreviewActive = false;
    this.ui?.setVisible(false);
    this.clearOverlay();
    document.getElementById('game-shell')?.classList.add('menu-shell');
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addMenuBackdrop(layer);
    // 病历档案入口对应玩家信息页，怪物图鉴暂时保留在内部供后续接入。
    const safe = this.safeGameRect(12);
    const buttonHeight = 108;
    const buttonGap = 16;
    const lastButtonY = safe.bottom - buttonHeight / 2 - 12;
    const firstButtonY = lastButtonY - (buttonHeight + buttonGap) * 2;
    this.addDeveloperPanel(layer, false);
    this.addMenuImageButton(layer, safe.centerX, firstButtonY, 330, buttonHeight, 'menu-button-archive-v1', '病历档案', () => this.showProfile());
    this.addMenuImageButton(layer, safe.centerX, firstButtonY + buttonHeight + buttonGap, 330, buttonHeight, 'menu-button-mainline-v1', '主线通关', () => this.showMainline(this.progress.tutorialCompleted ? this.floor : 0));
    this.addMenuImageButton(layer, safe.centerX, lastButtonY, 330, buttonHeight, 'menu-button-daily-v1', '每日挑战', () => this.showDailyChallenge());
    this.overlay = layer;
  }

  private addWeaponSelectImageButton(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, textureKey: string, label: string, callback: () => void, accent: number) {
    const button = this.add.container(x, y);
    const image = this.add.image(0, 0, textureKey).setOrigin(0.5).setDisplaySize(width, height).setAlpha(0.98);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(width < 190 ? 13 : 14, 1.35)}px`, color: palette.cream, stroke: '#080d11', strokeThickness: 4,
    }).setOrigin(0.5).setFontStyle('bold');
    button.add([image, text]);
    const setPressed = (pressed: boolean) => {
      button.setScale(pressed ? 0.96 : 1);
      image.setTint(pressed ? Phaser.Display.Color.IntegerToColor(accent).lighten(18).color : 0xffffff);
      text.setAlpha(pressed ? 0.78 : 1);
    };
    parent.add(button);
    this.uiActionRegions.push({ phase: this.phase, x, y, width: width + 18, height: height + 18, callback, setPressed });
    return button;
  }

  private addMenuBackdrop(layer: Phaser.GameObjects.Container) {
    const background = this.add.image(W / 2, H / 2, 'menu-background-v1').setOrigin(0.5);
    const backgroundScale = Math.max(W / background.width, H / background.height);
    background.setDisplaySize(background.width * backgroundScale, background.height * backgroundScale).setAlpha(0.98);
    layer.add(background);
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02070b, 0.14));
    const title = this.add.image(W / 2, 0, 'menu-title-v2').setOrigin(0.5, 0);
    const titleWidth = Math.min(1120, W - 36);
    title.setDisplaySize(titleWidth, titleWidth * title.height / title.width);
    layer.add(title);
    layer.add(this.add.rectangle(W / 2, H - 18, W, 36, 0x02070b, 0.42));
  }

  private addMenuImageButton(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, textureKey: string, label: string, callback: () => void) {
    const button = this.add.container(x, y);
    const image = this.add.image(0, 0, textureKey).setOrigin(0.5).setDisplaySize(width, height);
    const crops: Record<string, { x: number; y: number; width: number; height: number }> = {
      'menu-button-archive-v1': { x: 28, y: 47, width: 967, height: 444 },
      'menu-button-mainline-v1': { x: 28, y: 12, width: 967, height: 374 },
      'menu-button-daily-v1': { x: 27, y: 1, width: 970, height: 416 },
    };
    const crop = crops[textureKey];
    if (crop) image.setCrop(crop.x, crop.y, crop.width, crop.height);
    const textureLabels: Record<string, string> = {
      'menu-button-archive-v1': 'ui-text-archive-v1',
      'menu-button-mainline-v1': 'ui-text-mainline-v1',
      'menu-button-daily-v1': 'ui-text-daily-v1',
    };
    const expectedTextureLabels: Record<string, string> = {
      'menu-button-archive-v1': '档案',
      'menu-button-mainline-v1': '主线通关',
      'menu-button-daily-v1': '每日挑战',
    };
    const textTextureKey = textureLabels[textureKey];
    const labelNode = textTextureKey && this.textures.exists(textTextureKey)
      && expectedTextureLabels[textureKey] === label
      ? this.add.image(0, 0, textTextureKey).setOrigin(0.5).setDisplaySize(190, 76)
      : this.add.text(0, 0, label, {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${this.uiFontSize(23)}px`,
        color: palette.cream,
        stroke: '#080d11',
        strokeThickness: 5,
      }).setOrigin(0.5).setFontStyle('bold');
    button.add([image, labelNode]);
    const setPressed = (pressed: boolean) => {
      button.setScale(pressed ? 0.96 : 1);
      image.setTint(pressed ? 0xc6d8d0 : 0xffffff);
      labelNode.setAlpha(pressed ? 0.82 : 1);
    };
    parent.add(button);
    this.uiActionRegions.push({
      phase: this.phase,
      x,
      y,
      width: width + 24,
      height: Math.max(48, height + 4),
      callback,
      setPressed,
    });
    return button;
  }

  private showMainlineLegacy(targetFloor = this.floor) {
    this.phase = 'mainline-select';
    this.runMode = 'mainline';
    this.ui?.setVisible(false);
    this.selectedStartFloor = clamp(Math.round(targetFloor), 1, Math.min(TOTAL_FLOORS, this.progress.maxFloor));
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'mainline-background-v1', 0.58);
    this.drawMenuMotif(layer);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    this.addPixelFrame(layer, centerX, 360, 1120, 620, 0x101b24, 0x6bd3c1);
    const selected = this.selectedStartFloor;
    layer.add(this.add.text(centerX, this.safeTopY(92, 18), '主线通关', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '28px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(centerX, this.safeTopY(126, 18), 'MAINLINE / PATIENT ROUTE', { fontFamily: 'Courier New', fontSize: '11px', color: palette.cyan }).setOrigin(0.5));
    layer.add(this.add.rectangle(centerX, this.safeTopY(153, 18), Math.min(1000, safe.width), 1, 0x46636a, 0.75));

    const progressPanel = this.add.container(345 + layoutShift, 365);
    progressPanel.add(this.add.rectangle(0, 0, 500, 430, 0x0a141b, 0.96).setStrokeStyle(2, 0x6bd3c1, 0.88));
    progressPanel.add(this.add.text(-220, -184, '通关记录', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.cyan }).setFontStyle('bold'));
    progressPanel.add(this.add.text(-220, -138, `第 ${this.progress.maxFloor} / ${TOTAL_FLOORS} 层`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '30px', color: palette.cream }).setFontStyle('bold'));
    progressPanel.add(this.add.text(-220, -98, `已开放 ${this.progress.maxFloor} 层`, { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.green }));
    const progressBar = this.add.graphics();
    progressBar.fillStyle(0x26383f, 1).fillRect(-220, -62, 440, 12);
    progressBar.fillStyle(0x6bd3c1, 1).fillRect(-220, -62, 440 * clamp(this.progress.maxFloor / TOTAL_FLOORS, 0, 1), 12);
    progressPanel.add(progressBar);
    progressPanel.add(this.add.text(-220, -22, '当前入场', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.muted }));
    progressPanel.add(this.add.text(-220, 20, `第 ${selected} 层`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '32px', color: palette.amber }).setFontStyle('bold'));
    progressPanel.add(this.add.text(-220, 64, `${selected === 1 ? '旧住院部' : '封锁病区'}  /  ${this.wavesPerFloor()} 波`, { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.cream }));
    progressPanel.add(this.add.text(-220, 96, `病历编号 ${String(selected).padStart(4, '0')}`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '12px', color: palette.cyan }));
    layer.add(progressPanel);
    this.addButton(layer, 345 + layoutShift, this.safeBottomY(565, 60), 250, 48, `进入第 ${selected} 层`, () => this.showWeaponSelect('mainline', selected), 'primary', 10);

    const floorPanel = this.add.container(890 + layoutShift, 365);
    floorPanel.add(this.add.rectangle(0, 0, 510, 430, 0x0a141b, 0.96).setStrokeStyle(2, 0x46636a, 0.9));
    floorPanel.add(this.add.text(-230, -184, '选择楼层', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.cream }).setFontStyle('bold'));
    floorPanel.add(this.add.text(230, -184, `${this.progress.maxFloor} / ${TOTAL_FLOORS}`, { fontFamily: 'Courier New', fontSize: '13px', color: palette.green }).setOrigin(1, 0));
    layer.add(floorPanel);
    const previewStart = clamp(selected <= 5 ? 1 : selected - 4, 1, Math.max(1, TOTAL_FLOORS - 9));
    for (let offset = 0; offset < 10; offset += 1) {
      const floor = previewStart + offset;
      const column = offset % 2;
      const row = Math.floor(offset / 2);
      const x = -125 + column * 250;
      const y = -130 + row * 58;
      const unlocked = floor <= this.progress.maxFloor;
      if (unlocked) {
        this.addButton(layer, 890 + layoutShift + x, 365 + y, 208, 40, `${String(floor).padStart(2, '0')}  ${floor === selected ? '当前' : '已开放'}`, () => this.showMainline(floor), floor === selected ? 'primary' : 'muted', 6);
      } else {
        floorPanel.add(this.add.rectangle(x, y, 208, 40, 0x1b2930, 0.72).setStrokeStyle(1, 0x3b5158, 0.8));
        floorPanel.add(this.add.text(x, y, `${String(floor).padStart(2, '0')}  封锁`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '12px', color: palette.muted }).setOrigin(0.5));
      }
    }
    this.addButton(layer, 88, 38, 150, 42, '返回主界面', () => this.showStart(), 'muted', 8);
    this.overlay = layer;
  }

  private floorLabel(floor: number) {
    return floor === 0 ? '入口' : `第${floor}层`;
  }

  private floorZoneLabel(floor: number) {
    if (floor === 0) return '新手病区 / 入口大厅';
    if (floor <= 5) return '旧住院部 / 东翼';
    if (floor <= 12) return '异化病区 / 中庭';
    if (floor <= 20) return '深层病区 / 观测层';
    return '禁闭病区 / 深渊层';
  }

  private floorEnemyKinds(floor: number): EnemyKind[] {
    if (floor === 0) return ['chaser', 'shooter', 'disruptor', 'tentacle', 'bomber', 'eye'];
    const kinds: EnemyKind[] = ['chaser', 'shooter'];
    if (floor >= 4) kinds.push('disruptor');
    if (floor >= 7) kinds.push('tentacle', 'miniBoss');
    if (floor >= 12) kinds.push('bomber');
    if (floor >= 18) kinds.push('eye');
    if (floor >= TOTAL_FLOORS) kinds.push('boss');
    return kinds;
  }

  private enemyPreviewLabel(kind: EnemyKind) {
    const labels: Record<EnemyKind, string> = {
      chaser: '骨骸病患',
      shooter: '梦魇注视',
      disruptor: '潮汐护士',
      tentacle: '触手寄生体',
      bomber: '裂口爆体',
      eye: '异化眼球',
      miniBoss: '巡夜首领',
      boss: '楼层首领',
    };
    return labels[kind];
  }

  private addFloorEnemyPreview(parent: Phaser.GameObjects.Container, x: number, y: number, kind: EnemyKind, floor: number) {
    const card = this.add.container(x, y);
    const accent = kind === 'boss' || kind === 'miniBoss' ? paletteRgb.danger : paletteRgb.cyan;
    const cardWidth = 150;
    const cardHeight = 128;
    // 素材框底部预留名称栏，首领立绘高度更大，分别设置中心位置避免遮挡名称。
    const portraitCenterY = kind === 'boss' || kind === 'miniBoss' ? -4 : 0;
    if (this.textures.exists('mainline-floor-enemy-frame-v1')) {
      card.add(this.add.image(0, 0, 'mainline-floor-enemy-frame-v1').setOrigin(0.5).setDisplaySize(cardWidth, cardHeight).setAlpha(0.98));
    } else {
      card.add(this.add.rectangle(0, 0, cardWidth, cardHeight, 0x071117, 0.9).setStrokeStyle(1, accent, 0.62));
    }
    let sprite: Phaser.GameObjects.Sprite | undefined;
    if (kind === 'boss' || kind === 'miniBoss') {
      const key = kind === 'boss'
        ? MOON_MOTH_QUEEN_ART.portraitKey
        : MAINLINE_BOSS_ART_VARIANT_LIST[Math.abs(Math.floor(floor)) % MAINLINE_BOSS_ART_VARIANT_LIST.length]?.portraitKey;
      if (this.textures.exists(key)) {
        sprite = this.add.sprite(0, portraitCenterY, key, 0).setOrigin(0.5);
        const targetHeight = 84;
        sprite.setDisplaySize(targetHeight * sprite.width / Math.max(1, sprite.height), targetHeight);
      }
    } else {
      const artKey = smallEnemyArtForFloor(kind as SmallEnemyKind, floor);
      if (artKey && this.textures.exists(artKey)) {
        sprite = this.add.sprite(0, portraitCenterY, artKey, 0).setOrigin(0.5);
        const targetHeight = 74;
        sprite.setDisplaySize(targetHeight * sprite.width / Math.max(1, sprite.height), targetHeight);
      }
    }
    if (sprite) card.add(sprite);
    else card.add(this.add.circle(0, portraitCenterY, 23, kind === 'boss' ? 0x7e2e51 : 0x315b68, 0.9).setStrokeStyle(2, accent, 0.8));
    card.add(this.add.text(0, 47, this.enemyPreviewLabel(kind), {
      fontFamily: 'Microsoft YaHei',
      fontSize: `${this.uiFontSize(15, 1.35)}px`,
      color: palette.cream,
      stroke: '#071015',
      strokeThickness: 2,
      align: 'center',
      wordWrap: { width: 142, useAdvancedWrap: true },
    }).setOrigin(0.5).setFixedSize(142, 36).setFontStyle('bold'));
    parent.add(card);
    return card;
  }

  private setFloorScrollOffset(offset: number) {
    if (!this.progress.tutorialCompleted) return;
    this.floorScrollOffset = clamp(offset, this.floorScrollMin, this.floorScrollMax);
    this.floorScrollContent?.setY(this.floorScrollOffset);
    this.floorScrollRegions.forEach(({ region, baseY }) => { region.y = baseY + this.floorScrollOffset; });
  }

  private showMainlineIntro() {
    if (!this.ensureAssetGroup('mainline', () => this.showMainlineIntro())) return;
    this.phase = 'mainline-intro';
    this.runMode = 'mainline';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0).setAlpha(0);
    const safe = this.pageSafeBounds(12);
    const layoutShift = safe.centerX - W / 2;
    const panelX = clamp(1010 + layoutShift, safe.left + 225, safe.right - 225);
    const background = this.add.image(W / 2, H / 2, 'mainline-building-v3')
      .setOrigin(0.5)
      .setDisplaySize(W, H)
      .setAlpha(0.98);
    layer.add(background);
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02070b, 0.16));
    layer.add(this.add.text(panelX - 200, 270, '又来到了这座医院...\n难道还要和那群恶心的怪物战斗吗？', {
      fontFamily: 'Microsoft YaHei',
      fontSize: '24px',
      color: palette.cream,
      lineSpacing: 12,
      wordWrap: { width: 400 },
      stroke: '#05090f',
      strokeThickness: 4,
    }).setOrigin(0, 0.5));
    layer.add(this.add.text(panelX - 200, 395, '（本关为新手教学关卡）', {
      fontFamily: 'Microsoft YaHei',
      fontSize: '13px',
      color: palette.amber,
      wordWrap: { width: 390 },
    }));
    const continueIntro = () => {
      if (this.progress.mainlineIntroSeen) return;
      this.progress.mainlineIntroSeen = true;
      this.saveProgress();
      this.showMainline(0);
    };
    this.uiActionRegions.push({
      phase: this.phase,
      x: safe.centerX,
      y: H / 2,
      width: W,
      height: H,
      callback: continueIntro,
      setPressed: () => undefined,
    });
    this.addButton(layer, panelX, this.safeBottomY(610, 40), 300, 54, '进入楼层', continueIntro, 'primary', 12);
    this.overlay = layer;
    this.tweens.add({ targets: layer, alpha: 1, duration: 720, ease: 'Sine.easeOut' });
  }

  private showMainline(targetFloor = this.floor) {
    if (!this.ensureAssetGroup('mainline', () => this.showMainline(targetFloor))) return;
    if (!this.progress.mainlineIntroSeen) {
      this.progress.mainlineIntroSeen = true;
      this.saveProgress();
    }
    this.phase = 'mainline-select';
    this.runMode = 'mainline';
    this.ui?.setVisible(false);
    // Battle camera follow survives the tutorial outro unless it is stopped here.
    // The floor picker is viewport UI, so always rebuild it from the viewport origin.
    this.cameras.main.stopFollow();
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    const maxSelectable = this.progress.tutorialCompleted ? clamp(this.progress.maxFloor, 1, TOTAL_FLOORS) : 0;
    this.selectedStartFloor = this.progress.tutorialCompleted
      ? clamp(Math.round(targetFloor), 0, TOTAL_FLOORS)
      : 0;
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'mainline-floor-select-background-v1', 0.18);
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02070b, 0.24));
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    const selected = this.selectedStartFloor;
    this.addUiTextTexture(layer, W / 2, this.safeTopY(46, 18), 180, 76, 'ui-text-mainline-v1', '主线通关', 28);
    layer.add(this.add.text(W / 2, this.safeTopY(78, 18), '精神病院·楼层', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.cyan }).setOrigin(0.5));
    layer.add(this.add.rectangle(centerX, this.safeTopY(104, 18), Math.min(1030, safe.width), 1, 0x46636a, 0.78));

    const leftColumnX = 355 + layoutShift;

    const maskShape = this.add.graphics().setScrollFactor(0);
    maskShape.fillStyle(0xffffff, 1).fillRect(64 + layoutShift, this.floorScrollViewport.top, 582, this.floorScrollViewport.bottom - this.floorScrollViewport.top);
    maskShape.setVisible(false);
    layer.add(maskShape);
    this.floorScrollContent = this.add.container(0, 0).setScrollFactor(0).setMask(maskShape.createGeometryMask());
    this.floorScrollRegions = [];
    // Keep the authored perspective ratio and space each floor as a large
    // scrollable window so the tower remains readable at full size.
    const floorSlotWidth = 560;
    const floorSlotHeight = 392;
    const floorShellWidth = 560;
    const floorShellHeight = Math.round(floorShellWidth * 941 / 1672);
    const floorRoomMaxWidth = 500;
    const floorRoomMaxHeight = 375;
    const floorCardGap = 430;
    const floorCardX = leftColumnX;
    const baseYForFloor = (floor: number) => 400 - floor * floorCardGap;
    this.floorScrollMin = 0;
    this.floorScrollMax = Math.max(0, this.floorScrollViewport.bottom - (baseYForFloor(TOTAL_FLOORS) + floorSlotHeight / 2));
    this.floorScrollOffset = clamp((this.floorScrollViewport.top + this.floorScrollViewport.bottom) / 2 - baseYForFloor(selected), this.floorScrollMin, this.floorScrollMax);
    this.floorScrollContent.setY(this.floorScrollOffset);
    for (let floor = 0; floor <= TOTAL_FLOORS; floor += 1) {
      const unlocked = floor === 0 || (this.progress.tutorialCompleted === true && floor <= this.progress.maxFloor);
      const isSelected = floor === selected;
      // Every floor maps to the tower's single vertical window column.
      const x = floorCardX;
      const y = baseYForFloor(floor);
      const card = this.add.container(x, y);
      if (this.textures.exists('mainline-building-floor-shell-v1')) {
        card.add(this.add.image(0, 0, 'mainline-building-floor-shell-v1')
          .setOrigin(0.5)
          .setDisplaySize(floorShellWidth, floorShellHeight)
          .setAlpha(0.98));
      }
      const textureKey = unlocked
        ? (isSelected ? 'mainline-floor-selected-v1' : 'mainline-floor-unlocked-v1')
        : (isSelected ? 'mainline-floor-locked-selected-v1' : 'mainline-floor-locked-v1');
      if (this.textures.exists(textureKey)) {
        const source = this.textures.get(textureKey).getSourceImage() as { width: number; height: number };
        const sourceAspect = source.width / Math.max(1, source.height);
        const displayWidth = Math.min(floorRoomMaxWidth, floorRoomMaxHeight * sourceAspect);
        const displayHeight = displayWidth / sourceAspect;
        card.add(this.add.image(0, 0, textureKey)
          .setOrigin(0.5)
          .setDisplaySize(displayWidth, displayHeight)
          .setAlpha(unlocked ? 0.98 : 0.92));
      }
      this.floorScrollContent.add(card);
      const region: UiActionRegion = { phase: this.phase, x, y: y + this.floorScrollOffset, width: floorSlotWidth + 18, height: floorSlotHeight + 18, callback: () => this.showMainline(floor), setPressed: (pressed) => card.setScale(pressed ? 0.97 : 1) };
      this.uiActionRegions.push(region);
      this.floorScrollRegions.push({ region, baseY: y });
    }
    layer.add(this.floorScrollContent);

    const detailX = clamp(940 + layoutShift, safe.left + 250, safe.right - 250);
    const detail = this.add.container(detailX, 382);
    detail.add(this.add.text(-250, -206, this.floorLabel(selected), { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(25, 1.15)}px`, color: selected === 0 ? palette.amber : palette.cream }).setFontStyle('bold'));
    if (selected !== 0) detail.add(this.add.text(250, -204, `进度 ${selected} / ${TOTAL_FLOORS}`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: `${this.uiFontSize(11, 1.4)}px`, color: palette.green }).setOrigin(1, 0));
    detail.add(this.add.text(-250, -168, this.floorZoneLabel(selected), { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(12, 1.4)}px`, color: palette.cyan }));
    detail.add(this.add.rectangle(0, -138, 500, 1, 0x46636a, 0.74));
    detail.add(this.add.text(-250, -112, '可能出现', { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(13, 1.4)}px`, color: palette.muted }).setFontStyle('bold'));
    this.floorEnemyKinds(selected).slice(0, 6).forEach((kind, index) => this.addFloorEnemyPreview(detail, -164 + (index % 3) * 164, -30 + Math.floor(index / 3) * 132, kind, selected));
    if (selected === 0) {
      // 入口说明保持简洁，教程内容在进入关卡后通过对话展示。
    } else if (selected > maxSelectable) {
      detail.add(this.add.text(-220, 170, `完成${this.floorLabel(selected - 1)}后解锁当前楼层`, { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(12, 1.4)}px`, color: palette.amber }));
    } else {
      detail.add(this.add.text(-220, 170, `通关后解锁 ${selected < TOTAL_FLOORS ? this.floorLabel(selected + 1) : '终局档案'}`, { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(12, 1.4)}px`, color: palette.green }));
    }
    layer.add(detail);
    const canEnterFloor = selected === 0 || (this.progress.tutorialCompleted === true && selected <= maxSelectable);
    this.addButton(layer, detailX, this.safeBottomY(649, 34), 320, 48, canEnterFloor ? (selected === 0 ? '开始教程' : `进入${this.floorLabel(selected)}`) : '楼层未解锁', () => {
      if (canEnterFloor) this.showWeaponSelect('mainline', selected);
    }, canEnterFloor ? 'primary' : 'muted', 12, true);
    this.addButton(layer, 88, 38, 150, 42, '返回主界面', () => this.showStart(), 'muted', 8);
    layer.setScrollFactor(0, 0, true);
    this.overlay = layer;
  }

  private drawMenuMotif(layer: Phaser.GameObjects.Container) {
    const motif = this.add.graphics().setAlpha(0.7);
    motif.lineStyle(7, 0x18353b, 0.85);
    for (let branch = 0; branch < 6; branch += 1) {
      const startX = 870 + branch * 56;
      motif.beginPath();
      motif.moveTo(startX, 0);
      motif.lineTo(startX - 58, 112);
      motif.lineTo(startX + 24, 206);
      motif.lineTo(startX - 46, 328);
      motif.strokePath();
    }
    motif.lineStyle(2, 0x6bd3c1, 0.35).strokeEllipse(835, 180, 260, 140);
    motif.lineStyle(1, 0x7ab9d0, 0.3);
    for (let dot = 0; dot < 28; dot += 1) {
      motif.fillStyle(dot % 3 === 0 ? 0xf2bf62 : 0x6bd3c1, 0.35).fillRect(52 + (dot * 83) % 1160, 44 + (dot * 47) % 630, 3, 3);
    }
    layer.add(motif);
  }

  private addPixelFrame(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, fill: number, accent: number) {
    void width;
    void height;
    void fill;
    void accent;
    const frame = this.add.container(x, y);
    frame.add(this.add.rectangle(4, 4, width, height, 0x03060a, 0.96));
    frame.add(this.add.rectangle(0, 0, width, height, fill, 0.98).setStrokeStyle(2, 0x080d13, 1));
    frame.add(this.add.rectangle(0, 0, width - 10, height - 10, fill, 0).setStrokeStyle(1, accent, 0.45));
    const corners = this.add.graphics();
    corners.lineStyle(3, accent, 0.9);
    corners.lineBetween(-width / 2 + 6, -height / 2 + 14, -width / 2 + 6, -height / 2 + 6);
    corners.lineBetween(-width / 2 + 6, -height / 2 + 6, -width / 2 + 14, -height / 2 + 6);
    corners.lineBetween(width / 2 - 14, height / 2 - 6, width / 2 - 6, height / 2 - 6);
    corners.lineBetween(width / 2 - 6, height / 2 - 6, width / 2 - 6, height / 2 - 14);
    frame.add(corners);
    parent.add(frame);
    return frame;
  }

  private addDailyPanelFrame(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number) {
    const frame = this.add.container(x, y);
    if (this.textures.exists('daily-panel-frame-v1')) {
      frame.add(this.add.image(0, 0, 'daily-panel-frame-v1').setOrigin(0.5).setDisplaySize(width, height).setAlpha(0.96));
    } else {
      frame.add(this.add.rectangle(0, 0, width, height, 0x09141b, 0.96).setStrokeStyle(2, 0xb798e2, 0.9));
    }
    parent.add(frame);
    return frame;
  }

  private addDailyRankingFrame(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number) {
    const frame = this.add.container(x, y);
    if (this.textures.exists('daily-ranking-frame-v1')) {
      frame.add(this.add.image(0, 0, 'daily-ranking-frame-v1').setOrigin(0.5).setDisplaySize(width, height).setAlpha(0.98));
    } else {
      frame.add(this.add.rectangle(0, 0, width, height, 0x09141b, 0.96).setStrokeStyle(2, 0x46636a, 0.9));
    }
    parent.add(frame);
    return frame;
  }

  private setDailyRankingOffset(offset: number) {
    const next = clamp(Math.round(offset), 0, this.dailyRankingMaxOffset);
    if (next === this.dailyRankingOffset && this.dailyRankingRows) return;
    this.dailyRankingOffset = next;
    this.renderDailyRankingRows();
  }

  private renderDailyRankingRows() {
    const rows = this.dailyRankingRows;
    if (!rows) return;
    rows.removeAll(true);
    const rowHeight = 34;
    const listTop = -120;
    const board = this.dailyRankingEntries;
    if (board.length === 0) {
      rows.add(this.add.text(0, listTop + 92, '暂无通关记录', {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${this.uiFontSize(13, 1.3)}px`,
        color: palette.muted,
        stroke: '#050b10',
        strokeThickness: 2,
      }).setOrigin(0.5));
      this.updateDailyRankingScrollThumb();
      return;
    }
    board.slice(this.dailyRankingOffset, this.dailyRankingOffset + this.dailyRankingVisibleCount).forEach((entry, index) => {
      const y = listTop + index * rowHeight;
      const own = entry.name === this.playerNickname;
      const topRank = entry.rank <= 3;
      const rankColor = entry.rank === 1 ? palette.amber : entry.rank === 2 ? '#d6e7ea' : entry.rank === 3 ? '#d99263' : palette.cream;
      if (!topRank && own) rows.add(this.add.rectangle(0, y, 304, rowHeight - 3, 0x18353b, 0.9));
      if (topRank) {
        const badgeKey = entry.rank === 1 ? 'daily-rank-first-v1' : entry.rank === 2 ? 'daily-rank-second-v1' : 'daily-rank-third-v1';
        if (this.textures.exists(badgeKey)) {
          const badge = this.add.image(-100, y, badgeKey).setOrigin(0.5);
          const scale = (rowHeight - 2) / Math.max(1, badge.height);
          badge.setScale(scale);
          rows.add(badge);
        } else {
        rows.add(this.add.text(-100, y, String(entry.rank), { fontFamily: 'Courier New', fontSize: `${this.uiFontSize(14, 1.25)}px`, color: '#071117' }).setOrigin(0.5));
        }
      } else {
        rows.add(this.add.text(-111, y, String(entry.rank).padStart(2, '0'), { fontFamily: 'Courier New', fontSize: `${this.uiFontSize(14, 1.25)}px`, color: rankColor }).setOrigin(0, 0.5));
      }
      const displayName = entry.name.length > 12 ? `${entry.name.slice(0, 11)}...` : entry.name;
      rows.add(this.add.text(-82, y, displayName, { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(14, 1.25)}px`, color: own ? palette.teal : rankColor }).setOrigin(0, 0.5));
      const timeLabel = entry.score > 0 ? this.formatDailyTime(Math.max(1, Math.round((100000 - entry.score) / 100))) : '未通关';
      rows.add(this.add.text(108, y, timeLabel, {
        fontFamily: 'Courier New, Microsoft YaHei',
        fontSize: `${this.uiFontSize(14, 1.25)}px`,
        color: entry.score > 0 ? (topRank ? rankColor : palette.amber) : palette.danger,
      }).setOrigin(1, 0.5));
    });
    this.updateDailyRankingScrollThumb();
  }

  private updateDailyRankingScrollThumb() {
    const thumb = this.dailyRankingScrollThumb;
    if (!thumb) return;
    const trackTop = -120;
    const trackHeight = 300;
    const total = Math.max(1, this.dailyRankingEntries.length);
    const thumbHeight = Math.max(28, trackHeight * Math.min(1, this.dailyRankingVisibleCount / total));
    const travel = Math.max(0, trackHeight - thumbHeight);
    const progress = this.dailyRankingMaxOffset > 0 ? this.dailyRankingOffset / this.dailyRankingMaxOffset : 0;
    thumb.setSize(8, thumbHeight).setY(trackTop + thumbHeight / 2 + travel * progress);
  }

  private addDailyImageButton(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, label: string, callback: () => void, accent: number, iconKey = 'daily-ad-icon-v1') {
    const button = this.add.container(x, y);
    const image = this.add.image(0, 0, 'daily-start-button-v1').setOrigin(0.5).setDisplaySize(width, height);
    const labelNode = label === '开始挑战' && this.textures.exists('ui-text-start-challenge-v1')
      ? this.add.image(0, 0, 'ui-text-start-challenge-v1').setOrigin(0.5).setDisplaySize(190, 70)
      : this.add.text(0, 0, label, {
        fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(19, 1.25)}px`, color: palette.cream, stroke: '#080d11', strokeThickness: 4,
      }).setOrigin(0.5).setFontStyle('bold');
    button.add([image, labelNode]);
    if (label.includes('广告') && this.textures.exists(iconKey)) {
      const adIcon = this.add.image(-112, 0, iconKey).setOrigin(0.5).setDisplaySize(58, 58);
      labelNode.setX(24);
      button.add(adIcon);
    }
    const setPressed = (pressed: boolean) => {
      button.setScale(pressed ? 0.96 : 1);
      image.setTint(pressed ? 0xc6d8d0 : 0xffffff);
      labelNode.setAlpha(pressed ? 0.8 : 1);
    };
    parent.add(button);
    this.uiActionRegions.push({ phase: this.phase, x, y, width: width + 22, height: Math.max(48, height + 12), callback, setPressed });
    return button;
  }

  private addUiTextTexture(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, textureKey: string, fallback: string, fontSize: number, color = palette.cream) {
    if (this.textures.exists(textureKey)) {
      const image = this.add.image(x, y, textureKey).setOrigin(0.5);
      this.fitImageToBox(image, width, height);
      parent.add(image);
      return;
    }
    parent.add(this.add.text(x, y, fallback, {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: `${this.uiFontSize(fontSize, 1.35)}px`,
      color,
      stroke: '#050b10',
      strokeThickness: Math.max(2, Math.round(fontSize / 7)),
    }).setOrigin(0.5).setFontStyle('bold'));
  }

  private dialogueLines() {
    if (this.tutorialRun) {
      if (this.tutorialDialogueStage === 'outro') {
        return [
          { speaker: '小男孩', role: '患者 / 0001', glyph: '男', color: 0xf2bf62, text: '果然又是梦吗？...' },
          { speaker: '小男孩', role: '患者 / 0001', glyph: '男', color: 0xf2bf62, text: '我昨夜的力量真是强得可怕，好想再试一试。' },
          { speaker: '小男孩', role: '患者 / 0001', glyph: '男', color: 0xf2bf62, text: '总有一天我能变得同梦里那么强大，斩杀深渊里的诡神！' },
        ];
      }
      return [
        { speaker: '小男孩', role: '患者 / 0001', glyph: '男', color: 0xf2bf62, text: '又来到了这里吗？这次竟然是白天的病房？！！' },
        { speaker: '小男孩', role: '患者 / 0001', glyph: '男', color: 0xf2bf62, text: '这一次我一定要打败所有诡异，彻底净化这里！！' },
      ];
    }
    return [
      { speaker: '值班医生', role: '医生 / 01', glyph: '医', color: 0x7ab9d0, text: `你醒了。第 ${this.floor} 层白天治疗身体，夜里治疗命。灯灭之前，别离开这层楼。` },
      { speaker: '夜班护士', role: '护士 / 07', glyph: '护', color: 0x8fd17c, text: '听见病历夹翻页的声音就躲开。那不是风，是病区在点名。' },
      { speaker: '小男孩', role: '患者 / 0001', glyph: '男', color: 0xf2bf62, text: '这把刀在梦里绕着我转。今晚，我要顺着它找到门后的东西。' },
    ];
  }

  private showDialogue() {
    this.phase = 'dialogue';
    this.ui?.setVisible(false);
    this.dialogueIndex = clamp(this.dialogueIndex, 0, this.dialogueLines().length - 1);
    this.dialogueTransitioning = false;
    // 对白使用独立的全屏构图，避免沿用战斗镜头缩放后只显示病房中间一块。
    this.cameras.main.stopFollow();
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'ward-day-v1', 0);
    const safe = this.pageSafeBounds(12);
    const layoutShift = safe.centerX - W / 2;
    const line = this.dialogueLines()[this.dialogueIndex];
    const playerActive = line.speaker === '小男孩';
    const npcLine = playerActive
      ? this.dialogueLines().find((entry) => entry.speaker !== '小男孩')
      : line;
    const hasNpcLine = Boolean(npcLine);
    const npcData = npcLine ?? { color: 0x5d5c53, role: '', glyph: '' };
    const progressLabel = this.add.text(safe.left, this.safeTopY(34, 8), `${String(this.dialogueIndex + 1).padStart(2, '0')} / ${String(this.dialogueLines().length).padStart(2, '0')}`, {
      fontFamily: 'Courier New, Microsoft YaHei', fontSize: `${this.uiFontSize(14, 1.35)}px`, color: palette.cream, stroke: '#1b1413', strokeThickness: 4,
    }).setOrigin(0, 0.5);
    const floorLabel = this.add.text(safe.left, this.safeTopY(58, 8), `第 ${this.floor} 层`, {
      fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(11, 1.35)}px`, color: palette.muted, stroke: '#1b1413', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    const skipLabel = this.add.text(safe.right, this.safeTopY(34, 8), '跳过', {
      fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(13, 1.35)}px`, color: palette.cream, stroke: '#1b1413', strokeThickness: 4,
    }).setOrigin(1, 0.5);
    layer.add([progressLabel, floorLabel, skipLabel]);
    if (this.tutorialRun) floorLabel.setText('入口教程');

    const stage = this.add.container(layoutShift, 0);
    // Keep the player on the left and the hospital staff on the right. Both
    // actors share the same floor baseline so the day-to-night cut has no
    // visible jump in composition.
    const npcX = 835;
    const playerX = 445;
    const actorY = this.safeBottomY(515, 108);
    if (hasNpcLine) {
      this.addDialogueCharacter(stage, npcX, actorY - 6, npcLine!.speaker === '夜班护士' ? 'nurse' : 'doctor', npcData.color);
    }
    const playerShadow = this.add.graphics();
    playerShadow.fillStyle(0x05090f, 0.24).fillEllipse(playerX, actorY + 112, 126, 22);
    stage.add(playerShadow);
    const playerSprite = this.addPatientSprite(stage, playerX, actorY, 224, this.activePlayerSkin());
    if (playerSprite) {
      playerSprite.setAlpha(1).clearTint();
    }

    const npcBubble = this.addDialogueBubble(stage, npcX, 296, 420, 132, '', !playerActive && hasNpcLine ? line.text : '', 'left', !playerActive ? line.color : 0x5d5c53);
    const playerBubble = this.addDialogueBubble(stage, playerX, 296, 420, 132, '', playerActive ? line.text : '', 'right', playerActive ? line.color : 0x5d5c53);
    npcBubble.setVisible(!playerActive && hasNpcLine);
    playerBubble.setVisible(playerActive);
    layer.add(stage);

    const advanceDialogue = () => {
      if (this.dialogueTransitioning) return;
      if (this.dialogueIndex >= this.dialogueLines().length - 1) this.transitionToBattleFromDialogue();
      else { this.dialogueIndex += 1; this.showDialogue(); }
    };
    this.uiActionRegions.push({ phase: this.phase, x: W / 2, y: H / 2, width: W, height: H, callback: advanceDialogue, setPressed: () => undefined });
    this.uiActionRegions.push({ phase: this.phase, x: safe.right - 58, y: this.safeTopY(68, 8), width: 132, height: 28, callback: () => this.transitionToBattleFromDialogue(), setPressed: () => undefined });
    this.overlay = layer;
  }

  private addDialogueCharacter(parent: Phaser.GameObjects.Container, x: number, y: number, kind: 'doctor' | 'nurse', accent: number) {
    const actor = this.add.container(x, y).setAlpha(1).setScale(0.86);
    const g = this.add.graphics();
    const outline = 0x211719;
    const skin = 0xf2c7a4;
    const hair = kind === 'doctor' ? 0x2a2024 : 0x37232c;
    const uniform = kind === 'doctor' ? 0xe1ece4 : 0x9bc9ba;
    const shadow = this.add.graphics();
    shadow.fillStyle(0x05090f, 0.24).fillEllipse(0, 140, 132, 24);
    actor.add(shadow);

    g.fillStyle(outline, 1).fillRect(-30, 70, 22, 62).fillRect(8, 70, 22, 62);
    g.fillStyle(0x313a42, 1).fillRect(-34, 128, 30, 10).fillRect(4, 128, 30, 10);
    g.fillStyle(outline, 1).fillTriangle(-52, -4, 52, -4, 37, 83);
    g.fillStyle(uniform, 1).fillTriangle(-46, 0, 46, 0, 33, 78);
    g.fillStyle(uniform, 1).fillRect(-58, 10, 15, 56).fillRect(43, 10, 15, 56);
    g.fillStyle(outline, 1).fillRect(-62, 59, 20, 10).fillRect(42, 59, 20, 10);
    g.fillStyle(skin, 1).fillCircle(0, -32, 30);
    g.lineStyle(3, outline, 1).strokeCircle(0, -32, 30);
    g.fillStyle(hair, 1).fillRect(-29, -57, 58, 17);
    g.fillTriangle(-26, -58, -8, -73, 2, -56);
    g.fillTriangle(-4, -57, 12, -74, 24, -54);
    g.fillStyle(0x24191a, 1).fillRect(-15, -31, 6, 5).fillRect(9, -31, 6, 5);
    g.fillStyle(0x8b4d4b, 1).fillRect(-5, -16, 10, 3);
    if (kind === 'doctor') {
      g.fillStyle(0x7ab9d0, 1).fillRect(-6, 2, 12, 40);
      g.lineStyle(3, 0x7ab9d0, 1).arc(0, 34, 23, 0, Math.PI, false);
      g.fillStyle(0xf2bf62, 1).fillRect(13, 19, 8, 8);
    } else {
      g.fillStyle(0xf6f0dd, 1).fillRect(-27, -66, 54, 13);
      g.fillStyle(0xd95c68, 1).fillRect(-3, -66, 6, 13).fillRect(-9, -61, 18, 4);
      g.fillStyle(0xf4e8c9, 1).fillRect(-5, 3, 10, 38);
      g.fillStyle(accent, 1).fillRect(-27, 42, 54, 5);
    }
    actor.add(g);
    parent.add(actor);
    return actor;
  }

  private addDialogueBubble(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, speaker: string, message: string, tailSide: 'left' | 'right', accent: number) {
    const bubble = this.add.container(x, y);
    if (this.textures.exists('dialogue-bubble-v2')) {
      // The generated frame is 3:1; keep its native ratio so the tail and
      // corner ornaments do not look vertically stretched on any viewport.
      const frameWidth = width + 24;
      const frameHeight = frameWidth * (724 / 2172);
      const frame = this.add.image(0, -4, 'dialogue-bubble-v2')
        .setOrigin(0.5)
        .setDisplaySize(frameWidth, frameHeight);
      bubble.add(frame);
      const textColor = '#17232c';
      if (speaker) bubble.add(this.add.text(-width / 2 + 22, -height / 2 + 15, speaker, {
        fontFamily: UI_FONT_STACK,
        fontSize: `${this.uiFontSize(15)}px`,
        color: textColor,
      }).setFontStyle('bold'));
      const messageTop = speaker ? -height / 2 + 36 : -height / 2 + 20;
      const messageHeight = speaker ? height - 48 : height - 34;
      bubble.add(this.add.text(-width / 2 + 24, messageTop, message, {
        fontFamily: UI_FONT_STACK,
        fontSize: `${this.uiFontSize(20, 1.5)}px`,
        color: textColor,
        lineSpacing: this.compactUi() ? 5 : 7,
        align: 'center',
        wordWrap: { width: width - 48, useAdvancedWrap: true },
      }).setFixedSize(width - 48, messageHeight).setFontStyle('bold').setResolution(2));
      parent.add(bubble);
      return bubble;
    }
    const left = -width / 2;
    const right = width / 2;
    const top = -height / 2;
    const bottom = height / 2;
    const tailX = tailSide === 'left' ? -28 : 28;
    const outline = this.add.graphics();
    outline.fillStyle(0xece9ff, 0.96);
    outline.lineStyle(3, 0x392f4c, 1);
    outline.beginPath();
    outline.moveTo(left + 14, top);
    outline.lineTo(right - 14, top);
    outline.lineTo(right, top + 14);
    outline.lineTo(right, bottom - 14);
    outline.lineTo(right - 14, bottom);
    if (tailSide === 'left') {
      outline.lineTo(tailX + 12, bottom);
      outline.lineTo(tailX, bottom + 22);
      outline.lineTo(tailX - 12, bottom);
    } else {
      outline.lineTo(tailX + 12, bottom);
      outline.lineTo(tailX, bottom + 22);
      outline.lineTo(tailX - 12, bottom);
    }
    outline.lineTo(left, bottom - 14);
    outline.lineTo(left, top + 14);
    outline.lineTo(left + 14, top);
    outline.closePath();
    outline.fillPath();
    outline.strokePath();
    bubble.add(outline);
    bubble.add(this.add.rectangle(0, bottom - 7, width - 44, 2, accent, 0.6));
    if (speaker) bubble.add(this.add.text(left + 22, top + 16, speaker, { fontFamily: 'Microsoft YaHei', fontSize: '15px', color: '#392f4c' }).setFontStyle('bold'));
    const messageTop = speaker ? top + 38 : top + 20;
    const messageHeight = speaker ? height - 50 : height - 30;
    bubble.add(this.add.text(left + 22, messageTop, message, { fontFamily: 'Microsoft YaHei', fontSize: '18px', color: '#392f4c', lineSpacing: 6, wordWrap: { width: width - 44 } }).setFixedSize(width - 44, messageHeight));
    parent.add(bubble);
    return bubble;
  }

  private transitionToBattleFromDialogue() {
    if (this.dialogueTransitioning) return;
    this.dialogueTransitioning = true;
    const layer = this.overlay;
    if (!layer) {
      this.beginBattle();
      return;
    }
    this.uiActionRegions = [];
    const veil = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(100);
    layer.add(veil);
    this.tweens.add({
      targets: veil,
      alpha: 1,
      duration: 1250,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (this.tutorialRun && this.tutorialDialogueStage === 'outro') {
          this.tutorialRun = false;
          this.tutorialDialogueStage = 'intro';
          this.showMainline(1);
        } else {
          this.beginBattle();
        }
        // The target scene is created before lifting the veil, so the
        // hospital room keeps one shared origin while the transition eases
        // into the night palette instead of cutting on a single frame.
        const targetLayer = this.phase === 'battle' ? this.ui : this.overlay;
        const fadeIn = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setDepth(200).setScrollFactor(0);
        targetLayer?.add(fadeIn);
        this.tweens.add({
          targets: fadeIn,
          alpha: 0,
          duration: 650,
          ease: 'Sine.easeOut',
          onComplete: () => fadeIn.destroy(),
        });
      },
    });
  }

  private beginBattle() {
    this.clearOverlay();
    this.phase = 'battle';
    this.cameras.main.setBounds(WORLD_BOUNDS.left, WORLD_BOUNDS.top, WORLD_BOUNDS.right - WORLD_BOUNDS.left, WORLD_BOUNDS.bottom - WORLD_BOUNDS.top);
    this.cameras.main.setZoom(this.gameplayCameraZoom);
    if (this.player) this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.ui?.setVisible(true);
    this.updateHud();
    audio.playBattleStart();
    this.developerPanel?.destroy(true);
    this.addDeveloperPanel(this.ui, true);
  }

  private showTutorialGuide() {
    this.tutorialGuide?.destroy(true);
    const guide = this.add.container(W / 2, 122).setDepth(80).setScrollFactor(0);
    guide.add(this.add.rectangle(0, 0, 780, 82, 0x071117, 0.94).setStrokeStyle(2, paletteRgb.amber, 0.86));
    guide.add(this.add.text(0, -22, '入口教程 · 先活下来，再观察 SAN', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.amber }).setOrigin(0.5).setFontStyle('bold'));
    guide.add(this.add.text(0, 12, '拖动任意位置移动 ｜ 武器自动攻击 ｜ 收集绿色经验升级 ｜ SAN 归零挑战失败', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.cream }).setOrigin(0.5));
    this.ui.add(guide);
    this.tutorialGuide = guide;
    this.tutorialGuideTimer = 10;
  }

  private updateTutorialGuide(dt: number) {
    if (!this.tutorialGuide) return;
    this.tutorialGuideTimer = Math.max(0, this.tutorialGuideTimer - dt);
    if (this.tutorialGuideTimer <= 2) this.tutorialGuide.setAlpha(this.tutorialGuideTimer / 2);
    if (this.tutorialGuideTimer <= 0) {
      this.tutorialGuide.destroy(true);
      this.tutorialGuide = undefined;
    }
  }

  private showProfileLegacyEntry() {
    this.showProfileLegacyLayout();
  }

  private showProfileLegacy() {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.56);
    this.drawMenuMotif(layer);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    this.addPixelFrame(layer, centerX, 350, 820, 620, 0x101b24, 0xf2bf62);
    layer.add(this.add.text(centerX, this.safeTopY(104, 18), '我的 / PATIENT FILE', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '25px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(centerX, this.safeTopY(140, 18), '外观只改变显示效果，武器等级决定攻击方式。', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.muted }).setOrigin(0.5));
    const profile = this.add.container(360 + layoutShift, 340);
    profile.add(this.add.rectangle(0, 0, 220, 280, 0x0a141b, 1).setStrokeStyle(2, 0xf2bf62, 0.9));
    if (!this.addPatientSprite(profile, 0, 6, 232)) {
      profile.add(this.add.circle(0, -70, 50, 0xf2bf62, 0.9).setStrokeStyle(2, 0x071015, 1));
      profile.add(this.add.rectangle(0, 28, 72, 88, 0x415c67, 1).setStrokeStyle(2, 0x071015, 1));
      profile.add(this.add.text(0, -72, '男', { fontFamily: 'Microsoft YaHei', fontSize: '30px', color: '#071015' }).setOrigin(0.5));
    }
    profile.add(this.add.text(0, 132, '患者 / 0001', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.amber }).setOrigin(0.5));
    layer.add(profile);
    const weapon = this.currentWeapon();
    layer.add(this.add.text(525 + layoutShift, 230, '当前装备', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '14px', color: palette.muted }).setFontStyle('bold'));
    layer.add(this.add.text(525 + layoutShift, 270, weapon ? `${weapon.name}  Lv.${weapon.level}` : '病院刀  Lv.1', { fontFamily: 'Microsoft YaHei', fontSize: '22px', color: palette.amber }).setFixedSize(390, 34));
    layer.add(this.add.text(525 + layoutShift, 314, weapon ? `武器数量 ×${weapon.copies} · ${this.currentWeaponDamage(weapon)} 伤害` : '武器数量 ×1 · 24 伤害', { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.cream }).setFixedSize(390, 22));
    layer.add(this.add.text(525 + layoutShift, 348, '已解锁外观', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '14px', color: palette.muted }).setFontStyle('bold'));
    layer.add(this.add.text(525 + layoutShift, 384, weapon ? `${weapon.name} · ${this.weaponAppearanceLabel(weapon)}` : '病院刀 · 基础外观', { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.cream }).setFixedSize(390, 22));
    layer.add(this.add.text(525 + layoutShift, 416, '武器外观随武器等级变化；皮肤外观只改变角色颜色和套装加成。', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.muted, wordWrap: { width: 390 } }).setFixedSize(390, 42));
    layer.add(this.add.text(525 + layoutShift, 454, '已解锁皮肤', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.muted }).setFontStyle('bold'));
    this.skins.forEach((skin, index) => {
      const unlocked = this.isSkinAvailable(skin.id);
      const y = 482 + index * 50;
      const setText = skin.setName ? ` · ${skin.setName}（${skin.setBuff}）` : '';
      layer.add(this.add.text(525 + layoutShift, y, unlocked ? `${skin.name}${setText}` : '??? 未解锁', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: unlocked ? (skin.id === this.progress.equippedSkinId ? palette.amber : palette.cream) : palette.muted }).setFixedSize(245, 20));
      if (unlocked) {
        this.addButton(layer, 780 + layoutShift, y + 2, 96, 24, skin.id === this.progress.equippedSkinId ? '已装备' : '装备', () => this.equipSkin(skin.id), skin.id === this.progress.equippedSkinId ? 'muted' : 'primary', 10);
      } else if (skin.category === 'boss') {
        this.addButton(layer, 780 + layoutShift, y + 2, 96, 24, '去挑战', () => this.showDailyChallenge(), 'muted', 10);
      } else {
        const cost = this.skinPurchaseCost(skin.id);
        this.addButton(layer, 780 + layoutShift, y + 2, 96, 24, cost <= 0 ? '领取' : `购买 ${cost}`, () => this.buySkin(skin.id), 'primary', 10);
      }
    });
    layer.add(this.add.text(525 + layoutShift, this.safeBottomY(652, 18), `病例残页 ${this.progress.metaCoins} · 套装加成在进入战斗时生效`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '9px', color: palette.cyan }).setFixedSize(390, 14));
    this.addButton(layer, 88, 38, 150, 42, '返回主界面', () => this.showStart(), 'muted', 8);
    this.overlay = layer;
  }

  private showProfileLegacyLayout() {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.56);
    this.drawMenuMotif(layer);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    this.addPixelFrame(layer, centerX, 360, 1120, 620, 0x101b24, 0xf2bf62);
    layer.add(this.add.text(centerX, this.safeTopY(86, 8), '病历档案', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '28px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(centerX, this.safeTopY(119, 8), 'PATIENT FILE / WARD 07', { fontFamily: 'Courier New', fontSize: '11px', color: palette.cyan }).setOrigin(0.5));
    layer.add(this.add.text(safe.right - 8, this.safeTopY(87, 8), `创游货币  ${this.progress.metaCoins}`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.amber }).setOrigin(1, 0.5));
    layer.add(this.add.rectangle(centerX, this.safeTopY(148, 8), 1000, 1, 0x46636a, 0.75));

    const previewSkin = this.skins.find((skin) => skin.id === this.profilePreviewSkinId) ?? this.skins[0];
    const categories: Array<{ id: ProfileSkinCategory; label: string }> = [
      { id: 'all', label: '全部皮肤' },
      { id: 'boss', label: 'BOSS掉落' },
      { id: 'store', label: '商店' },
    ];
    const setCategory = (category: ProfileSkinCategory) => {
      this.profileSkinCategory = category;
      const categorySkins = this.skins.filter((skin) => category === 'all' || this.profileSkinCategoryFor(skin) === category);
      if (categorySkins.length > 0 && !categorySkins.some((skin) => skin.id === this.profilePreviewSkinId)) this.profilePreviewSkinId = categorySkins[0].id;
      this.showProfile();
    };
    const preview = this.add.container(444 + layoutShift, 302);
    preview.add(this.add.rectangle(0, 0, 480, 300, 0x0a141b, 0.98).setStrokeStyle(2, previewSkin.color, 0.9));
    preview.add(this.add.rectangle(0, 0, 472, 292, 0x0a141b, 0).setStrokeStyle(1, 0x46636a, 0.75));
    preview.add(this.add.text(-218, -125, '患者本人', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.amber }).setFontStyle('bold'));
    preview.add(this.add.text(-83, -123, `昵称 · ${this.playerNickname}`, { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.cyan, wordWrap: { width: 150 } }));
    preview.add(this.add.text(218, -123, '正面预览', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '11px', color: palette.muted }).setOrigin(1, 0));
    const portrait = this.addPatientSprite(preview, 0, -3, 196, previewSkin);
    if (portrait && previewSkin.id !== 'patient-default' && !this.skinHasCustomArt(previewSkin)) portrait.setTint(previewSkin.color);
    preview.add(this.add.rectangle(0, 101, 128, 2, previewSkin.color, 0.7));
    preview.add(this.add.text(0, 118, this.playerNickname, { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    preview.add(this.add.text(0, 139, previewSkin.name, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '10px', color: palette.cyan }).setOrigin(0.5));
    layer.add(preview);

    const detail = this.add.container(444 + layoutShift, this.safeBottomY(560, 96));
    detail.add(this.add.rectangle(0, 0, 480, 192, 0x0a141b, 0.98).setStrokeStyle(2, previewSkin.color, 0.9));
    detail.add(this.add.text(-218, -67, previewSkin.name, { fontFamily: 'Microsoft YaHei', fontSize: '20px', color: palette.cream }).setFontStyle('bold'));
    detail.add(this.add.text(-218, -33, previewSkin.setName ? `${previewSkin.setName} · ${previewSkin.setBuff}` : '基础病号服 · 无套装加成', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.cyan, wordWrap: { width: 265 } }));
    const previewUnlocked = this.isSkinAvailable(previewSkin.id);
    const previewEquipped = previewSkin.id === this.progress.equippedSkinId;
    const previewStatus = previewUnlocked
      ? (previewEquipped ? '当前已装备' : '已解锁，可装备')
      : previewSkin.category === 'boss'
        ? 'BOSS 掉落 · 完成每日挑战解锁'
        : this.skinPurchaseCost(previewSkin.id) <= 0
          ? '免费领取'
          : `购买价格 · ${this.skinPurchaseCost(previewSkin.id)} 创游货币`;
    detail.add(this.add.text(-218, 8, previewStatus, { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: previewUnlocked ? palette.green : palette.amber, wordWrap: { width: 265 } }));
    layer.add(detail);
    if (previewUnlocked) {
        this.addButton(layer, 605 + layoutShift, this.safeBottomY(580, 54), 108, 32, previewEquipped ? '已装备' : '装备', () => this.equipSkin(previewSkin.id), previewEquipped ? 'muted' : 'primary', 8);
    } else if (previewSkin.category === 'boss') {
      this.addButton(layer, 605 + layoutShift, this.safeBottomY(580, 54), 108, 32, '前往挑战', () => this.showDailyChallenge(), 'muted', 8);
    } else {
      const cost = this.skinPurchaseCost(previewSkin.id);
      this.addButton(layer, 605 + layoutShift, this.safeBottomY(580, 54), 108, 32, cost <= 0 ? '领取' : `购买 ${cost}`, () => this.buySkin(previewSkin.id), 'primary', 8);
    }

    const visibleSkins = this.skins.filter((skin) => this.profileSkinCategory === 'all' || this.profileSkinCategoryFor(skin) === this.profileSkinCategory);
     const skinPanelX = clamp(970 + layoutShift, safe.left + 270, safe.right - 270);
     this.addPixelFrame(layer, skinPanelX, this.safeBottomY(410, 250), 540, 500, 0x0a141b, 0x46636a);
     layer.add(this.add.text(skinPanelX - 245, this.safeTopY(190, 8), '皮肤', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.cream }).setFontStyle('bold'));
     layer.add(this.add.text(skinPanelX + 242, this.safeTopY(190, 8), `${visibleSkins.length} 套`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '11px', color: palette.muted }).setOrigin(1, 0));
     categories.forEach((category, index) => {
       this.addButton(layer, skinPanelX - 150 + index * 112, this.safeTopY(190, 8), index === 0 ? 94 : index === 1 ? 104 : 88, 30, category.label, () => setCategory(category.id), this.profileSkinCategory === category.id ? 'primary' : 'muted', 7);
     });
    visibleSkins.forEach((skin, index) => {
      const unlocked = this.isSkinAvailable(skin.id);
      const column = index % 3;
      const row = Math.floor(index / 3);
       const x = skinPanelX - 163 + column * 165;
      const y = 286 + row * 180;
      const card = this.add.container(x, y);
      const selected = skin.id === this.profilePreviewSkinId;
      card.add(this.add.rectangle(0, 0, 150, 144, 0x0a141b, 0.98).setStrokeStyle(selected ? 2 : 1, selected ? skin.color : 0x46636a, 0.95));
      const mini = this.addPatientSprite(card, 0, -18, 74, skin);
      if (mini && skin.id !== 'patient-default' && !this.skinHasCustomArt(skin)) mini.setTint(skin.color);
      if (mini && !unlocked) mini.setAlpha(0.42);
      if (!unlocked) {
        card.add(this.add.rectangle(0, -16, 144, 80, 0x05090f, 0.28));
        card.add(this.add.text(0, -16, '锁', { fontFamily: 'Microsoft YaHei', fontSize: '18px', color: palette.muted }).setOrigin(0.5));
      }
      card.add(this.add.text(0, 47, skin.name, { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: unlocked ? palette.cream : palette.muted, wordWrap: { width: 122 }, align: 'center' }).setOrigin(0.5, 0.5).setFontStyle('bold'));
      card.add(this.add.text(0, 65, unlocked ? (skin.id === this.progress.equippedSkinId ? '已装备' : '已解锁') : '已锁定', { fontFamily: 'Microsoft YaHei', fontSize: '9px', color: unlocked ? palette.green : palette.muted }).setOrigin(0.5));
      layer.add(card);
      this.addButton(layer, x, y + 89, 96, 24, selected ? '当前预览' : '预览', () => this.previewSkin(skin.id), selected ? 'primary' : 'muted', 7);
    });
    this.addButton(layer, 88, 38, 150, 42, '返回主界面', () => this.showStart(), 'muted', 8);
    this.overlay = layer;
    if (!this.playerIdentityLoaded) {
      void this.ensurePlayerIdentity().then(() => { if (this.overlay === layer && layer.active) this.showProfile(); });
    }
  }

  private showProfile() {
    if (!this.ensureAssetGroup('profile', () => this.showProfile())) return;
    this.normalizeTemporaryUnlocks();
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.42);
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02070b, 0.28));
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    this.addUiTextTexture(layer, centerX, this.safeTopY(58, 8), 170, 68, 'ui-text-archive-v1', '病历档案', 28);
    layer.add(this.add.rectangle(centerX, this.safeTopY(118, 8), 1080, 1, 0x46636a, 0.78));

    const previewSkin = this.skins.find((skin) => skin.id === this.profilePreviewSkinId) ?? this.skins[0];
    const caseInk = '#17131b';
    const caseAccent = '#7d1f35';
    const caseMuted = '#24545b';
    const caseTextStroke = '#fff3d0';
    const caseStrokeThickness = 2;
    const caseLabelSize = this.compactUi() ? 27 : this.uiFontSize(15, 1.35);
    const caseNameSize = this.compactUi() ? 30 : this.uiFontSize(21, 1.25);
    const caseDetailSize = this.compactUi() ? 24 : this.uiFontSize(14, 1.35);
    const caseIdSize = this.compactUi() ? 22 : this.uiFontSize(13, 1.35);
    const caseSkinNameSize = this.compactUi() ? 25 : this.uiFontSize(14, 1.35);
    const boardX = 340 + layoutShift;
    const boardY = 408;
    // Keep the case sheet close to the skin panel width and scale every
    // child with it so text, barcode, and portrait retain their proportions.
    const caseSheetScale = 574 / 650;
    const board = this.add.container(boardX, boardY).setScale(caseSheetScale);
    if (this.textures.exists('profile-case-sheet-v2')) {
      board.add(this.add.image(0, 0, 'profile-case-sheet-v2').setOrigin(0.5).setDisplaySize(650, 406).setAlpha(0.98));
    } else {
      board.add(this.add.image(0, 0, 'profile-case-sheet-v1').setOrigin(0.5).setDisplaySize(650, 406).setAlpha(0.98));
    }
    // Keep identity details in the paper's upper-left field, where the
    // decorative sheet leaves a clear reading area at every viewport size.
    board.add(this.add.text(-205, -118, '\u75c5\u4eba\u59d3\u540d', { fontFamily: UI_FONT_STACK, fontSize: `${caseLabelSize}px`, color: caseAccent, stroke: caseTextStroke, strokeThickness: caseStrokeThickness }).setFontStyle('bold'));
    board.add(this.add.text(-205, -91, this.playerNickname, { fontFamily: UI_FONT_STACK, fontSize: `${caseNameSize}px`, color: caseInk, stroke: caseTextStroke, strokeThickness: caseStrokeThickness, wordWrap: { width: 190 } }).setFontStyle('bold'));
    board.add(this.add.text(-205, -59, '\u79f0\u53f7  \u003c\u65e0\u003e', { fontFamily: UI_FONT_STACK, fontSize: `${caseLabelSize}px`, color: caseAccent, stroke: caseTextStroke, strokeThickness: caseStrokeThickness }).setFontStyle('bold'));
    board.add(this.add.text(-205, -31, `\u75c5\u5386\u7f16\u53f7  W07-${String(this.progress.maxFloor).padStart(2, '0')}`, { fontFamily: UI_FONT_STACK, fontSize: `${caseIdSize}px`, color: caseMuted, stroke: caseTextStroke, strokeThickness: caseStrokeThickness }).setFontStyle('bold'));
    board.add(this.add.text(-250, 24, '\u75c7\u72b6\u8bb0\u5f55', { fontFamily: UI_FONT_STACK, fontSize: `${caseLabelSize}px`, color: caseAccent, stroke: caseTextStroke, strokeThickness: caseStrokeThickness }).setFontStyle('bold'));
    board.add(this.add.text(-250, 48, '\u5931\u7720 / \u4f4e\u8bed\u5e7b\u542c / \u7ea2\u5149\u8fc7\u5ea6\u53cd\u5e94', { fontFamily: UI_FONT_STACK, fontSize: `${caseDetailSize}px`, color: caseInk, stroke: caseTextStroke, strokeThickness: caseStrokeThickness, wordWrap: { width: 220 } }).setFontStyle('bold'));
    if (this.textures.exists('profile-barcode-v1')) board.add(this.add.image(-146, 136, 'profile-barcode-v1').setOrigin(0.5).setDisplaySize(208, 48).setAlpha(0.96));
    board.add(this.add.rectangle(164, 111, 210, 40, 0x101b24, 0.84).setStrokeStyle(1, 0xe7c28b, 0.8));
    const portrait = this.addPatientSprite(board, 164, -3, 198, previewSkin);
    if (portrait && previewSkin.id !== 'patient-default' && !this.skinHasCustomArt(previewSkin)) portrait.setTint(previewSkin.color);
    board.add(this.add.text(164, 111, previewSkin.name, { fontFamily: UI_FONT_STACK, fontSize: `${caseSkinNameSize}px`, color: '#fff3d0', stroke: '#101b24', strokeThickness: 3, wordWrap: { width: 180, useAdvancedWrap: true }, align: 'center' }).setOrigin(0.5).setFixedSize(190, 38).setFontStyle('bold'));
    layer.add(board);

    const previewUnlocked = this.isSkinAvailable(previewSkin.id);
    const previewEquipped = previewSkin.id === this.progress.equippedSkinId;
    const previewAction = previewUnlocked
      ? (previewEquipped ? '已装备' : '装备')
      : previewSkin.category === 'boss'
        ? '去挑战'
        : previewSkin.category === 'basic'
          ? `第 ${previewSkin.unlockFloor ?? '?'} 层解锁`
          : `购买 ${this.skinPurchaseCost(previewSkin.id)}`;
    const previewActionX = boardX + 164 * caseSheetScale;
    const previewActionY = boardY + 220;
    this.addButton(layer, previewActionX, previewActionY, 88 * caseSheetScale, 26 * caseSheetScale, previewAction, () => {
      if (previewUnlocked) this.equipSkin(previewSkin.id);
      else if (previewSkin.category === 'boss') this.showDailyChallenge();
      else if (previewSkin.category === 'store') void this.buySkin(previewSkin.id);
    }, previewEquipped || previewSkin.category === 'basic' ? 'muted' : 'primary', 8);
    const previewAdEligible = !previewUnlocked && (previewSkin.category === 'boss' || previewSkin.category === 'store');
    if (previewAdEligible) {
      const adX = boardX + 250 * caseSheetScale;
      if (this.textures.exists('ad-reward-v1')) this.addImageAction(layer, adX, previewActionY, 40, 40, 'ad-reward-v1', () => { void this.watchSkinAd(previewSkin.id); }, 8);
      layer.add(this.add.text(adX, previewActionY + 30, '看广告免费体验一天', {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${this.uiFontSize(8, 1.5)}px`,
        color: palette.amber,
        stroke: '#071015',
        strokeThickness: 2,
      }).setOrigin(0.5));
    }
    if (this.skinAdMessage) layer.add(this.add.text(previewActionX, previewActionY + 32, this.skinAdMessage, {
      fontFamily: 'Microsoft YaHei',
      fontSize: '9px',
      color: palette.danger,
      stroke: '#071015',
      strokeThickness: 2,
      wordWrap: { width: 170 },
      align: 'center',
    }).setOrigin(0.5));

    const skinPanelX = clamp(965 + layoutShift, safe.left + 285, safe.right - 285);
    const skinPanelY = this.safeBottomY(438, 236);
    const skinPanel = this.add.container(skinPanelX, skinPanelY);
    if (this.textures.exists('profile-skin-background-v1')) skinPanel.add(this.add.image(0, 0, 'profile-skin-background-v1').setOrigin(0.5).setDisplaySize(620, 452).setAlpha(0.9));
    else skinPanel.add(this.add.rectangle(0, 0, 620, 452, 0x09141b, 0.9));
    if (this.textures.exists('profile-skin-panel-frame-v1')) {
      skinPanel.add(this.add.image(0, 0, 'profile-skin-panel-frame-v1').setOrigin(0.5).setDisplaySize(632, 422).setAlpha(0.96));
    }
    layer.add(skinPanel);
    const categories: Array<{ id: ProfileSkinCategory; label: string }> = [
      { id: 'all', label: '\u5168\u90e8' },
      { id: 'basic', label: '\u57fa\u7840' },
      { id: 'store', label: '\u5546\u5e97' },
      { id: 'boss', label: 'BOSS\u6389\u843d' },
    ];
    const setCategory = (category: ProfileSkinCategory) => {
      this.profileSkinCategory = category;
      this.profileSkinPage = 0;
      const categorySkins = this.skins.filter((skin) => category === 'all' || this.profileSkinCategoryFor(skin) === category);
      if (categorySkins.length > 0 && !categorySkins.some((skin) => skin.id === this.profilePreviewSkinId)) this.profilePreviewSkinId = categorySkins[0].id;
      this.showProfile();
    };
    if (this.textures.exists('ui-text-profile-tabs-v1')) {
      // Preserve the source aspect ratio so the four category labels stay
      // legible in the Builda canvas.
      layer.add(this.add.image(skinPanelX, this.safeTopY(190, 8), 'ui-text-profile-tabs-v1').setOrigin(0.5).setDisplaySize(430, 143));
      categories.forEach((category, index) => {
        const tabX = skinPanelX - 126 + index * 84;
        this.uiActionRegions.push({
          phase: this.phase,
          x: tabX,
          y: this.safeTopY(190, 8),
          width: index === 3 ? 90 : 68,
          height: 36,
          callback: () => setCategory(category.id),
          setPressed: () => undefined,
        });
      });
    } else {
      categories.forEach((category, index) => {
        this.addPlainTextAction(layer, skinPanelX - 126 + index * 84, this.safeTopY(190, 8), index === 3 ? 90 : 68, 36, category.label, () => setCategory(category.id), this.profileSkinCategory === category.id ? palette.teal : palette.muted, 10);
      });
    }
    const visibleSkins = this.skins.filter((skin) => this.profileSkinCategory === 'all' || this.profileSkinCategoryFor(skin) === this.profileSkinCategory);
    const profileSkinPageCount = Math.max(1, Math.ceil(visibleSkins.length / 3));
    this.profileSkinPage = clamp(this.profileSkinPage, 0, profileSkinPageCount - 1);
    const pageSkins = visibleSkins.slice(this.profileSkinPage * 3, this.profileSkinPage * 3 + 3);
    const skinGridTop = 356;
    const skinGridColumnGap = 154;
    // Keep the second row's nameplate inside the raster panel on compact
    // landscape viewports, with enough breathing room below the text.
    const skinGridGapY = 136;
    this.profileSkinViewport = { left: skinPanelX - 280, right: skinPanelX + 280, top: 232, bottom: 612 };
    pageSkins.forEach((skin, index) => {
      const unlocked = this.isSkinAvailable(skin.id);
      const selected = skin.id === this.profilePreviewSkinId;
      const column = index % 3;
      const row = 0;
      const x = skinPanelX - skinGridColumnGap + column * skinGridColumnGap;
      const y = skinGridTop + row * skinGridGapY;
      const card = this.add.container(x, y);
      const frameIndex = unlocked ? (selected ? 1 : 0) : 2;
      // Keep each page to one centered row of three and enlarge the portrait without
      // changing its source aspect ratio.
      if (this.textures.exists('profile-skin-frame-v1')) {
        card.add(this.add.image(0, 0, 'profile-skin-frame-v1', frameIndex).setOrigin(0.5).setDisplaySize(142, 248).setAlpha(unlocked ? 0.98 : 0.58));
      }
      const mini = this.addPatientSprite(card, 0, -8, 128, skin);
      if (mini && mini.displayWidth > 112) mini.setDisplaySize(112, mini.displayHeight * 112 / mini.displayWidth);
      if (mini && skin.id !== 'patient-default' && !this.skinHasCustomArt(skin)) mini.setTint(skin.color);
      // Keep locked skins fully readable; the lock frame and a light veil
      // communicate availability without making the character disappear.
      if (mini && !unlocked) mini.setAlpha(0.94);
      // A second frame pass keeps lock seals and edge ornament above the
      // portrait while preserving the original portrait proportions.
      if (this.textures.exists('profile-skin-frame-v1')) {
        card.add(this.add.image(0, 0, 'profile-skin-frame-v1', frameIndex).setOrigin(0.5).setDisplaySize(142, 248).setAlpha(unlocked ? 0.98 : 0.58));
      }
      card.add(this.add.text(0, 138, this.uiLabel(skin.name), {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${this.uiFontSize(14)}px`,
        color: unlocked ? palette.cream : palette.muted,
        stroke: '#071015',
        strokeThickness: 3,
        wordWrap: { width: 164 },
        align: 'center',
        lineSpacing: 1,
      }).setOrigin(0.5).setFixedSize(166, 84).setFontStyle('bold'));
      layer.add(card);
      // Selecting a card immediately updates the larger preview on the left.
      this.uiActionRegions.push({ phase: this.phase, x, y, width: 166, height: 210, callback: () => this.previewSkin(skin.id), setPressed: (pressed) => card.setScale(pressed ? 0.97 : 1) });
    });
    if (profileSkinPageCount > 1) {
       const pageY = this.safeBottomY(632, 8);
      const pageControlOffset = 94;
      if (this.profileSkinPage > 0) {
        this.addImageAction(layer, skinPanelX - pageControlOffset, pageY, 56, 56, 'profile-arrow-left-v1', () => this.setProfileSkinPage(this.profileSkinPage - 1, profileSkinPageCount));
      }
      if (this.profileSkinPage < profileSkinPageCount - 1) {
        this.addImageAction(layer, skinPanelX + pageControlOffset, pageY, 56, 56, 'profile-arrow-right-v1', () => this.setProfileSkinPage(this.profileSkinPage + 1, profileSkinPageCount));
      }
    layer.add(this.add.text(skinPanelX, pageY, `${this.profileSkinPage + 1} / ${profileSkinPageCount}`, { fontFamily: 'Courier New', fontSize: `${this.uiFontSize(12, 1.35)}px`, color: palette.cream, stroke: '#071015', strokeThickness: 2 }).setOrigin(0.5).setFontStyle('bold'));
    }
    this.addButton(layer, 88, 38, 150, 42, '\u8fd4\u56de\u4e3b\u754c\u9762', () => this.showStart(), 'muted', 8);
    this.overlay = layer;
    if (!this.playerIdentityLoaded) {
      void this.ensurePlayerIdentity().then(() => { if (this.overlay === layer && layer.active) this.showProfile(); });
    }
  }

  private profileSkinCategoryFor(skin: SkinDef): ProfileSkinCategory {
    return skin.category;
  }

  private previewSkin(id: string) {
    if (!this.skins.some((skin) => skin.id === id)) return;
    this.profilePreviewSkinId = id;
    this.showProfile();
  }

  private setProfileSkinPage(page: number, pageCount: number) {
    this.profileSkinPage = clamp(Math.round(page), 0, Math.max(0, pageCount - 1));
    this.showProfile();
  }

  private setWeaponSkinPage(page: number, pageCount: number) {
    this.weaponSkinPage = clamp(Math.round(page), 0, Math.max(0, pageCount - 1));
    this.showWeaponSelect(this.runMode === 'daily' ? 'daily' : 'mainline', this.selectedStartFloor);
  }

  private equipSkin(id: string) {
    if (!this.isSkinAvailable(id)) return;
    this.progress.equippedSkinId = id;
    this.saveProgress();
    this.showProfile();
  }

  private skinPurchaseCost(id: string) {
    const cost = skinDefForId(id)?.cost ?? 999;
    return Math.min(30000, Math.max(10000, cost));
  }

  private async buySkin(id: string) {
    if (this.isSkinAvailable(id)) {
      this.equipSkin(id);
      return;
    }
    if (skinDefForId(id)?.category !== 'store') return;
    if (this.skinPaymentPending) return;
    this.skinPaymentPending = true;
    this.skinAdMessage = '';
    let purchaseGranted = false;
    try {
      if (!buildaPlatform.sdk?.pay?.showPayPanel) {
        this.skinAdMessage = '请在创游世界内完成购买';
      } else {
        const result = await buildaPlatform.showPayPanel(this.configuredSkinSaleId(id));
        if (!result) {
          this.skinAdMessage = '支付服务暂不可用，皮肤未解锁';
        } else if (!result.success) {
          this.skinAdMessage = '购买已取消或支付失败，皮肤未解锁';
        } else if (!result.orderId.trim()) {
          this.skinAdMessage = '支付未返回订单号，皮肤未解锁';
        } else if (!(await this.recordPaymentOrder(result.orderId))) {
          this.skinAdMessage = '该支付订单已使用或无法校验，皮肤未解锁';
        } else {
          purchaseGranted = true;
        }
      }
    } catch {
      this.skinAdMessage = '支付暂不可用，皮肤未解锁';
    } finally {
      this.skinPaymentPending = false;
    }
    if (!purchaseGranted) {
      const failureMessage = this.skinAdMessage;
      this.skinAdMessage = '';
      this.showProfile();
      if (failureMessage) this.showToast(failureMessage);
      return;
    }
    this.progress.unlockedSkinIds.push(id);
    this.progress.equippedSkinId = id;
    this.profilePreviewSkinId = id;
    this.saveProgress();
    this.showProfile();
  }

  private async watchSkinAd(id: string) {
    const skin = skinDefForId(id);
    if (!skin || skin.category === 'basic' || this.isSkinAvailable(id) || this.skinAdPending) return;
    this.skinAdPending = true;
    this.skinAdMessage = '';
    let success = false;
    try {
      if (!buildaPlatform.sdk?.ad?.showRewardAd) {
        this.skinAdMessage = '当前环境未接入激励广告';
      } else {
        const successResult = await buildaPlatform.showRewardAd(`skin_trial_${id}`);
        const result = { ok: successResult, data: { success: successResult } };
        if (!result.ok || !result.data?.success) this.skinAdMessage = '广告未完成，本次未解锁体验';
        else success = true;
      }
    } catch {
      this.skinAdMessage = '激励广告暂不可用，请稍后再试';
    } finally {
      this.skinAdPending = false;
    }
    if (success) {
      this.progress.skinTrialExpiresAt ??= {};
      this.progress.skinTrialExpiresAt[id] = Date.now() + SKIN_TRIAL_DURATION_MS;
      this.progress.equippedSkinId = id;
      this.profilePreviewSkinId = id;
      this.skinAdMessage = '';
      this.saveProgress();
    }
    const failureMessage = this.skinAdMessage;
    this.skinAdMessage = '';
    this.showProfile();
    if (failureMessage) this.showToast(failureMessage);
  }

  private configuredSkinSaleId(id: string) {
    const config = (window as Window & { __BUILDA_SKIN_SALE_IDS__?: Record<string, unknown> }).__BUILDA_SKIN_SALE_IDS__;
    const saleId = config?.[id];
    if (typeof saleId === 'string' && isValidSaleId(saleId)) return saleId;
    return skinSaleId(id);
  }

  private configuredWeaponSkinSaleId(id: string) {
    const config = (window as Window & { __BUILDA_WEAPON_SKIN_SALE_IDS__?: Record<string, unknown> }).__BUILDA_WEAPON_SKIN_SALE_IDS__;
    const saleId = config?.[id];
    if (typeof saleId === 'string' && isValidSaleId(saleId)) return saleId;
    return weaponSkinSaleId(id);
  }

  private weaponAppearanceLabel(weapon: Weapon) {
    return this.equippedWeaponSkin(weapon.weaponClass).name;
  }

  private equipWeaponSkin(id: string) {
    const skin = this.weaponSkins.find((candidate) => candidate.id === id);
    if (!skin || !this.isWeaponSkinAvailable(id)) return;
    this.progress.equippedWeaponSkinIds[skin.weaponClass] = id;
    this.saveProgress();
  }

  private async buyWeaponSkin(id: string, mode: RunMode) {
    const skin = this.weaponSkins.find((candidate) => candidate.id === id);
    if (!skin || skin.category !== 'store' || this.isWeaponSkinAvailable(id) || this.weaponSkinPaymentPending) return;
    this.weaponSkinPaymentPending = true;
    this.weaponSkinAdMessage = '';
    let purchaseGranted = false;
    try {
      if (!buildaPlatform.sdk?.pay?.showPayPanel) {
        this.weaponSkinAdMessage = '请在创游世界内完成购买';
      } else {
        const result = await buildaPlatform.showPayPanel(this.configuredWeaponSkinSaleId(id));
        if (!result) {
          this.weaponSkinAdMessage = '支付服务暂不可用，武器皮肤未解锁';
        } else if (!result.success) {
          this.weaponSkinAdMessage = '购买已取消或支付失败，武器皮肤未解锁';
        } else if (!result.orderId.trim()) {
          this.weaponSkinAdMessage = '支付未返回订单号，武器皮肤未解锁';
        } else if (!(await this.recordPaymentOrder(result.orderId))) {
          this.weaponSkinAdMessage = '该支付订单已使用或无法校验，武器皮肤未解锁';
        } else {
          purchaseGranted = true;
        }
      }
    } catch {
      this.weaponSkinAdMessage = '支付暂不可用，武器皮肤未解锁';
    } finally {
      this.weaponSkinPaymentPending = false;
    }
    if (!purchaseGranted) {
      const failureMessage = this.weaponSkinAdMessage;
      this.weaponSkinAdMessage = '';
      this.showWeaponSelect(mode, this.selectedStartFloor);
      if (failureMessage) this.showToast(failureMessage);
      return;
    }
    this.progress.unlockedWeaponSkinIds.push(id);
    this.progress.equippedWeaponSkinIds[skin.weaponClass] = id;
    this.weaponSelectPreviewSkinId = id;
    this.saveProgress();
    this.showWeaponSelect(mode, this.selectedStartFloor);
  }

  private async watchWeaponSkinAd(id: string, mode: RunMode) {
    const skin = this.weaponSkins.find((candidate) => candidate.id === id);
    if (!skin || skin.category === 'basic' || this.isWeaponSkinAvailable(id) || this.weaponSkinAdPending) return;
    this.weaponSkinAdPending = true;
    this.weaponSkinAdMessage = '';
    let success = false;
    try {
      if (!buildaPlatform.sdk?.ad?.showRewardAd) {
        this.weaponSkinAdMessage = '当前环境未接入激励广告';
      } else {
        const successResult = await buildaPlatform.showRewardAd(`weapon_skin_trial_${id}`);
        const result = { ok: successResult, data: { success: successResult } };
        if (!result.ok || !result.data?.success) this.weaponSkinAdMessage = '广告未完成，本次未解锁体验';
        else success = true;
      }
    } catch {
      this.weaponSkinAdMessage = '激励广告暂不可用，请稍后再试';
    } finally {
      this.weaponSkinAdPending = false;
    }
    if (success) {
      this.progress.weaponSkinTrialExpiresAt ??= {};
      this.progress.weaponSkinTrialExpiresAt[id] = Date.now() + SKIN_TRIAL_DURATION_MS;
      this.progress.equippedWeaponSkinIds[skin.weaponClass] = id;
      this.weaponSelectPreviewSkinId = id;
      this.weaponSkinAdMessage = '';
      this.saveProgress();
    }
    const failureMessage = this.weaponSkinAdMessage;
    this.weaponSkinAdMessage = '';
    this.showWeaponSelect(mode, this.selectedStartFloor);
    if (failureMessage) this.showToast(failureMessage);
  }

  private showDailyChallengeLegacy(toast?: string) {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    if (toast) {
      this.showToast(toast);
      toast = undefined;
    }
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'daily-challenge-background-v1', 0.56);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    this.addPixelFrame(layer, centerX, 350, 820, 560, 0x101b24, 0xb798e2);
    layer.add(this.add.text(centerX, this.safeTopY(104, 18), '每日挑战', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '25px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    this.addPixelFrame(layer, centerX, 330, 610, 250, 0x0a141b, 0x46636a);
    const completed = this.isDailyCompleted();
    layer.add(this.add.text(centerX, 266, completed ? '今日挑战已锁定' : '今日挑战可进入', { fontFamily: 'Microsoft YaHei', fontSize: '24px', color: completed ? palette.muted : palette.violet }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(centerX, 312, completed ? '每日只能完成一次，明日刷新挑战资格。' : '选择主线已解锁的武器，完成 50 波挑战。', { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.cream }).setOrigin(0.5));
    layer.add(this.add.text(centerX, 360, '挑战规则：选定武器后不可更换。每次升级三选一，银色、金色、棱彩卡牌会组合出不同战斗流派。', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.muted, wordWrap: { width: 510 } }).setOrigin(0.5));
    if (!completed) this.addButton(layer, centerX, this.safeBottomY(474, 74), 220, 44, '选择武器并开始', () => this.showWeaponSelect('daily', 1), 'primary');
    this.addButton(layer, 88, 38, 150, 42, '返回主界面', () => this.showStart(), 'muted');
    this.overlay = layer;
  }

  private showDailyChallenge(toast?: string) {
    if (!this.ensureAssetGroup('daily', () => this.showDailyChallenge(toast))) return;
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    if (toast) {
      this.showToast(toast);
      toast = undefined;
    }
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'daily-challenge-background-v2', 0.28);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;

    const completed = this.isDailyCompleted();
    const attempts = this.dailyAttemptsUsed();
    const monthly = this.monthlyChallenge();
    const cthulhuText = (x: number, y: number, value: string, size: number, color = palette.cream) => this.add.text(x, y, value, {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: `${this.uiFontSize(size, 1.25)}px`,
      color,
      stroke: '#050b10',
      strokeThickness: Math.max(2, Math.round(size / 7)),
    }).setOrigin(0.5).setFontStyle('bold');
    this.addUiTextTexture(layer, centerX, this.safeTopY(72, 8), 230, 88, 'ui-text-daily-v1', '每日挑战', 29);

    const bossX = clamp(205 + layoutShift, safe.left + 165, safe.right - 165);
    const bossPanel = this.add.container(bossX, 220);
    this.addUiTextTexture(layer, bossX, 79, 170, 56, 'ui-text-boss-month-v1', '本月首领', 15, palette.violet);
    const bossPortraitKey = this.textures.exists(monthly.portraitKey) ? monthly.portraitKey : MOON_MOTH_QUEEN_ART.portraitKey;
    if (this.textures.exists(bossPortraitKey)) {
      const portrait = this.add.image(0, -2, bossPortraitKey).setOrigin(0.5);
      const portraitScale = Math.min(230 / portrait.width, 230 / portrait.height);
      bossPanel.add(portrait.setScale(portraitScale));
    } else {
      bossPanel.add(this.add.circle(0, -2, 64, 0x24353c, 1).setStrokeStyle(2, 0xb798e2, 1));
      bossPanel.add(this.add.text(0, -2, 'BOSS', { fontFamily: 'Courier New', fontSize: '20px', color: palette.violet }).setOrigin(0.5));
    }
    layer.add(cthulhuText(bossX, 355, monthly.name, 20));
    layer.add(bossPanel);
    const playerDrop = this.skins.find((skin) => skin.id === monthly.drops.playerSkinId);
    const meleeDrop = this.weaponSkins.find((skin) => skin.id === monthly.drops.meleeWeaponSkinId);
    const rangedDrop = this.weaponSkins.find((skin) => skin.id === monthly.drops.rangedWeaponSkinId);
    const dropItems = [
      { texture: playerDrop ? this.skinCoverTextureKey(playerDrop) : '', label: playerDrop?.name ?? '玩家皮肤', id: monthly.drops.playerSkinId },
      { texture: meleeDrop ? this.weaponSkinTextureKey(meleeDrop) : '', label: meleeDrop?.name ?? '近战武器皮肤', id: monthly.drops.meleeWeaponSkinId },
      { texture: rangedDrop ? this.weaponSkinTextureKey(rangedDrop) : '', label: rangedDrop?.name ?? '远程武器皮肤', id: monthly.drops.rangedWeaponSkinId },
    ];
    dropItems.forEach((item, index) => {
      const x = 95 + layoutShift + index * 110;
      const panel = this.addDailyPanelFrame(layer, x, 500, 100, 150);
      if (item.texture && this.textures.exists(item.texture)) panel.add(this.add.image(0, -5, item.texture).setOrigin(0.5).setDisplaySize(58, 58));
      layer.add(this.add.text(x, 590, item.label, {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${this.uiFontSize(13, 1.5)}px`,
        color: palette.cream,
        stroke: '#050b10',
        strokeThickness: 2,
        align: 'center',
        wordWrap: { width: 102, useAdvancedWrap: true },
      }).setOrigin(0.5).setFixedSize(102, 34).setFontStyle('bold'));
    });
    layer.add(this.add.text(bossX, 644, '月末奖励按平台排行榜结果发放', {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: `${this.uiFontSize(11, 1.35)}px`,
      color: palette.muted,
      stroke: '#050b10',
      strokeThickness: 2,
      wordWrap: { width: 330 },
    }).setOrigin(0.5));

    const infoX = centerX + 5;
    if (completed) layer.add(cthulhuText(infoX, 168, '本月挑战已完成', 19, palette.green));
    else this.addUiTextTexture(layer, infoX, 158, 244, 54, 'ui-text-status-waiting-v1', '今晚的病区正在等待', 15);
    layer.add(this.add.text(infoX, 202, '通关最快记录', {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: `${this.uiFontSize(11, 1.55)}px`,
      color: palette.muted,
    }).setOrigin(0.5));
    const monthlyBestSeconds = this.currentMonthDailyBestSeconds();
    const statusStampKey = monthlyBestSeconds ? 'ui-stamp-completed-v1' : 'ui-stamp-uncompleted-v1';
    const statusStampFallback = monthlyBestSeconds ? '已通关' : '未通关';
    this.addUiTextTexture(layer, infoX, 258, 64, 64, statusStampKey, statusStampFallback, 15, monthlyBestSeconds ? palette.green : palette.danger);
    if (monthlyBestSeconds) layer.add(cthulhuText(infoX, 304, this.formatDailyTime(monthlyBestSeconds), 18, palette.green));
    const dailyActionY = this.safeBottomY(635, 52);
    const dailyActionLabel = attempts >= 3 ? '观看广告 +1 次' : completed ? '刷新纪录' : '开始挑战';
    this.addDailyImageButton(layer, centerX, dailyActionY, 330, 86, dailyActionLabel, () => this.showWeaponSelect('daily', 1), attempts >= 3 ? 0xed716e : 0xb798e2, 'daily-ad-icon-monthly-v1');
    layer.add(this.add.text(centerX, this.safeBottomY(700, 10), `剩余免费次数 ${Math.max(0, 3 - attempts)} / 3 · 广告次数 ${this.dailyAdTicketsAvailable()}`, {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: '11px',
      color: attempts >= 3 ? palette.amber : palette.cyan,
    }).setOrigin(0.5));

    const rankingX = clamp(1080 + layoutShift, safe.left + 180, safe.right - 180);
    const rankingY = this.safeBottomY(370, 282);
    const boardPanel = this.addDailyRankingFrame(layer, rankingX, rankingY, 360, 560);
    this.addUiTextTexture(boardPanel, 0, -194, 150, 56, 'ui-text-ranking-v1', '排行榜', 18);
    boardPanel.add(this.add.text(-111, -154, '排名', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: `${this.uiFontSize(10)}px`, color: palette.muted }));
    boardPanel.add(this.add.text(-76, -154, '昵称', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: `${this.uiFontSize(10)}px`, color: palette.muted }));
    boardPanel.add(this.add.text(108, -154, '通关记录', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: `${this.uiFontSize(10)}px`, color: palette.muted }).setOrigin(1, 0));
    boardPanel.add(this.add.rectangle(0, -136, 300, 1, 0x6bd3c1, 0.28));
    const board = this.dailyBoard;
    const rankingListTop = -120;
    const rankingListBottom = 180;
    const rankingRowHeight = 34;
    this.dailyRankingEntries = board;
    this.dailyRankingVisibleCount = Math.max(1, Math.floor((rankingListBottom - rankingListTop) / rankingRowHeight));
    this.dailyRankingMaxOffset = Math.max(0, board.length - this.dailyRankingVisibleCount);
    this.dailyRankingOffset = clamp(this.dailyRankingOffset, 0, this.dailyRankingMaxOffset);
    this.dailyRankingViewport = { left: rankingX - 162, right: rankingX + 162, top: rankingY - 150, bottom: rankingY + 168 };
    this.dailyRankingRows = this.add.container(0, 0);
    boardPanel.add(this.dailyRankingRows);
    const rankingMask = this.add.graphics().fillStyle(0xffffff, 1).fillRect(
      rankingX - 150,
      rankingY + rankingListTop - 16,
      300,
      rankingListBottom - rankingListTop + 22,
    ).setVisible(false).setScrollFactor(0);
    layer.add(rankingMask);
    this.dailyRankingRows.setMask(rankingMask.createGeometryMask());
    // The artwork already contains the ranking rail. Avoid adding a second
    // vector thumb that reads as an unrelated purple bar beside the board.
    this.dailyRankingScrollThumb = undefined;
    this.renderDailyRankingRows();
    boardPanel.add(this.add.rectangle(0, 165, 300, 1, 0x6bd3c1, 0.28));
    boardPanel.add(this.add.text(-76, 180, '我的排行', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: `${this.uiFontSize(12)}px`, color: palette.muted }));
    boardPanel.add(this.add.text(72, 180, this.dailyPlayerRankLabel(board), {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: `${this.uiFontSize(15)}px`,
      color: this.dailySelfRank ? palette.green : palette.danger,
    }).setOrigin(1, 0));
    layer.add(boardPanel);
    this.addButton(layer, 88, 38, 100, 34, '返回', () => this.showStart(), 'muted', 8);
    this.overlay = layer;
    const pendingIdentity = !this.playerIdentityLoaded;
    const pendingBoard = !this.dailyBoardLoaded;
    if (pendingIdentity || pendingBoard) {
      void Promise.all([pendingIdentity ? this.ensurePlayerIdentity() : Promise.resolve(), pendingBoard ? this.loadDailyBoard() : Promise.resolve()]).then(() => {
        if (this.overlay === layer && layer.active) this.showDailyChallenge(toast);
      });
    }
  }

  private showDailyChallengeLegacyLayout(toast?: string) {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    if (toast) {
      this.showToast(toast);
      toast = undefined;
    }
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'daily-challenge-background-v2', 0.28);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;

    const completed = this.isDailyCompleted();
    const attempts = this.dailyAttemptsUsed();
    const title = this.add.text(centerX, this.safeTopY(42, 8), '每日挑战', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '26px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold');
    layer.add(title);

    const bossX = clamp(205 + layoutShift, safe.left + 155, safe.right - 155);
    const bossPanel = this.add.container(bossX, 215);
    this.addUiTextTexture(layer, bossX, 74, 170, 56, 'ui-text-boss-month-v1', '本月首领', 15, palette.violet);
    if (this.textures.exists(MOON_MOTH_QUEEN_ART.portraitKey)) {
      bossPanel.add(this.add.image(0, -8, MOON_MOTH_QUEEN_ART.portraitKey).setOrigin(0.5).setDisplaySize(210, 142));
    } else {
      bossPanel.add(this.add.circle(0, -8, 56, 0x24353c, 1).setStrokeStyle(2, 0xb798e2, 1));
      bossPanel.add(this.add.text(0, -8, 'BOSS', { fontFamily: 'Courier New', fontSize: '20px', color: palette.violet }).setOrigin(0.5));
    }
    layer.add(this.add.text(bossX, 294, MOON_MOTH_QUEEN_ART.name, {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: '19px',
      color: palette.cream,
      stroke: '#050b10',
      strokeThickness: 3,
    }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(bossPanel);

    const dropPanel = this.addDailyPanelFrame(layer, bossX, 492, 310, 175);
    dropPanel.add(this.add.text(-116, -65, '掉落装备', { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.violet }).setFontStyle('bold'));
    const dropItems = [
      { texture: 'relic-crown', label: '月蚀王冠' },
      { texture: 'relic-fang', label: '狼王牙' },
      { texture: 'relic-hood', label: '夜巡兜帽' },
    ];
    dropItems.forEach((item, index) => {
      const x = -78 + index * 78;
      if (this.textures.exists(item.texture)) dropPanel.add(this.add.image(x, 5, item.texture).setOrigin(0.5).setDisplaySize(42, 42));
      dropPanel.add(this.add.text(x, 45, item.label, { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.cream }).setOrigin(0.5));
    });
    dropPanel.add(this.add.text(0, 70, completed ? '已加入病历档案' : '通关后随机掉落任意一件BOSS遗物', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: completed ? palette.green : palette.muted }).setOrigin(0.5));
    layer.add(dropPanel);

    const entryWeapon = this.createWeaponRoster().find((weapon) => weapon.id === this.selectedWeaponId) ?? this.createWeaponRoster()[0];
    const weaponPanel = this.addDailyPanelFrame(layer, 535 + layoutShift, 492, 310, 175);
    weaponPanel.add(this.add.text(-116, -65, '入场武器', { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.cyan }).setFontStyle('bold'));
    if (entryWeapon && this.textures.exists(this.weaponAssetKey(entryWeapon))) {
      weaponPanel.add(this.add.image(-72, 8, this.weaponAssetKey(entryWeapon)).setOrigin(0.5).setDisplaySize(68, 68));
    }
    weaponPanel.add(this.add.text(8, -2, entryWeapon?.name ?? '病院刀', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.cream }).setOrigin(0, 0.5).setFontStyle('bold'));
    weaponPanel.add(this.add.text(8, 27, entryWeapon ? `${entryWeapon.damage} 伤害  ·  ${entryWeapon.type === 'melee' ? '近战' : '远程'}` : '基础武器', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.muted }).setOrigin(0, 0.5));
    weaponPanel.add(this.add.text(8, 51, '进入战斗后不可更换', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.amber }).setOrigin(0, 0.5));
    layer.add(weaponPanel);

    const infoX = centerX + 15;
    layer.add(this.add.text(infoX, 176, completed ? '本月挑战已完成' : '今晚的病区正在等待', { fontFamily: 'Microsoft YaHei', fontSize: '19px', color: completed ? palette.green : palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(infoX, 214, '选定武器后完成 50 波战斗，升级卡牌会改变攻击节奏。', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.muted, wordWrap: { width: 300 } }).setOrigin(0.5));
    layer.add(this.add.text(infoX, 286, '通关最快记录', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.muted }).setOrigin(0.5));
    layer.add(this.add.text(infoX, 315, this.formatDailyTime(this.progress.dailyBestSeconds), { fontFamily: 'Courier New', fontSize: '24px', color: this.progress.dailyBestSeconds ? palette.green : palette.amber }).setOrigin(0.5).setFontStyle('bold'));
    if (!completed) this.addDailyImageButton(layer, centerX, this.safeBottomY(635, 52), 330, 86, attempts >= 3 ? '观看广告 +1 次' : '开始挑战', () => this.showWeaponSelect('daily', 1), attempts >= 3 ? 0xed716e : 0xb798e2, 'daily-ad-icon-monthly-v1');
    layer.add(this.add.text(centerX, this.safeBottomY(700, 10), `剩余免费次数 ${Math.max(0, 3 - attempts)} / 3 · 广告次数 ${this.dailyAdTicketsAvailable()}`, { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: attempts >= 3 ? palette.amber : palette.cyan }).setOrigin(0.5));

    const boardPanel = this.addDailyRankingFrame(layer, clamp(1080 + layoutShift, safe.left + 175, safe.right - 175), this.safeBottomY(370, 282), 350, 600);
    boardPanel.add(this.add.text(-125, -268, '排行榜', { fontFamily: 'Microsoft YaHei', fontSize: '17px', color: palette.cream }).setFontStyle('bold'));
    boardPanel.add(this.add.text(-137, -228, '名次', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.muted }));
    boardPanel.add(this.add.text(-65, -228, '昵称', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.muted }));
    boardPanel.add(this.add.text(137, -228, '用时', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.muted }).setOrigin(1, 0));
    const board = this.dailyBoard;
    board.slice(0, 20).forEach((entry, index) => {
      const y = -207 + index * 18;
      const own = entry.name === this.playerNickname;
      if (own) boardPanel.add(this.add.rectangle(0, y + 8, 280, 17, 0x18353b, 0.9));
      boardPanel.add(this.add.text(-137, y + 8, String(entry.rank).padStart(2, '0'), { fontFamily: 'Courier New', fontSize: '10px', color: entry.rank === 1 ? palette.amber : palette.cream }).setOrigin(0, 0.5));
      boardPanel.add(this.add.text(-65, y + 8, entry.name, { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: own ? palette.teal : palette.cream }).setOrigin(0, 0.5));
      boardPanel.add(this.add.text(137, y + 8, entry.score > 0 ? this.formatDailyTime(Math.max(1, Math.round((100000 - entry.score) / 100))) : '未通关', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '10px', color: entry.score > 0 ? palette.amber : palette.muted }).setOrigin(1, 0.5));
    });
    boardPanel.add(this.add.text(-137, 184, '我的记录', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.muted }));
    boardPanel.add(this.add.text(137, 184, this.formatDailyTime(this.progress.dailyBestSeconds), { fontFamily: 'Courier New', fontSize: '20px', color: this.progress.dailyBestSeconds ? palette.green : palette.muted }).setOrigin(1, 0));
    layer.add(boardPanel);
    this.addButton(layer, 76, 38, 100, 34, '返回', () => this.showStart(), 'muted', 8);
    this.overlay = layer;
    const pendingIdentity = !this.playerIdentityLoaded;
    const pendingBoard = !this.dailyBoardLoaded;
    if (pendingIdentity || pendingBoard) {
      void Promise.all([pendingIdentity ? this.ensurePlayerIdentity() : Promise.resolve(), pendingBoard ? this.loadDailyBoard() : Promise.resolve()]).then(() => {
        if (this.overlay === layer && layer.active) this.showDailyChallenge(toast);
      });
    }
  }

  private archiveKindUnlocked(kind: EnemyKind) {
    return this.progress.archiveKinds.includes(kind);
  }

  private unlockArchiveKind(kind: EnemyKind) {
    if (kind === 'boss' && !this.progress.archiveKinds.includes('boss')) {
      this.progress.archiveKinds.push('boss');
      this.saveProgress();
    } else if (kind !== 'boss' && !this.progress.archiveKinds.includes(kind)) {
      this.progress.archiveKinds.push(kind);
      this.saveProgress();
    }
  }

  private showArchive() {
    if (!this.ensureAssetGroup('mainline', () => this.showArchive())) return;
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.58);
    this.drawMenuMotif(layer);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    this.addPixelFrame(layer, centerX, 350, 980, 570, 0x101b24, 0x7ab9d0);
    layer.add(this.add.text(centerX, this.safeTopY(92, 18), '病历档案 / ARCHIVE', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '25px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(centerX, this.safeTopY(128, 18), '遇到异常体后解锁记录；未遇到的条目保留为问号剪影。', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.muted }).setOrigin(0.5));

    const entries: Array<{ kind: EnemyKind; name: string; skill: string; wave: number }> = [
      { kind: 'chaser', name: '追猎异常体', skill: '近身追击，接触时造成伤害', wave: 1 },
      { kind: 'shooter', name: '投射病患', skill: '保持距离发射追踪弹', wave: 3 },
      { kind: 'disruptor', name: '干扰体', skill: '脚下生成范围干扰波', wave: 6 },
      { kind: 'tentacle', name: '触手病灶', skill: '远距离横扫，预警范围较大', wave: 9 },
      { kind: 'bomber', name: '爆裂病灶', skill: '锁定位置后延迟爆炸', wave: 12 },
      { kind: 'eye', name: '窥视之眼', skill: '直线激光，命中后造成重击', wave: 15 },
    ];
    layer.add(this.add.text(centerX, this.safeTopY(164, 18), '异常体图鉴', { fontFamily: 'Microsoft YaHei', fontSize: '17px', color: palette.cyan }).setOrigin(0.5).setFontStyle('bold'));
    entries.forEach((entry, index) => {
      const unlocked = this.archiveKindUnlocked(entry.kind);
      const x = 350 + layoutShift + (index % 3) * 290;
      const y = 212 + Math.floor(index / 3) * 82;
      const color = unlocked ? this.enemyColor(entry.kind) : 0x46545a;
      const stats = enemyCombatStats(entry.kind, entry.wave);
      const card = this.add.container(x, y);
      card.add(this.add.rectangle(0, 0, 258, 68, 0x132129, 1).setStrokeStyle(1, color, 0.9));
      card.add(this.add.circle(-99, 0, 20, color, unlocked ? 0.28 : 0.08).setStrokeStyle(1, color, 1));
      card.add(this.add.text(-99, 0, unlocked ? this.enemyGlyph(entry.kind) : '?', { fontFamily: 'Microsoft YaHei', fontSize: '15px', color: unlocked ? hex(color) : palette.muted }).setOrigin(0.5));
      card.add(this.add.text(-70, -22, unlocked ? entry.name : '??? 未解锁', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: unlocked ? palette.cream : palette.muted }).setOrigin(0, 0.5));
      card.add(this.add.text(-70, 1, unlocked ? `生命 ${stats.hp} · 伤害 ${stats.damage.toFixed(1)}` : `第 ${entry.wave} 波后可记录`, { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: unlocked ? palette.amber : palette.muted }).setOrigin(0, 0.5));
      card.add(this.add.text(-70, 20, unlocked ? entry.skill : '击败或遇到后显示技能', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.muted, wordWrap: { width: 178 } }).setOrigin(0, 0.5));
      layer.add(card);
    });

    const bossEntries: Array<{ kind: EnemyKind; name: string; skill: string }> = [
      { kind: 'miniBoss', name: '第 10 波 · 小首领', skill: '冲击领域 + 追踪爆弹' },
      { kind: 'boss', name: '楼层首领', skill: '领域攻击 + 激光锁定 + 爆炸冲击' },
    ];
    layer.add(this.add.text(centerX, 382, '首领图鉴', { fontFamily: 'Microsoft YaHei', fontSize: '17px', color: palette.amber }).setOrigin(0.5).setFontStyle('bold'));
    bossEntries.forEach((entry, index) => {
      const unlocked = this.archiveKindUnlocked(entry.kind);
      const x = 490 + layoutShift + index * 300;
      const color = unlocked ? this.enemyColor(entry.kind) : 0x46545a;
      const stats = enemyCombatStats(entry.kind, entry.kind === 'boss' ? this.wavesPerFloor() : 10);
      const card = this.add.container(x, 430);
      card.add(this.add.rectangle(0, 0, 270, 72, 0x1d2930, 1).setStrokeStyle(2, color, 0.9));
      card.add(this.add.circle(-104, 0, 23, color, unlocked ? 0.28 : 0.08).setStrokeStyle(1, color, 1));
      card.add(this.add.text(-104, 0, unlocked ? this.enemyGlyph(entry.kind) : '?', { fontFamily: 'Microsoft YaHei', fontSize: '17px', color: unlocked ? hex(color) : palette.muted }).setOrigin(0.5));
      card.add(this.add.text(-72, -23, unlocked ? entry.name : '??? 未解锁首领', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: unlocked ? palette.cream : palette.muted }).setOrigin(0, 0.5));
      card.add(this.add.text(-72, 0, unlocked ? `生命 ${stats.hp} · 伤害 ${stats.damage.toFixed(1)}` : '完成挑战后解锁', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: unlocked ? palette.amber : palette.muted }).setOrigin(0, 0.5));
      card.add(this.add.text(-72, 21, unlocked ? entry.skill : '击败后显示技能', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.muted }).setOrigin(0, 0.5));
      layer.add(card);
    });

    layer.add(this.add.text(centerX, this.safeBottomY(520, 92), `已记录 ${this.progress.archiveKinds.length} 项 · 当前推进至第 ${this.floor} 层 / 共 ${TOTAL_FLOORS} 层`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '12px', color: palette.cyan }).setOrigin(0.5));
    this.addButton(layer, 88, 38, 52, 44, '返回主界面', () => this.showStart(), 'muted', 12);
    this.overlay = layer;
  }

  private showSettings() {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.58);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    this.addPixelFrame(layer, centerX, 350, 700, 500, 0x101b24, 0x8fd17c);
    layer.add(this.add.text(centerX, this.safeTopY(116, 18), '夜班设置 / OPTIONS', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '25px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(centerX, this.safeTopY(154, 18), '设置只影响表现，不改变本层战斗数值。', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.muted }).setOrigin(0.5));
    const setting = (y: number, label: string, value: boolean, callback: () => void) => {
      layer.add(this.add.text(430 + layoutShift, y - 9, label, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '16px', color: palette.cream }));
      this.addButton(layer, 770 + layoutShift, y, 160, 38, value ? '开启' : '关闭', callback, value ? 'primary' : 'muted');
    };
    setting(234, '受击震动', this.screenShakeEnabled, () => { this.screenShakeEnabled = !this.screenShakeEnabled; this.showSettings(); });
    setting(302, '数字伤害', this.damageNumbersEnabled, () => { this.damageNumbersEnabled = !this.damageNumbersEnabled; this.showSettings(); });
    layer.add(this.add.text(centerX, 414, '推荐横屏 16:9 · 支持触摸摇杆与键盘调试', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.cyan }).setOrigin(0.5));
    this.addButton(layer, 88, 38, 52, 44, '返回主界面', () => this.showStart(), 'muted', 12);
    this.overlay = layer;
  }

  private showHelp() {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.58);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    this.addPixelFrame(layer, centerX, 350, 780, 500, 0x101b24, 0xf2bf62);
    layer.add(this.add.text(centerX, this.safeTopY(116, 18), '夜班手册 / FIELD MANUAL', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '25px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    const help = [
      ['移动', '在屏幕任意位置按住并拖动，松开手指即可停下。'],
      ['攻击', '武器会自动环绕并攻击，武器数越多覆盖越广。'],
      ['成长', '拾取绿色经验，升级时从三张医嘱卡中选择一张。'],
      ['SAN', 'SAN 低于 30 会自动进入异化：出怪、移速和攻击提高，护盾吸收降低。SAN 归零后失去意识。'],
      ['成长', '击杀敌人获得经验，升级时选择卡牌；卡牌前两次可免费刷新。'],
    ];
    help.forEach(([title, detail], index) => {
      const y = 198 + index * 52;
      layer.add(this.add.text(424 + layoutShift, y, title, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '16px', color: palette.amber }).setFontStyle('bold'));
      layer.add(this.add.text(536 + layoutShift, y, detail, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.cream, wordWrap: { width: 400 } }));
    });
    this.addButton(layer, 88, 38, 52, 44, '返回主界面', () => this.showStart(), 'muted', 12);
    this.overlay = layer;
  }

  private startRun(targetFloor = this.floor, mode: RunMode = this.runMode, weaponId = this.selectedWeaponId) {
    if (mode === 'daily' && !this.ensureAssetGroup('daily', () => this.startRun(targetFloor, mode, weaponId))) return;
    if (!this.ensureAssetGroup('battle', () => this.startRun(targetFloor, mode, weaponId))) return;
    this.startRunInternal(targetFloor, mode, weaponId);
  }

  private startRunInternal(targetFloor = this.floor, mode: RunMode = this.runMode, weaponId = this.selectedWeaponId) {
    this.normalizeTemporaryUnlocks();
    this.releaseJoystick();
    this.clearOverlay();
    this.clearRunObjects();
    this.runMode = mode;
    this.lastDailyBossDropIds = [];
    this.tutorialRun = mode === 'mainline' && Math.round(targetFloor) === 0;
    this.floor = mode === 'daily' ? 1 : this.tutorialRun ? 0 : clamp(Math.round(targetFloor), 1, Math.min(TOTAL_FLOORS, this.progress.maxFloor));
    this.selectedWeaponId = weaponId;
    this.phase = 'battle';
    this.dialogueIndex = 0;
    this.dialogueTransitioning = false;
    this.wave = 1;
    if (this.developerMode.options.enabled && this.developerWaveOverride !== undefined) {
      this.wave = clamp(this.developerWaveOverride, 1, this.wavesPerFloor());
    }
    this.waveTimer = 0;
    this.spawnTimer = 0.35;
    this.waveSpawned = 0;
    this.waveClearedMessage = '';
    this.waveClearedTimer = 0;
    this.waveBreakTimer = 0;
    this.pendingWaveBreak = false;
    this.waveCleanupComplete = false;
    this.upgradeRefreshCount = 0;
    this.upgradeChoices = [];
    this.upgradeCardRefreshUsed = [false, false, false];
    this.upgradePaymentPending = false;
    this.upgradePaymentMessage = '';
    this.attackTimer = 0.25;
    this.weaponAngle = 0;
    this.previousWeaponAngle = 0;
    this.weaponOrbitRadius = 0;
    this.elapsed = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.shield = this.tutorialRun ? TUTORIAL_SHOWCASE_SHIELD : 0;
    this.maxShield = this.tutorialRun ? TUTORIAL_SHOWCASE_SHIELD : 0;
    this.san = 100;
    this.xp = 0;
    this.level = this.tutorialRun ? TUTORIAL_SHOWCASE_LEVEL : 1;
    this.xpNeed = experienceRequiredForLevel(this.level);
    this.kills = 0;
    this.sanPulse = 0;
    this.mutated = false;
    this.damageBonus = this.tutorialRun ? TUTORIAL_SHOWCASE_DAMAGE_BONUS : 0;
    this.roundDamageBonus = 0;
    this.rotationSpeedMultiplier = this.tutorialRun ? 3 : 1;
    this.rotationUpgradeStacks = 0;
    this.rotationStacksConvertedToAmmo = 0;
    this.waveBossSpawned = false;
    this.runSpeed = this.tutorialRun ? TUTORIAL_SHOWCASE_RUN_SPEED : 380;
    this.pickupRadius = this.tutorialRun ? TUTORIAL_SHOWCASE_PICKUP_RADIUS : DEFAULT_PICKUP_RADIUS;
    this.magnet = this.tutorialRun ? TUTORIAL_SHOWCASE_MAGNET : 0;
    this.gameSpeed = this.developerMode.options.enabled && this.developerMode.options.initialGameSpeed !== undefined
      ? clamp(this.developerMode.options.initialGameSpeed, 0.25, 8)
      : 1;
    this.dailyStatusSynergy = 0;
    this.dailyShieldRetaliation = 0;
    this.dailyMagnetSynergy = 0;
    this.dailyVoidPulse = 0;
    this.dailyVoidPulseTimer = 0;
    this.dailyEchoShots = 0;
    this.dailyBloodPact = 0;
    this.dailyKillNova = 0;
    this.dailySlowField = 0;
    this.waveLength = this.durationForWave();
    this.weapons = this.createWeaponRoster();
    this.weapons.forEach((weapon) => { weapon.owned = weapon.id === weaponId; });
    const selectedWeapon = this.weapons.find((weapon) => weapon.id === weaponId);
    if (!selectedWeapon || (mode === 'daily' && !this.isWeaponUnlocked(weaponId))) {
      this.selectedWeaponId = 'knife';
      this.weapons.forEach((weapon) => { weapon.owned = weapon.id === 'knife'; });
    }
    const starting = this.currentWeapon();
    if (starting) {
      starting.level = this.tutorialRun ? TUTORIAL_SHOWCASE_WEAPON_LEVEL : 1;
      starting.copies = this.tutorialRun ? MAX_WEAPON_COPIES : 1;
      starting.ammo = this.tutorialRun ? 8 : 1;
    }
    this.applyEquippedSkinBonus();
    this.dailyBossRewardGranted = false;
    this.activeAttackStatus = undefined;
    this.attackStatusLevel = 0;
    this.attackStatusDuration = 0;
    this.attackStatusDamage = 0;
    this.attackStatusSpreadTargets = 0;
    this.attackStatusSpreadRadius = 0;
    this.playerAnimation = 'idle';
    this.playerDirection = 'down';
    this.playerHitTimer = 0;
    this.playerDeathTimer = 0;
    this.playerDeathPending = false;
    this.createPlayer();
    this.cameras.main.setBounds(WORLD_BOUNDS.left, WORLD_BOUNDS.top, WORLD_BOUNDS.right - WORLD_BOUNDS.left, WORLD_BOUNDS.bottom - WORLD_BOUNDS.top);
    this.cameras.main.setZoom(this.gameplayCameraZoom);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.updateHud();
    if (this.tutorialRun) this.showDialogue();
    else this.beginBattle();
  }

  private createPlayer() {
    this.player = this.add.container(650, 380).setDepth(10);
    const bodyLayer = this.add.container(0, 0).setScale(this.playerSpriteScale);
    const weaponLayer = this.add.container(0, 0);
    this.playerBodyLayer = bodyLayer;
    this.playerWeaponLayer = weaponLayer;
    this.player.add(bodyLayer);
    this.player.add(weaponLayer);
    this.playerSprite = undefined;
    const equippedSkin = this.activePlayerSkin();
    const skinColor = equippedSkin.color;
    this.playerGlow = this.add.circle(0, 0, 42, this.mutated ? 0xed716e : 0x6bd3c1, 0);
    bodyLayer.add(this.playerGlow);
    this.playerSpriteTargetHeight = 104;
    this.playerSprite = this.addPlayerSprite(bodyLayer, 0, 5, this.playerSpriteTargetHeight, equippedSkin);
    if (!this.playerSprite) {
      bodyLayer.add(this.add.circle(0, 2, 18, this.mutated ? 0x9a3846 : skinColor, 1).setStrokeStyle(2, 0x17262d, 1));
      bodyLayer.add(this.add.rectangle(0, 23, 22, 21, this.mutated ? 0x8b3446 : 0x415c67, 1).setStrokeStyle(2, 0x17262d, 1));
      bodyLayer.add(this.add.text(0, -3, '男', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: '#17262d' }).setOrigin(0.5));
    }
    this.heldWeapons = [];
    this.heldWeapon = undefined;
    this.updateHeldWeaponVisual();
    this.world.add(this.player);
  }

  private fitPlayerSprite(sprite: Phaser.GameObjects.Sprite) {
    const frameWidth = sprite.frame?.realWidth || sprite.frame?.width || 1;
    const frameHeight = sprite.frame?.realHeight || sprite.frame?.height || 1;
    const aspect = frameWidth / Math.max(1, frameHeight);
    sprite.setDisplaySize(this.playerSpriteTargetHeight * aspect, this.playerSpriteTargetHeight);
  }

  private addPlayerSprite(parent: Phaser.GameObjects.Container, x: number, y: number, targetHeight: number, skin?: SkinDef) {
    const selectedSkin = skin ?? this.skins[0];
    const textureKey = this.skinHasCustomArt(selectedSkin) ? this.skinFrontTextureKey(selectedSkin) : 'patient-boy';
    if (!this.textures.exists(textureKey)) return undefined;
    const sprite = this.add.sprite(x, y, textureKey).setOrigin(0.5);
    // Custom skin portraits must remain fully opaque on mobile, where their
    // transparent canvas already blends with the scene background.
    if (this.skinHasCustomArt(selectedSkin)) sprite.setAlpha(1).setBlendMode(Phaser.BlendModes.NORMAL);
    this.playerSpriteTargetHeight = targetHeight;
    this.fitPlayerSprite(sprite);
    parent.add(sprite);
    return sprite;
  }

  private addPatientSprite(parent: Phaser.GameObjects.Container, x: number, y: number, targetHeight: number, skin?: SkinDef) {
    const selectedSkin = skin ?? this.skins[0];
    // Store covers are presentation art and may contain transparent padding.
    // Use the front portrait for cards so every row gets the same visible
    // character scale, then fall back to the cover only when needed.
    const customTextureKeys = this.skinHasCustomArt(selectedSkin)
      ? [this.skinFrontTextureKey(selectedSkin), this.skinCoverTextureKey(selectedSkin)]
      : [];
    const customTextureKey = customTextureKeys.find((key) => this.textures.exists(key));
    const textureKey = customTextureKey
      ?? (this.textures.exists('patient-idle-front') ? 'patient-idle-front' : 'patient-boy');
    if (!this.textures.exists(textureKey)) return undefined;
    const sprite = this.add.image(x, y, textureKey).setOrigin(0.5);
    if (this.skinHasCustomArt(selectedSkin)) sprite.setAlpha(1).setBlendMode(Phaser.BlendModes.NORMAL);
    sprite.setDisplaySize(targetHeight * sprite.width / sprite.height, targetHeight);
    parent.add(sprite);
    return sprite;
  }

  private playPlayerAnimation(animation: PlayerAnimation, force = false) {
    const sprite = this.playerSprite;
    if (!sprite) return;
    const equippedSkin = this.activePlayerSkin();
    // Custom skins do not ship a separate hit/death sheet. Keep their own
    // portrait frame so the silhouette never changes aspect during damage.
    if ((animation === 'hit' || animation === 'death') && this.skinHasCustomArt(equippedSkin)) {
      sprite.anims.stop();
      const stableKey = this.skinFrontTextureKey(equippedSkin);
      if (this.textures.exists(stableKey)) sprite.setTexture(stableKey, 0);
      this.fitPlayerSprite(sprite);
      this.playerAnimation = animation;
      return;
    }
    if (animation === 'idle') {
      if (force || this.playerAnimation !== 'idle') {
        sprite.anims.stop();
        const idleKey = this.skinHasCustomArt(equippedSkin) ? this.skinFrontTextureKey(equippedSkin) : 'patient-idle-front';
        if (this.textures.exists(idleKey)) sprite.setTexture(idleKey);
        else {
          const idleKey = `patient-walk-${this.playerDirection}`;
          if (this.textures.exists(idleKey)) sprite.setTexture(idleKey, 0);
          else sprite.setTexture('patient-boy');
        }
        this.fitPlayerSprite(sprite);
      }
      this.playerAnimation = 'idle';
      return;
    }
    const direction = animation.startsWith('walk-') ? animation.slice(5) as PlayerDirection : undefined;
    const customKey = direction ? this.skinWalkAnimationKey(equippedSkin, direction) : '';
    const key = direction && this.skinHasCustomArt(equippedSkin) && this.textures.exists(customKey) ? customKey : `patient-${animation}`;
    if (!this.textures.exists(key)) return;
    if (!force && this.playerAnimation === animation && sprite.anims.isPlaying) return;
    sprite.setTexture(key, 0);
    this.fitPlayerSprite(sprite);
    sprite.anims.play(key, true);
    this.playerAnimation = animation;
  }

  private directionForVector(x: number, y: number): PlayerDirection {
    if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'left' : 'right';
    return y < 0 ? 'up' : 'down';
  }

  private applyEquippedSkinBonus() {
    const skin = this.activePlayerSkin();
    if (!skin) return;
    if (skin.id === 'street-runner') this.runSpeed *= 1.05;
    if (skin.id === 'cthulhu-dark') this.damageBonus += 8;
  }

  private updatePlayer(dt: number) {
    this.playerHitTimer = Math.max(0, this.playerHitTimer - dt);
    let x = this.joystickVector.x;
    let y = this.joystickVector.y;
    if (this.keys.left.isDown || this.keys.up.isDown || this.keys.right.isDown || this.keys.down.isDown || this.keys.a.isDown || this.keys.w.isDown || this.keys.d.isDown || this.keys.s.isDown) {
      x = (this.keys.right.isDown || this.keys.d.isDown ? 1 : 0) - (this.keys.left.isDown || this.keys.a.isDown ? 1 : 0);
      y = (this.keys.down.isDown || this.keys.s.isDown ? 1 : 0) - (this.keys.up.isDown || this.keys.w.isDown ? 1 : 0);
      const length = Math.hypot(x, y) || 1;
      x /= length;
      y /= length;
    }
    const moving = Math.hypot(x, y) > 0.08;
    if (moving) this.playerDirection = this.directionForVector(x, y);
    const resolved = this.resolveBlockedPosition(
      this.player.x,
      this.player.y,
      this.player.x + x * this.runSpeed * dt,
      this.player.y + y * this.runSpeed * dt,
      this.playerRadius,
    );
    this.player.x = resolved.x;
    this.player.y = resolved.y;
    this.playPlayerAnimation(moving ? `walk-${this.playerDirection}` : 'idle');
    if (this.playerSprite) {
      if (this.playerHitTimer > 0) this.playerSprite.setTint(0xff4f58);
      else this.playerSprite.clearTint();
    }
    const mutationVisual = this.mutated;
    this.playerGlow.setFillStyle(mutationVisual ? 0xed716e : 0x6bd3c1);
    this.playerGlow.setAlpha(0);
    this.playerGlow.setScale(mutationVisual ? 1.08 + (Math.sin(this.sanPulse * 10) + 1) * 0.05 : 1);
  }

  private spawnWaveEnemy() {
    if (this.waveTimer >= this.waveLength || this.waveSpawned >= this.spawnBudgetForWave()) return;
    const available: EnemyKind[] = ['chaser'];
    if (this.tutorialRun) {
      const tutorialKinds: EnemyKind[] = ['chaser', 'shooter', 'disruptor', 'tentacle', 'bomber'];
      available.splice(0, available.length, ...tutorialKinds.slice(0, Math.min(this.wave, tutorialKinds.length)));
    } else {
      if (this.wave >= 3) available.push('shooter');
      if (this.wave >= 6) available.push('disruptor');
      if (this.wave >= 9) available.push('tentacle');
      if (this.wave >= 12) available.push('bomber');
      if (this.wave >= 15) available.push('eye');
    }
    let kind: EnemyKind = Phaser.Utils.Array.GetRandom(available);
    if (this.isTutorialBossWave() && !this.waveBossSpawned) {
      kind = 'boss';
      this.waveBossSpawned = true;
    } else if (this.isMiniBossWave() && !this.waveBossSpawned) {
      kind = 'miniBoss';
      this.waveBossSpawned = true;
    }
    if (this.isFloorBossWave() && !this.waveBossSpawned) {
      kind = 'boss';
      this.waveBossSpawned = true;
    }
    if (kind !== 'boss') this.unlockArchiveKind(kind);
    const balanceWave = this.runMode === 'daily' ? Math.ceil(this.wave / 10) : this.wave;
    const stats = enemyCombatStats(kind, balanceWave);
    const isBoss = kind === 'miniBoss' || kind === 'boss';
    const baseHp = stats.hp;
    const hpScale = this.enemyHealthMultiplier();
    const activeWeapon = this.currentWeapon();
    const openingHpCap = this.runMode === 'mainline' && activeWeapon
      ? openingWaveEnemyHealthCap(kind, this.wave, this.currentWeaponDamage(activeWeapon))
      : Number.POSITIVE_INFINITY;
    const hp = Math.max(1, Math.min(Math.round(baseHp * hpScale), openingHpCap));
    const radius = isBoss ? stats.radius : Math.round(stats.radius * this.smallEnemyScale);
    const { x, y } = this.findSpawnPoint(radius);
    const node = this.add.container(x, y).setDepth(7);
    const color = this.enemyColor(kind);
    let body: Phaser.GameObjects.Container;
    let visualWidth = radius * 2;
    let visualHeight = radius * 2;
    let bossVisual: Enemy['bossVisual'] | undefined;
    let miniBossVisual: Enemy['miniBossVisual'] | undefined;
    if (isBoss) {
      if (kind === 'boss') {
        const boss = this.createMoonMothQueenBody(radius, color);
        body = boss.body;
        visualWidth = boss.visualWidth;
        visualHeight = boss.visualHeight;
        bossVisual = boss.bossVisual;
      } else {
        const variant = Phaser.Utils.Array.GetRandom(MAINLINE_BOSS_ART_VARIANT_LIST);
        const miniBoss = this.createMiniBossBody(variant.id, radius, color);
        body = miniBoss.body;
        visualWidth = miniBoss.visualWidth;
        visualHeight = miniBoss.visualHeight;
        miniBossVisual = miniBoss.miniBossVisual;
      }
    } else {
      const small = this.createSmallEnemyBody(kind as SmallEnemyKind, radius, color);
      body = small.body;
      visualWidth = small.visualWidth;
      visualHeight = small.visualHeight;
    }
    node.add(body);
    const hpBar = this.add.graphics();
    hpBar.fillStyle(0x101820, 0.8).fillRect(-visualWidth / 2 - 4, -visualHeight / 2 - 12, visualWidth + 8, 4);
    hpBar.fillStyle(color, 1).fillRect(-visualWidth / 2 - 4, -visualHeight / 2 - 12, visualWidth + 8, 4);
    node.add(hpBar);
    this.world.add(node);
    const enemy: Enemy = { kind, node, body, baseHp, hpScale, hp, maxHp: hp, speed: this.tutorialRun ? stats.speed * 0.72 : stats.speed, damage: stats.damage, radius, visualWidth, visualHeight, facingRight: false, attackCd: 0.2, shootCd: 1.8, areaCd: 2.5, flash: 0, meleeHitCd: 0, deathTimer: 0, statusTimer: 0, statusTick: 0 };
    if (bossVisual) enemy.bossVisual = bossVisual;
    if (miniBossVisual) enemy.miniBossVisual = miniBossVisual;
    (node as Phaser.GameObjects.Container & { hpBar?: Phaser.GameObjects.Graphics }).hpBar = hpBar;
    this.enemies.push(enemy);
    this.waveSpawned += 1;
    if (enemy.bossVisual) this.startBossEntrance(enemy);
  }

  private findSpawnPoint(radius: number) {
    const active = this.enemies.filter((enemy) => !enemy.dead);
    const view = this.cameras.main.worldView;
    const margin = 72;
    const left = clamp(view.x - margin, WORLD_BOUNDS.left + 28, WORLD_BOUNDS.right - 28);
    const right = clamp(view.right + margin, WORLD_BOUNDS.left + 28, WORLD_BOUNDS.right - 28);
    const top = clamp(view.y - margin, WORLD_BOUNDS.top + 28, WORLD_BOUNDS.bottom - 28);
    const bottom = clamp(view.bottom + margin, WORLD_BOUNDS.top + 28, WORLD_BOUNDS.bottom - 28);
    let fallback = { x: ARENA_WALKABLE_CENTER.x, y: ARENA_WALKABLE_CENTER.y };
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const edge = attempt < 12 ? attempt % 4 : -1;
      const point = edge === 0
        ? { x: left, y: Phaser.Math.Between(Math.round(top), Math.round(bottom)) }
        : edge === 1
          ? { x: right, y: Phaser.Math.Between(Math.round(top), Math.round(bottom)) }
          : edge === 2
            ? { x: Phaser.Math.Between(Math.round(left), Math.round(right)), y: top }
            : edge === 3
              ? { x: Phaser.Math.Between(Math.round(left), Math.round(right)), y: bottom }
              : { x: Phaser.Math.Between(Math.round(left), Math.round(right)), y: Phaser.Math.Between(Math.round(top), Math.round(bottom)) };
      fallback = point;
      if (active.every((enemy) => distance(enemy.node, point) >= Math.max(44, enemy.radius + radius + 8)) && !this.isBlocked(point.x, point.y, radius)) return point;
    }
    return fallback;
  }

  private isBlocked(x: number, y: number, radius: number) {
    const samples = radius > 0
      ? [
          { x, y },
          { x: x + radius * 0.86, y },
          { x: x - radius * 0.86, y },
          { x, y: y + radius * 0.86 },
          { x, y: y - radius * 0.86 },
        ]
      : [{ x, y }];
    if (samples.some((sample) => !pointInPolygon(sample, ARENA_WALKABLE_POINTS))) return true;
    return this.walls.some((wall) => {
      const closestX = clamp(x, wall.x, wall.x + wall.width);
      const closestY = clamp(y, wall.y, wall.y + wall.height);
      return Math.hypot(x - closestX, y - closestY) < radius;
    });
  }

  private spawnIntervalForWave() {
    if (this.tutorialRun) return 1.15;
    if (this.runMode === 'daily') return Math.max(0.25, 0.62 * dailyWaveScaling(this.wave).spawnIntervalMultiplier);
    if (this.wave === 1) return 0.72;
    return Math.max(0.24, 0.72 - this.wave * 0.022);
  }

  private spawnBudgetForWave() {
    if (this.tutorialRun) {
      return TUTORIAL_WAVE_BUDGETS[clamp(this.wave, 1, TUTORIAL_WAVE_BUDGETS.length) - 1];
    }
    const paceBudget = Math.ceil(this.durationForWave() / Math.max(0.1, this.spawnIntervalForWave() * this.spawnRateMultiplier()));
    if (this.runMode === 'daily') {
      const scaling = dailyWaveScaling(this.wave);
      return Math.max(Math.ceil(scaling.baseBudget) + (this.isFloorBossWave() ? 12 : 0), paceBudget);
    }
    const budgets = [24, 30, 36, 42, 50, 58, 66, 75, 85, 96, 108, 120, 134, 148, 164, 180, 196, 214, 232, 252];
    return Math.max(budgets[clamp(this.wave, 1, budgets.length) - 1], paceBudget);
  }

  private wavesPerFloor() {
    if (this.tutorialRun) return 6;
    return this.runMode === 'daily' ? 50 : wavesPerFloorForFloor(this.floor);
  }

  private isMiniBossWave() {
    return this.runMode === 'mainline' && !this.tutorialRun && this.wave === (TEMP_FIRST_WAVE_BOSS_TEST ? 1 : 10);
  }

  private isTutorialBossWave() {
    return this.tutorialRun && this.wave === 6;
  }

  private isFloorBossWave() {
    return this.runMode === 'daily' && this.wave === (TEMP_FIRST_WAVE_BOSS_TEST ? 1 : this.wavesPerFloor());
  }

  private currentWeaponTier() {
    const weapon = this.currentWeapon();
    return weapon ? Math.max(0, this.weapons.indexOf(weapon)) : 0;
  }

  private enemyHealthMultiplier() {
    const weapon = this.currentWeapon();
    if (this.tutorialRun) return tutorialEnemyHealthMultiplier(this.level, this.currentWeaponTier(), weapon?.ammo ?? 1);
    const buildScale = calculateEnemyHealthMultiplier(this.level, this.currentWeaponTier(), weapon?.ammo ?? 1);
    return this.runMode === 'daily' ? buildScale * dailyWaveScaling(this.wave).healthMultiplier : buildScale;
  }

  private rescaleActiveEnemies() {
    const nextScale = this.enemyHealthMultiplier();
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const healthRatio = enemy.maxHp > 0 ? clamp(enemy.hp / enemy.maxHp, 0, 1) : 1;
      enemy.hpScale = nextScale;
      enemy.maxHp = Math.max(1, Math.round(enemy.baseHp * nextScale));
      enemy.hp = clamp(healthRatio * enemy.maxHp, 0, enemy.maxHp);
    }
  }

  private spawnRateMultiplier() {
    if (this.mutated) return 0.58;
    return 1;
  }

  private enemyDamageMultiplier() {
    if (this.tutorialRun) return TUTORIAL_ENEMY_DAMAGE_FACTOR;
    let multiplier = 1;
    if (this.mutated) multiplier *= 1.3;
    if (this.runMode === 'daily') multiplier *= dailyWaveScaling(this.wave).damageMultiplier;
    return multiplier;
  }

  private enemyAttackDamage(enemy: Enemy, amount: number) {
    return amount * this.enemyDamageMultiplier() * (enemy.status === 'weaken' ? 0.65 : 1);
  }

  private incomingDamageMultiplier() {
    let multiplier = this.tutorialRun ? TUTORIAL_INCOMING_DAMAGE_FACTOR : this.mutated ? 1.22 : 1;
    if (this.dailyBloodPact > 0) multiplier *= 1 + this.dailyBloodPact * 0.08;
    return multiplier;
  }

  private shieldAbsorptionMultiplier() {
    if (this.mutated) return 0.68;
    return 1;
  }

  private updateEnemies(dt: number) {
    for (const enemy of this.enemies) {
      if (enemy.dead) {
        enemy.deathTimer = Math.max(0, enemy.deathTimer - dt);
        enemy.node.setAlpha(clamp(enemy.deathTimer / 0.8, 0, 1));
        continue;
      }
      enemy.attackCd -= dt;
      enemy.shootCd -= dt;
      enemy.areaCd -= dt;
      enemy.flash -= dt;
      enemy.meleeHitCd = Math.max(0, enemy.meleeHitCd - dt);
      if (enemy.statusTimer > 0) {
        enemy.statusTimer = Math.max(0, enemy.statusTimer - dt);
        enemy.statusTick -= dt;
        if (enemy.statusTick <= 0) {
          enemy.statusTick = 0.8;
          const statusDamage = enemy.status === 'weaken' ? this.attackStatusDamage * 0.5 : this.attackStatusDamage;
          const statusColor = enemy.status === 'burn' ? 0xe78a57 : enemy.status === 'poison' ? 0x8fd17c : 0xb798e2;
          this.damageEnemy(enemy, statusDamage, statusColor);
        }
        if (enemy.statusTimer <= 0) {
          enemy.status = undefined;
          enemy.statusMarker?.destroy();
          enemy.statusMarker = undefined;
        }
      }
      if (enemy.dead) continue;
      const dist = distance(enemy.node, this.player);
      if (enemy.kind === 'boss' && enemy.bossVisual) {
        const moving = dist > 260;
        if (moving) {
          this.setBossVisualState(enemy, 'walk');
          this.moveEnemy(enemy, dt, 0.58);
        } else {
          this.setBossVisualState(enemy, 'attack');
          enemy.node.setPosition(enemy.node.x, enemy.node.y);
        }
        this.updateBossFacing(enemy, this.player.x > enemy.node.x);
        if (enemy.shootCd <= 0 && dist < 760) {
          enemy.shootCd = 3.9;
          this.setBossVisualState(enemy, 'attack');
          this.enemyBeam(enemy);
          this.time.delayedCall(260, () => {
            if (!enemy.dead && enemy.bossVisual && this.phase === 'battle') this.setBossVisualState(enemy, distance(enemy.node, this.player) > 260 ? 'walk' : 'attack');
          });
        }
        if (enemy.areaCd <= 0) {
          enemy.areaCd = 5.4;
          const warningRadius = 150;
          audio.playEnemyAttack('boss');
          this.createAreaWarning(this.player.x, this.player.y, warningRadius, 0xed716e);
          if (dist < warningRadius) this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage * 0.9), '楼层 Boss 领域');
        }
        if (dist < enemy.radius + 34 && enemy.attackCd <= 0) {
          enemy.attackCd = 1.2;
          this.setBossVisualState(enemy, 'attack');
          audio.playEnemyAttack('boss');
          this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage), '楼层 Boss');
        }
      } else if (enemy.kind === 'miniBoss' && enemy.miniBossVisual) {
        const moving = dist > 220;
        if (moving) {
          this.setMiniBossVisualState(enemy, 'walk');
          this.moveEnemy(enemy, dt, 0.55);
        } else {
          this.setMiniBossVisualState(enemy, 'attack');
        }
        if (dist > 220) {
          this.updateMiniBossFacing(enemy, this.player.x > enemy.node.x);
        }
        if (enemy.shootCd <= 0 && dist < 720) {
          enemy.shootCd = 5.2;
          this.setMiniBossVisualState(enemy, 'attack');
          this.enemyBomb(enemy);
          this.time.delayedCall(260, () => {
            if (!enemy.dead && enemy.miniBossVisual && this.phase === 'battle') {
              this.setMiniBossVisualState(enemy, distance(enemy.node, this.player) > 220 ? 'walk' : 'attack');
            }
          });
        }
        if (enemy.areaCd <= 0) {
          enemy.areaCd = 6.4;
          const warningRadius = 116;
          audio.playEnemyAttack('miniBoss');
          this.createAreaWarning(this.player.x, this.player.y, warningRadius, 0xf2bf62);
          this.setMiniBossVisualState(enemy, 'attack');
          if (dist < warningRadius) this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage * 0.9), '小首领冲击');
        }
        if (dist < enemy.radius + 30 && enemy.attackCd <= 0) {
          enemy.attackCd = 1.15;
          this.setMiniBossVisualState(enemy, 'attack');
          audio.playEnemyAttack('miniBoss');
          this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage), '小首领');
        }
      } else if (enemy.kind === 'bomber') {
        if (dist < this.smallEnemyDistance(290)) this.moveEnemy(enemy, dt, -0.7);
        else if (dist > this.smallEnemyDistance(430)) this.moveEnemy(enemy, dt, 0.45);
        if (enemy.shootCd <= 0 && dist < this.smallEnemyDistance(620)) {
          enemy.shootCd = 3.2;
          this.enemyBomb(enemy);
        }
      } else if (enemy.kind === 'eye') {
        if (dist < this.smallEnemyDistance(310)) this.moveEnemy(enemy, dt, -0.45);
        else if (dist > this.smallEnemyDistance(520)) this.moveEnemy(enemy, dt, 0.35);
        if (enemy.shootCd <= 0 && dist < this.smallEnemyDistance(620)) {
          enemy.shootCd = 2.8;
          this.enemyBeam(enemy);
        }
      } else if (enemy.kind === 'tentacle') {
        if (dist > this.smallEnemyDistance(190)) this.moveEnemy(enemy, dt, 0.75);
        if (enemy.areaCd <= 0) {
          enemy.areaCd = 3.2;
          const angle = Phaser.Math.Angle.Between(enemy.node.x, enemy.node.y, this.player.x, this.player.y);
          this.enemyAttackEffect('tentacle', enemy.node.x, enemy.node.y, this.smallEnemyDistance(190) * 1.72, this.smallEnemyDistance(190) * 1.72, angle, {
            alpha: 0.94,
            depth: 8,
            duration: 260,
            scale: 1.08,
          });
          audio.playEnemyAttack('tentacle');
          this.createAreaWarning(enemy.node.x, enemy.node.y, this.smallEnemyDistance(190), 0x9a6bd1);
          if (dist < this.smallEnemyDistance(190)) this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage * 1.1), '触手横扫');
        }
      } else if (enemy.kind === 'shooter') {
        if (dist > this.smallEnemyDistance(230)) this.moveEnemy(enemy, dt, 1);
        if (enemy.shootCd <= 0 && dist < this.smallEnemyDistance(480)) {
          enemy.shootCd = 2.3;
          this.enemyShot(enemy);
        }
      } else if (enemy.kind === 'disruptor') {
        if (dist > this.smallEnemyDistance(160)) this.moveEnemy(enemy, dt, 0.75);
        if (enemy.areaCd <= 0) {
          enemy.areaCd = 3.8;
          audio.playEnemyAttack('disruptor');
          this.createAreaWarning(enemy.node.x, enemy.node.y, this.smallEnemyDistance(150), 0xb798e2);
          if (dist < this.smallEnemyDistance(150)) this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage * 1.1), '干扰波');
        }
      } else {
        this.moveEnemy(enemy, dt, 1);
        if (dist < enemy.radius + this.smallEnemyDistance(24) && enemy.attackCd <= 0) {
          enemy.attackCd = 1.45;
          const angle = Phaser.Math.Angle.Between(enemy.node.x, enemy.node.y, this.player.x, this.player.y);
          this.enemyAttackEffect('chaser', enemy.node.x, enemy.node.y, 152, 152, angle, {
            alpha: 0.96,
            depth: 8,
            duration: 180,
            scale: 1.06,
          });
          audio.playEnemyAttack('chaser');
          this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage), '异常体');
        }
      }
      if (enemy.flash > 0) enemy.node.setAlpha(0.55); else enemy.node.setAlpha(1);
      const hpBar = (enemy.node as Phaser.GameObjects.Container & { hpBar?: Phaser.GameObjects.Graphics }).hpBar;
      hpBar?.clear().fillStyle(0x101820, 0.8).fillRect(-enemy.visualWidth / 2 - 4, -enemy.visualHeight / 2 - 12, enemy.visualWidth + 8, 5).fillStyle(this.enemyColor(enemy.kind), 1).fillRect(-enemy.visualWidth / 2 - 4, -enemy.visualHeight / 2 - 12, (enemy.visualWidth + 8) * Math.max(0, enemy.hp / enemy.maxHp), 5);
    }
    this.separateEnemies();
    this.enemies = this.enemies.filter((enemy) => {
      if (!enemy.dead) return true;
      if (enemy.deathTimer > 0) return true;
      enemy.node.destroy();
      return false;
    });
  }

  private separateEnemies() {
    const active = this.enemies.filter((enemy) => !enemy.dead);
    for (let first = 0; first < active.length; first += 1) {
      for (let second = first + 1; second < active.length; second += 1) {
        const a = active[first];
        const b = active[second];
        const dx = b.node.x - a.node.x;
        const dy = b.node.y - a.node.y;
        const length = Math.hypot(dx, dy);
        const minimum = a.radius + b.radius + 6;
        if (length >= minimum) continue;
        const angle = length > 0 ? Math.atan2(dy, dx) : ((first + second) % 8) * Math.PI / 4;
        const push = (minimum - (length || 0)) * 0.5;
        a.node.x = clamp(a.node.x - Math.cos(angle) * push, WORLD_BOUNDS.left + a.radius, WORLD_BOUNDS.right - a.radius);
        a.node.y = clamp(a.node.y - Math.sin(angle) * push, WORLD_BOUNDS.top + a.radius, WORLD_BOUNDS.bottom - a.radius);
        b.node.x = clamp(b.node.x + Math.cos(angle) * push, WORLD_BOUNDS.left + b.radius, WORLD_BOUNDS.right - b.radius);
        b.node.y = clamp(b.node.y + Math.sin(angle) * push, WORLD_BOUNDS.top + b.radius, WORLD_BOUNDS.bottom - b.radius);
        if (this.isBlocked(a.node.x, a.node.y, a.radius)) {
          const resolvedA = this.resolveBlockedPosition(ARENA_WALKABLE_CENTER.x, ARENA_WALKABLE_CENTER.y, a.node.x, a.node.y, a.radius);
          a.node.x = resolvedA.x;
          a.node.y = resolvedA.y;
        }
        if (this.isBlocked(b.node.x, b.node.y, b.radius)) {
          const resolvedB = this.resolveBlockedPosition(ARENA_WALKABLE_CENTER.x, ARENA_WALKABLE_CENTER.y, b.node.x, b.node.y, b.radius);
          b.node.x = resolvedB.x;
          b.node.y = resolvedB.y;
        }
      }
    }
  }

  private moveEnemy(enemy: Enemy, dt: number, multiplier: number) {
    const dx = this.player.x - enemy.node.x;
    const dy = this.player.y - enemy.node.y;
    const len = Math.hypot(dx, dy) || 1;
    const slow = this.dailySlowField > 0 && distance(enemy.node, this.player) < 190 + this.dailySlowField * 18
      ? 1 - Math.min(0.56, 0.28 + this.dailySlowField * 0.08)
      : 1;
    const mutationSpeed = this.mutated ? 1.18 : 1;
    const nextX = enemy.node.x + (dx / len) * enemy.speed * multiplier * slow * mutationSpeed * dt;
    const nextY = enemy.node.y + (dy / len) * enemy.speed * multiplier * slow * mutationSpeed * dt;
    const resolved = this.resolveBlockedPosition(enemy.node.x, enemy.node.y, nextX, nextY, enemy.radius);
    enemy.node.x = resolved.x;
    enemy.node.y = resolved.y;
    if (enemy.bossVisual) {
      this.updateBossFacing(enemy, nextX > enemy.node.x);
    } else if (enemy.miniBossVisual) {
      this.updateMiniBossFacing(enemy, dx > 0);
    } else if (enemy.kind !== 'miniBoss' && enemy.body) {
      enemy.facingRight = dx > 0;
      enemy.body.setScale(enemy.facingRight ? -1 : 1, 1);
    }
  }

  private resolveBlockedPosition(fromX: number, fromY: number, x: number, y: number, radius: number) {
    const clampToWorld = (value: number, min: number, max: number) => clamp(value, min, max);
    const valid = (pointX: number, pointY: number) => !this.isBlocked(pointX, pointY, radius);
    const nextX = clampToWorld(x, WORLD_BOUNDS.left + radius, WORLD_BOUNDS.right - radius);
    const nextY = clampToWorld(y, WORLD_BOUNDS.top + radius, WORLD_BOUNDS.bottom - radius);
    if (valid(nextX, nextY)) return { x: nextX, y: nextY };
    let startX = clampToWorld(fromX, WORLD_BOUNDS.left + radius, WORLD_BOUNDS.right - radius);
    let startY = clampToWorld(fromY, WORLD_BOUNDS.top + radius, WORLD_BOUNDS.bottom - radius);
    if (!valid(startX, startY)) {
      startX = ARENA_WALKABLE_CENTER.x;
      startY = ARENA_WALKABLE_CENTER.y;
    }
    if (!valid(startX, startY)) return { x: nextX, y: nextY };
    let lowX = startX;
    let lowY = startY;
    let highX = nextX;
    let highY = nextY;
    for (let step = 0; step < 14; step += 1) {
      const midX = (lowX + highX) / 2;
      const midY = (lowY + highY) / 2;
      if (valid(midX, midY)) {
        lowX = midX;
        lowY = midY;
      } else {
        highX = midX;
        highY = midY;
      }
    }
    return { x: lowX, y: lowY };
  }

  private enemyShot(enemy: Enemy) {
    audio.playEnemyAttack('shooter');
    const dx = this.player.x - enemy.node.x;
    const dy = this.player.y - enemy.node.y;
    const len = Math.hypot(dx, dy) || 1;
    const node = this.enemyAttackEffect('shooter', enemy.node.x, enemy.node.y, 76, 76, Math.atan2(dy, dx), {
      alpha: 0.98,
      depth: 8,
      tint: 0xffffff,
    });
    this.projectiles.push({ node, vx: (dx / len) * 165, vy: (dy / len) * 165, damage: this.enemyAttackDamage(enemy, enemy.damage * 0.65), ttl: 4, color: 0xb798e2 });
  }

  private enemyBomb(enemy: Enemy) {
    audio.playEnemyAttack(enemy.kind === 'miniBoss' ? 'miniBoss' : 'bomber');
    const target = { x: this.player.x, y: this.player.y };
    const warning = this.enemyAttackEffect('disruptor', target.x, target.y, 116, 116, 0, {
      alpha: 0.24,
      depth: 4,
      tint: 0xe78a57,
    });
    this.tweens.add({ targets: warning, scale: 0.65, alpha: 0.6, yoyo: true, repeat: 2, duration: 120 });
    this.time.delayedCall(720, () => {
      if (!warning.active) return;
      warning.destroy();
      this.enemyAttackEffect('bomber', target.x, target.y, 188, 188, 0, {
        alpha: 0.98,
        depth: 9,
        duration: 300,
        scale: 1.48,
      });
      if (this.phase === 'battle' && distance(this.player, target) < 74) this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage * 1.35), '爆炸冲击');
    });
  }

  private enemyBeam(enemy: Enemy) {
    audio.playEnemyAttack(enemy.kind === 'boss' ? 'boss' : 'eye');
    const target = { x: this.player.x, y: this.player.y };
    const angle = Phaser.Math.Angle.Between(enemy.node.x, enemy.node.y, target.x, target.y);
    this.enemyAttackEffect('eye', enemy.node.x, enemy.node.y, Math.max(120, distance(enemy.node, target) + 56), 72, angle, {
      alpha: 0.98,
      depth: 9,
      duration: 520,
      scale: 1.02,
      originX: 0.12,
      originY: 0.5,
    });
    this.enemyAttackEffect('disruptor', target.x, target.y, 54, 54, 0, {
      alpha: 0.7,
      depth: 9,
      duration: 220,
      scale: 1.4,
      tint: 0xf06eaa,
    });
    this.time.delayedCall(280, () => {
      if (this.phase === 'battle' && distance(this.player, target) < 62) this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage * 1.25), '激光眼');
    });
  }

  private updateProjectiles(dt: number) {
    this.projectiles = this.projectiles.filter((shot) => {
      shot.node.x += shot.vx * dt;
      shot.node.y += shot.vy * dt;
      shot.ttl -= dt;
      if (shot.ttl <= 0 || shot.node.x < WORLD_BOUNDS.left - 30 || shot.node.x > WORLD_BOUNDS.right + 30 || shot.node.y < WORLD_BOUNDS.top - 30 || shot.node.y > WORLD_BOUNDS.bottom + 30) { shot.node.destroy(); return false; }
      if (distance(shot.node, this.player) < 22) { shot.node.destroy(); this.hitPlayer(shot.damage, '远程投射'); return false; }
      return true;
    });
  }

  private updateDrops(dt: number, forceAttract = false) {
    this.drops = this.drops.filter((drop) => {
      if (this.phase !== 'battle' && this.phase !== 'wave-cleanup') return true;
      if (!forceAttract) drop.ttl -= dt;
      if (drop.ttl <= 0) { drop.node.destroy(); return false; }
      const d = distance(drop.node, this.player);
      const pickupRange = this.pickupRadius + this.magnet;
      if (forceAttract) drop.attracted = true;
      if (!drop.attracted && isWithinPickupRange(d, this.pickupRadius, this.magnet)) {
        drop.attracted = true;
      }

      if (drop.attracted) {
        // Keep the drop moving visibly toward the player instead of consuming it on range entry.
        if (!forceAttract && d > pickupRange * 1.5) {
          drop.attracted = false;
          drop.node.setScale(1);
        } else {
          const speed = pickupPullSpeed(d, pickupRange) * (1 + this.dailyMagnetSynergy * 0.12);
          const step = Math.min(d, speed * dt);
          if (d > 0) {
            drop.node.x += ((this.player.x - drop.node.x) / d) * step;
            drop.node.y += ((this.player.y - drop.node.y) / d) * step;
          }
          drop.node.rotation += dt * 12;
          const pulse = 1.05 + (Math.sin(this.elapsed * 18 + drop.value) + 1) * 0.06;
          drop.node.setScale(pulse);
          if (distance(drop.node, this.player) <= 18) {
            this.collectDrop(drop);
            drop.node.destroy();
            return false;
          }
        }
      } else {
        drop.node.rotation += dt * 1.2;
        drop.node.setScale(1);
      }
      return true;
    });
  }

  private collectDrop(drop: Drop) {
    audio.playPickup();
    if (this.phase === 'wave-cleanup') {
      this.xp += drop.value;
      return;
    }
    this.gainXp(drop.value);
  }

  private autoAttack() {
    const weapon = this.currentWeapon();
    if (!weapon) return;
    const shots = weapon.copies * weapon.ammo + (weapon.type === 'ranged' ? this.dailyEchoShots : 0);

    if (weapon.type === 'melee') {
      const blades = this.meleeBladeSegments(weapon);
      const blade = blades[blades.length - 1];
      const hitCooldown = Math.max(0.24, (Math.PI * 2 / this.currentRotationSpeed(weapon)) * 0.72);
      const targets = this.enemies
        .filter((enemy) => !enemy.dead
          && enemy.meleeHitCd <= 0
          && blades.some((sample) => bladeTouchesCircle(sample.start, sample.end, enemy.node, enemyVisualRadius(enemy.kind, enemy.radius))))
        .sort((a, b) => distance(a.node, blade.end) - distance(b.node, blade.end))
        .slice(0, (meleeTargetLimit(weapon.ammo) + this.dailyEchoShots * 2) * Math.max(1, weapon.copies));
      if (targets.length > 0) audio.playWeaponAttack(weapon.weaponClass);
      const damage = this.currentWeaponDamage(weapon);
      targets.forEach((target, index) => {
        target.meleeHitCd = hitCooldown;
        this.damageEnemy(target, damage, weapon.color);
        this.applyAttackStatus(target, weapon.statusEffect);
        this.fireLine(target, weapon.color, index * 0.02, weapon.effect, weapon.weaponClass);
      });
      return;
    }

    const candidates = this.enemies
      .filter((enemy) => !enemy.dead && distance(enemy.node, this.player) <= weaponAttackRange(weapon.type, weapon.weaponClass, weapon.range))
      .sort((a, b) => distance(a.node, this.player) - distance(b.node, this.player));
    if (candidates.length > 0) audio.playWeaponAttack(weapon.weaponClass);
    for (let shot = 0; shot < shots; shot += 1) {
      const target = candidates[shot] ?? candidates[0];
      if (!target) return;
      const damage = this.currentWeaponDamage(weapon) * volleyDamageMultiplier(shot);
      this.damageEnemy(target, damage, weapon.color);
      this.applyAttackStatus(target, weapon.statusEffect);
      this.fireLine(target, weapon.color, shot * 0.02, weapon.effect, weapon.weaponClass);
    }
  }

  private meleeBladeSegment(weapon: Weapon, angle = this.weaponAngle) {
    const innerRadius = 16;
    const reach = this.meleeReach(weapon);
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    return {
      start: {
        x: this.player.x + direction.x * innerRadius,
        y: this.player.y + direction.y * innerRadius,
      },
      end: {
        x: this.player.x + direction.x * reach,
        y: this.player.y + direction.y * reach,
      },
    };
  }

  private meleeReach(weapon: Weapon) {
    if (weapon.weaponClass !== 'sword') return weapon.range;
    return Math.round(weapon.range + this.weaponVisualSpec(weapon).width * 1.1);
  }

  private meleeBladeSegments(weapon: Weapon) {
    const sweptAngle = Phaser.Math.Angle.Wrap(this.weaponAngle - this.previousWeaponAngle);
    const samples = Math.max(1, Math.ceil(Math.abs(sweptAngle) / 0.1));
    const copies = clamp(Math.floor(weapon.copies), 1, MAX_WEAPON_COPIES);
    return Array.from({ length: copies }, (_, copyIndex) => {
      const copyOffset = (copyIndex * FULL_TURN) / copies;
      return Array.from({ length: samples + 1 }, (_, index) => this.meleeBladeSegment(
        weapon,
        this.previousWeaponAngle + copyOffset + sweptAngle * (index / samples),
      ));
    }).flat();
  }

  private currentWeaponDamage(weapon: Weapon) {
    const base = weaponDamageAtLevel(weapon.damage, weapon.level, this.damageBonus + this.roundDamageBonus);
    return Math.round(base * (this.mutated ? 1.35 : 1));
  }

  private currentRotationSpeed(weapon: Weapon) {
    return effectiveRotationSpeed(weapon.rotationSpeed, this.rotationSpeedMultiplier);
  }

  private applyRotationUpgrade(weapon: Weapon, percent = 15) {
    const nextMultiplier = Math.min(
      MAX_WEAPON_ROTATION_SPEED / Math.max(0.1, weapon.rotationSpeed),
      this.rotationSpeedMultiplier * (1 + percent / 100),
    );
    if (nextMultiplier > this.rotationSpeedMultiplier + 0.0001) this.rotationUpgradeStacks += 1;
    this.rotationSpeedMultiplier = nextMultiplier;
  }

  private applyWeaponGrowthUpgrade() {
    const weapon = this.currentWeapon();
    if (!weapon) return;
    if (weapon.type === 'melee') this.applyRotationUpgrade(weapon);
    else weapon.ammo += 1;
  }

  private applyCardWeaponGrowth(percent = 15) {
    const weapon = this.currentWeapon();
    if (weapon) this.applyRotationUpgrade(weapon, percent);
  }

  private applyAttackStatus(enemy: Enemy, status?: AttackStatus) {
    if (!status || enemy.dead) return;
    enemy.status = status;
    enemy.statusTimer = this.attackStatusDuration;
    enemy.statusTick = Math.min(enemy.statusTick || 0.8, 0.8);
    const labels: Record<AttackStatus, string> = { poison: '毒', burn: '燃', weaken: '弱' };
    const colors: Record<AttackStatus, string> = { poison: '#8fd17c', burn: '#e78a57', weaken: '#b798e2' };
    enemy.statusMarker?.destroy();
    enemy.statusMarker = this.add.text(0, -enemy.visualHeight / 2 - 18, labels[status], { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: colors[status], stroke: '#0b1117', strokeThickness: 3 }).setOrigin(0.5);
    enemy.node.add(enemy.statusMarker);
    this.floatText(enemy.node.x, enemy.node.y - enemy.visualHeight / 2 - 26, `${status === 'poison' ? '中毒' : status === 'burn' ? '燃烧' : '虚弱'}`, colors[status]);
  }

  private applyAttackEffectUpgrade(
    status: AttackStatus,
    tier: number,
    configuredGrowth?: { damageIncrease?: number; durationIncrease?: number },
  ) {
    const weapon = this.currentWeapon();
    if (!weapon) return;
    const nextStatus = this.activeAttackStatus ?? status;
    const growth = {
      ...attackStatusGrowth(this.attackStatusLevel, tier),
      ...configuredGrowth,
    };
    if (this.attackStatusLevel === 0) {
      this.attackStatusDuration = 3;
      this.attackStatusDamage = nextStatus === 'burn' ? 3 : nextStatus === 'poison' ? 2 : 1.5;
    }
    weapon.statusEffect = nextStatus;
    this.activeAttackStatus = nextStatus;
    this.attackStatusLevel = growth.level;
    this.attackStatusDuration = Math.round((this.attackStatusDuration + growth.durationIncrease) * 10) / 10;
    this.attackStatusDamage = Math.round((this.attackStatusDamage + growth.damageIncrease) * 10) / 10;
    this.attackStatusSpreadTargets = growth.spreadTargets;
    this.attackStatusSpreadRadius = growth.spreadRadius;
    const labels: Record<AttackStatus, string> = { poison: '中毒', burn: '燃烧', weaken: '虚弱' };
    this.floatText(this.player.x, this.playerLabelY(18), `${labels[nextStatus]}提升至 Lv.${this.attackStatusLevel}`, palette.amber);
  }

  private spreadAttackStatus(source: Enemy) {
    const status = source.status;
    if (!status || this.attackStatusSpreadTargets <= 0 || this.attackStatusSpreadRadius <= 0) return;
    const targets = this.enemies
      .filter((enemy) => enemy !== source && !enemy.dead && distance(source.node, enemy.node) <= this.attackStatusSpreadRadius)
      .sort((a, b) => distance(source.node, a.node) - distance(source.node, b.node))
      .slice(0, this.attackStatusSpreadTargets);
    if (targets.length === 0) return;
    targets.forEach((enemy) => this.applyAttackStatus(enemy, status));
    const color = status === 'burn' ? 0xe78a57 : status === 'poison' ? 0x8fd17c : 0xb798e2;
    const ring = this.add.circle(source.node.x, source.node.y, 16, color, 0).setStrokeStyle(2, color, 0.8).setDepth(8);
    this.world.add(ring);
    this.tweens.add({
      targets: ring,
      scale: this.attackStatusSpreadRadius / 16,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });
  }

  private applyAttackSpeedUpgrade(percent = 12) {
    const weapon = this.currentWeapon();
    if (weapon) this.applyRotationUpgrade(weapon, percent);
  }

  private applyWeaponCopiesUpgrade() {
    const weapon = this.currentWeapon();
    if (!weapon || weapon.copies >= MAX_WEAPON_COPIES) return;
    weapon.copies = clamp(weapon.copies + 1, 1, MAX_WEAPON_COPIES);
    this.updateHeldWeaponVisual();
  }

  private applyRoundDamageBuff(amount: number) {
    // 武器强化在当前楼层内持续，直到本层结算或失败重开。
    this.damageBonus += amount;
  }

  private applyHealthShieldUpgrade(amount: number) {
    if (this.san < 100) {
      this.san = clamp(this.san + amount, 0, 100);
      this.hp = this.san;
      return;
    }
    this.maxShield += amount;
    this.shield = Math.min(this.maxShield, this.shield + amount);
  }

  private enemyColor(kind: EnemyKind) {
    if (kind === 'chaser') return 0xd25563;
    if (kind === 'shooter') return 0x7ab9d0;
    if (kind === 'disruptor') return 0xb798e2;
    if (kind === 'tentacle') return 0x9a6bd1;
    if (kind === 'bomber') return 0xe78a57;
    if (kind === 'eye') return 0xf06eaa;
    if (kind === 'miniBoss') return 0xf2bf62;
    return 0xed716e;
  }

  private enemyGlyph(kind: EnemyKind) {
    if (kind === 'chaser') return '追';
    if (kind === 'shooter') return '投';
    if (kind === 'disruptor') return '扰';
    if (kind === 'tentacle') return '触';
    if (kind === 'bomber') return '弹';
    if (kind === 'eye') return '眼';
    if (kind === 'miniBoss') return '小';
    return '王';
  }

  private currentCooldown() {
    const weapon = this.currentWeapon();
    return weapon ? Math.max(0.18, weapon.cooldown) : 1;
  }

  private canUpgradeWeapon() {
    const current = this.currentWeapon();
    if (!current) return false;
    const index = this.weapons.indexOf(current);
    return index >= 0 && this.level >= (index + 1) * 5;
  }

  private strongerWeapon() {
    const current = this.currentWeapon();
    if (!current || !this.canUpgradeWeapon()) return undefined;
    const index = this.weapons.indexOf(current);
    const next = this.weapons[index + 1];
    return next && this.isWeaponUnlocked(next.id) ? next : undefined;
  }

  private applyBuff(buffKind: BuffKind) {
    if (buffKind === 'damage') {
      this.damageBonus += 6;
    }
    if (buffKind === 'health') {
      this.san = clamp(this.san + 24, 0, 100);
      this.hp = this.san;
    }
    if (buffKind === 'shield') {
      this.maxShield += 28;
      this.shield = this.maxShield;
    }
    this.rescaleActiveEnemies();
  }

  private upgradeWeapon() {
    const current = this.currentWeapon();
    const next = this.strongerWeapon();
    if (!current || !next) return;
    const ammo = current.ammo;
    const copies = current.copies;
    const level = current.level + 1;
    this.equipWeapon(next);
    next.ammo = Math.max(next.ammo, ammo);
    next.copies = copies;
    next.level = level;
    this.rescaleActiveEnemies();
  }

  private damageEnemy(enemy: Enemy, amount: number, color: number) {
    if (enemy.dead) return;
    audio.playEnemyHit(enemy.kind);
    enemy.hp -= amount;
    enemy.flash = 0.08;
    if (this.damageNumbersEnabled) this.floatText(enemy.node.x, enemy.node.y - enemy.visualHeight / 2 - 15, `-${Math.round(amount)}`, hex(color), 24, 34, 680);
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private weaponEffectTextureKey(weaponClass?: WeaponClass) {
    if (!weaponClass) return undefined;
    return `effect-${weaponClass}-neon-v1`;
  }

  private fireLine(target: Enemy, color: number, delay: number, effect: WeaponEffect, weaponClass?: WeaponClass) {
    this.time.delayedCall(delay * 1000, () => {
      if (!target.node.active || target.dead || this.phase !== 'battle') return;
      const impactX = target.node.x;
      const impactY = target.node.y;
      const line = this.add.graphics().setDepth(12);
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.node.x, target.node.y);
      const lineWidth = effect === 'beam' || effect === 'laser' ? 6 : effect === 'slash' || effect === 'tentacle' ? 4 : 2;
      const originX = this.heldWeapon ? this.player.x + this.heldWeapon.x : this.player.x;
      const originY = this.heldWeapon ? this.player.y + this.heldWeapon.y : this.player.y;
      const effectTexture = this.weaponEffectTextureKey(weaponClass);
      const effectSizes: Record<WeaponClass, { width: number; height: number }> = {
        sword: { width: 92, height: 72 },
        whip: { width: 112, height: 74 },
        gun: { width: 132, height: 70 },
        cannon: { width: 148, height: 72 },
      };
      const effectSprite = effectTexture && this.textures.exists(effectTexture)
        ? this.add.image(originX, originY, effectTexture)
          .setOrigin(0.5)
          .setDisplaySize(weaponClass ? effectSizes[weaponClass].width : 112, weaponClass ? effectSizes[weaponClass].height : 72)
           // 枪械特效的亮色弹头在素材反方向，旋转 180 度后让弹头朝向目标。
           .setRotation(angle + (weaponClass === 'gun' ? Math.PI : 0))
           .setBlendMode(Phaser.BlendModes.ADD)
           .setAlpha(0.92)
           .setDepth(13)
         : undefined;
      if (effectSprite) this.world.add(effectSprite);
      line.lineStyle(lineWidth, color, 0.92).lineBetween(originX, originY, impactX, impactY);
      if (effect === 'slash') {
        const perpX = Math.cos(angle + Math.PI / 2) * 13;
        const perpY = Math.sin(angle + Math.PI / 2) * 13;
        line.lineStyle(3, color, 0.8).lineBetween(impactX - perpX - Math.cos(angle) * 13, impactY - perpY - Math.sin(angle) * 13, impactX + perpX, impactY + perpY);
      }
      if (effect === 'spark') {
        line.lineStyle(2, color, 0.8);
        for (let ray = 0; ray < 6; ray += 1) {
          const rayAngle = angle + ray * Math.PI / 3;
          line.lineBetween(impactX + Math.cos(rayAngle) * 6, impactY + Math.sin(rayAngle) * 6, impactX + Math.cos(rayAngle) * 18, impactY + Math.sin(rayAngle) * 18);
        }
      }
      if (effect === 'tentacle') {
        line.lineStyle(3, color, 0.8);
        for (let branch = -1; branch <= 1; branch += 1) {
          const bend = angle + Math.PI / 2;
          const offset = branch * 9;
          const midX = this.player.x + Math.cos(angle) * 48 + Math.cos(bend) * offset;
          const midY = this.player.y + Math.sin(angle) * 48 + Math.sin(bend) * offset;
          line.beginPath();
          line.moveTo(this.player.x, this.player.y);
          line.lineTo(midX, midY);
          line.lineTo(impactX + Math.cos(bend) * offset * 1.5, impactY + Math.sin(bend) * offset * 1.5);
          line.strokePath();
        }
      }
      if (effect === 'laser') {
        line.lineStyle(12, color, 0.18).lineBetween(originX, originY, impactX, impactY);
        line.lineStyle(2, 0xffd4ee, 0.95).lineBetween(originX, originY, impactX, impactY);
      }
      if (effect === 'void') {
        line.lineStyle(3, color, 0.9);
        for (let ring = 1; ring <= 3; ring += 1) {
          line.strokeCircle(impactX, impactY, ring * 10);
        }
        for (let ray = 0; ray < 5; ray += 1) {
          const rayAngle = angle + ray * Math.PI * 0.4;
          line.lineBetween(impactX, impactY, impactX + Math.cos(rayAngle) * (16 + ray * 4), impactY + Math.sin(rayAngle) * (16 + ray * 4));
        }
      }
      if (effect === 'neon') {
        line.lineStyle(2, 0x9ffff1, 0.95);
        for (let ray = 0; ray < 8; ray += 1) {
          const rayAngle = angle + ray * Math.PI / 4;
          line.lineBetween(impactX, impactY, impactX + Math.cos(rayAngle) * 24, impactY + Math.sin(rayAngle) * 24);
        }
      }
      this.world.add(line);
      const muzzle = this.add.circle(originX, originY, effect === 'beam' || effect === 'laser' ? 12 : 7, color, 0.42).setDepth(12);
      this.world.add(muzzle);
      this.tweens.add({ targets: muzzle, scale: 2.2, alpha: 0, duration: 150, onComplete: () => muzzle.destroy() });
      const impactRadius = effect === 'beam' || effect === 'laser' ? 15 : effect === 'burst' || effect === 'bomb' ? 12 : effect === 'void' ? 18 : 7;
      const impact = this.add.circle(impactX, impactY, impactRadius, color, effect === 'beam' || effect === 'laser' ? 0.3 : 0.22).setDepth(12);
      this.world.add(impact);
      const impactRing = effect === 'bomb'
        ? this.add.circle(impactX, impactY, 28, color, 0).setStrokeStyle(3, color, 0.9).setDepth(12)
        : undefined;
      if (impactRing) this.world.add(impactRing);
      const visuals = impactRing ? [line, impact, impactRing] : [line, impact];
      this.tweens.add({
        targets: visuals,
        alpha: 0,
        scale: effect === 'burst' || effect === 'beam' || effect === 'laser' || effect === 'bomb' || effect === 'void' ? 1.45 : 1.1,
        duration: effect === 'beam' || effect === 'laser' ? 170 : effect === 'bomb' ? 260 : 130,
        onComplete: () => visuals.forEach((visual) => visual.destroy()),
      });
      if (effectSprite) {
        this.tweens.add({
          targets: effectSprite,
          x: impactX,
          y: impactY,
          alpha: 0,
          scale: 1.12,
          duration: effect === 'beam' || effect === 'laser' ? 210 : 170,
          ease: 'Cubic.Out',
          onComplete: () => effectSprite.destroy(),
        });
      }
    });
  }

  private killEnemy(enemy: Enemy) {
    if (enemy.dead) return;
    audio.playEnemyDeath(enemy.kind);
    this.spreadAttackStatus(enemy);
    this.kills += 1;
    if (this.runMode === 'daily' && this.dailyKillNova > 0) {
      const cadence = Math.max(6, 12 - this.dailyKillNova * 2);
      if (this.kills % cadence === 0) this.triggerKillNova(enemy.node.x, enemy.node.y);
    }
    const balanceWave = this.runMode === 'daily' ? Math.ceil(this.wave / 10) : this.wave;
    const stats = enemyCombatStats(enemy.kind, balanceWave);
    this.drop(enemy.node.x, enemy.node.y, 'xp', stats.xp);
    if (enemy.kind === 'boss' && enemy.bossVisual) {
      enemy.deathTimer = 3.4;
      this.unlockArchiveKind('boss');
      this.startBossDeath(enemy);
      return;
    }
    if (enemy.kind === 'miniBoss' && enemy.miniBossVisual) {
      this.setMiniBossVisualState(enemy, 'death');
    }
    enemy.dead = true;
    enemy.deathTimer = 0.8;
    const marker = this.add.text(0, -enemy.visualHeight / 2 - 8, 'X', { fontFamily: 'Arial', fontSize: '18px', color: '#f4e8c9', stroke: '#0b1117', strokeThickness: 3 }).setOrigin(0.5);
    enemy.node.add(marker);
    this.tweens.add({ targets: marker, y: -enemy.visualHeight / 2 - 30, alpha: 0, duration: 800, onComplete: () => marker.destroy() });
    this.tweens.add({ targets: enemy.node, alpha: 0, duration: 800 });
    if (enemy.kind === 'boss') this.unlockArchiveKind('boss');
  }

  private drop(x: number, y: number, kind: DropKind, value: number) {
    const colors: Record<DropKind, number> = { xp: 0x8fd17c };
    const glyphs: Record<DropKind, string> = { xp: '+' };
    const node = this.add.container(x, y).setDepth(5);
    if (kind === 'xp' && this.textures.exists('xp-drop-cthulhu-v1')) {
      node.add(this.add.image(0, 0, 'xp-drop-cthulhu-v1').setOrigin(0.5).setDisplaySize(34, 34).setBlendMode(Phaser.BlendModes.ADD));
    } else {
      node.add(this.add.circle(0, 0, 8, colors[kind], 0.9).setStrokeStyle(1, 0x0b1117, 1));
      node.add(this.add.text(0, 0, glyphs[kind], { fontFamily: 'Microsoft YaHei', fontSize: '9px', color: '#0b1117' }).setOrigin(0.5));
    }
    this.world.add(node);
    this.drops.push({ node, kind, value, ttl: 12, attracted: false });
  }

  private hitPlayer(amount: number, source: string) {
    if (this.phase !== 'battle' || this.playerDeathPending) return;
    if (this.developerMode.options.enabled && this.developerGodMode) return;
    const incoming = amount * this.incomingDamageMultiplier();
    const absorbed = Math.min(this.shield, incoming * this.shieldAbsorptionMultiplier());
    this.shield = Math.max(0, this.shield - absorbed);
    const healthDamage = incoming - absorbed;
    if (absorbed > 0 && this.dailyShieldRetaliation > 0) {
      const target = this.enemies
        .filter((enemy) => !enemy.dead)
        .sort((a, b) => distance(a.node, this.player) - distance(b.node, this.player))[0];
      if (target) this.damageEnemy(target, this.dailyShieldRetaliation, 0x7ab9d0);
    }
    this.san = clamp(this.san - healthDamage, 0, 100);
    this.hp = this.san;
    if (this.san <= 0) audio.playPlayerDeath();
    else audio.playPlayerHit();
    const hitLabel = absorbed > 0
      ? `${source} 护盾吸收 ${Math.round(absorbed)}${healthDamage > 0 ? ` · SAN -${Math.round(healthDamage)}` : ''}`
      : `${source} SAN -${Math.round(healthDamage)}`;
    this.floatText(this.player.x, this.playerLabelY(10), hitLabel, absorbed > 0 ? palette.cyan : palette.danger);
    this.cameras.main.flash(90, 180, 65, 65, false);
    if (this.screenShakeEnabled) this.cameras.main.shake(120, 0.006);
    this.playerHitTimer = 0.3;
    this.playerSprite?.setTint(0xff4f58);
    // Keep the current animation frame and silhouette. Damage feedback is a
    // short red tint plus camera feedback, never a replacement hit sprite.
    this.tweens.killTweensOf(this.player);
    this.player.setScale(1);
    if (this.san <= 0) {
      this.playerDeathPending = true;
      this.playerDeathTimer = 0.72;
      this.playerHitTimer = 0;
      this.playPlayerAnimation('death', true);
    }
  }

  private updateMutation(dt: number) {
    this.sanPulse += dt;
    const shouldMutate = this.san > 0 && this.san < 30;
    if (shouldMutate !== this.mutated) {
      this.mutated = shouldMutate;
      this.cameras.main.shake(shouldMutate ? 260 : 120, shouldMutate ? 0.01 : 0.004);
      this.floatText(this.player.x, this.playerLabelY(18), shouldMutate ? 'SAN 低于 30 · 异化启动' : 'SAN 恢复 · 异化解除', shouldMutate ? palette.danger : palette.cyan);
      this.updateWardBackground();
    }
  }

  private updateWardBackground() {
    if (!this.arenaBackground) return;
    const textureKey = this.mutated ? 'ward-night-deep-v1' : 'ward-night-v1';
    if (this.arenaBackgroundTexture === textureKey || this.arenaBackgroundTransition?.texture.key === textureKey || !this.textures.exists(textureKey)) return;
    this.arenaBackgroundTexture = textureKey;
    const previous = this.arenaBackground;
    const next = this.add.image(
      (WORLD_BOUNDS.left + WORLD_BOUNDS.right) / 2,
      (WORLD_BOUNDS.top + WORLD_BOUNDS.bottom) / 2,
      textureKey,
    ).setOrigin(0.5).setDisplaySize(
      WORLD_BOUNDS.right - WORLD_BOUNDS.left,
      WORLD_BOUNDS.bottom - WORLD_BOUNDS.top,
    ).setAlpha(0);
    this.world.add(next);
    // 变异背景只应铺在战斗对象下方，避免切换瞬间盖住角色和敌人。
    this.world.moveTo(next, 1);
    this.arenaBackgroundTransition = next;
    this.tweens.add({
      targets: next,
      alpha: 0.96,
      duration: 900,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (this.arenaBackgroundTransition !== next) return;
        previous?.destroy();
        this.arenaBackground = next;
        this.arenaBackgroundTransition = undefined;
      },
    });
  }

  private updateDailyAugments(dt: number) {
    if (this.runMode !== 'daily') return;
    if (this.dailyVoidPulse <= 0) return;
    this.dailyVoidPulseTimer -= dt;
    if (this.dailyVoidPulseTimer > 0) return;
    this.dailyVoidPulseTimer = Math.max(2.8, 6.2 - this.dailyVoidPulse * 0.45);
    this.triggerVoidPulse();
  }

  private triggerVoidPulse() {
    const weapon = this.currentWeapon();
    const radius = 142 + this.dailyVoidPulse * 12;
    const damage = Math.max(10, Math.round((weapon ? this.currentWeaponDamage(weapon) : 18) * (0.18 + this.dailyVoidPulse * 0.03)));
    const targets = this.enemies
      .filter((enemy) => !enemy.dead && distance(enemy.node, this.player) <= radius)
      .sort((a, b) => distance(a.node, this.player) - distance(b.node, this.player))
      .slice(0, 4 + this.dailyVoidPulse * 2);
    targets.forEach((enemy) => this.damageEnemy(enemy, damage, 0xb798e2));
    const ring = this.add.circle(this.player.x, this.player.y, radius, 0xb798e2, 0.06).setStrokeStyle(3, 0xd9b9ff, 0.9).setDepth(8);
    this.world.add(ring);
    this.tweens.add({ targets: ring, scale: 1.14, alpha: 0, duration: 360, onComplete: () => ring.destroy() });
    this.floatText(this.player.x, this.playerLabelY(26), `裂隙脉冲 · ${targets.length} 个目标`, '#d9b9ff');
  }

  private triggerKillNova(x: number, y: number) {
    const weapon = this.currentWeapon();
    const radius = 88 + this.dailyKillNova * 14;
    const damage = Math.max(12, Math.round((weapon ? this.currentWeaponDamage(weapon) : 18) * (0.26 + this.dailyKillNova * 0.05)));
    const targets = this.enemies
      .filter((enemy) => !enemy.dead && distance(enemy.node, { x, y }) <= radius)
      .slice(0, 3 + this.dailyKillNova);
    targets.forEach((enemy) => this.damageEnemy(enemy, damage, 0xf2bf62));
    const burst = this.add.circle(x, y, 16, 0xf2bf62, 0.16).setStrokeStyle(3, 0xffe2a0, 0.9).setDepth(8);
    this.world.add(burst);
    this.tweens.add({ targets: burst, scale: radius / 16, alpha: 0, duration: 420, onComplete: () => burst.destroy() });
    this.floatText(x, y - 36, '猎杀爆裂', '#ffe2a0');
  }

  private gainXp(amount: number) {
    this.xp += amount;
    this.checkLevelUp();
  }

  private checkLevelUp() {
    if (this.phase !== 'battle' || this.xp < this.xpNeed) return;
    this.xp -= this.xpNeed;
    this.level += 1;
    this.xpNeed = experienceRequiredForLevel(this.level);
    this.rescaleActiveEnemies();
    audio.playLevelUp();
    this.showUpgrade();
  }

  private upgradeCardTexture(rarity: UpgradeCardRarity) {
    return `upgrade-card-${rarity}-v1`;
  }

  private upgradeCardIcon(parent: Phaser.GameObjects.Container, kind: UpgradeIconKind, x: number, y: number, color: number, iconSize = 94) {
    const textureKey = `upgrade-icon-${kind}`;
    if (this.textures.exists(textureKey)) {
      const icon = this.add.image(x, y, textureKey)
        .setOrigin(0.5)
        // The card assets already provide the circular opening. Keep each
        // authored icon inside that opening without adding a second ring.
        .setDisplaySize(iconSize, iconSize);
      parent.add(icon);
      return icon;
    }
    const g = this.add.graphics().setPosition(x, y);
    g.lineStyle(3, color, 0.98);
    g.fillStyle(color, 0.18);
    switch (kind) {
      case 'move':
        g.lineBetween(-16, 0, 10, 0);
        g.lineBetween(10, 0, 2, -8);
        g.lineBetween(10, 0, 2, 8);
        g.lineBetween(-12, -8, -12, 8);
        break;
      case 'damage':
        g.lineBetween(-14, 13, 13, -14);
        g.lineBetween(-5, 2, 4, 11);
        g.lineBetween(-8, 5, 1, 14);
        g.fillTriangle(13, -14, 6, -11, 10, -5);
        break;
      case 'sustain':
        g.beginPath();
        g.moveTo(0, 15);
        g.lineTo(-15, 1);
        g.lineTo(-14, -8);
        g.lineTo(-7, -13);
        g.lineTo(0, -7);
        g.lineTo(7, -13);
        g.lineTo(14, -8);
        g.lineTo(15, 1);
        g.closePath();
        g.fillPath();
        g.strokePath();
        g.strokeRect(-17, -18, 34, 36);
        break;
      case 'growth':
        g.strokeCircle(0, 0, 13);
        g.beginPath();
        g.arc(0, 0, 18, -1.1, 0.45, false);
        g.strokePath();
        g.lineBetween(15, 5, 8, 5);
        g.lineBetween(15, 5, 12, -1);
        g.lineBetween(-15, -5, -8, -5);
        g.lineBetween(-15, -5, -12, 1);
        break;
      case 'effect':
        g.fillTriangle(0, -18, 5, -4, 18, 0);
        g.fillTriangle(18, 0, 5, 5, 0, 18);
        g.fillTriangle(0, 18, -5, 5, -18, 0);
        g.fillTriangle(-18, 0, -5, -4, 0, -18);
        g.strokeCircle(0, 0, 5);
        break;
      case 'copies':
        g.strokeCircle(-9, 7, 7);
        g.strokeCircle(9, 7, 7);
        g.strokeCircle(0, -9, 7);
        g.lineBetween(-4, -4, -6, 1);
        g.lineBetween(4, -4, 6, 1);
        break;
      case 'resonance':
        g.strokeCircle(0, 0, 7);
        g.strokeCircle(0, 0, 15);
        g.lineBetween(-20, 0, -12, 0);
        g.lineBetween(12, 0, 20, 0);
        g.lineBetween(0, -20, 0, -12);
        g.lineBetween(0, 12, 0, 20);
        break;
      case 'shield':
        g.strokeRect(-13, -14, 26, 28);
        g.lineBetween(-13, -4, 13, -4);
        g.lineBetween(0, -14, 0, 14);
        break;
      case 'magnet':
        g.beginPath();
        g.arc(0, 1, 14, Math.PI * 0.15, Math.PI * 0.85, false);
        g.strokePath();
        g.lineBetween(-13, 5, -13, 14);
        g.lineBetween(13, 5, 13, 14);
        g.lineBetween(-16, 14, -9, 14);
        g.lineBetween(9, 14, 16, 14);
        break;
      case 'pulse':
        g.strokeCircle(0, 0, 5);
        g.strokeCircle(0, 0, 12);
        g.strokeCircle(0, 0, 19);
        break;
      case 'mirror':
        g.lineBetween(-17, -8, 9, -8);
        g.lineBetween(9, -8, 2, -15);
        g.lineBetween(9, -8, 2, -1);
        g.lineBetween(17, 8, -9, 8);
        g.lineBetween(-9, 8, -2, 1);
        g.lineBetween(-9, 8, -2, 15);
        break;
      case 'blood':
        g.beginPath();
        g.moveTo(0, -18);
        g.lineTo(12, 1);
        g.lineTo(8, 13);
        g.lineTo(0, 18);
        g.lineTo(-8, 13);
        g.lineTo(-12, 1);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      case 'nova':
        g.strokeCircle(0, 0, 7);
        g.fillTriangle(0, -20, 5, -5, 20, 0);
        g.fillTriangle(20, 0, 5, 5, 0, 20);
        g.fillTriangle(0, 20, -5, 5, -20, 0);
        g.fillTriangle(-20, 0, -5, -5, 0, -20);
        break;
      case 'slow':
        g.strokeCircle(0, 0, 16);
        g.lineBetween(0, 0, 0, -9);
        g.lineBetween(0, 0, 7, 5);
        g.lineBetween(-21, 0, -16, 0);
        g.lineBetween(16, 0, 21, 0);
        break;
    }
    parent.add(g);
    return g;
  }

  private upgradeCardSelectionFrame(parent: Phaser.GameObjects.Container, width: number, height: number, color: number) {
    const frame = this.add.graphics();
    frame.lineStyle(12, color, 0.16);
    frame.strokeRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8);
    frame.lineStyle(3, color, 0.95);
    const left = -width / 2 - 3;
    const right = width / 2 + 3;
    const top = -height / 2 - 3;
    const bottom = height / 2 + 3;
    const corner = 20;
    frame.lineBetween(left, top, left + corner, top);
    frame.lineBetween(left, top, left, top + corner);
    frame.lineBetween(right, top, right - corner, top);
    frame.lineBetween(right, top, right, top + corner);
    frame.lineBetween(left, bottom, left + corner, bottom);
    frame.lineBetween(left, bottom, left, bottom - corner);
    frame.lineBetween(right, bottom, right - corner, bottom);
    frame.lineBetween(right, bottom, right, bottom - corner);
    frame.setVisible(false);
    parent.add(frame);
    return frame;
  }

  private upgradeDefinitionFromConfig(
    config: UpgradeCardConfig,
    rarity: UpgradeCardRarity,
    status: AttackStatus,
    weapon?: Weapon,
  ): UpgradeDef {
    const tier = upgradeCardTierForRarity(rarity);
    const tierConfig = config.tiers?.[rarity];
    const tierValue = tierConfig?.value;
    const requireTierValue = () => {
      if (tierValue === undefined) throw new Error(`缺少升级卡牌数值配置：${config.id}/${rarity}`);
      return tierValue;
    };
    const describe = (values: Readonly<Record<string, string | number>>) => formatUpgradeCardDescription(config.description, values);
    const statusNames: Record<AttackStatus, string> = { poison: '中毒', burn: '燃烧', weaken: '虚弱' };
    const statusName = statusNames[status];
    const titleTemplate = config.id === 'attack-effect' && this.activeAttackStatus
      ? (config.activeTitle ?? config.title)
      : config.title;
    const title = titleTemplate.replace('{status}', statusName);
    const base = {
      title,
      color: upgradeCardColor(config, status),
      rarity: config.rarity ?? rarity,
      icon: config.icon,
    };

    switch (config.id) {
      case 'move-speed': {
        const movePercent = requireTierValue();
        return { ...base, detail: describe({ value: movePercent }), apply: () => { this.runSpeed *= 1 + movePercent / 100; } };
      }
      case 'weapon-damage': {
        const damageAmount = requireTierValue();
        return { ...base, detail: describe({ value: damageAmount }), apply: () => this.applyRoundDamageBuff(damageAmount) };
      }
      case 'san-shield': {
        const sustainAmount = requireTierValue();
        return { ...base, detail: describe({ value: sustainAmount }), apply: () => this.applyHealthShieldUpgrade(sustainAmount) };
      }
      case 'attack-speed': {
        const growthPercent = requireTierValue();
        return { ...base, detail: describe({ value: growthPercent }), apply: () => this.applyCardWeaponGrowth(growthPercent) };
      }
      case 'attack-effect': {
        const statusGrowth = attackStatusGrowth(this.attackStatusLevel, tier);
        const damageIncrease = tierConfig?.damageIncrease ?? statusGrowth.damageIncrease;
        const durationIncrease = tierConfig?.durationIncrease ?? statusGrowth.durationIncrease;
        const statusBaseDamage = status === 'burn' ? 3 : status === 'poison' ? 2 : 1.5;
        const statusDamage = Math.round(((this.attackStatusLevel === 0 ? statusBaseDamage : this.attackStatusDamage) + damageIncrease) * 10) / 10;
        const statusDuration = Math.round(((this.attackStatusLevel === 0 ? 3 : this.attackStatusDuration) + durationIncrease) * 10) / 10;
        const tickDamage = Math.round((status === 'weaken' ? statusDamage * 0.5 : statusDamage) * 10) / 10;
        const spreadDetail = statusGrowth.spreadTargets > 0
          ? ` · 击败后传播 ${statusGrowth.spreadTargets} 个目标（范围 ${statusGrowth.spreadRadius}）`
          : ' · 持续强化后解锁击杀传播';
        const detail = describe({
          status: statusName,
          weakenPrefix: status === 'weaken' ? '敌人伤害 -35% · ' : '',
          tickDamage,
          duration: statusDuration,
          spread: spreadDetail,
        });
        return {
          ...base,
          detail,
          apply: () => this.applyAttackEffectUpgrade(status, tier, { damageIncrease, durationIncrease }),
        };
      }
      case 'twin-echo':
        return {
          ...base,
          detail: describe({ speed: 6 + tier * 2 }),
          apply: () => {
            this.applyWeaponCopiesUpgrade();
            const currentWeapon = this.currentWeapon();
            if (currentWeapon) this.applyRotationUpgrade(currentWeapon, 6 + tier * 2);
          },
        };
      case 'shield-retaliation':
        return {
          ...base,
          detail: describe({ retaliation: 4 + tier * 2 }),
          apply: () => {
            this.applyHealthShieldUpgrade(12 + tier * 8);
            this.dailyShieldRetaliation += 4 + tier * 2;
          },
        };
      case 'magnetic-harvest':
        return {
          ...base,
          detail: describe({}),
          apply: () => {
            this.runSpeed *= 1.06;
            this.pickupRadius += 28;
            this.magnet += 36;
            this.dailyMagnetSynergy += 1;
          },
        };
      case 'rift-pulse':
        return {
          ...base,
          detail: describe({
            interval: Math.max(2.8, 6.2 - (this.dailyVoidPulse + 1) * 0.45).toFixed(1),
            targets: 6 + (this.dailyVoidPulse + 1) * 2,
          }),
          apply: () => {
            this.dailyVoidPulse += 1;
            this.dailyVoidPulseTimer = 1.2;
          },
        };
      case 'mirror-barrage':
        return {
          ...base,
          detail: describe({ shots: this.dailyEchoShots + 1 }),
          apply: () => { this.dailyEchoShots += 1; },
        };
      case 'blood-moon-pact':
        return {
          ...base,
          detail: describe({ taken: (this.dailyBloodPact + 1) * 8 }),
          apply: () => {
            this.dailyBloodPact += 1;
            this.damageBonus += 16;
          },
        };
      case 'hunt-nova':
        return {
          ...base,
          detail: describe({ kills: Math.max(6, 12 - (this.dailyKillNova + 1) * 2) }),
          apply: () => { this.dailyKillNova += 1; },
        };
      case 'stasis-field':
        return {
          ...base,
          detail: describe({ slow: Math.min(56, 28 + (this.dailySlowField + 1) * 8) }),
          apply: () => { this.dailySlowField += 1; },
        };
      case 'weapon-copies':
        return {
          ...base,
          detail: weapon ? describe({ current: weapon.copies, next: weapon.copies + 1 }) : '增加当前武器数量',
          apply: () => this.applyWeaponCopiesUpgrade(),
        };
      default:
        throw new Error(`未知升级卡牌配置：${config.id}`);
    }
  }

  private buildUpgradePool() {
    const weapon = this.currentWeapon();
    const statusOptions: AttackStatus[] = ['poison', 'burn', 'weaken'];
    const status = this.activeAttackStatus ?? statusOptions[(this.level - 1) % statusOptions.length];
    return UPGRADE_CARD_CONFIGS
      .filter((config) => !('dailyOnly' in config) || !config.dailyOnly || this.runMode === 'daily')
      .filter((config) => !('requiresWeaponCopies' in config) || !config.requiresWeaponCopies || Boolean(weapon && weapon.copies < MAX_WEAPON_COPIES))
      .map((config) => {
        const rarity = 'rarity' in config && config.rarity ? config.rarity : rollUpgradeCardRarity();
        return this.upgradeDefinitionFromConfig(config, rarity, status, weapon);
      });
  }

  private refreshUpgradeCard(index: number) {
    if (this.phase !== 'upgrade' || index < 0 || index > 2 || this.upgradeCardRefreshUsed[index]) return;
    const pool = this.buildUpgradePool();
    const current = this.upgradeChoices[index];
    const occupied = this.upgradeChoices.filter((choice, choiceIndex) => choiceIndex !== index && choice !== current);
    const alternatives = pool.filter((candidate) => !occupied.some((choice) => choice.title === candidate.title && choice.detail === candidate.detail));
    const replacement = Phaser.Utils.Array.GetRandom(alternatives.length > 0 ? alternatives : pool);
    if (!replacement) return;
    this.upgradeChoices[index] = replacement;
    this.upgradeCardRefreshUsed[index] = true;
    this.showUpgrade(false);
  }

  private showUpgrade(resetRefresh = true) {
    this.phase = 'upgrade';
    if (resetRefresh || this.upgradeChoices.length !== 3) {
      this.upgradeRefreshCount = 0;
      this.upgradePaymentMessage = '';
      this.upgradeChoices = Phaser.Utils.Array.Shuffle(this.buildUpgradePool()).slice(0, 3);
      this.upgradeCardRefreshUsed = [false, false, false];
    }
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const upgradeFrameTexture = this.textures.exists('profile-skin-panel-frame-v1') ? 'profile-skin-panel-frame-v1' : undefined;
    const frameAspect = upgradeFrameTexture ? 1536 / 1024 : 1040 / 612;
    const frameHeight = Math.min(680, safe.height - 24);
    const frameWidth = upgradeFrameTexture
      ? Math.min(safe.width - 32, Math.round(frameHeight * frameAspect))
      : Math.min(1120, safe.width - 32);
    const frameY = clamp(safe.centerY - 2, safe.top + frameHeight / 2 + 8, safe.bottom - frameHeight / 2 - 8);
    const frameTop = frameY - frameHeight / 2;
    const frameBottom = frameY + frameHeight / 2;
    if (upgradeFrameTexture) {
      layer.add(this.add.image(centerX, frameY, upgradeFrameTexture).setOrigin(0.5).setDisplaySize(frameWidth, frameHeight).setAlpha(0.98));
    } else {
      this.addPixelFrame(layer, centerX, frameY, frameWidth, frameHeight, 0x101b24, 0xb798e2);
    }
    layer.add(this.add.text(centerX, frameTop + 40, `升级 Lv.${this.level}`, { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(28, 1.35)}px`, color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(centerX, frameTop + 76, '三选一，选择后继续战斗', { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(14)}px`, color: palette.muted }).setOrigin(0.5));
    const cardHeight = Math.min(470, Math.max(360, Math.round(frameHeight * (this.compactUi() ? 0.62 : 0.68))));
    const cardWidth = Math.max(204, Math.min(320, Math.round(cardHeight * 0.67), Math.floor((frameWidth - 120) / 3)));
    const cardSpacing = Math.min(cardWidth + 28, Math.floor((frameWidth - cardWidth) / 2));
    const cardXBase = centerX - cardSpacing;
    const cardY = clamp(frameY - 18, frameTop + 260, frameBottom - cardHeight / 2 - 74);
    this.upgradeChoices.forEach((choice, index) => {
      const x = cardXBase + index * cardSpacing;
      const card = this.add.container(x, cardY).setSize(cardWidth, cardHeight);
      const rarity = choice.rarity ?? 'blue';
      const rarityColor = rarity === 'gold' ? 0xffd18a : rarity === 'purple' ? 0xb798e2 : 0x5f9dff;
      const textureKey = this.upgradeCardTexture(rarity);
      if (this.textures.exists(textureKey)) {
        card.add(this.add.image(0, 0, textureKey).setOrigin(0.5).setDisplaySize(cardWidth, cardHeight));
      } else {
        card.add(this.add.rectangle(0, 0, cardWidth, cardHeight, palette.panel, 1).setStrokeStyle(2, rarityColor, 0.95));
      }
      // The source card opening sits above the card midpoint. Keep the halo
      // and raster icon on the same measured center so every type lands in
      // the circular opening instead of drifting into the text panel.
      const iconCenterY = Math.round(-cardHeight * 0.174);
      const iconSize = Math.round(Math.min(124, cardHeight * 0.29));
      card.add(this.add.circle(0, iconCenterY, iconSize * 0.49, 0x091721, 0.9).setStrokeStyle(3, rarityColor, 0.9));
      this.upgradeCardIcon(card, choice.icon ?? 'effect', 0, iconCenterY, choice.color, iconSize);
      const textWidth = Math.max(176, cardWidth - 30);
      const titleSize = this.uiFontSize(choice.title.length > 10 ? 21 : 23, 1.2);
      const detailSize = this.uiFontSize(choice.detail.length > 58 ? 14 : 15, 1.3);
      card.add(this.add.text(0, Math.round(cardHeight * 0.186), choice.title, {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${titleSize}px`,
        color: '#fffaf0',
        align: 'center',
        stroke: '#071015',
        strokeThickness: 4,
        wordWrap: { width: textWidth - 8 },
        lineSpacing: 3,
      }).setOrigin(0.5).setFixedSize(textWidth, 58).setFontStyle('bold'));
      card.add(this.add.text(0, Math.round(cardHeight * 0.29), choice.detail, {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${detailSize}px`,
        color: '#f4e8c9',
        align: 'center',
        stroke: '#071015',
        strokeThickness: 3,
        wordWrap: { width: textWidth - 10 },
        lineSpacing: 4,
      }).setOrigin(0.5).setFixedSize(textWidth, 76));
      layer.add(card);
      const applyChoice = () => {
        if (this.phase !== 'upgrade') return;
        audio.unlock();
        audio.play('select');
        choice.apply();
        this.rescaleActiveEnemies();
        this.upgradeChoices = [];
        this.upgradeCardRefreshUsed = [false, false, false];
        this.clearOverlay();
        this.phase = 'battle';
        if (this.pendingWaveBreak) {
          if (this.waveCleanupComplete) {
            this.checkLevelUp();
            if ((this.phase as Phase) === 'upgrade') return;
            this.startWaveBreak();
          } else {
            this.phase = 'wave-cleanup';
          }
        } else {
          this.checkLevelUp();
        }
      };
      this.uiActionRegions.push({
        phase: this.phase,
        x,
        y: cardY,
        width: cardWidth + 22,
        height: cardHeight + 18,
        callback: applyChoice,
        setPressed: (pressed) => card.setScale(pressed ? 0.975 : 1),
      });
      const refreshY = cardY + cardHeight / 2 + 30;
      const refreshUsed = this.upgradeCardRefreshUsed[index];
      this.addUpgradeTextAction(layer, x, refreshY, refreshUsed ? '1/1' : '0/1', () => this.refreshUpgradeCard(index), refreshUsed ? 'muted' : 'primary', true, 13, 88, 42);
    });
    this.overlay = layer;
  }

  private async refreshUpgradeCards() {
    if (this.phase !== 'upgrade' || this.upgradePaymentPending) return;
    if (!upgradeRefreshRequiresPayment(this.upgradeRefreshCount)) {
      this.upgradeRefreshCount += 1;
      this.upgradePaymentMessage = '';
      this.showUpgrade(false);
      return;
    }

    if (!buildaPlatform.sdk?.pay?.showPayPanel) {
      this.upgradePaymentMessage = '当前环境未接入平台支付，卡牌未刷新';
      this.showUpgrade(false);
      return;
    }

    this.upgradePaymentPending = true;
    this.upgradePaymentMessage = '正在等待平台支付结果';
    this.showUpgrade(false);
    let resultMessage = '';
    try {
      const result = await buildaPlatform.showPayPanel(PAID_UPGRADE_REFRESH_SALE_ID);
      if (!result) {
        resultMessage = '平台支付未完成，卡牌未刷新';
      } else if (!result.success) {
        resultMessage = '支付已取消，卡牌未刷新';
      } else {
        const orderId = result.orderId.trim();
        if (!orderId) {
          resultMessage = '平台未返回订单号，卡牌未刷新';
        } else if (this.processedPaymentOrderIds.has(await paymentOrderKey(orderId)) || this.processedPaymentOrderIds.has(orderId)) {
          resultMessage = '该支付订单已使用，卡牌未重复刷新';
        } else if (await this.recordPaymentOrder(orderId)) {
          this.upgradeRefreshCount += 1;
          this.saveProgress();
        } else {
          resultMessage = '该支付订单无效，卡牌未刷新';
        }
      }
    } catch {
      resultMessage = '平台支付暂不可用，卡牌未刷新';
    } finally {
      this.upgradePaymentPending = false;
      this.upgradePaymentMessage = resultMessage;
      if (this.phase === 'upgrade') this.showUpgrade(false);
    }
  }

  private beginWaveCleanup() {
    if (this.phase !== 'battle') return;
    this.pendingWaveBreak = true;
    this.waveCleanupComplete = false;
    this.projectiles.forEach((shot) => shot.node.destroy());
    this.projectiles = [];
    this.drops.forEach((drop) => { drop.attracted = true; });
    this.phase = 'wave-cleanup';
    this.ui?.setVisible(true);
    this.updateHud();
  }

  private completeWaveCleanup() {
    if (this.phase !== 'wave-cleanup' || this.enemies.length > 0 || this.drops.length > 0) return;
    this.waveCleanupComplete = true;
    this.phase = 'battle';
    this.checkLevelUp();
    if ((this.phase as Phase) === 'upgrade') return;
    this.startWaveBreak();
  }

  private startWaveBreak() {
    if (this.phase !== 'battle') return;
    this.pendingWaveBreak = false;
    this.waveCleanupComplete = false;
    this.waveClearedMessage = this.isFloorBossWave() ? '楼层首领已击破 · 本层通关' : `第 ${this.wave} 波通过`;
    this.waveClearedTimer = 1.8;
    this.waveBreakTimer = 1.8;
    this.phase = 'wave-break';
    this.ui?.setVisible(true);
    this.updateHud();
  }

  private completeWaveBreak() {
    if (this.phase !== 'wave-break') return;
    this.waveBreakTimer = 0;
    if (this.wave >= this.wavesPerFloor()) {
      this.showResult(true);
      return;
    }
    this.nextWave();
  }

  private equipWeapon(nextWeapon: Weapon) {
    const current = this.currentWeapon();
    const currentAmmo = current?.ammo ?? 1;
    const currentStatus = current?.statusEffect;
    const pendingRotationStacks = Math.max(0, this.rotationUpgradeStacks - this.rotationStacksConvertedToAmmo);
    this.weapons.forEach((weapon) => {
      weapon.owned = false;
    });
    nextWeapon.owned = true;
    nextWeapon.level = Math.max(1, current?.level ?? 1);
    nextWeapon.copies = current?.copies ?? 1;
    nextWeapon.ammo = currentAmmo + (nextWeapon.type === 'ranged' ? pendingRotationStacks : 0);
    nextWeapon.statusEffect = currentStatus;
    this.activeAttackStatus = currentStatus;
    if (nextWeapon.type === 'ranged') this.rotationStacksConvertedToAmmo = this.rotationUpgradeStacks;
    this.weaponAngle = 0;
    this.previousWeaponAngle = 0;
    this.updateHeldWeaponVisual();
    this.rescaleActiveEnemies();
  }

  private nextWave() {
    this.clearOverlay();
    this.ui?.setVisible(true);
    this.wave += 1;
    this.waveLength = this.durationForWave();
    this.waveTimer = 0;
    this.waveSpawned = 0;
    this.waveClearedMessage = '';
    this.waveClearedTimer = 0;
    this.waveBreakTimer = 0;
    this.spawnTimer = 0.4;
    this.waveBossSpawned = false;
    this.waveCleanupComplete = false;
    this.roundDamageBonus = 0;
    this.phase = 'battle';
  }

  private durationForWave() {
    const waves = this.wavesPerFloor();
    if (this.tutorialRun) return this.wave === waves ? 18 : 12;
    if (this.runMode === 'daily') {
      if (this.isFloorBossWave()) return 52;
      if (this.wave === waves) return 52;
      return 22 + Math.min(10, this.wave * 0.16);
    }
    if (this.isMiniBossWave()) return 38;
    return this.wave === waves ? 34 : 24 + this.wave * 1.2;
  }

  private showResult(win: boolean) {
    this.playerDeathPending = false;
    this.playerDeathTimer = 0;
    if (win) this.recordRunReward();
    if (win && this.tutorialRun) {
      this.tutorialDialogueStage = 'outro';
      this.dialogueIndex = 0;
      this.showDialogue();
      return;
    }
    this.cameras.main.stopFollow();
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    this.phase = 'result';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(45).setScrollFactor(0);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    if (!win) {
      layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000204, 1));
      const failTitle = this.add.image(centerX, 184, 'ui-text-result-fail-v1').setOrigin(0.5);
      this.fitImageToBox(failTitle, Math.min(760, safe.width - 36), 110);
      layer.add(failTitle);
      layer.add(this.add.text(centerX, 270, `第 ${this.floor} 层 · 第 ${this.wave} 波`, {
        fontFamily: 'Courier New, Microsoft YaHei',
        fontSize: '15px',
        color: palette.danger,
      }).setOrigin(0.5));
      const resultBottomY = this.safeBottomY(590, 74);
      const resultRetryY = Math.min(430, resultBottomY - 160);
      this.addMenuImageButton(layer, centerX, resultRetryY, 330, 124, 'menu-button-mainline-v1', '重新挑战', () => {
        this.startRun(this.floor, this.runMode, this.selectedWeaponId);
      });
      this.addButton(layer, centerX, Math.min(resultBottomY - 48, resultRetryY + 126), 220, 48, '回到标题', () => this.showStart(), 'muted', 10);
      this.overlay = layer;
      return;
    }
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.7);
    if (this.textures.exists('profile-skin-panel-frame-v1')) {
      layer.add(this.add.image(centerX, 350, 'profile-skin-panel-frame-v1').setOrigin(0.5).setDisplaySize(720, 480).setAlpha(0.98));
    } else {
      this.addPixelFrame(layer, centerX, 350, 720, 480, 0x101b24, win ? 0x8fd17c : 0xed716e);
    }
    if (win && this.tutorialRun) {
      layer.add(this.add.text(centerX, 206, '入口教程完成', { fontFamily: 'Microsoft YaHei', fontSize: '34px', color: palette.green }).setOrigin(0.5).setFontStyle('bold'));
      layer.add(this.add.text(centerX, 264, '已掌握移动、自动攻击、经验升级和 SAN 异化。下一站是第 1 层。', { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(16)}px`, color: palette.cream, align: 'center', wordWrap: { width: 520 } }).setOrigin(0.5));
      layer.add(this.add.text(centerX, 334, `击破 ${this.kills} · 等级 ${this.level}`, { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(15)}px`, color: palette.muted }).setOrigin(0.5));
      this.addButton(layer, centerX, 438, 240, 52, '前往第 1 层', () => this.showMainline(1), 'primary', 10);
      this.addButton(layer, centerX, 507, 160, 38, '回到标题', () => this.showStart(), 'muted', 10);
      this.overlay = layer;
      return;
    }
    const finalFloor = this.floor >= TOTAL_FLOORS;
    let resultTitle = win
      ? this.runMode === 'daily' ? '每日挑战完成' : finalFloor ? `全部 ${TOTAL_FLOORS} 层清除完成` : `第 ${this.floor} 层清除完成`
      : '失去意识';
    let resultDetail = win
      ? this.runMode === 'daily'
        ? '50 波挑战完成，成绩已提交，月末按平台排行榜发放奖励。'
        : finalFloor ? `第 ${TOTAL_FLOORS} 层已清理完成。病区暂时恢复安静。` : `第 ${this.floor} 层已清理完成。准备进入第 ${this.floor + 1} 层。`
      : `你倒在第 ${this.floor} 层第 ${this.wave} 波。当前楼层会保留，重开从第 1 波开始。`;
    if (win && this.tutorialRun) {
      resultTitle = '入口教程完成';
      resultDetail = '已掌握移动、自动攻击、经验升级和 SAN 异化。下一站是第 1 层。';
    }
    layer.add(this.add.text(centerX, 206, resultTitle, {
      fontFamily: 'Microsoft YaHei',
      fontSize: `${this.uiFontSize(34, 1.12)}px`,
      color: win ? palette.green : palette.danger,
      stroke: '#071015',
      strokeThickness: 4,
    }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(centerX, 264, resultDetail, { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(16)}px`, color: palette.cream, align: 'center', wordWrap: { width: 520 } }).setOrigin(0.5));
    const resultStatsY = win && this.runMode === 'daily' ? 362 : 334;
    if (win && this.runMode === 'daily') {
      const dropText = this.lastDailyBossDropIds.length > 0
        ? `BOSS掉落：${this.lastDailyBossDropIds.map((id) => this.rewardNameForId(id)).join('、')}`
        : '本次未掉落BOSS遗物';
      layer.add(this.add.text(centerX, 316, dropText, {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${this.uiFontSize(13)}px`,
        color: this.lastDailyBossDropIds.length > 0 ? palette.violet : palette.muted,
        wordWrap: { width: 520 },
        align: 'center',
      }).setOrigin(0.5));
    }
    layer.add(this.add.text(centerX, resultStatsY, `击破 ${this.kills} · 等级 ${this.level}`, { fontFamily: 'Microsoft YaHei', fontSize: `${this.uiFontSize(15)}px`, color: palette.muted }).setOrigin(0.5));
    this.addButton(layer, centerX, 438, 240, 52, win ? (this.runMode === 'daily' ? '返回每日挑战' : finalFloor ? '从第 1 层再打一遍' : `进入第 ${this.floor + 1} 层`) : `从第 ${this.floor} 层第 1 波重开`, () => win && this.runMode === 'daily' ? this.showDailyChallenge() : this.startRun(win && !finalFloor ? this.floor + 1 : this.floor), 'primary', 10);
    this.addButton(layer, centerX, 507, 160, 38, '回到标题', () => this.showStart(), 'muted', 10);
    this.overlay = layer;
  }

  private recordRunReward() {
    if (this.runMode === 'daily') {
      if (!this.dailyBossRewardGranted) {
        this.dailyBossRewardGranted = true;
        const monthly = this.monthlyChallenge();
        this.lastDailyBossDropIds = rollMonthlyBossDrops(monthly);
        this.lastDailyBossDropIds.forEach((id) => {
          if (this.skins.some((skin) => skin.id === id) && !this.progress.unlockedSkinIds.includes(id)) this.progress.unlockedSkinIds.push(id);
          if (this.weaponSkins.some((skin) => skin.id === id) && !this.progress.unlockedWeaponSkinIds.includes(id)) this.progress.unlockedWeaponSkinIds.push(id);
        });
        const alreadyCompletedThisMonth = this.isDailyCompleted();
        this.progress.dailyCompletedDate = this.todayKey();
        this.progress.dailyBestSeconds = alreadyCompletedThisMonth && this.progress.dailyBestSeconds
          ? Math.min(this.progress.dailyBestSeconds, this.elapsed)
          : this.elapsed;
        if (!this.progress.archiveKinds.includes('boss')) this.progress.archiveKinds.push('boss');
        this.saveProgress();
        void this.submitDailyScore(this.elapsed);
      }
      return;
    }
    if (this.tutorialRun) {
      this.progress.maxFloor = Math.max(1, this.progress.maxFloor);
      this.progress.tutorialCompleted = true;
      this.saveProgress();
      return;
    }
    this.progress.maxFloor = Math.max(this.progress.maxFloor, Math.min(TOTAL_FLOORS, this.floor + 1));
    this.syncFloorUnlocks(this.floor);
    if (this.floor >= 3 && !this.progress.unlockedWeaponIds.includes('thorn')) this.progress.unlockedWeaponIds.push('thorn');
    if (this.floor >= 5 && !this.progress.unlockedWeaponIds.includes('echo')) this.progress.unlockedWeaponIds.push('echo');
    this.saveProgress();
  }

  private addButton(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, label: string, callback: () => void, style: 'primary' | 'muted' | 'danger' = 'primary', hitPadding = 14, frameOnly = false) {
    const isBackButton = label === '返回主界面' || label === '返回' || x === 88 && y === 38 || x === 76 && y === 38;
    if (isBackButton) {
      x = this.safeBackButtonX();
      y = this.safeBackButtonY();
      width = 52;
      height = 44;
      label = '←';
      hitPadding = Math.max(hitPadding, 12);
    }
    const colors = { primary: 0x2d6b69, muted: 0x26383f, danger: 0x8c3c4d };
    // Keep the touch target larger than the visible button.
    const hitWidth = Math.max(48, width + hitPadding * 2);
    const hitHeight = Math.max(48, height + hitPadding * 2);
    const button = this.add.container(x, y);
    const commandFrameKey = this.textures.exists('ui-command-frame-v2') ? 'ui-command-frame-v2' : 'ui-command-frame';
    const hasPixelButton = !isBackButton && this.textures.exists(commandFrameKey);
    const pixelButton = hasPixelButton
      ? this.add.image(0, 0, commandFrameKey).setDisplaySize(width + 24, Math.max(48, height + 16)).setAlpha(0.92)
      : undefined;
    if (pixelButton) button.add(pixelButton);
    const labelNode = isBackButton && this.textures.exists('back-icon-v1')
      ? this.add.image(0, 0, 'back-icon-v1').setDisplaySize(48, 48)
      : this.add.text(0, 0, isBackButton ? '←' : label, { fontFamily: 'Microsoft YaHei', fontSize: `${isBackButton ? 25 : this.uiFontSize(15)}px`, color: palette.cream }).setOrigin(0.5);
    button.add(labelNode);
    const setPressed = (pressed: boolean) => {
      button.setScale(pressed ? 0.97 : 1);
      pixelButton?.setTint(pressed ? Phaser.Display.Color.IntegerToColor(colors[style]).lighten(12).color : 0xffffff);
    };
    parent.add(button);
    // Action regions are resolved against the game canvas, while the visual
    // button may live inside a positioned container (the developer panel is
    // the main example). Include the parent's offset so the touch target
    // stays aligned with what the player sees.
    const regionX = x + parent.x;
    const regionY = y + parent.y;
    this.uiActionRegions.push({ phase: this.phase, x: regionX, y: regionY, width: hitWidth, height: hitHeight, callback, setPressed });
    return button;
  }

  /** Upgrade choices stay visually attached to their raster cards; no extra line frame is drawn. */
  private addUpgradeTextAction(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    callback: () => void,
    style: 'primary' | 'muted' | 'danger' = 'primary',
    refresh = false,
    fontSize = refresh ? 12 : 18,
    hitWidth = refresh ? 300 : 176,
    hitHeight = 56,
  ) {
    const colors = { primary: palette.teal, muted: palette.muted, danger: palette.danger };
    const button = this.add.container(x, y);
    const labelNode = this.add.text(refresh ? 12 : 0, 0, label, {
      fontFamily: 'Microsoft YaHei',
      fontSize: `${this.uiFontSize(fontSize)}px`,
      color: colors[style],
      stroke: '#071015',
      strokeThickness: 2,
    }).setOrigin(0.5).setFontStyle('bold');
    if (refresh) {
      button.add(this.add.text(-28, 0, '\u21bb', {
        fontFamily: 'Courier New',
        fontSize: `${this.uiFontSize(28)}px`,
        color: colors[style],
        stroke: '#071015',
        strokeThickness: 2,
      }).setOrigin(0.5));
    }
    button.add(labelNode);
    parent.add(button);
    this.uiActionRegions.push({
      phase: this.phase,
      x,
      y,
      width: hitWidth,
      height: hitHeight,
      callback,
      setPressed: (pressed) => {
        button.setScale(pressed ? 0.96 : 1);
        labelNode.setAlpha(pressed ? 0.68 : 1);
      },
    });
    return button;
  }

  private addPlainTextAction(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, label: string, callback: () => void, color = palette.teal, fontSize = 10) {
    const button = this.add.container(x, y);
    const labelNode = this.add.text(0, 0, label, {
      fontFamily: 'Microsoft YaHei',
      fontSize: `${this.uiFontSize(fontSize)}px`,
      color,
      stroke: '#071015',
      strokeThickness: 2,
    }).setOrigin(0.5).setFontStyle('bold');
    button.add(labelNode);
    parent.add(button);
    this.uiActionRegions.push({
      phase: this.phase,
      x,
      y,
      width,
      height,
      callback,
      setPressed: (pressed) => {
        button.setScale(pressed ? 0.96 : 1);
        labelNode.setAlpha(pressed ? 0.68 : 1);
      },
    });
    return button;
  }

  private addImageAction(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, textureKey: string, callback: () => void, hitPadding = 12, imageAlpha = 0.96, pressedImageAlpha = 0.68) {
    const button = this.add.container(x, y);
    const image = this.add.image(0, 0, textureKey).setOrigin(0.5).setDisplaySize(width, height).setAlpha(imageAlpha);
    button.add(image);
    parent.add(button);
    const hitWidth = Math.max(48, width + hitPadding * 2);
    const hitHeight = Math.max(48, height + hitPadding * 2);
    this.uiActionRegions.push({
      phase: this.phase,
      x,
      y,
      width: hitWidth,
      height: hitHeight,
      callback,
      setPressed: (pressed) => {
        button.setScale(pressed ? 0.92 : 1);
        image.setAlpha(pressed ? pressedImageAlpha : imageAlpha);
      },
    });
    return button;
  }

  private clearOverlay() {
    this.releaseJoystick();
    this.releaseUiPointer();
    this.releaseFloorScroll();
    this.releaseDailyRankingScroll();
    document.getElementById('game-shell')?.classList.remove('menu-shell');
    this.overlay?.destroy(true);
    this.overlay = undefined;
    this.tutorialGuide?.destroy(true);
    this.tutorialGuide = undefined;
    this.tutorialGuideTimer = 0;
    this.floorScrollContent = undefined;
    this.floorScrollRegions = [];
    this.dailyRankingRows = undefined;
    this.dailyRankingEntries = [];
    this.dailyRankingVisibleCount = 0;
    this.dailyRankingOffset = 0;
    this.dailyRankingMaxOffset = 0;
    this.dailyRankingViewport = { left: 0, right: 0, top: 0, bottom: 0 };
    this.profileSkinPointer = undefined;
    this.profileSkinMoved = false;
    this.profileSkinStartX = 0;
    this.profileSkinViewport = { left: 0, right: 0, top: 0, bottom: 0 };
    this.uiActionRegions = [];
  }

  private clearRunObjects() {
    this.enemies.forEach((enemy) => enemy.node.destroy());
    this.projectiles.forEach((shot) => shot.node.destroy());
    this.clearDrops();
    this.enemies = [];
    this.projectiles = [];
    this.player?.destroy();
    this.playerBodyLayer = undefined;
    this.playerWeaponLayer = undefined;
    this.playerSprite = undefined;
    this.playerAnimation = 'idle';
    this.playerDirection = 'down';
    this.playerHitTimer = 0;
    this.playerDeathTimer = 0;
    this.playerDeathPending = false;
    this.heldWeapon = undefined;
    this.heldWeapons = [];
  }

  private clearDrops() {
    this.drops.forEach((drop) => drop.node.destroy());
    this.drops = [];
  }

  private showToast(message: string, color = palette.amber, duration = 1600) {
    if (!message.trim()) return;
    this.transientToast?.destroy(true);
    const safe = this.pageSafeBounds(10);
    const toast = this.add.container(safe.centerX, safe.top + 82).setDepth(320).setScrollFactor(0);
    const backdrop = this.add.rectangle(0, 0, 430, 48, 0x071117, 0.94).setStrokeStyle(2, 0x6bd3c1, 0.6);
    const label = this.add.text(0, 0, message, {
      fontFamily: UI_FONT_STACK,
      fontSize: `${this.uiFontSize(14, 1.2)}px`,
      color,
      stroke: '#071117',
      strokeThickness: 3,
      align: 'center',
      wordWrap: { width: 396, useAdvancedWrap: true },
    }).setOrigin(0.5).setFixedSize(396, 42).setFontStyle('bold').setResolution(2);
    toast.add([backdrop, label]);
    this.transientToast = toast;
    this.tweens.add({
      targets: toast,
      alpha: 0,
      delay: Math.max(300, duration),
      duration: 300,
      ease: 'Quad.Out',
      onComplete: () => {
        if (this.transientToast === toast) this.transientToast = undefined;
        toast.destroy(true);
      },
    });
  }

  private floatText(x: number, y: number, message: string, color: string, fontSize = 12, rise = 24, duration = 650) {
    const strokeThickness = fontSize >= 20 ? 4 : 3;
    const text = this.add.text(x, y, message, { fontFamily: 'Microsoft YaHei', fontSize: `${fontSize}px`, color, stroke: '#0b1117', strokeThickness }).setOrigin(0.5).setDepth(30);
    this.world.add(text);
    this.tweens.add({ targets: text, y: y - rise, alpha: 0, duration, onComplete: () => text.destroy() });
  }

  private enemyAttackEffect(kind: SmallEnemyAttackKind, x: number, y: number, width: number, height: number, rotation = 0, options: {
    alpha?: number;
    depth?: number;
    duration?: number;
    scale?: number;
    originX?: number;
    originY?: number;
    tint?: number;
  } = {}) {
    const art = SMALL_ENEMY_ATTACK_ART_BY_KIND[kind];
    const image = this.add.image(x, y, art.key)
      .setOrigin(options.originX ?? 0.5, options.originY ?? 0.5)
      .setDisplaySize(width, height)
      .setRotation(rotation)
      .setDepth(options.depth ?? 9)
      .setAlpha(options.alpha ?? 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (options.tint !== undefined) image.setTint(options.tint);
    this.world.add(image);
    if ((options.duration ?? 0) > 0) {
      this.tweens.add({
        targets: image,
        alpha: 0,
        scale: options.scale ?? 1.12,
        duration: options.duration,
        ease: 'Cubic.Out',
        onComplete: () => image.destroy(),
      });
    }
    return image;
  }

  private createAreaWarning(x: number, y: number, radius = 75, color = 0xb798e2) {
    this.enemyAttackEffect('disruptor', x, y, radius * 2.2, radius * 2.2, 0, {
      alpha: 0.22,
      depth: 4,
      duration: 520,
      scale: 1.32,
      tint: color,
    });
  }

  private canvasPoint(event: PointerEvent) {
    const rect = this.game.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * W / Math.max(1, rect.width),
      y: (event.clientY - rect.top) * H / Math.max(1, rect.height),
    };
  }

  /** Convert a viewport anchor into coordinates rendered correctly by the zoomed battle camera. */
  private cameraZoomAdjustedUiPoint(x: number, y: number) {
    const zoom = Math.max(0.001, this.cameras.main.zoom || 1);
    if (Math.abs(zoom - 1) < 0.001) return { x, y };
    return {
      x: W / 2 + (x - W / 2) / zoom,
      y: H / 2 + (y - H / 2) / zoom,
    };
  }

  /** UI containers ignore camera scrolling, but still follow camera zoom. */
  private canvasUiPoint(event: PointerEvent) {
    const point = this.canvasPoint(event);
    const zoom = Math.max(0.001, this.cameras.main.zoom || 1);
    if (Math.abs(zoom - 1) < 0.001) return point;
    return {
      x: W / 2 + (point.x - W / 2) / zoom,
      y: H / 2 + (point.y - H / 2) / zoom,
    };
  }

  private findUiRegion(x: number, y: number) {
    return this.uiActionRegions
      .filter((candidate) => candidate.phase === this.phase
        && x >= candidate.x - candidate.width / 2
        && x <= candidate.x + candidate.width / 2
        && y >= candidate.y - candidate.height / 2
        && y <= candidate.y + candidate.height / 2)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  }

  private handleUiPointerDown(event: PointerEvent) {
    if (this.pendingUiAction) return;
    const point = this.canvasUiPoint(event);
    if (this.phase === 'battle') {
      const region = this.findUiRegion(point.x, point.y);
      if (region) {
        this.pendingUiAction = { pointerId: event.pointerId, phase: this.phase, region };
        region.setPressed(true);
        event.preventDefault();
        event.stopPropagation();
        try { this.game.canvas.setPointerCapture(event.pointerId); } catch { /* capture is best effort */ }
      }
      return;
    }
    if (this.phase === 'start' && this.dailyRankingRows && this.dailyRankingMaxOffset > 0
      && point.x >= this.dailyRankingViewport.left && point.x <= this.dailyRankingViewport.right
      && point.y >= this.dailyRankingViewport.top && point.y <= this.dailyRankingViewport.bottom) {
      this.dailyRankingPointer = event.pointerId;
      this.dailyRankingStartY = point.y;
      this.dailyRankingStartOffset = this.dailyRankingOffset;
      this.dailyRankingMoved = false;
      try { this.game.canvas.setPointerCapture(event.pointerId); } catch { /* capture can fail after browser gestures */ }
      return;
    }
    if (this.phase === 'start'
      && point.x >= this.profileSkinViewport.left && point.x <= this.profileSkinViewport.right
      && point.y >= this.profileSkinViewport.top && point.y <= this.profileSkinViewport.bottom) {
      this.profileSkinPointer = event.pointerId;
      this.profileSkinStartX = point.x;
      this.profileSkinMoved = false;
    }
    if (this.phase === 'mainline-select' && this.progress.tutorialCompleted) {
      this.floorScrollPointer = event.pointerId;
      this.floorScrollStartY = point.y;
      this.floorScrollStartOffset = this.floorScrollOffset;
      this.floorScrollMoved = false;
    }
    const region = this.findUiRegion(point.x, point.y);
    if (region) {
      this.pendingUiAction = { pointerId: event.pointerId, phase: this.phase, region };
      region.setPressed(true);
      event.preventDefault();
      event.stopPropagation();
    }
    try { this.game.canvas.setPointerCapture(event.pointerId); } catch { /* capture can fail after browser gestures */ }
  }

  private handleUiPointerMove(event: PointerEvent) {
    if (this.phase === 'start' && this.dailyRankingPointer === event.pointerId) {
      const point = this.canvasPoint(event);
      const delta = point.y - this.dailyRankingStartY;
      if (!this.dailyRankingMoved && Math.abs(delta) > 8) this.dailyRankingMoved = true;
      if (this.dailyRankingMoved) {
        this.setDailyRankingOffset(this.dailyRankingStartOffset - delta / 30);
        event.preventDefault();
      }
      return;
    }
    if (this.phase === 'start' && this.profileSkinPointer === event.pointerId) {
      const point = this.canvasPoint(event);
      const delta = point.x - this.profileSkinStartX;
      if (!this.profileSkinMoved && Math.abs(delta) > 8) {
        this.profileSkinMoved = true;
        this.releaseUiPointer();
      }
      if (this.profileSkinMoved) event.preventDefault();
      return;
    }
    if (this.phase !== 'mainline-select' || !this.progress.tutorialCompleted || this.floorScrollPointer !== event.pointerId) return;
    const point = this.canvasPoint(event);
    const delta = point.y - this.floorScrollStartY;
    if (!this.floorScrollMoved && Math.abs(delta) > 8) {
      this.floorScrollMoved = true;
      this.releaseUiPointer();
    }
    if (this.floorScrollMoved) {
      // Dragging upward should reveal higher floors, which are positioned at
      // smaller base Y values in the vertical tower list.
      this.setFloorScrollOffset(this.floorScrollStartOffset - delta);
      event.preventDefault();
    }
  }

  private handleUiWheel(event: WheelEvent) {
    if (this.phase === 'mainline-select' && this.progress.tutorialCompleted) {
      this.setFloorScrollOffset(this.floorScrollOffset + event.deltaY * 0.82);
      event.preventDefault();
      return;
    }
    if (this.phase !== 'start' || !this.dailyRankingRows || this.dailyRankingMaxOffset <= 0) return;
    const point = this.canvasPoint(event as unknown as PointerEvent);
    if (point.x < this.dailyRankingViewport.left || point.x > this.dailyRankingViewport.right
      || point.y < this.dailyRankingViewport.top || point.y > this.dailyRankingViewport.bottom) return;
    const direction = event.deltaY === 0 ? 0 : event.deltaY > 0 ? 1 : -1;
    this.setDailyRankingOffset(this.dailyRankingOffset + direction * 2);
    event.preventDefault();
  }

  private handleUiPointerUp(event: PointerEvent) {
    const scrollingRanking = this.phase === 'start' && this.dailyRankingPointer === event.pointerId;
    const movedRanking = this.dailyRankingMoved;
    if (scrollingRanking) this.releaseDailyRankingScroll();
    if (movedRanking) {
      this.releaseUiPointer();
      return;
    }
    const swipingProfile = this.phase === 'start' && this.profileSkinPointer === event.pointerId;
    const movedProfile = this.profileSkinMoved;
    const profileDelta = this.canvasPoint(event).x - this.profileSkinStartX;
    if (swipingProfile) this.releaseProfileSkinSwipe();
    if (movedProfile) {
      this.releaseUiPointer();
      if (Math.abs(profileDelta) > 42) {
        const visibleSkins = this.skins.filter((skin) => this.profileSkinCategory === 'all' || this.profileSkinCategoryFor(skin) === this.profileSkinCategory);
        const pageCount = Math.max(1, Math.ceil(visibleSkins.length / 6));
        this.setProfileSkinPage(this.profileSkinPage + (profileDelta < 0 ? 1 : -1), pageCount);
      }
      return;
    }
    const scrollingFloor = this.phase === 'mainline-select' && this.floorScrollPointer === event.pointerId;
    const movedFloor = this.floorScrollMoved;
    if (scrollingFloor) this.releaseFloorScroll();
    if (movedFloor) {
      this.releaseUiPointer();
      return;
    }
    const pending = this.pendingUiAction;
    if (!pending || event.pointerId !== pending.pointerId) return;
    const point = this.canvasUiPoint(event);
    this.pendingUiAction = undefined;
    pending.region.setPressed(false);
    const withinPendingRegion = point.x >= pending.region.x - pending.region.width / 2
      && point.x <= pending.region.x + pending.region.width / 2
      && point.y >= pending.region.y - pending.region.height / 2
      && point.y <= pending.region.y + pending.region.height / 2;
    if (this.phase === pending.phase && withinPendingRegion) {
      event.preventDefault();
      event.stopPropagation();
      audio.unlock();
      audio.play('tap');
      pending.region.callback();
    }
  }

  private releaseUiPointer() {
    const pending = this.pendingUiAction;
    this.pendingUiAction = undefined;
    pending?.region.setPressed(false);
  }

  private releaseFloorScroll() {
    this.floorScrollPointer = undefined;
    this.floorScrollMoved = false;
    this.floorScrollStartY = 0;
    this.floorScrollStartOffset = this.floorScrollOffset;
  }

  private releaseDailyRankingScroll() {
    this.dailyRankingPointer = undefined;
    this.dailyRankingMoved = false;
    this.dailyRankingStartY = 0;
    this.dailyRankingStartOffset = this.dailyRankingOffset;
  }

  private releaseProfileSkinSwipe() {
    this.profileSkinPointer = undefined;
    this.profileSkinMoved = false;
    this.profileSkinStartX = 0;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if ((this.phase !== 'battle' && this.phase !== 'boss-intro') || this.pendingUiAction) return;
    if (this.hud.skill?.visible && this.hud.skill.getBounds().contains(pointer.x, pointer.y)) return;
    this.joystickPointer = pointer.id;
    this.joystickOrigin = { x: pointer.x, y: pointer.y };
    this.setJoystick(pointer.x, pointer.y);
    this.createTouchJoystick();
    pointer.event?.preventDefault?.();
    const nativeEvent = pointer.event as PointerEvent | undefined;
    if (nativeEvent && this.game.canvas.setPointerCapture) {
      try { this.game.canvas.setPointerCapture(nativeEvent.pointerId); } catch { /* pointer capture can fail after a browser gesture */ }
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.joystickPointer) return;
    this.setJoystick(pointer.x, pointer.y);
    pointer.event?.preventDefault?.();
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.joystickPointer) return;
    this.releaseJoystick();
  }

  private setJoystick(x: number, y: number) {
    const dx = x - this.joystickOrigin.x;
    const dy = y - this.joystickOrigin.y;
    const len = Math.hypot(dx, dy) || 1;
    const knob = this.joystickVisual?.getData('knob') as Phaser.GameObjects.Arc | undefined;
    if (len <= this.joystickDeadzone) {
      this.joystickVector.x = 0;
      this.joystickVector.y = 0;
      knob?.setPosition(0, 0);
      return;
    }
    const dirX = dx / len;
    const dirY = dy / len;
    this.joystickVector.x = dirX;
    this.joystickVector.y = dirY;
    const travel = Math.min(len, this.joystickMaxDistance);
    knob?.setPosition(dirX * travel, dirY * travel);
  }

  private createTouchJoystick() {
    this.joystickVisual?.destroy(true);
    const visual = this.add.container(this.joystickOrigin.x, this.joystickOrigin.y).setDepth(30).setScrollFactor(0);
    const ring = this.add.circle(0, 0, this.joystickRingRadius, 0x18313a, 0.42).setStrokeStyle(2, 0x6bd3c1, 0.8);
    const knob = this.add.circle(0, 0, this.joystickKnobRadius, 0x6bd3c1, 0.82).setStrokeStyle(2, 0xf4e8c9, 0.65);
    visual.add([ring, knob]);
    visual.setData('knob', knob);
    this.joystickVisual = visual;
    this.ui.add(visual);
  }

  private releaseJoystick() {
    this.joystickPointer = undefined;
    this.joystickVector.x = 0;
    this.joystickVector.y = 0;
    this.joystickVisual?.destroy(true);
    this.joystickVisual = undefined;
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-shell',
  width: W,
  height: H,
  backgroundColor: '#0b1117',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  input: { activePointers: 2, touch: true },
  render: { antialias: true, pixelArt: false, roundPixels: true },
  scene: [HospitalBattleScene],
});

window.addEventListener('resize', () => {
  game.scale.refresh();
  const scene = game.scene.getScene('hospital-battle') as HospitalBattleScene | undefined;
  scene?.['refreshBuildaLayout']();
});
const bossPreview = () => {
  const run = () => {
    const scene = game.scene.getScene('hospital-battle') as HospitalBattleScene | undefined;
    if (!scene) {
      window.setTimeout(run, 50);
      return;
    }
    (scene as any).startBossPreviewShowcase();
  };
  run();
};

window.__BOSS_PREVIEW__ = bossPreview;
window.__GAME_TEST_API__ = {
  ...(window.__GAME_TEST_API__ ?? {}),
  snapshot: () => {
    const scene = game.scene.getScene('hospital-battle') as HospitalBattleScene | undefined;
    if (!scene) return {};
    return {
      phase: scene['phase'],
      developerMode: scene['developerMode'].options.enabled ? {
        enabled: true,
        godMode: scene['developerGodMode'],
        autoClear: scene['developerAutoClear'],
        gameSpeed: scene['gameSpeed'],
      } : { enabled: false },
      floor: scene['floor'],
      totalFloors: TOTAL_FLOORS,
      wavesPerFloor: scene['wavesPerFloor'](),
      wave: scene['wave'],
      waveBreakTimer: scene['waveBreakTimer'],
      waveSpawned: scene['waveSpawned'],
      waveBudget: scene['spawnBudgetForWave'](),
      hp: scene['hp'],
      san: scene['san'],
      shield: scene['shield'],
      maxShield: scene['maxShield'],
      mutated: scene['mutated'],
      playerRadius: scene['playerRadius'],
      dailyAttemptsUsed: scene['dailyAttemptsUsed'](),
      dailyFreeAttemptsRemaining: Math.max(0, 3 - scene['dailyAttemptsUsed']()),
      waveCleanupComplete: scene['waveCleanupComplete'],
      dailySynergies: {
        status: scene['dailyStatusSynergy'],
        shieldRetaliation: scene['dailyShieldRetaliation'],
        magnet: scene['dailyMagnetSynergy'],
        voidPulse: scene['dailyVoidPulse'],
        echoShots: scene['dailyEchoShots'],
        bloodPact: scene['dailyBloodPact'],
        killNova: scene['dailyKillNova'],
        slowField: scene['dailySlowField'],
      },
      attackStatus: scene['activeAttackStatus'],
      level: scene['level'],
      kills: scene['kills'],
      drops: scene['drops'].length,
      playerAnimation: scene['playerAnimation'],
      playerDirection: scene['playerDirection'],
      enemies: scene['enemies'].filter((enemy) => !enemy.dead).map((enemy) => ({ kind: enemy.kind, hp: enemy.hp, maxHp: enemy.maxHp })),
      weapon: scene['currentWeapon']() ? { id: scene['currentWeapon']()!.id, name: scene['currentWeapon']()!.name, type: scene['currentWeapon']()!.type, ammo: scene['currentWeapon']()!.ammo, copies: scene['currentWeapon']()!.copies, level: scene['currentWeapon']()!.level, damage: scene['currentWeaponDamage'](scene['currentWeapon']()!), rotationsPerSecond: rotationsPerSecond(scene['currentRotationSpeed'](scene['currentWeapon']()!)) } : undefined,
      bossVisual: (() => {
        const boss = scene['enemies'].find((enemy) => enemy.kind === 'boss' && enemy.bossVisual);
        return boss ? { width: boss.visualWidth, height: boss.visualHeight, state: boss.bossVisual!.state } : undefined;
      })(),
    };
  },
  bossPreview,
  developerMode: () => ({
    enabled: developerMode.options.enabled,
    godMode: (game.scene.getScene('hospital-battle') as HospitalBattleScene | undefined)?.['developerGodMode'] ?? false,
    autoClear: (game.scene.getScene('hospital-battle') as HospitalBattleScene | undefined)?.['developerAutoClear'] ?? false,
  }),
  setDeveloperControls: (controls: { floor?: number; wave?: number; godMode?: boolean; autoClear?: boolean; gameSpeed?: number }) => {
    const scene = game.scene.getScene('hospital-battle') as HospitalBattleScene | undefined;
    return scene?.['setDeveloperControls'](controls) ?? { enabled: false };
  },
};

export { game };
