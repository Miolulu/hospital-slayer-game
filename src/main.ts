import Phaser from 'phaser';
import './style.css';
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
  TOTAL_HOSPITAL_FLOORS,
  volleyDamageMultiplier,
  waveSpawningComplete,
  wavesPerFloorForFloor,
  weaponDamageAtLevel,
  WEAPON_DAMAGE,
  upgradeRefreshRequiresPayment,
  type CombatEnemyKind,
} from './combatBalance';
import {
  SMALL_ENEMY_ART_FRAME_RATE,
  SMALL_ENEMY_ART_SHEET_BY_KEY,
  SMALL_ENEMY_ART_SHEETS,
  SMALL_ENEMY_ART_VARIANTS,
  type SmallEnemyKind,
} from './patientEnemyArt';
import {
  PLAYER_SKIN_ART_IMAGES,
  PLAYER_SKIN_ART_SHEETS,
  playerSkinArtForId,
} from './playerSkinArt';
import { installUiTextTheme, UI_FONT_STACK } from './uiTheme';

installUiTextTheme();

const W = 1280;
const H = 720;
const MAX_WEAPON_COPIES = 5;
const TOTAL_FLOORS = TOTAL_HOSPITAL_FLOORS;
const FULL_TURN = Math.PI * 2;
const ARENA = { left: 160, right: 1120, top: 116, bottom: 642 };
const WORLD_BOUNDS = { left: -720, right: 2000, top: -520, bottom: 1700 };

type Phase = 'start' | 'mainline-intro' | 'mainline-select' | 'weapon-select' | 'dialogue' | 'battle' | 'wave-cleanup' | 'wave-break' | 'upgrade' | 'result';
type EnemyKind = CombatEnemyKind;
type DropKind = 'xp';
type WeaponType = 'melee' | 'ranged';
type WeaponEffect = 'slash' | 'spark' | 'burst' | 'beam' | 'tentacle' | 'laser' | 'bomb' | 'void' | 'neon';
type BuffKind = 'damage' | 'health' | 'shield';
type RunMode = 'mainline' | 'daily';
type WeaponClass = 'sword' | 'whip' | 'gun' | 'cannon';
type AttackStatus = 'poison' | 'burn' | 'weaken';
type PlayerDirection = 'left' | 'right' | 'up' | 'down';
type PlayerAnimation = 'idle' | 'walk-left' | 'walk-right' | 'walk-up' | 'walk-down' | 'hit' | 'death';
type UpgradeCardRarity = 'blue' | 'purple' | 'gold';
type UpgradeIconKind = 'move' | 'damage' | 'sustain' | 'growth' | 'effect' | 'copies' | 'resonance' | 'shield' | 'magnet' | 'pulse' | 'mirror' | 'blood' | 'nova' | 'slow';
const UPGRADE_ICON_KINDS: UpgradeIconKind[] = [
  'move', 'damage', 'sustain', 'growth', 'effect', 'copies', 'resonance',
  'shield', 'magnet', 'pulse', 'mirror', 'blood', 'nova', 'slow',
];
type ProfileSkinCategory = 'all' | 'basic' | 'store' | 'boss';

interface SkinDef {
  id: string;
  name: string;
  color: number;
  assetPrefix?: string;
  artId?: string;
  weaponId?: string;
  setName?: string;
  setBuff?: string;
}

interface ProgressSave {
  maxFloor: number;
  mainlineIntroSeen?: boolean;
  unlockedWeaponIds: string[];
  unlockedWeaponSkinIds: string[];
  equippedWeaponSkinIds: Partial<Record<WeaponClass, string>>;
  unlockedSkinIds: string[];
  equippedSkinId: string;
  archiveKinds: string[];
  dailyCompletedDate?: string;
  dailyBestSeconds?: number;
  dailyAttemptDate?: string;
  dailyAttempts?: number;
  metaCoins: number;
}

interface DailyBoardEntry {
  rank: number;
  name: string;
  score: number;
}

interface Enemy {
  kind: EnemyKind;
  node: Phaser.GameObjects.Container;
  body?: Phaser.GameObjects.Container;
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
  node: Phaser.GameObjects.Arc;
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

export class HospitalBattleScene extends Phaser.Scene {
  private phase: Phase = 'start';
  private loadingLayer?: Phaser.GameObjects.Container;
  private loadingProgress?: Phaser.GameObjects.Graphics;
  private loadingStatus?: Phaser.GameObjects.Text;
  private overlay?: Phaser.GameObjects.Container;
  private canvasUiPointerDownHandler?: (event: PointerEvent) => void;
  private canvasUiPointerMoveHandler?: (event: PointerEvent) => void;
  private canvasUiPointerUpHandler?: (event: PointerEvent) => void;
  private canvasUiWheelHandler?: (event: WheelEvent) => void;
  private canvasPointerCancelHandler?: (event: PointerEvent) => void;
  private world!: Phaser.GameObjects.Container;
  private ui!: Phaser.GameObjects.Container;
  private arenaBackground?: Phaser.GameObjects.Image;
  private arenaBackgroundTexture = '';
  private player!: Phaser.GameObjects.Container;
  private playerBodyLayer?: Phaser.GameObjects.Container;
  private playerWeaponLayer?: Phaser.GameObjects.Container;
  private playerSprite?: Phaser.GameObjects.Sprite;
  private playerSpriteTargetHeight = 82;
  private playerSpriteScale = 2;
  private readonly smallEnemyScale = 1.2;
  private enemyVisualHeight = Math.round(164 * 1.2);
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
    unlockedWeaponIds: ['knife', 'ward-lantern'],
    unlockedWeaponSkinIds: ['sword-default', 'gun-default', 'whip-default', 'cannon-default'],
    equippedWeaponSkinIds: { sword: 'sword-default', gun: 'gun-default', whip: 'whip-default', cannon: 'cannon-default' },
    unlockedSkinIds: ['patient-default'],
    equippedSkinId: 'patient-default',
    archiveKinds: [],
    dailyBestSeconds: undefined,
    dailyAttemptDate: undefined,
    dailyAttempts: 0,
    metaCoins: 0,
  };
  private playerNickname = '患者 0001';
  private playerIdentityLoaded = false;
  private profilePreviewSkinId = 'patient-default';
  private profileSkinCategory: ProfileSkinCategory = 'all';
  private skinPaymentPending = false;
  private dailyBoard: DailyBoardEntry[] = [
    { rank: 1, name: '夜班记录员', score: 9820 },
    { rank: 2, name: '无窗病房', score: 9470 },
    { rank: 3, name: '患者 0001', score: 0 },
    { rank: 4, name: '回声样本', score: 9010 },
    { rank: 5, name: '月影观察者', score: 8760 },
  ];
  private dailyBoardLoaded = false;
  private skins: SkinDef[] = [
    { id: 'patient-default', name: '初始病号服', color: 0xe7c28b },
    { id: 'investigator-normal', name: '调查员男·正常版', color: 0x8b6a49, artId: 'investigator-normal', setName: '调查员常服', setBuff: '纯外观' },
    { id: 'scarlet-night', name: '猩红夜班', color: 0xed716e, setName: '猩红套装', setBuff: '伤害 +6' },
    { id: 'cyan-ward', name: '青蓝病区', color: 0x7ab9d0, setName: '青蓝套装', setBuff: '护盾 +18' },
    { id: 'violet-dream', name: '紫雾梦魇', color: 0xb798e2, setName: '紫雾套装', setBuff: '移速 +8%' },
    { id: 'street-runner', name: '夜行校服', color: 0x2b7880, assetPrefix: 'street-runner', setName: '街区夜行套装', setBuff: '移速 +5%' },
    { id: 'cthulhu-dark', name: '深潜祭服', color: 0x573a6b, assetPrefix: 'cthulhu-dark', setName: '深潜祭服套装', setBuff: '伤害 +8' },
  ];
  private weaponSkins: WeaponSkinDef[] = [
    { id: 'sword-default', name: '基础病院刀', weaponClass: 'sword', color: 0xed716e, cost: 0, textureKey: 'weapon-sword' },
    { id: 'sword-cthulhu', name: '深渊裂刃', weaponClass: 'sword', color: 0x6bd3c1, cost: 60, textureKey: 'weapon-skin-sword-cthulhu', assetPath: '/assets/art/weapon-select/skin-sword-cthulhu-clean.png' },
    { id: 'sword-fairytale', name: '怪诞童话', weaponClass: 'sword', color: 0xed716e, cost: 45, textureKey: 'weapon-skin-sword-fairytale', assetPath: '/assets/art/weapon-select/skin-sword-fairytale-clean.png' },
    { id: 'sword-hero-tech', name: '英雄科技', weaponClass: 'sword', color: 0x7ab9d0, cost: 80, textureKey: 'weapon-skin-sword-hero-tech', assetPath: '/assets/art/weapon-select/skin-sword-hero-tech-clean.png' },
    { id: 'gun-default', name: '基础灯枪', weaponClass: 'gun', color: 0xf2bf62, cost: 0, textureKey: 'weapon-gun' },
    { id: 'gun-cthulhu', name: '深渊灯枪', weaponClass: 'gun', color: 0x6bd3c1, cost: 60, textureKey: 'weapon-skin-gun-cthulhu', assetPath: '/assets/art/weapon-select/skin-gun-cthulhu-clean.png' },
    { id: 'gun-fairytale', name: '童话脉冲枪', weaponClass: 'gun', color: 0xed716e, cost: 45, textureKey: 'weapon-skin-gun-fairytale', assetPath: '/assets/art/weapon-select/skin-gun-fairytale-clean.png' },
    { id: 'whip-default', name: '基础长鞭', weaponClass: 'whip', color: 0x8fd17c, cost: 0, textureKey: 'weapon-whip' },
    { id: 'whip-cthulhu', name: '古神触须鞭', weaponClass: 'whip', color: 0x9a6bd1, cost: 60, textureKey: 'weapon-skin-whip-cthulhu', assetPath: '/assets/art/weapon-select/skin-whip-cthulhu-clean.png' },
    { id: 'whip-fairytale', name: '梦魇童话鞭', weaponClass: 'whip', color: 0xed716e, cost: 45, textureKey: 'weapon-skin-whip-fairytale', assetPath: '/assets/art/weapon-select/skin-whip-fairytale-clean.png' },
    { id: 'cannon-default', name: '基础回声炮', weaponClass: 'cannon', color: 0xb798e2, cost: 0, textureKey: 'weapon-cannon' },
    { id: 'cannon-cthulhu', name: '深渊回声炮', weaponClass: 'cannon', color: 0x6bd3c1, cost: 60, textureKey: 'weapon-skin-cannon-cthulhu', assetPath: '/assets/art/weapon-select/skin-cannon-cthulhu-clean.png' },
    { id: 'cannon-fairytale', name: '童话星陨炮', weaponClass: 'cannon', color: 0xed716e, cost: 45, textureKey: 'weapon-skin-cannon-fairytale', assetPath: '/assets/art/weapon-select/skin-cannon-fairytale-clean.png' },
  ];
  private waveBreakTimer = 0;
  private dailyBossRewardGranted = false;
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
  private paidRefreshOrderIds = new Set<string>();
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
  private mutationTimer = 0;
  private sanLowActive = false;
  private sanLowTimer = 0;
  private frenzyAvailable = false;
  private frenzyActive = false;
  private frenzyTimer = 0;
  private sanPulse = 0;
  private mutated = false;
  private runSpeed = 190;
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
  private readonly walls = [
    { x: 260, y: 180, width: 170, height: 34 },
    { x: 860, y: 180, width: 170, height: 34 },
    { x: 260, y: 520, width: 170, height: 34 },
    { x: 860, y: 520, width: 170, height: 34 },
  ];
  private dialogueIndex = 0;
  private dialogueTransitioning = false;
  private tutorialRun = false;
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
  }

  preload() {
    this.createLoadingScreen();
    this.load.on('progress', (value: number) => {
      this.loadingProgress?.clear()
        .fillStyle(0x6bd3c1, 1)
        .fillRect(W / 2 - 210, H / 2 + 35, 420 * clamp(value, 0, 1), 10);
      this.loadingStatus?.setText(`正在加载病区资源  ${Math.round(value * 100)}%`);
      const progress = Math.round(clamp(value, 0, 1) * 100);
      document.getElementById('loading-progress-ring')?.style.setProperty('--progress', `${progress}%`);
      const progressLabel = document.getElementById('loading-progress-value');
      if (progressLabel) progressLabel.textContent = `${progress}%`;
    });
    this.load.on('loaderror', (file: { key?: string }) => {
      const key = file.key || '未知资源';
      this.loadingStatus?.setText(`资源加载失败：${key}`.slice(0, 42)).setColor(palette.danger);
    });
    this.load.once('complete', () => {
      this.loadingLayer?.destroy(true);
      this.loadingLayer = undefined;
      this.loadingProgress = undefined;
      this.loadingStatus = undefined;
      document.getElementById('loading-screen')?.classList.add('hidden');
    });
    this.load.image('patient-boy', '/assets/art/patient-boy.png');
    this.load.image('patient-idle-front', '/assets/art/animations/patient-idle-front.png');
    PLAYER_SKIN_ART_IMAGES.forEach(({ key, path }) => {
      this.load.image(key, path);
    });
    PLAYER_SKIN_ART_SHEETS.forEach(({ key, path, frameWidth, frameHeight }) => {
      this.load.spritesheet(key, path, { frameWidth, frameHeight });
    });
    this.load.image('menu-ward-night-v1', '/assets/art/menu-ward-night-v1.png');
    this.load.image('profile-hospital-photo-v1', '/assets/art/profile-hospital-photo-v1.png');
    this.load.image('menu-background-v1', '/assets/art/menu/menu-background-v1.png');
    this.load.image('menu-title-v2', '/assets/art/menu/menu-title-v2.png');
    this.load.image('menu-button-archive-v1', '/assets/art/menu/menu-button-archive-v1.png');
    this.load.image('menu-button-mainline-v1', '/assets/art/menu/menu-button-mainline-v1.png');
    this.load.image('menu-button-daily-v1', '/assets/art/menu/menu-button-daily-v1.png');
    this.load.image('ui-command-frame', '/assets/art/ui-command-frame.webp');
    this.load.image('ui-command-frame-v2', '/assets/art/ui/ui-command-frame-v2.png');
    this.load.image('ui-typography-kit-v1', '/assets/art/ui/ui-typography-kit-v1.png');
    this.load.image('ui-round-frame', '/assets/art/ui-round-frame.webp');
    this.load.image('back-icon-v1', '/assets/art/ui/back-icon-v1.png');
    this.load.image('daily-challenge-background-v1', '/assets/art/daily-challenge-background-v1.png');
    this.load.image('daily-challenge-background-v2', '/assets/art/daily/daily-background-v2.png');
    this.load.image('daily-ranking-frame-v1', '/assets/art/daily/daily-ranking-frame-v1.png');
    this.load.image('daily-panel-frame-v1', '/assets/art/daily/daily-panel-frame-v1.png');
    this.load.image('daily-start-button-v1', '/assets/art/daily/daily-start-button-v1.png');
    this.load.image('mainline-background-v1', '/assets/art/mainline-background-v1.png');
    this.load.image('mainline-building-v1', '/assets/art/mainline-building-v1.png');
    this.load.image('mainline-building-v2', '/assets/art/mainline-building-v2.png');
    this.load.image('mainline-building-v3', '/assets/art/mainline-building-v3.png');
    this.load.image('mainline-floor-select-background-v1', '/assets/art/mainline-floor-select-background-v1.png');
    this.load.image('mainline-floor-locked-v1', '/assets/art/mainline-floor-locked-v1.png');
    this.load.image('mainline-floor-locked-selected-v1', '/assets/art/mainline-floor-locked-selected-v1.png');
    this.load.image('mainline-floor-unlocked-v1', '/assets/art/mainline-floor-unlocked-v1.png');
    this.load.image('mainline-floor-selected-v1', '/assets/art/mainline-floor-selected-v1.png');
    this.load.image('mainline-building-floor-shell-v1', '/assets/art/mainline-building-floor-shell-v1.png');
    this.load.image('weapon-select-background-v1', '/assets/art/weapon-select/weapon-select-background-v1.png');
    (['category', 'main', 'detail', 'skin-card', 'action-buy', 'action-equip', 'back'] as const).forEach((frame) => {
      this.load.image(`weapon-select-frame-${frame}-v1`, `/assets/art/weapon-select/weapon-select-frame-${frame}-v1.png`);
    });
    (['melee', 'ranged', 'magic', 'heavy'] as const).forEach((category) => {
      this.load.image(`weapon-category-${category}`, `/assets/art/weapon-select/icons/weapon-category-${category}.png`);
    });
    this.load.image('ward-day-v1', '/assets/art/ward-day-v1.png');
    this.load.image('ward-night-v1', '/assets/art/ward-night-v1.png');
    this.load.image('ward-night-deep-v1', '/assets/art/ward-night-deep-v1.png');
    this.load.image('boss-moon-wolf', '/assets/art/boss-moon-wolf.webp');
    (['relic-crown', 'relic-fang', 'relic-hood'] as const).forEach((relic) => {
      this.load.image(relic, `/assets/art/${relic}.webp`);
    });
    this.load.image('upgrade-card-blue-v1', '/assets/art/cards/upgrade-card-blue-v1.png');
    this.load.image('upgrade-card-purple-v1', '/assets/art/cards/upgrade-card-purple-v1.png');
    this.load.image('upgrade-card-gold-v1', '/assets/art/cards/upgrade-card-gold-v1.png');
    this.load.image('effect-sword-neon-v1', '/assets/art/weapons/effect-sword-neon-v1.png');
    this.load.image('effect-gun-neon-v1', '/assets/art/weapons/effect-gun-neon-v1.png');
    this.load.image('effect-cannon-neon-v1', '/assets/art/weapons/effect-cannon-neon-v1.png');
    this.load.image('effect-whip-neon-v1', '/assets/art/weapons/effect-whip-neon-v1.png');
    this.load.image('xp-drop-cthulhu-v1', '/assets/art/pickups/xp-drop-cthulhu-v1.png');
    this.load.image('san-frenzy-v1', '/assets/art/hud/san-frenzy-v1.png');
    UPGRADE_ICON_KINDS.forEach((kind) => {
      this.load.image(`upgrade-icon-${kind}`, `/assets/art/cards/icons/upgrade-icon-${kind}.png`);
    });
    (['sword', 'gun', 'whip', 'cannon'] as const).forEach((weaponClass) => {
      this.load.image(`weapon-${weaponClass}`, `/assets/art/weapons/weapon-${weaponClass}.png`);
    });
    this.weaponSkins.filter((skin) => skin.assetPath).forEach((skin) => {
      this.load.image(skin.textureKey, skin.assetPath!);
    });
    (['left', 'right', 'up', 'down'] as PlayerDirection[]).forEach((direction) => {
      this.load.spritesheet(`patient-walk-${direction}`, `/assets/art/animations/patient-walk-${direction}.png`, { frameWidth: 192, frameHeight: 192 });
    });
    this.load.spritesheet('patient-hit', '/assets/art/animations/patient-hit.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('patient-death', '/assets/art/animations/patient-death.png', { frameWidth: 192, frameHeight: 192 });
    PLAYER_SKIN_ART_IMAGES.forEach(({ key, path }) => {
      this.load.image(key, path);
    });
    PLAYER_SKIN_ART_SHEETS.forEach(({ key, path, frameWidth, frameHeight }) => {
      this.load.spritesheet(key, path, { frameWidth, frameHeight });
    });
    this.load.image('mini-boss-01', '/assets/art/enemies/bosses/mini-boss-01.png');
    this.load.image('floor-boss-01', '/assets/art/enemies/bosses/floor-boss-01.png');
    this.skins.filter((skin) => skin.assetPrefix).forEach((skin) => {
      const root = `/assets/art/skins/${skin.assetPrefix}`;
      this.load.image(this.skinFrontTextureKey(skin), `${root}/front.png`);
      (['left', 'right', 'up', 'down'] as PlayerDirection[]).forEach((direction) => {
        this.load.spritesheet(this.skinWalkTextureKey(skin, direction), `${root}/walk-${direction}.png`, { frameWidth: 192, frameHeight: 192 });
      });
    });
    SMALL_ENEMY_ART_SHEETS.forEach(({ key, path, frameWidth, frameHeight }) => {
      this.load.spritesheet(key, path, { frameWidth, frameHeight });
    });
  }

  private createLoadingScreen() {
    const layer = this.add.container(0, 0).setDepth(1000).setScrollFactor(0);
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, palette.bg, 1);
    const frame = this.add.rectangle(W / 2, H / 2, 560, 188, 0x101b24, 0.98)
      .setStrokeStyle(2, 0x6bd3c1, 0.92);
    const title = this.add.text(W / 2, H / 2 - 46, '正在进入病区', {
      fontFamily: UI_FONT_STACK,
      fontSize: '24px',
      color: palette.cream,
      stroke: '#071015',
      strokeThickness: 3,
    }).setOrigin(0.5).setFontStyle('bold');
    const status = this.add.text(W / 2, H / 2 - 8, '正在加载病区资源  0%', {
      fontFamily: UI_FONT_STACK,
      fontSize: '13px',
      color: palette.muted,
    }).setOrigin(0.5);
    const track = this.add.graphics().fillStyle(0x26383f, 1).fillRect(W / 2 - 210, H / 2 + 35, 420, 10);
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
    this.floor = clamp(this.progress.maxFloor, 1, TOTAL_FLOORS);
    this.weapons = this.createWeaponRoster();
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
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);
    this.canvasUiPointerDownHandler = (event: PointerEvent) => this.handleUiPointerDown(event);
    this.canvasUiPointerMoveHandler = (event: PointerEvent) => this.handleUiPointerMove(event);
    this.canvasUiPointerUpHandler = (event: PointerEvent) => this.handleUiPointerUp(event);
    this.canvasUiWheelHandler = (event: WheelEvent) => this.handleUiWheel(event);
    this.canvasPointerCancelHandler = () => {
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
    void this.ensurePlayerIdentity();
    void this.notifyBuildaReady();
    window.__GAME_TEST_API__ = {
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
    bg.lineStyle(3, 0x6bd3c1, 0.12);
    this.walls.forEach((wall) => bg.strokeRect(wall.x, wall.y, wall.width, wall.height));
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
    // 固定组件只使用画布坐标，镜头移动时不会带走数值和提示。
    const panel = this.add.container(174, H - 242).setDepth(25).setScrollFactor(0, 0, true);
    this.addPixelFrame(panel, 146, 110, 292, 220, palette.panel, 0x6bd3c1);
    panel.add(this.add.text(14, 10, '生存状态 / SAN', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '12px', color: palette.muted }).setFontStyle('bold'));
    this.hud.panel = panel;
    this.ui.add(panel);
    this.hud.sanOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xc44557, 0).setDepth(0);
    this.ui.add(this.hud.sanOverlay);
    const wavePanel = this.add.container(W / 2, 44).setDepth(26).setScrollFactor(0, 0, true);
    this.hud.wavePanel = wavePanel;
    this.ui.add(wavePanel);
    this.hud.wave = text(0, -12, '第 1 / 10 波', 22, palette.amber).setOrigin(0.5).setFontStyle('bold');
    this.hud.timer = text(0, 17, '倒计时 30 秒', 14, palette.cream).setOrigin(0.5);
    this.hud.waveCleared = text(0, 42, '', 13, palette.green).setOrigin(0.5).setFontStyle('bold');
    wavePanel.add(this.hud.wave);
    wavePanel.add(this.hud.timer);
    wavePanel.add(this.hud.waveCleared);
    this.hud.hp = text(52, 18, '生命 100 / 100', 13, palette.cream).setFixedSize(228, 18);
    this.hud.xp = text(52, 84, `经验 0 / ${experienceRequiredForLevel(1)} · Lv.1`, 11, palette.muted).setFixedSize(225, 18);
    this.hud.san = text(52, 43, 'SAN 100 / 100', 13, palette.cyan).setFixedSize(228, 18).setWordWrapWidth(228);
    this.hud.weapon = text(96, 132, '病院刀 · 武器数 1', 11, palette.amber).setFixedSize(184, 18).setWordWrapWidth(184);
    this.hud.status = text(96, 162, '环绕攻击 · 自动吸附', 10, palette.muted).setFixedSize(184, 36).setWordWrapWidth(184);
    panel.add(this.hud.hp);
    panel.add(this.hud.xp);
    panel.add(this.hud.san);
    panel.add(this.hud.weapon);
    panel.add(this.hud.status);
    this.hud.bar = this.add.graphics();
    this.hud.sanBar = this.add.graphics();
    this.hud.xpBar = this.add.graphics();
    panel.add(this.hud.bar);
    panel.add(this.hud.sanBar);
    panel.add(this.hud.xpBar);
    this.hud.bar.setDepth(1);
    this.hud.sanBar.setDepth(1);
    this.hud.xpBar.setDepth(1);
    const weaponIcon = this.add.circle(56, 151, 29, 0x19353b, 1).setStrokeStyle(2, 0xf2bf62, 0.95);
    panel.add(weaponIcon);
    this.hud.weaponIcon = this.add.image(56, 151, 'weapon-sword').setOrigin(0.5).setDisplaySize(46, 46);
    panel.add(this.hud.weaponIcon);
    this.hud.skillIcon = this.add.image(230, 180, 'san-frenzy-v1').setOrigin(0.5).setDisplaySize(48, 48).setDepth(25).setVisible(false);
    panel.add(this.hud.skillIcon);
    this.hud.skill = this.add.text(230, 180, '暴走', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.cream, backgroundColor: '#8c3c4d', padding: { left: 12, right: 12, top: 8, bottom: 8 } })
      .setOrigin(0.5).setDepth(26).setVisible(false)
      .setInteractive(new Phaser.Geom.Rectangle(-48, -25, 96, 50), Phaser.Geom.Rectangle.Contains);
    this.hud.skill.on('pointerdown', (pointer: Phaser.Input.Pointer) => { pointer.event?.preventDefault?.(); this.triggerFrenzy(); });
    panel.add(this.hud.skill);
    this.pinHudToViewport();
  }

  private currentWeapon() {
    return this.weapons.find((weapon) => weapon.owned);
  }

  private weaponSkinsFor(weaponClass: WeaponClass) {
    return this.weaponSkins.filter((skin) => skin.weaponClass === weaponClass);
  }

  private weaponSkinTextureKey(skin: WeaponSkinDef) {
    return skin.textureKey && this.textures.exists(skin.textureKey) ? skin.textureKey : `weapon-${skin.weaponClass}`;
  }

  private equippedWeaponSkin(weaponClass: WeaponClass) {
    const equippedId = this.progress.equippedWeaponSkinIds?.[weaponClass] ?? `${weaponClass}-default`;
    return this.weaponSkins.find((skin) => skin.id === equippedId && skin.weaponClass === weaponClass)
      ?? this.weaponSkins.find((skin) => skin.id === `${weaponClass}-default`)!;
  }

  private weaponAssetKey(weapon?: Weapon) {
    return this.weaponSkinTextureKey(this.equippedWeaponSkin(weapon?.weaponClass ?? 'sword'));
  }

  private weaponVisualSpec(weapon: Weapon) {
    const specs: Record<WeaponClass, { width: number; height: number; originX: number; originY: number; rotation: number }> = {
      sword: { width: 92, height: 92, originX: 0.15, originY: 0.75, rotation: -Math.PI / 4 },
      gun: { width: 106, height: 106, originX: 0.16, originY: 0.72, rotation: 0 },
      whip: { width: 100, height: 100, originX: 0.14, originY: 0.75, rotation: 0 },
      cannon: { width: 96, height: 96, originX: 0.15, originY: 0.74, rotation: -Math.PI / 4 },
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
    const sdk = window.Builda;
    if (sdk?.runtime) {
      try {
        this.buildaSafeArea = sdk.runtime.safeArea();
        this.buildaCapsuleRect = sdk.runtime.capsuleMenuRect();
      } catch {
        this.buildaSafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
        this.buildaCapsuleRect = { top: 0, right: 0, width: 0, height: 0 };
      }
    }
    const canvasRect = this.game?.canvas?.getBoundingClientRect();
    const scaleX = canvasRect?.width ? W / canvasRect.width : 1;
    const scaleY = canvasRect?.height ? H / canvasRect.height : 1;
    const safeTop = Math.max(18, (this.buildaSafeArea.top + 8) * scaleY);
    const capsuleRight = this.buildaCapsuleRect.width > 0
      ? (this.buildaSafeArea.right + this.buildaCapsuleRect.right + this.buildaCapsuleRect.width + 12) * scaleX
      : this.buildaSafeArea.right * scaleX + 20;
    const safeBottom = this.buildaSafeArea.bottom * scaleY;
    this.hud.panel?.setPosition(174, H - 242 - safeBottom);
    this.hud.resourcePanel?.setPosition(W - 122 - Math.max(0, capsuleRight - 20), safeTop + 36);
  }

  private async notifyBuildaReady() {
    const sdk = window.Builda;
    if (!sdk?.runtime?.ready) return;
    try {
      const result = await sdk.runtime.ready();
      if (!result.ok) console.warn(`[Builda] runtime.ready failed: ${result.error.code}`);
      this.refreshBuildaLayout();
    } catch (error) {
      console.warn('[Builda] runtime.ready unavailable', error);
    }
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
      const active = this.enemies.some((enemy) => !enemy.dead && distance(enemy.node, this.player) < weapon.range + 70);
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
    this.hud.hp?.setText(`生命 ${Math.ceil(this.hp)} / ${this.maxHp}${this.maxShield > 0 ? ` · 护盾 ${Math.ceil(this.shield)}` : ''}`);
    this.hud.xp?.setText(`经验 ${Math.floor(this.xp)} / ${this.xpNeed} · Lv.${this.level}`);
    const sanLabel = this.mutated
      ? 'SAN 变异态 · 伤害↑ 防御↓'
      : this.frenzyActive
        ? `SAN 归零 · 暴走 ${this.frenzyTimer.toFixed(1)} 秒`
        : this.sanLowActive
          ? `SAN 归零 · 刷怪加速 ${this.sanLowTimer.toFixed(1)} 秒`
          : this.mutationTimer > 0
            ? `SAN 归零 · 变异倒计时 ${this.mutationTimer.toFixed(1)} 秒`
            : this.san < 30
              ? `SAN 偏低 · ${Math.ceil(this.san)} / 100`
              : `SAN ${Math.ceil(this.san)} / 100`;
    this.hud.san?.setText(sanLabel);
    const weapon = this.currentWeapon();
    this.hud.weapon?.setText(weapon
      ? `${weapon.name} Lv.${weapon.level} · ×${weapon.copies} · ${this.currentWeaponDamage(weapon)}伤害`
      : '手持：无');
    this.hud.weaponIcon?.setTexture(this.weaponAssetKey(weapon)).setVisible(true).setDisplaySize(46, 46);
    const attackStatusLabel = this.activeAttackStatus
      ? `${({ poison: '中毒', burn: '燃烧', weaken: '虚弱' } as Record<AttackStatus, string>)[this.activeAttackStatus]} Lv.${this.attackStatusLevel}`
      : '无攻击特效';
    const combatStatus = this.mutated
      ? '变异：刷怪↑ · 移速↑ · 伤害↑ · 防御↓'
      : this.frenzyActive
        ? '暴走：伤害↑ · 护盾效果↓'
        : this.mutationTimer > 0
          ? `变异倒计时 ${this.mutationTimer.toFixed(1)} 秒 · 防御↓`
          : this.sanLowActive
            ? 'SAN 暴走：刷怪↑ · 伤害↑ · 防御↓'
            : `武器环绕 · 自动拾取 · ${attackStatusLabel}`;
    this.hud.status?.setText(combatStatus);
    this.hud.kills?.setText(`击破 ${this.kills}`);
    this.hud.hp?.setColor(this.hp < 30 ? palette.danger : palette.cream);
    this.hud.san?.setColor(this.mutated || this.san < 30 ? palette.danger : palette.cyan);
    const sanAlert = this.sanLowActive || this.mutationTimer > 0 || this.mutated || this.frenzyActive;
    const pulse = 0.04 + (Math.sin(this.sanPulse * 8) + 1) * 0.025;
    this.hud.sanOverlay?.setAlpha(sanAlert ? pulse : this.san < 30 ? 0.025 : 0);
    const skillVisible = this.phase === 'battle' && this.frenzyAvailable && !this.frenzyActive;
    this.hud.skillIcon?.setVisible(skillVisible).setAlpha(skillVisible ? 0.92 + (Math.sin(this.sanPulse * 8) + 1) * 0.04 : 0);
    this.hud.skill?.setVisible(skillVisible).setAlpha(skillVisible ? 0.82 + (Math.sin(this.sanPulse * 8) + 1) * 0.09 : 0);
    const hpRatio = clamp(this.hp / Math.max(1, this.maxHp), 0, 1);
    const xpRatio = clamp(this.xp / Math.max(1, this.xpNeed), 0, 1);
    const healthBarHeight = 132;
    const healthBarY = 42 + healthBarHeight * (1 - hpRatio);
    this.hud.bar?.clear().fillStyle(0x2a3b42, 1).fillRect(18, 42, 18, healthBarHeight).fillStyle(this.hp < 30 ? 0xed716e : 0xd25563, 1).fillRect(18, healthBarY, 18, healthBarHeight * hpRatio);
    this.hud.xpBar?.clear().fillStyle(0x2a3b42, 1).fillRect(52, 84, 220, 7).fillStyle(0x557fc4, 1).fillRect(52, 84, 220 * xpRatio, 7);
    this.hud.sanBar?.clear().fillStyle(0x2a3b42, 1).fillRect(52, 110, 220, 7).fillStyle(this.mutated || this.frenzyActive ? 0xed716e : 0x7ab9d0, 1).fillRect(52, 110, 220 * clamp(this.san / 100, 0, 1), 7);
    this.updateHeldWeaponVisual();
  }

  private pinHudToViewport() {
    if (!this.ui) return;
    // Re-apply the fixed layer contract because camera follow can change nested container state.
    const visible = this.phase === 'battle' || this.phase === 'wave-cleanup' || this.phase === 'wave-break';
    this.ui.setPosition(0, 0).setDepth(100).setAlpha(1).setScrollFactor(0, 0, true).setVisible(visible);
    this.hud.panel?.setScrollFactor(0, 0, true).setDepth(25);
    this.hud.sanOverlay?.setScrollFactor(0, 0);
    this.hud.wave?.setScrollFactor(0, 0);
    this.hud.timer?.setScrollFactor(0, 0);
    this.hud.waveCleared?.setScrollFactor(0, 0);
    this.hud.wavePanel?.setScrollFactor(0, 0, true).setDepth(26);
    this.hud.resourcePanel?.setScrollFactor(0, 0, true).setDepth(26);
    this.hud.kills?.setScrollFactor(0, 0);
    this.hud.skillIcon?.setScrollFactor(0, 0);
    this.hud.skill?.setScrollFactor(0, 0);
  }

  private loadProgress() {
    try {
      const raw = window.localStorage.getItem('hospital-godslayer-progress');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ProgressSave>;
      const defaultSkinIds = ['patient-default', 'investigator-normal'];
      const defaultWeaponSkins = ['sword-default', 'gun-default', 'whip-default', 'cannon-default'];
      const equippedWeaponSkinIds = parsed.equippedWeaponSkinIds && typeof parsed.equippedWeaponSkinIds === 'object'
        ? parsed.equippedWeaponSkinIds
        : { sword: 'sword-default', gun: 'gun-default', whip: 'whip-default', cannon: 'cannon-default' };
      this.progress = {
        maxFloor: clamp(Number(parsed.maxFloor) || 1, 1, TOTAL_FLOORS),
        mainlineIntroSeen: parsed.mainlineIntroSeen === true,
        unlockedWeaponIds: Array.isArray(parsed.unlockedWeaponIds) ? parsed.unlockedWeaponIds.filter((id): id is string => typeof id === 'string') : ['knife', 'ward-lantern'],
        unlockedWeaponSkinIds: Array.isArray(parsed.unlockedWeaponSkinIds) ? parsed.unlockedWeaponSkinIds.filter((id): id is string => typeof id === 'string') : defaultWeaponSkins,
        equippedWeaponSkinIds,
        unlockedSkinIds: Array.isArray(parsed.unlockedSkinIds) ? parsed.unlockedSkinIds.filter((id): id is string => typeof id === 'string') : defaultSkinIds,
        equippedSkinId: typeof parsed.equippedSkinId === 'string' ? parsed.equippedSkinId : 'patient-default',
        archiveKinds: Array.isArray(parsed.archiveKinds) ? parsed.archiveKinds.filter((id): id is string => typeof id === 'string') : [],
        dailyCompletedDate: typeof parsed.dailyCompletedDate === 'string' ? parsed.dailyCompletedDate : undefined,
        dailyBestSeconds: Number.isFinite(Number(parsed.dailyBestSeconds)) && Number(parsed.dailyBestSeconds) > 0 ? Number(parsed.dailyBestSeconds) : undefined,
        dailyAttemptDate: typeof parsed.dailyAttemptDate === 'string' ? parsed.dailyAttemptDate : undefined,
        dailyAttempts: Math.max(0, Math.floor(Number(parsed.dailyAttempts) || 0)),
        metaCoins: Math.max(0, Number(parsed.metaCoins) || 0),
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
      if (!this.progress.unlockedSkinIds.includes('investigator-normal')) this.progress.unlockedSkinIds.splice(1, 0, 'investigator-normal');
      if (!this.progress.unlockedSkinIds.includes(this.progress.equippedSkinId)) this.progress.equippedSkinId = this.progress.unlockedSkinIds[0] ?? 'patient-default';
    } catch {
      this.progress = { maxFloor: 1, mainlineIntroSeen: false, unlockedWeaponIds: ['knife', 'ward-lantern'], unlockedWeaponSkinIds: ['sword-default', 'gun-default', 'whip-default', 'cannon-default'], equippedWeaponSkinIds: { sword: 'sword-default', gun: 'gun-default', whip: 'whip-default', cannon: 'cannon-default' }, unlockedSkinIds: ['patient-default', 'investigator-normal'], equippedSkinId: 'patient-default', archiveKinds: [], dailyBestSeconds: undefined, dailyAttemptDate: undefined, dailyAttempts: 0, metaCoins: 0 };
    }
  }

  private saveProgress() {
    try { window.localStorage.setItem('hospital-godslayer-progress', JSON.stringify(this.progress)); } catch { /* local storage can be unavailable in an embedded preview */ }
  }

  private async ensurePlayerIdentity() {
    if (this.playerIdentityLoaded) return this.playerNickname;
    try {
      const result = await window.Builda?.whoami?.({ timeoutMs: 1200 });
      if (result?.ok && result.data.name.trim()) {
        this.playerNickname = result.data.name.trim().slice(0, 14);
      }
    } catch {
      // The standalone browser preview has no host identity; keep the local patient label.
    }
    this.playerIdentityLoaded = true;
    this.dailyBoard = this.dailyBoard.map((entry) => entry.rank === 3 ? { ...entry, name: this.playerNickname } : entry);
    return this.playerNickname;
  }

  private async loadDailyBoard() {
    if (this.dailyBoardLoaded) return;
    try {
      const result = await window.Builda?.rank?.getRankList('daily_night', { limit: 20, timeoutMs: 1400 });
      if (result?.ok && result.data.list.length > 0) {
        this.dailyBoard = result.data.list.map((entry: { rank: number; player: { name: string }; score: number }) => ({
          rank: entry.rank,
          name: entry.player.name.trim().slice(0, 14) || `患者 ${entry.rank}`,
          score: Math.max(0, Math.round(entry.score)),
        }));
      }
    } catch {
      // The local board remains visible when a host rank board is unavailable.
    }
    while (this.dailyBoard.length < 20) {
      const rank = this.dailyBoard.length + 1;
      this.dailyBoard.push({ rank, name: `未登记患者 ${String(rank).padStart(2, '0')}`, score: 0 });
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

  private async submitDailyScore(seconds: number) {
    try {
      await window.Builda?.rank?.submitScore('daily_night', this.dailyScoreForTime(seconds), { timeoutMs: 1400 });
    } catch {
      // Score submission is best effort; the local fastest record is still stored.
    }
    this.dailyBoardLoaded = false;
  }

  private todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  private isDailyCompleted() {
    return this.progress.dailyCompletedDate === this.todayKey();
  }

  private dailyAttemptsUsed() {
    if (this.progress.dailyAttemptDate !== this.todayKey()) return 0;
    return Math.max(0, Math.floor(this.progress.dailyAttempts ?? 0));
  }

  private async startDailyAttempt(weaponId: string) {
    if (this.isDailyCompleted()) {
      this.showDailyChallenge('本月挑战已完成，本日入口已锁定');
      return;
    }
    const today = this.todayKey();
    let attempts = this.dailyAttemptsUsed();
    if (attempts >= 3) {
      const sdk = window.Builda;
      if (!sdk?.pay?.showPayPanel) {
        this.showDailyChallenge('免费次数已用完，当前环境未接入平台支付');
        return;
      }
      try {
        const result = await sdk.pay.showPayPanel(PAID_UPGRADE_REFRESH_SALE_ID, { timeoutMs: 15000 });
        if (!result.ok || !result.data.success) {
          this.showDailyChallenge('付费挑战未完成，本次未进入');
          return;
        }
      } catch {
        this.showDailyChallenge('平台支付暂不可用，本次未进入');
        return;
      }
    }
    attempts += 1;
    this.progress.dailyAttemptDate = today;
    this.progress.dailyAttempts = attempts;
    this.saveProgress();
    this.startRun(1, 'daily', weaponId);
  }

  private isWeaponUnlocked(id: string) {
    return this.progress.unlockedWeaponIds.includes(id);
  }

  private createWeaponRoster(): Weapon[] {
    return [
      { id: 'knife', name: '病院刀', glyph: '刀', weaponClass: 'sword', type: 'melee', effect: 'slash', color: 0xed716e, damage: WEAPON_DAMAGE.knife, cooldown: 0.42, range: 90, rotationSpeed: 4.8, level: 1, copies: 1, ammo: 1, owned: true },
      { id: 'ward-lantern', name: '病房灯枪', glyph: '枪', weaponClass: 'gun', type: 'ranged', effect: 'spark', color: 0xf2bf62, damage: WEAPON_DAMAGE.wardLantern, cooldown: 0.72, range: 360, rotationSpeed: 3.8, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'thorn', name: '荆棘长鞭', glyph: '鞭', weaponClass: 'whip', type: 'melee', effect: 'tentacle', color: 0x8fd17c, damage: WEAPON_DAMAGE.thorn, cooldown: 0.64, range: 100, rotationSpeed: 5.6, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'echo', name: '回声炮', glyph: '炮', weaponClass: 'cannon', type: 'ranged', effect: 'burst', color: 0xb798e2, damage: WEAPON_DAMAGE.echo, cooldown: 0.62, range: 410, rotationSpeed: 4.4, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'crown', name: '冠冕雷炮', glyph: '雷', weaponClass: 'cannon', type: 'ranged', effect: 'beam', color: 0xe5d47a, damage: WEAPON_DAMAGE.crown, cooldown: 0.58, range: 480, rotationSpeed: 5.2, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'flesh-tentacle', name: '血肉触手', glyph: '触', weaponClass: 'whip', type: 'melee', effect: 'tentacle', color: 0x9a6bd1, damage: WEAPON_DAMAGE.fleshTentacle, cooldown: 0.58, range: 104, rotationSpeed: 5.1, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'laser-eye', name: '激光眼', glyph: '眼', weaponClass: 'gun', type: 'ranged', effect: 'laser', color: 0xf06eaa, damage: WEAPON_DAMAGE.laserEye, cooldown: 0.7, range: 540, rotationSpeed: 4.9, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'sanity-bomb', name: '理智炸弹', glyph: '弹', weaponClass: 'cannon', type: 'ranged', effect: 'bomb', color: 0xe78a57, damage: WEAPON_DAMAGE.sanityBomb, cooldown: 0.86, range: 430, rotationSpeed: 4.2, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'void-scissors', name: '虚空剪', glyph: '剪', weaponClass: 'sword', type: 'melee', effect: 'void', color: 0x6b83e8, damage: WEAPON_DAMAGE.voidScissors, cooldown: 0.52, range: 112, rotationSpeed: 6.0, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'neon-orbit', name: '霓虹轨道', glyph: '轨', weaponClass: 'gun', type: 'ranged', effect: 'neon', color: 0x49e5c2, damage: WEAPON_DAMAGE.neonOrbit, cooldown: 0.56, range: 560, rotationSpeed: 5.6, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'abyss-drill', name: '深渊钻', glyph: '钻', weaponClass: 'sword', type: 'melee', effect: 'burst', color: 0xd7d7e8, damage: WEAPON_DAMAGE.abyssDrill, cooldown: 0.5, range: 122, rotationSpeed: 6.4, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'star-cannon', name: '星骸炮', glyph: '星', weaponClass: 'cannon', type: 'ranged', effect: 'beam', color: 0x7ab9d0, damage: WEAPON_DAMAGE.starCannon, cooldown: 0.68, range: 620, rotationSpeed: 4.6, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'dream-mine', name: '梦魇雷', glyph: '雷', weaponClass: 'cannon', type: 'ranged', effect: 'bomb', color: 0xf2bf62, damage: WEAPON_DAMAGE.dreamMine, cooldown: 0.78, range: 480, rotationSpeed: 4.8, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'eldritch-whip', name: '古神鞭', glyph: '鞭', weaponClass: 'whip', type: 'melee', effect: 'tentacle', color: 0xb46be0, damage: WEAPON_DAMAGE.eldritchWhip, cooldown: 0.44, range: 138, rotationSpeed: 6.7, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'skull-rail', name: '颅骨轨炮', glyph: '轨', weaponClass: 'gun', type: 'ranged', effect: 'laser', color: 0xff8fba, damage: WEAPON_DAMAGE.skullRail, cooldown: 0.62, range: 680, rotationSpeed: 5.0, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'cosmic-mortar', name: '宇宙迫击炮', glyph: '陨', weaponClass: 'cannon', type: 'ranged', effect: 'bomb', color: 0xd99263, damage: WEAPON_DAMAGE.cosmicMortar, cooldown: 0.84, range: 720, rotationSpeed: 4.1, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'god-eye', name: '神之眼', glyph: '眼', weaponClass: 'gun', type: 'ranged', effect: 'laser', color: 0xffd86f, damage: WEAPON_DAMAGE.godEye, cooldown: 0.55, range: 760, rotationSpeed: 5.4, level: 0, copies: 0, ammo: 1, owned: false },
      { id: 'hospital-core', name: '医院核心', glyph: '核', weaponClass: 'cannon', type: 'ranged', effect: 'beam', color: 0xc7f4e8, damage: WEAPON_DAMAGE.hospitalCore, cooldown: 0.5, range: 820, rotationSpeed: 5.8, level: 0, copies: 0, ammo: 1, owned: false },
    ];
  }

  private showWeaponSelect(mode: RunMode, targetFloor = this.floor) {
    if (mode === 'daily' && this.isDailyCompleted()) {
      this.showDailyChallenge('今日挑战已完成，请明日再来~');
      return;
    }
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
      sword: { label: '近战', icon: 'weapon-category-melee' },
      gun: { label: '远程', icon: 'weapon-category-ranged' },
      whip: { label: '法术', icon: 'weapon-category-magic' },
      cannon: { label: '重型', icon: 'weapon-category-heavy' },
    };
    const selectedWeapon = baseWeapons.find((weapon) => weapon.id === this.selectedWeaponId) ?? baseWeapons[0];
    if (!selectedWeapon) return;
    if (!this.weaponSelectPreviewSkinId || !this.weaponSkins.some((skin) => skin.id === this.weaponSelectPreviewSkinId && skin.weaponClass === selectedWeapon.weaponClass)) {
      this.weaponSelectPreviewSkinId = this.equippedWeaponSkin(selectedWeapon.weaponClass).id;
    }
    const selectedSkin = this.weaponSkins.find((skin) => skin.id === this.weaponSelectPreviewSkinId) ?? this.equippedWeaponSkin(selectedWeapon.weaponClass);
    const selectedSkinUnlocked = this.progress.unlockedWeaponSkinIds.includes(selectedSkin.id);
    const equippedSkin = this.equippedWeaponSkin(selectedWeapon.weaponClass);
    const accent = mode === 'daily' ? 0xb798e2 : 0x6bd3c1;

    layer.add(this.add.text(centerX, this.safeTopY(48, 8), '武器库', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '29px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(centerX, this.safeTopY(82, 8), mode === 'daily' ? '每日挑战 · 选择入场武器' : `第 ${this.selectedStartFloor} 层 · 选择入场武器`, { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.cyan }).setOrigin(0.5));
    layer.add(this.add.text(safe.right - 8, this.safeTopY(53, 8), `创游货币  ${this.progress.metaCoins}`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.amber }).setOrigin(1, 0.5));

    baseWeapons.forEach((weapon, index) => {
      const meta = categoryMeta[weapon.weaponClass];
      const unlocked = this.isWeaponUnlocked(weapon.id) || (mode === 'mainline' && weapon.id === 'knife');
      const x = 112 + layoutShift;
      const y = 170 + index * 132;
      const color = unlocked ? weapon.color : 0x405158;
      const button = this.add.container(x, y);
      const frame = this.add.image(0, 0, 'weapon-select-frame-category-v1').setOrigin(0.5).setDisplaySize(142, 116).setAlpha(unlocked ? 0.98 : 0.58);
      button.add(frame);
      if (this.textures.exists(meta.icon)) button.add(this.add.image(0, -11, meta.icon).setOrigin(0.5).setDisplaySize(58, 58).setAlpha(unlocked ? 0.98 : 0.45));
      button.add(this.add.text(0, 39, meta.label, { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: unlocked ? palette.cream : palette.muted }).setOrigin(0.5).setFontStyle('bold'));
      if (weapon.id === selectedWeapon.id) button.add(this.add.rectangle(0, 0, 126, 100, 0x6bd3c1, 0).setStrokeStyle(2, accent, 0.92));
      layer.add(button);
      this.uiActionRegions.push({
        phase: this.phase,
        x,
        y,
        width: 152,
        height: 126,
        callback: () => {
          if (!unlocked || (mode === 'daily' && !this.isWeaponUnlocked(weapon.id))) return;
          this.selectedWeaponId = weapon.id;
          this.weaponSelectPreviewSkinId = this.equippedWeaponSkin(weapon.weaponClass).id;
          this.showWeaponSelect(mode, this.selectedStartFloor);
        },
        setPressed: (pressed) => button.setScale(pressed ? 0.96 : 1),
      });
    });

    const main = this.add.container(500 + layoutShift, 292);
    main.add(this.add.image(0, 0, 'weapon-select-frame-main-v1').setOrigin(0.5).setDisplaySize(520, 310).setAlpha(0.98));
    const mainImage = this.add.image(0, -4, this.weaponSkinTextureKey(selectedSkin)).setOrigin(0.5).setDisplaySize(214, 214);
    main.add(mainImage);
    main.add(this.add.text(0, 119, selectedWeapon.name, { fontFamily: 'Microsoft YaHei', fontSize: '22px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    main.add(this.add.text(0, 146, `${categoryMeta[selectedWeapon.weaponClass].label} · ${selectedWeapon.type === 'melee' ? '环绕近战' : '远程投射'} · 伤害 ${selectedWeapon.damage}`, { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.cyan }).setOrigin(0.5));
    layer.add(main);

    const detail = this.add.container(500 + layoutShift, 525);
    detail.add(this.add.image(0, 0, 'weapon-select-frame-detail-v1').setOrigin(0.5).setDisplaySize(520, 150).setAlpha(0.98));
    detail.add(this.add.text(-226, -44, selectedSkin.name, { fontFamily: 'Microsoft YaHei', fontSize: '18px', color: selectedSkin.color ? hex(selectedSkin.color) : palette.cyan }).setFontStyle('bold'));
    detail.add(this.add.text(-226, -12, selectedSkinUnlocked ? (selectedSkin.id === equippedSkin.id ? '当前装备 · 进入战斗后生效' : '已解锁 · 可装备') : `未解锁 · 需要 ${selectedSkin.cost} 创游货币`, { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: selectedSkinUnlocked ? palette.green : palette.amber }));
    detail.add(this.add.text(-226, 16, `攻击方式：${selectedWeapon.effect === 'slash' ? '弧形斩击' : selectedWeapon.effect === 'spark' ? '灯火脉冲' : selectedWeapon.effect === 'tentacle' ? '触手延展' : '异化爆裂'}  ·  射程 ${selectedWeapon.range}`, { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.muted }));
    detail.add(this.add.text(-226, 39, '皮肤只改变武器外观，伤害和成长仍由武器本体决定。', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.muted }));
    layer.add(detail);

    const skinPanelX = clamp(1004 + layoutShift, safe.left + 222, safe.right - 222);
    layer.add(this.add.text(skinPanelX, this.safeTopY(139, 18), '武器皮肤', { fontFamily: 'Microsoft YaHei', fontSize: '18px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(skinPanelX, this.safeTopY(162, 18), `${this.weaponSkinsFor(selectedWeapon.weaponClass).length} 款 · 可预览未解锁`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '10px', color: palette.cyan }).setOrigin(0.5));
    this.addPixelFrame(layer, skinPanelX, 390, 444, 486, 0x071117, accent);
    this.weaponSkinsFor(selectedWeapon.weaponClass).forEach((skin, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = skinPanelX - 134 + column * 134;
      const y = 250 + row * 127;
      const unlocked = this.progress.unlockedWeaponSkinIds.includes(skin.id);
      const selected = skin.id === selectedSkin.id;
      const card = this.add.container(x, y);
      card.add(this.add.image(0, 0, 'weapon-select-frame-skin-card-v1').setOrigin(0.5).setDisplaySize(120, 112).setAlpha(unlocked ? 0.98 : 0.64));
      card.add(this.add.image(0, -5, this.weaponSkinTextureKey(skin)).setOrigin(0.5).setDisplaySize(78, 78).setAlpha(unlocked ? 0.98 : 0.42));
      if (selected) card.add(this.add.rectangle(0, 0, 108, 100, 0x6bd3c1, 0).setStrokeStyle(2, accent, 1));
      if (!unlocked) {
        card.add(this.add.rectangle(0, -4, 106, 76, 0x05090f, 0.36));
        card.add(this.add.text(0, -4, '锁定', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.amber }).setOrigin(0.5));
      }
      card.add(this.add.text(0, 45, skin.name, { fontFamily: 'Microsoft YaHei', fontSize: '9px', color: unlocked ? palette.cream : palette.muted, wordWrap: { width: 104 }, align: 'center' }).setOrigin(0.5, 0.5));
      layer.add(card);
      this.uiActionRegions.push({
        phase: this.phase,
        x,
        y,
        width: 126,
        height: 118,
        callback: () => { this.weaponSelectPreviewSkinId = skin.id; this.showWeaponSelect(mode, this.selectedStartFloor); },
        setPressed: (pressed) => card.setScale(pressed ? 0.96 : 1),
      });
    });

    const actionY = this.safeBottomY(656, 28);
    if (!selectedSkinUnlocked) {
      this.addWeaponSelectImageButton(layer, 390 + layoutShift, actionY, 212, 46, 'weapon-select-frame-action-buy-v1', `购买 ${selectedSkin.cost}`, () => this.buyWeaponSkin(selectedSkin.id, mode), accent);
      this.addWeaponSelectImageButton(layer, 615 + layoutShift, actionY, 212, 46, 'weapon-select-frame-action-equip-v1', '预览中', () => undefined, 0x46636a);
    } else {
      this.addWeaponSelectImageButton(layer, 390 + layoutShift, actionY, 212, 46, 'weapon-select-frame-action-buy-v1', selectedSkin.id === equippedSkin.id ? '已装备' : '装备皮肤', () => {
        this.equipWeaponSkin(selectedSkin.id);
        this.showWeaponSelect(mode, this.selectedStartFloor);
      }, selectedSkin.id === equippedSkin.id ? 0x46636a : accent);
      this.addWeaponSelectImageButton(layer, 615 + layoutShift, actionY, 212, 46, 'weapon-select-frame-action-equip-v1', '进入战斗', () => {
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
    this.phase = 'start';
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
    this.addMenuImageButton(layer, safe.centerX, firstButtonY, 330, buttonHeight, 'menu-button-archive-v1', '病历档案', () => this.showProfile());
    this.addMenuImageButton(layer, safe.centerX, firstButtonY + buttonHeight + buttonGap, 330, buttonHeight, 'menu-button-mainline-v1', '主线通关', () => this.showMainline(this.floor));
    this.addMenuImageButton(layer, safe.centerX, lastButtonY, 330, buttonHeight, 'menu-button-daily-v1', '每日挑战', () => this.showDailyChallenge());
    this.overlay = layer;
  }

  private addWeaponSelectImageButton(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, textureKey: string, label: string, callback: () => void, accent: number) {
    const button = this.add.container(x, y);
    const image = this.add.image(0, 0, textureKey).setOrigin(0.5).setDisplaySize(width, height).setAlpha(0.98);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Microsoft YaHei', fontSize: width < 190 ? '13px' : '14px', color: palette.cream, stroke: '#080d11', strokeThickness: 4,
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
    const safe = this.safeGameRect(12);
    const title = this.add.image(safe.centerX, safe.top - 8, 'menu-title-v2').setOrigin(0.5, 0);
    const titleWidth = Math.min(1120, safe.width - 36);
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
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Microsoft YaHei',
      fontSize: '23px',
      color: palette.cream,
      stroke: '#080d11',
      strokeThickness: 5,
    }).setOrigin(0.5).setFontStyle('bold');
    button.add([image, text]);
    const setPressed = (pressed: boolean) => {
      button.setScale(pressed ? 0.96 : 1);
      image.setTint(pressed ? 0xc6d8d0 : 0xffffff);
      text.setAlpha(pressed ? 0.82 : 1);
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
      boss: '月蚀狼王',
    };
    return labels[kind];
  }

  private addFloorEnemyPreview(parent: Phaser.GameObjects.Container, x: number, y: number, kind: EnemyKind) {
    const card = this.add.container(x, y);
    const accent = kind === 'boss' || kind === 'miniBoss' ? paletteRgb.danger : paletteRgb.cyan;
    card.add(this.add.rectangle(0, 0, 124, 106, 0x071117, 0.9).setStrokeStyle(1, accent, 0.62));
    let sprite: Phaser.GameObjects.Sprite | undefined;
    if (kind === 'boss' || kind === 'miniBoss') {
      const key = kind === 'boss' ? 'floor-boss-01' : 'mini-boss-01';
      if (this.textures.exists(key)) sprite = this.add.sprite(0, -10, key, 0).setOrigin(0.5).setDisplaySize(68, 68);
    } else {
      const artKey = SMALL_ENEMY_ART_VARIANTS[kind as SmallEnemyKind]?.[0];
      if (artKey && this.textures.exists(artKey)) sprite = this.add.sprite(0, -10, artKey, 0).setOrigin(0.5).setDisplaySize(58, 58);
    }
    if (sprite) card.add(sprite);
    else card.add(this.add.circle(0, -10, 23, kind === 'boss' ? 0x7e2e51 : 0x315b68, 0.9).setStrokeStyle(2, accent, 0.8));
    card.add(this.add.text(0, 38, this.enemyPreviewLabel(kind), { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.cream, align: 'center' }).setOrigin(0.5));
    parent.add(card);
    return card;
  }

  private setFloorScrollOffset(offset: number) {
    this.floorScrollOffset = clamp(offset, this.floorScrollMin, this.floorScrollMax);
    this.floorScrollContent?.setY(this.floorScrollOffset);
    this.floorScrollRegions.forEach(({ region, baseY }) => { region.y = baseY + this.floorScrollOffset; });
  }

  private showMainlineIntro() {
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
    const textShade = this.add.rectangle(panelX, 360, 450, 430, 0x02070b, 0.46)
      .setStrokeStyle(1, 0x46636a, 0.52);
    layer.add(textShade);
    layer.add(this.add.rectangle(panelX, this.safeTopY(177, 18), 360, 2, paletteRgb.danger, 0.7));
    layer.add(this.add.text(panelX, this.safeTopY(132, 18), '主线通关', {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: '30px',
      color: palette.cream,
      stroke: '#05090f',
      strokeThickness: 5,
    }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(panelX, this.safeTopY(205, 18), '病历记录  ·  夜间再入院', {
      fontFamily: 'Microsoft YaHei',
      fontSize: '13px',
      color: palette.cyan,
    }).setOrigin(0.5));
    layer.add(this.add.text(panelX - 200, 270, '又来到了这座医院...\n难道还要和那群恶心的怪物战斗吗？', {
      fontFamily: 'Microsoft YaHei',
      fontSize: '24px',
      color: palette.cream,
      lineSpacing: 12,
      wordWrap: { width: 400 },
      stroke: '#05090f',
      strokeThickness: 4,
    }).setOrigin(0, 0.5));
    layer.add(this.add.text(panelX - 200, 395, '楼层还在向上延伸。黑雾里没有尽头。', {
      fontFamily: 'Microsoft YaHei',
      fontSize: '13px',
      color: palette.muted,
      wordWrap: { width: 390 },
    }));
    const continueIntro = () => {
      if (this.progress.mainlineIntroSeen) return;
      this.progress.mainlineIntroSeen = true;
      this.saveProgress();
      this.showMainline(this.floor);
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
    this.addButton(layer, panelX, this.safeBottomY(610, 40), 300, 54, '进入楼层档案', continueIntro, 'primary', 12);
    this.overlay = layer;
    this.tweens.add({ targets: layer, alpha: 1, duration: 720, ease: 'Sine.easeOut' });
  }

  private showMainline(targetFloor = this.floor) {
    if (!this.progress.mainlineIntroSeen) {
      this.showMainlineIntro();
      return;
    }
    this.phase = 'mainline-select';
    this.runMode = 'mainline';
    this.ui?.setVisible(false);
    const maxSelectable = clamp(this.progress.maxFloor, 1, TOTAL_FLOORS);
    this.selectedStartFloor = clamp(Math.round(targetFloor), 0, maxSelectable);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'mainline-floor-select-background-v1', 0.18);
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02070b, 0.24));
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    const selected = this.selectedStartFloor;
    layer.add(this.add.text(centerX, this.safeTopY(46, 18), '主线通关', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '28px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(centerX, this.safeTopY(78, 18), '精神病院 · 楼层档案', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.cyan }).setOrigin(0.5));
    layer.add(this.add.text(safe.right - 8, this.safeTopY(52, 18), `已开放 ${this.progress.maxFloor} / ${TOTAL_FLOORS}`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.green }).setOrigin(1, 0.5));
    layer.add(this.add.rectangle(centerX, this.safeTopY(104, 18), Math.min(1030, safe.width), 1, 0x46636a, 0.78));

    const leftColumnX = 355 + layoutShift;
    const building = this.add.container(leftColumnX, 400);
    building.add(this.add.text(0, -252, '精神病院 · WARD 07', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.amber }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(building);

    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff, 1).fillRect(64 + layoutShift, this.floorScrollViewport.top, 582, this.floorScrollViewport.bottom - this.floorScrollViewport.top);
    maskShape.setVisible(false);
    layer.add(maskShape);
    this.floorScrollContent = this.add.container(0, 0).setMask(maskShape.createGeometryMask());
    this.floorScrollRegions = [];
    // Every floor uses the same 16:9 raster window; the vertical gap keeps
    // the tower readable while allowing all thirty floors to scroll.
    const floorCardWidth = 420;
    const floorCardHeight = 132;
    const floorShellWidth = 560;
    const floorShellHeight = 178;
    const floorCardGap = 190;
    const floorCardX = leftColumnX;
    const baseYForFloor = (floor: number) => 596 - floor * floorCardGap;
    this.floorScrollMin = Math.min(0, this.floorScrollViewport.bottom - baseYForFloor(0));
    this.floorScrollMax = Math.max(0, this.floorScrollViewport.top - baseYForFloor(TOTAL_FLOORS));
    this.floorScrollOffset = clamp(408 - baseYForFloor(selected), this.floorScrollMin, this.floorScrollMax);
    this.floorScrollContent.setY(this.floorScrollOffset);
    for (let floor = 0; floor <= TOTAL_FLOORS; floor += 1) {
      const unlocked = floor === 0 || floor <= this.progress.maxFloor;
      const isSelected = floor === selected;
      // Every floor maps to the tower's single vertical window column.
      const x = floorCardX;
      const y = baseYForFloor(floor);
      const card = this.add.container(x, y);
      const glow = this.add.rectangle(0, 0, 338, 56, paletteRgb.danger, unlocked ? (isSelected ? 0.34 : 0.16) : 0.035);
      card.add(glow);
      if (unlocked) this.tweens.add({ targets: glow, alpha: isSelected ? 0.5 : 0.28, duration: 760, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      card.add(this.add.rectangle(0, 0, 320, 52, unlocked ? 0x0d1b22 : 0x11191e, 0.98).setStrokeStyle(isSelected ? 3 : 1, isSelected ? paletteRgb.amber : unlocked ? paletteRgb.danger : 0x3b5158, unlocked ? 0.96 : 0.7));
      card.add(this.add.text(-112, 0, this.floorLabel(floor), { fontFamily: 'Microsoft YaHei', fontSize: floor === 0 ? '15px' : '14px', color: unlocked ? palette.cream : palette.muted }).setOrigin(0, 0.5).setFontStyle('bold'));
      card.add(this.add.text(158, 0, unlocked ? (isSelected ? '当前选中' : '可进入') : '锁定', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: isSelected ? palette.amber : unlocked ? palette.danger : palette.muted }).setOrigin(1, 0.5));
      if (!unlocked) card.add(this.add.text(0, 0, '锁', { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.muted }).setOrigin(0.5));
      if (isSelected) card.add(this.add.rectangle(0, 0, 338, 62, 0x6bd3c1, 0).setStrokeStyle(1, 0x6bd3c1, 0.74));
      if (this.textures.exists('mainline-building-floor-shell-v1')) {
        card.add(this.add.image(0, 0, 'mainline-building-floor-shell-v1')
          .setOrigin(0.5)
          .setDisplaySize(floorShellWidth, floorShellHeight)
          .setAlpha(0.98));
      }
      const textureKey = unlocked
        ? (isSelected ? 'mainline-floor-selected-v1' : 'mainline-floor-unlocked-v1')
        : (isSelected ? 'mainline-floor-locked-selected-v1' : 'mainline-floor-locked-v1');
      if (isSelected && unlocked) {
        const halo = this.add.rectangle(0, 0, floorCardWidth + 12, floorCardHeight + 12, paletteRgb.cyan, 0.1)
          .setStrokeStyle(2, paletteRgb.amber, 0.82);
        card.add(halo);
        this.tweens.add({ targets: halo, alpha: 0.2, duration: 860, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      if (this.textures.exists(textureKey)) {
        card.add(this.add.image(0, 0, textureKey)
          .setOrigin(0.5)
          .setDisplaySize(floorCardWidth, floorCardHeight)
          .setAlpha(unlocked ? 0.98 : 0.92));
      }
      const labelColor = unlocked ? palette.cream : palette.muted;
      const stateColor = isSelected && unlocked ? palette.amber : unlocked ? palette.danger : palette.muted;
      card.add(this.add.text(-floorShellWidth / 2 + 24, -floorShellHeight / 2 + 22, this.floorLabel(floor), {
        fontFamily: 'Microsoft YaHei', fontSize: floor === 0 ? '15px' : '14px', color: labelColor,
        stroke: '#061017', strokeThickness: 4,
      }).setOrigin(0, 0.5).setFontStyle('bold'));
      const stateLabel = unlocked
        ? (isSelected ? '\u5f53\u524d\u9009\u4e2d' : '\u5df2\u89e3\u9501')
        : '\u672a\u89e3\u9501';
      card.add(this.add.text(floorShellWidth / 2 - 24, -floorShellHeight / 2 + 22, stateLabel, {
        fontFamily: 'Microsoft YaHei', fontSize: '11px', color: stateColor,
        stroke: '#061017', strokeThickness: 4,
      }).setOrigin(1, 0.5));
      this.floorScrollContent.add(card);
      if (unlocked) {
        const region: UiActionRegion = { phase: this.phase, x, y: y + this.floorScrollOffset, width: floorShellWidth + 18, height: floorShellHeight + 18, callback: () => this.showMainline(floor), setPressed: (pressed) => card.setScale(pressed ? 0.97 : 1) };
        this.uiActionRegions.push(region);
        this.floorScrollRegions.push({ region, baseY: y });
      }
    }
    layer.add(this.floorScrollContent);
    layer.add(this.add.text(leftColumnX, this.safeTopY(130, 18), '上下滑动查看楼层', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.muted }).setOrigin(0.5));
    layer.add(this.add.text(leftColumnX, this.safeBottomY(650, 22), '红光窗口可进入 · 锁定楼层需完成上一层', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.cyan }).setOrigin(0.5));

    const detailX = clamp(940 + layoutShift, safe.left + 250, safe.right - 250);
    const detail = this.add.container(detailX, 382);
    detail.add(this.add.rectangle(0, 0, 500, 470, 0x071117, 0.96).setStrokeStyle(2, selected === 0 ? paletteRgb.amber : paletteRgb.cyan, 0.9));
    detail.add(this.add.rectangle(0, 0, 484, 454, 0x071117, 0).setStrokeStyle(1, 0x46636a, 0.66));
    detail.add(this.add.text(-220, -206, this.floorLabel(selected), { fontFamily: 'Microsoft YaHei', fontSize: '25px', color: selected === 0 ? palette.amber : palette.cream }).setFontStyle('bold'));
    detail.add(this.add.text(220, -204, `${selected === 0 ? '教程' : `进度 ${selected} / ${TOTAL_FLOORS}`}`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '11px', color: palette.green }).setOrigin(1, 0));
    detail.add(this.add.text(-220, -168, this.floorZoneLabel(selected), { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.cyan }));
    detail.add(this.add.rectangle(0, -138, 438, 1, 0x46636a, 0.74));
    detail.add(this.add.text(-220, -112, '可能出现', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.muted }).setFontStyle('bold'));
    this.floorEnemyKinds(selected).slice(0, 6).forEach((kind, index) => this.addFloorEnemyPreview(detail, -148 + (index % 3) * 148, -34 + Math.floor(index / 3) * 112, kind));
    if (selected === 0) {
      detail.add(this.add.text(-220, 170, '入口教程', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.amber }).setFontStyle('bold'));
      detail.add(this.add.text(-220, 196, '满级体验：熟悉移动、自动攻击、经验升级与 SAN 异化。', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.cream, wordWrap: { width: 430 } }));
    } else {
      detail.add(this.add.text(-220, 170, `通关后解锁 ${selected < TOTAL_FLOORS ? this.floorLabel(selected + 1) : '终局档案'}`, { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.green }));
    }
    layer.add(detail);
    this.addButton(layer, detailX, this.safeBottomY(649, 34), 320, 48, selected === 0 ? '开始入口教程' : `进入${this.floorLabel(selected)}`, () => this.showWeaponSelect('mainline', selected), 'primary', 12);
    this.addButton(layer, 88, 38, 150, 42, '返回主界面', () => this.showStart(), 'muted', 8);
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
    const frame = this.add.container(x, y);
    frame.add(this.add.rectangle(4, 4, width, height, 0x03060a, 0.96));
    frame.add(this.add.rectangle(0, 0, width, height, fill, 0.98).setStrokeStyle(2, 0x080d13, 1));
    frame.add(this.add.rectangle(0, 0, width - 10, height - 10, fill, 0).setStrokeStyle(1, accent, 0.45));
    const commandFrameKey = this.textures.exists('ui-command-frame-v2') ? 'ui-command-frame-v2' : 'ui-command-frame';
    if (this.textures.exists(commandFrameKey)) {
      const edgeWidth = Math.max(180, width + 42);
      const edgeHeight = Math.min(58, Math.max(44, height * 0.12));
      const top = this.add.image(0, -height / 2 + edgeHeight * 0.38, commandFrameKey)
        .setDisplaySize(edgeWidth, edgeHeight)
        .setAlpha(0.78);
      const bottom = this.add.image(0, height / 2 - edgeHeight * 0.38, commandFrameKey)
        .setDisplaySize(edgeWidth, edgeHeight)
        .setFlipY(true)
        .setAlpha(0.7);
      frame.add([top, bottom]);
      if (this.textures.exists('ui-round-frame')) {
        const cornerSize = Math.min(48, Math.max(34, edgeHeight));
        const topLeft = this.add.image(-width / 2 + cornerSize * 0.55, -height / 2 + cornerSize * 0.55, 'ui-round-frame')
          .setDisplaySize(cornerSize, cornerSize)
          .setAlpha(0.72);
        const bottomRight = this.add.image(width / 2 - cornerSize * 0.55, height / 2 - cornerSize * 0.55, 'ui-round-frame')
          .setDisplaySize(cornerSize, cornerSize)
          .setAngle(180)
          .setAlpha(0.64);
        frame.add([topLeft, bottomRight]);
      }
    } else {
      const corners = this.add.graphics();
      corners.lineStyle(3, accent, 0.9);
      corners.lineBetween(-width / 2 + 6, -height / 2 + 14, -width / 2 + 6, -height / 2 + 6);
      corners.lineBetween(-width / 2 + 6, -height / 2 + 6, -width / 2 + 14, -height / 2 + 6);
      corners.lineBetween(width / 2 - 14, height / 2 - 6, width / 2 - 6, height / 2 - 6);
      corners.lineBetween(width / 2 - 6, height / 2 - 6, width / 2 - 6, height / 2 - 14);
      frame.add(corners);
    }
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

  private addDailyImageButton(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, label: string, callback: () => void, accent: number) {
    const button = this.add.container(x, y);
    const image = this.add.image(0, 0, 'daily-start-button-v1').setOrigin(0.5).setDisplaySize(width, height);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Microsoft YaHei', fontSize: '19px', color: palette.cream, stroke: '#080d11', strokeThickness: 4,
    }).setOrigin(0.5).setFontStyle('bold');
    button.add([image, text]);
    const setPressed = (pressed: boolean) => {
      button.setScale(pressed ? 0.96 : 1);
      image.setTint(pressed ? 0xc6d8d0 : 0xffffff);
      text.setAlpha(pressed ? 0.8 : 1);
    };
    parent.add(button);
    this.uiActionRegions.push({ phase: this.phase, x, y, width: width + 22, height: Math.max(48, height + 12), callback, setPressed });
    return button;
  }

  private dialogueLines() {
    if (this.tutorialRun) {
      return [
        { speaker: '深渊使者', role: '梦境来客', glyph: '渊', color: 0xb798e2, text: '病院已经被诡异污染。找到并击败源头，你才能从梦里醒来。' },
        { speaker: '小男孩', role: '患者 / 0001', glyph: '男', color: 0xf2bf62, text: '我会记住这条路。刀、枪和异化的力量，都交给我试试。' },
        { speaker: '深渊使者', role: '梦境来客', glyph: '渊', color: 0xb798e2, text: '去吧，少年。等你睁眼时，真正的夜班才刚刚开始。' },
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
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'ward-day-v1', 0);
    const safe = this.pageSafeBounds(12);
    const layoutShift = safe.centerX - W / 2;
    const line = this.dialogueLines()[this.dialogueIndex];
    const playerActive = line.speaker === '小男孩';
    const npcLine = playerActive ? this.dialogueLines().find((entry) => entry.speaker !== '小男孩') ?? this.dialogueLines()[0] : line;
    const npcData = { color: npcLine.color, role: npcLine.role, glyph: npcLine.glyph };
    const progressLabel = this.add.text(safe.left, this.safeTopY(34, 8), `${String(this.dialogueIndex + 1).padStart(2, '0')} / ${String(this.dialogueLines().length).padStart(2, '0')}`, {
      fontFamily: 'Courier New, Microsoft YaHei', fontSize: '14px', color: palette.cream, stroke: '#1b1413', strokeThickness: 4,
    }).setOrigin(0, 0.5);
    const floorLabel = this.add.text(safe.left, this.safeTopY(58, 8), `第 ${this.floor} 层`, {
      fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.muted, stroke: '#1b1413', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    const skipLabel = this.add.text(safe.right, this.safeTopY(34, 8), '跳过', {
      fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.cream, stroke: '#1b1413', strokeThickness: 4,
    }).setOrigin(1, 0.5);
    layer.add([progressLabel, floorLabel, skipLabel]);
    if (this.tutorialRun) floorLabel.setText('入口教程');

    const stage = this.add.container(layoutShift, 0);
    const npcX = 500;
    const playerX = 780;
    const actorY = this.safeBottomY(515, 108);
    this.addDialogueCharacter(stage, npcX, actorY - 28, npcLine.speaker === '夜班护士' ? 'nurse' : 'doctor', npcData.color);
    const playerShadow = this.add.graphics();
    playerShadow.fillStyle(0x05090f, 0.24).fillEllipse(playerX, actorY + 112, 126, 22);
    stage.add(playerShadow);
    const playerSprite = this.addPatientSprite(stage, playerX, actorY, 224);
    if (playerSprite) {
      playerSprite.setAlpha(1).clearTint();
    }

    const npcBubble = this.addDialogueBubble(stage, npcX, 345, 270, 96, '', !playerActive ? line.text : '', 'left', !playerActive ? line.color : 0x5d5c53);
    const playerBubble = this.addDialogueBubble(stage, playerX, 345, 270, 96, '', playerActive ? line.text : '', 'right', playerActive ? line.color : 0x5d5c53);
    npcBubble.setVisible(!playerActive);
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
    if (speaker) bubble.add(this.add.text(left + 22, top + 16, speaker, { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: '#392f4c' }).setFontStyle('bold'));
    const messageTop = speaker ? top + 38 : top + 20;
    const messageHeight = speaker ? height - 50 : height - 30;
    bubble.add(this.add.text(left + 22, messageTop, message, { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: '#392f4c', lineSpacing: 4, wordWrap: { width: width - 44 } }).setFixedSize(width - 44, messageHeight));
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
      onComplete: () => this.beginBattle(),
    });
  }

  private beginBattle() {
    this.clearOverlay();
    this.phase = 'battle';
    this.ui?.setVisible(true);
    this.updateHud();
    if (this.tutorialRun) this.showTutorialGuide();
  }

  private showTutorialGuide() {
    this.tutorialGuide?.destroy(true);
    const guide = this.add.container(W / 2, 122).setDepth(80).setScrollFactor(0);
    guide.add(this.add.rectangle(0, 0, 780, 82, 0x071117, 0.94).setStrokeStyle(2, paletteRgb.amber, 0.86));
    guide.add(this.add.text(0, -22, '入口教程 · 先活下来，再观察 SAN', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.amber }).setOrigin(0.5).setFontStyle('bold'));
    guide.add(this.add.text(0, 12, '拖动任意位置移动 ｜ 武器自动攻击 ｜ 收集绿色经验升级 ｜ SAN 归零会异化', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.cream }).setOrigin(0.5));
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
      const unlocked = this.progress.unlockedSkinIds.includes(skin.id);
      const y = 482 + index * 50;
      const setText = skin.setName ? ` · ${skin.setName}（${skin.setBuff}）` : '';
      layer.add(this.add.text(525 + layoutShift, y, unlocked ? `${skin.name}${setText}` : '??? 未解锁', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: unlocked ? (skin.id === this.progress.equippedSkinId ? palette.amber : palette.cream) : palette.muted }).setFixedSize(245, 20));
      if (unlocked) {
        this.addButton(layer, 780 + layoutShift, y + 2, 96, 24, skin.id === this.progress.equippedSkinId ? '已装备' : '装备', () => this.equipSkin(skin.id), skin.id === this.progress.equippedSkinId ? 'muted' : 'primary', 10);
      } else if (skin.id !== 'scarlet-night') {
        const cost = this.skinPurchaseCost(skin.id);
        this.addButton(layer, 780 + layoutShift, y + 2, 96, 24, `购买 ${cost}`, () => this.buySkin(skin.id), 'primary', 10);
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
    const previewUnlocked = this.progress.unlockedSkinIds.includes(previewSkin.id);
    const previewEquipped = previewSkin.id === this.progress.equippedSkinId;
    const previewStatus = previewUnlocked
      ? (previewEquipped ? '当前已装备' : '已解锁，可装备')
      : previewSkin.id === 'scarlet-night'
        ? 'BOSS 掉落 · 完成每日挑战解锁'
        : `购买价格 · ${this.skinPurchaseCost(previewSkin.id)} 创游货币`;
    detail.add(this.add.text(-218, 8, previewStatus, { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: previewUnlocked ? palette.green : palette.amber, wordWrap: { width: 265 } }));
    layer.add(detail);
    if (previewUnlocked) {
        this.addButton(layer, 605 + layoutShift, this.safeBottomY(580, 54), 108, 32, previewEquipped ? '已装备' : '装备', () => this.equipSkin(previewSkin.id), previewEquipped ? 'muted' : 'primary', 8);
    } else if (previewSkin.id === 'scarlet-night') {
      this.addButton(layer, 605 + layoutShift, this.safeBottomY(580, 54), 108, 32, '前往挑战', () => this.showDailyChallenge(), 'muted', 8);
    } else {
      this.addButton(layer, 605 + layoutShift, this.safeBottomY(580, 54), 108, 32, `购买 ${this.skinPurchaseCost(previewSkin.id)}`, () => this.buySkin(previewSkin.id), 'primary', 8);
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
      const unlocked = this.progress.unlockedSkinIds.includes(skin.id);
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
      card.add(this.add.text(0, 47, skin.name, { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: unlocked ? palette.cream : palette.muted, wordWrap: { width: 130 }, align: 'center' }).setOrigin(0.5, 0.5).setFontStyle('bold'));
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
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.42);
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02070b, 0.28));
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    layer.add(this.add.text(centerX, this.safeTopY(58, 8), '\u75c5\u5386\u6863\u6848', { fontFamily: 'Microsoft YaHei', fontSize: '28px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(centerX, this.safeTopY(92, 8), 'PATIENT FILE  /  WARD 07', { fontFamily: 'Courier New', fontSize: '11px', color: palette.cyan }).setOrigin(0.5));
    layer.add(this.add.text(safe.right - 8, this.safeTopY(62, 8), `\u521b\u6e38\u8d27\u5e01  ${this.progress.metaCoins}`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.amber }).setOrigin(1, 0.5));
    layer.add(this.add.rectangle(centerX, this.safeTopY(118, 8), 1080, 1, 0x46636a, 0.78));

    const previewSkin = this.skins.find((skin) => skin.id === this.profilePreviewSkinId) ?? this.skins[0];
    const certificate = this.add.container(335 + layoutShift, 270);
    certificate.add(this.add.rectangle(0, 0, 500, 270, 0x0a141b, 0.98).setStrokeStyle(2, previewSkin.color, 0.92));
    certificate.add(this.add.rectangle(0, 0, 488, 258, 0x0a141b, 0).setStrokeStyle(1, 0x46636a, 0.76));
    certificate.add(this.add.text(-225, -108, '\u75c5\u4f8b\u8bc1', { fontFamily: 'Microsoft YaHei', fontSize: '18px', color: palette.amber }).setFontStyle('bold'));
    certificate.add(this.add.text(-225, -72, `\u6635\u79f0  ${this.playerNickname}`, { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.cream, wordWrap: { width: 220 } }));
    certificate.add(this.add.text(-225, -42, '\u79f0\u53f7  \u003c\u65e0\u003e', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.cyan }));
    certificate.add(this.add.text(-225, -12, `\u6863\u6848\u7f16\u53f7  W07-${String(this.progress.maxFloor).padStart(2, '0')}`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '11px', color: palette.muted }));
    const portrait = this.addPatientSprite(certificate, 112, 12, 166, previewSkin);
    if (portrait && previewSkin.id !== 'patient-default' && !this.skinHasCustomArt(previewSkin)) portrait.setTint(previewSkin.color);
    certificate.add(this.add.rectangle(112, 93, 126, 2, previewSkin.color, 0.72));
    certificate.add(this.add.text(112, 111, previewSkin.name, { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    certificate.add(this.add.text(112, 132, '\u5f53\u524d\u88c5\u5907\u76ae\u80a4', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.green }).setOrigin(0.5));
    layer.add(certificate);

    if (this.textures.exists('profile-hospital-photo-v1')) {
      layer.add(this.add.image(335 + layoutShift, 510, 'profile-hospital-photo-v1').setOrigin(0.5).setDisplaySize(500, 170).setAlpha(0.92));
    }
    layer.add(this.add.text(95 + layoutShift, 612, '\u75c5\u9662\u5f71\u50cf\u8bb0\u5f55  /  \u591c\u95f4\u89c2\u5bdf\u7167\u7247', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '11px', color: palette.amber }));
    layer.add(this.add.text(95 + layoutShift, 634, '\u75c7\u72b6\uff1a\u5931\u7720\u3001\u542c\u89c1\u4f4e\u8bed\u3001\u5bf9\u7ea2\u5149\u4ea7\u751f\u8fc7\u5ea6\u53cd\u5e94\u3002', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.cream }));
    layer.add(this.add.text(95 + layoutShift, 656, '\u5907\u6ce8\uff1a\u591c\u95f4\u75c5\u533a\u5b58\u5728\u672a\u77e5\u6ce2\u52a8\uff0c\u8bf7\u52ff\u5355\u72ec\u79bb\u5f00\u3002', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.muted }));

    const skinPanelX = clamp(965 + layoutShift, safe.left + 285, safe.right - 285);
    this.addPixelFrame(layer, skinPanelX, this.safeBottomY(405, 250), 560, 520, 0x0a141b, 0x46636a);
    layer.add(this.add.text(skinPanelX - 252, this.safeTopY(157, 8), '\u5168\u90e8\u76ae\u80a4', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.cream }).setFontStyle('bold'));
    layer.add(this.add.text(skinPanelX + 250, this.safeTopY(157, 8), `${this.skins.length} \u5957`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '11px', color: palette.muted }).setOrigin(1, 0));
    const categories: Array<{ id: ProfileSkinCategory; label: string }> = [
      { id: 'all', label: '\u5168\u90e8' },
      { id: 'basic', label: '\u57fa\u7840' },
      { id: 'store', label: '\u5546\u5e97' },
      { id: 'boss', label: 'BOSS\u6389\u843d' },
    ];
    const setCategory = (category: ProfileSkinCategory) => {
      this.profileSkinCategory = category;
      const categorySkins = this.skins.filter((skin) => category === 'all' || this.profileSkinCategoryFor(skin) === category);
      if (categorySkins.length > 0 && !categorySkins.some((skin) => skin.id === this.profilePreviewSkinId)) this.profilePreviewSkinId = categorySkins[0].id;
      this.showProfile();
    };
    categories.forEach((category, index) => {
      this.addButton(layer, skinPanelX - 126 + index * 84, this.safeTopY(190, 8), index === 3 ? 90 : 68, 28, category.label, () => setCategory(category.id), this.profileSkinCategory === category.id ? 'primary' : 'muted', 7);
    });
    const visibleSkins = this.skins.filter((skin) => this.profileSkinCategory === 'all' || this.profileSkinCategoryFor(skin) === this.profileSkinCategory);
    visibleSkins.forEach((skin, index) => {
      const unlocked = this.progress.unlockedSkinIds.includes(skin.id);
      const selected = skin.id === this.profilePreviewSkinId;
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = skinPanelX - 165 + column * 165;
      const y = 270 + row * 142;
      const card = this.add.container(x, y);
      card.add(this.add.rectangle(0, 0, 150, 120, 0x0a141b, 0.98).setStrokeStyle(selected ? 2 : 1, selected ? skin.color : 0x46636a, 0.95));
      const mini = this.addPatientSprite(card, 0, -17, 66, skin);
      if (mini && skin.id !== 'patient-default' && !this.skinHasCustomArt(skin)) mini.setTint(skin.color);
      if (mini && !unlocked) mini.setAlpha(0.42);
      if (!unlocked) {
        card.add(this.add.rectangle(0, -16, 144, 74, 0x05090f, 0.34));
        card.add(this.add.text(0, -16, '\u9501', { fontFamily: 'Microsoft YaHei', fontSize: '18px', color: palette.muted }).setOrigin(0.5));
      }
      card.add(this.add.text(0, 40, skin.name, { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: unlocked ? palette.cream : palette.muted, wordWrap: { width: 130 }, align: 'center' }).setOrigin(0.5).setFontStyle('bold'));
      card.add(this.add.text(0, 57, unlocked ? (skin.id === this.progress.equippedSkinId ? '\u5df2\u88c5\u5907' : '\u5df2\u89e3\u9501') : '\u672a\u89e3\u9501', { fontFamily: 'Microsoft YaHei', fontSize: '9px', color: unlocked ? palette.green : palette.muted }).setOrigin(0.5));
      layer.add(card);
      this.addButton(layer, x - 35, y + 82, 66, 22, selected ? '\u5df2\u9884\u89c8' : '\u9884\u89c8', () => this.previewSkin(skin.id), selected ? 'primary' : 'muted', 7);
      if (unlocked) {
        this.addButton(layer, x + 39, y + 82, 66, 22, skin.id === this.progress.equippedSkinId ? '\u5df2\u88c5\u5907' : '\u88c5\u5907', () => this.equipSkin(skin.id), skin.id === this.progress.equippedSkinId ? 'muted' : 'primary', 7);
      } else if (skin.id === 'scarlet-night') {
        this.addButton(layer, x + 39, y + 82, 66, 22, '\u53bb\u6311\u6218', () => this.showDailyChallenge(), 'muted', 7);
      } else {
        this.addButton(layer, x + 39, y + 82, 66, 22, `\u8d2d\u4e70 ${this.skinPurchaseCost(skin.id)}`, () => this.buySkin(skin.id), 'primary', 7);
      }
    });
    this.addButton(layer, 88, 38, 150, 42, '\u8fd4\u56de\u4e3b\u754c\u9762', () => this.showStart(), 'muted', 8);
    this.overlay = layer;
    if (!this.playerIdentityLoaded) {
      void this.ensurePlayerIdentity().then(() => { if (this.overlay === layer && layer.active) this.showProfile(); });
    }
  }

  private profileSkinCategoryFor(skin: SkinDef): ProfileSkinCategory {
    if (skin.id === 'patient-default' || skin.id === 'investigator-normal') return 'basic';
    if (skin.id === 'scarlet-night') return 'boss';
    return 'store';
  }

  private previewSkin(id: string) {
    if (!this.skins.some((skin) => skin.id === id)) return;
    this.profilePreviewSkinId = id;
    this.showProfile();
  }

  private equipSkin(id: string) {
    if (!this.progress.unlockedSkinIds.includes(id)) return;
    this.progress.equippedSkinId = id;
    this.saveProgress();
    this.showProfile();
  }

  private skinPurchaseCost(id: string) {
    return id === 'investigator-normal' ? 0 : id === 'cyan-ward' ? 20 : id === 'violet-dream' ? 15 : id === 'street-runner' ? 25 : id === 'cthulhu-dark' ? 40 : 999;
  }

  private async buySkin(id: string) {
    if (this.progress.unlockedSkinIds.includes(id)) {
      this.equipSkin(id);
      return;
    }
    if (id === 'scarlet-night') return;
    if (this.skinPaymentPending) return;
    this.skinPaymentPending = true;
    try {
      const sdk = window.Builda;
      if (sdk?.pay?.showPayPanel) {
        const saleId = this.configuredSkinSaleId(id);
        if (!saleId) return;
        const result = await sdk.pay.showPayPanel(saleId, { timeoutMs: 15000 });
        if (!result.ok || !result.data.success) return;
      } else {
        const cost = this.skinPurchaseCost(id);
        if (this.progress.metaCoins < cost) return;
        this.progress.metaCoins -= cost;
      }
    } finally {
      this.skinPaymentPending = false;
    }
    this.progress.unlockedSkinIds.push(id);
    this.progress.equippedSkinId = id;
    this.profilePreviewSkinId = id;
    this.saveProgress();
    this.showProfile();
  }

  private configuredSkinSaleId(id: string) {
    const config = (window as Window & { __BUILDA_SKIN_SALE_IDS__?: Record<string, unknown> }).__BUILDA_SKIN_SALE_IDS__;
    const saleId = config?.[id];
    return typeof saleId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(saleId) ? saleId : '';
  }

  private weaponAppearanceLabel(weapon: Weapon) {
    return this.equippedWeaponSkin(weapon.weaponClass).name;
  }

  private equipWeaponSkin(id: string) {
    const skin = this.weaponSkins.find((candidate) => candidate.id === id);
    if (!skin || !this.progress.unlockedWeaponSkinIds.includes(id)) return;
    this.progress.equippedWeaponSkinIds[skin.weaponClass] = id;
    this.saveProgress();
  }

  private buyWeaponSkin(id: string, mode: RunMode) {
    const skin = this.weaponSkins.find((candidate) => candidate.id === id);
    if (!skin || skin.cost <= 0 || this.progress.unlockedWeaponSkinIds.includes(id)) return;
    if (this.progress.metaCoins < skin.cost) return;
    this.progress.metaCoins -= skin.cost;
    this.progress.unlockedWeaponSkinIds.push(id);
    this.progress.equippedWeaponSkinIds[skin.weaponClass] = id;
    this.weaponSelectPreviewSkinId = id;
    this.saveProgress();
    this.showWeaponSelect(mode, this.selectedStartFloor);
  }

  private showDailyChallengeLegacy(toast?: string) {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
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
    if (toast) layer.add(this.add.text(centerX, this.safeBottomY(448, 94), toast, { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.amber }).setOrigin(0.5));
    this.addButton(layer, 88, 38, 150, 42, '返回主界面', () => this.showStart(), 'muted');
    this.overlay = layer;
  }

  private showDailyChallenge(toast?: string) {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'daily-challenge-background-v2', 0.28);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;

    const completed = this.isDailyCompleted();
    const attempts = this.dailyAttemptsUsed();
    const cthulhuText = (x: number, y: number, value: string, size: number, color = palette.cream) => this.add.text(x, y, value, {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: String(size) + 'px',
      color,
      stroke: '#050b10',
      strokeThickness: Math.max(2, Math.round(size / 7)),
    }).setOrigin(0.5).setFontStyle('bold');
    const title = cthulhuText(centerX, this.safeTopY(42, 8), '每日挑战', 26);
    layer.add(title);

    const bossX = clamp(205 + layoutShift, safe.left + 165, safe.right - 165);
    const bossPanel = this.addDailyPanelFrame(layer, bossX, 220, 330, 250);
    layer.add(cthulhuText(bossX, 79, '本月首领', 15, palette.violet));
    if (this.textures.exists('boss-moon-wolf')) {
      bossPanel.add(this.add.image(0, -2, 'boss-moon-wolf').setOrigin(0.5).setDisplaySize(250, 180));
    } else {
      bossPanel.add(this.add.circle(0, -2, 64, 0x24353c, 1).setStrokeStyle(2, 0xb798e2, 1));
      bossPanel.add(this.add.text(0, -2, 'BOSS', { fontFamily: 'Courier New', fontSize: '20px', color: palette.violet }).setOrigin(0.5));
    }
    layer.add(cthulhuText(bossX, 355, '月蚀狼王', 20));
    layer.add(cthulhuText(bossX, 407, 'BOSS 掉落', 14, palette.violet));
    const dropItems = [
      { texture: 'relic-crown', label: '月蚀王冠' },
      { texture: 'relic-fang', label: '狼王牙' },
      { texture: 'relic-hood', label: '夜巡兜帽' },
    ];
    dropItems.forEach((item, index) => {
      const x = 95 + layoutShift + index * 110;
      const panel = this.addDailyPanelFrame(layer, x, 500, 100, 150);
      if (this.textures.exists(item.texture)) panel.add(this.add.image(0, -5, item.texture).setOrigin(0.5).setDisplaySize(58, 58));
      layer.add(this.add.text(x, 590, item.label, {
        fontFamily: 'Microsoft YaHei',
        fontSize: '10px',
        color: palette.cream,
        stroke: '#050b10',
        strokeThickness: 2,
      }).setOrigin(0.5));
    });
    layer.add(this.add.text(bossX, 619, completed ? '已加入病历档案' : '通关后随机掉落任意一件BOSS遗物', {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: '10px',
      color: completed ? palette.green : palette.muted,
      stroke: '#050b10',
      strokeThickness: 2,
    }).setOrigin(0.5));

    const infoX = centerX + 5;
    layer.add(cthulhuText(infoX, 168, completed ? '本月挑战已完成' : '今晚的病区正在等待', 19, completed ? palette.green : palette.cream));
    layer.add(this.add.text(infoX, 220, '通关最快记录', {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: '11px',
      color: palette.muted,
    }).setOrigin(0.5));
    layer.add(cthulhuText(infoX, 252, this.formatDailyTime(this.progress.dailyBestSeconds), 24, this.progress.dailyBestSeconds ? palette.green : palette.danger));
    const dailyActionY = this.safeBottomY(635, 52);
    if (!completed) this.addDailyImageButton(layer, centerX, dailyActionY, 330, 86, attempts >= 3 ? '付费挑战' : '开始挑战', () => this.showWeaponSelect('daily', 1), attempts >= 3 ? 0xed716e : 0xb798e2);
    layer.add(this.add.text(centerX, this.safeBottomY(700, 10), '剩余免费次数 ' + Math.max(0, 3 - attempts) + ' / 3', {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: '11px',
      color: attempts >= 3 ? palette.amber : palette.cyan,
    }).setOrigin(0.5));
    if (toast) layer.add(this.add.text(centerX, this.safeBottomY(611, 28), toast, {
      fontFamily: 'Microsoft YaHei',
      fontSize: '10px',
      color: palette.amber,
      wordWrap: { width: 300 },
    }).setOrigin(0.5));

    const rankingX = clamp(1080 + layoutShift, safe.left + 180, safe.right - 180);
    const rankingY = this.safeBottomY(370, 282);
    const boardPanel = this.addDailyRankingFrame(layer, rankingX, rankingY, 360, 560);
    boardPanel.add(cthulhuText(0, -248, '排行榜', 18));
    boardPanel.add(this.add.text(-143, -218, '排名', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '10px', color: palette.muted }));
    boardPanel.add(this.add.text(-76, -218, '昵称', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '10px', color: palette.muted }));
    boardPanel.add(this.add.text(143, -218, '通关记录', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '10px', color: palette.muted }).setOrigin(1, 0));
    boardPanel.add(this.add.rectangle(0, -200, 300, 1, 0x6bd3c1, 0.28));
    const board = this.dailyBoard.map((entry) => entry.name === this.playerNickname && this.progress.dailyBestSeconds ? { ...entry, score: this.dailyScoreForTime(this.progress.dailyBestSeconds) } : entry);
    board.slice(0, 20).forEach((entry) => {
      const y = -181 + (entry.rank - 1) * 17;
      const own = entry.name === this.playerNickname;
      const topRank = entry.rank <= 3;
      const rankColor = entry.rank === 1 ? palette.amber : entry.rank === 2 ? '#d6e7ea' : entry.rank === 3 ? '#d99263' : palette.cream;
      if (topRank) boardPanel.add(this.add.rectangle(0, y + 7, 304, 18, entry.rank === 1 ? 0x8e6d32 : entry.rank === 2 ? 0x4e6972 : 0x754a35, 0.34));
      else if (own) boardPanel.add(this.add.rectangle(0, y + 7, 304, 17, 0x18353b, 0.9));
      if (topRank) {
        boardPanel.add(this.add.circle(-133, y + 7, 8, entry.rank === 1 ? 0xf2bf62 : entry.rank === 2 ? 0xd6e7ea : 0xd99263, 0.85).setStrokeStyle(1, 0x050b10, 0.9));
        boardPanel.add(this.add.text(-133, y + 7, String(entry.rank), { fontFamily: 'Courier New', fontSize: '9px', color: '#071117' }).setOrigin(0.5));
      } else {
        boardPanel.add(this.add.text(-143, y + 7, String(entry.rank).padStart(2, '0'), { fontFamily: 'Courier New', fontSize: '10px', color: rankColor }).setOrigin(0, 0.5));
      }
      boardPanel.add(this.add.text(-76, y + 7, entry.name, { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: own ? palette.teal : rankColor }).setOrigin(0, 0.5));
      const timeLabel = entry.score > 0 ? this.formatDailyTime(Math.max(1, Math.round((100000 - entry.score) / 100))) : '未通关';
      boardPanel.add(this.add.text(143, y + 7, timeLabel, {
        fontFamily: 'Courier New, Microsoft YaHei',
        fontSize: '10px',
        color: entry.score > 0 ? (topRank ? rankColor : palette.amber) : palette.danger,
      }).setOrigin(1, 0.5));
    });
    boardPanel.add(this.add.rectangle(0, 165, 300, 1, 0x6bd3c1, 0.28));
    boardPanel.add(this.add.text(-143, 180, '我的记录', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '12px', color: palette.muted }));
    boardPanel.add(this.add.text(143, 180, this.progress.dailyBestSeconds ? this.formatDailyTime(this.progress.dailyBestSeconds) : '未通关', {
      fontFamily: 'Courier New, Microsoft YaHei',
      fontSize: '19px',
      color: this.progress.dailyBestSeconds ? palette.green : palette.danger,
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
    const bossPanel = this.addDailyPanelFrame(layer, bossX, 215, 310, 255);
    bossPanel.add(this.add.text(-116, -101, '本月首领', { fontFamily: 'Microsoft YaHei', fontSize: '15px', color: palette.violet }).setFontStyle('bold'));
    if (this.textures.exists('boss-moon-wolf')) {
      bossPanel.add(this.add.image(0, -8, 'boss-moon-wolf').setOrigin(0.5).setDisplaySize(210, 142));
    } else {
      bossPanel.add(this.add.circle(0, -8, 56, 0x24353c, 1).setStrokeStyle(2, 0xb798e2, 1));
      bossPanel.add(this.add.text(0, -8, 'BOSS', { fontFamily: 'Courier New', fontSize: '20px', color: palette.violet }).setOrigin(0.5));
    }
    bossPanel.add(this.add.text(0, 79, '月蚀狼王', { fontFamily: 'Microsoft YaHei', fontSize: '19px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    bossPanel.add(this.add.text(0, 105, '范围攻击  /  追踪爆裂', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.cyan }).setOrigin(0.5));
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
    if (!completed) this.addDailyImageButton(layer, centerX, this.safeBottomY(635, 52), 330, 86, attempts >= 3 ? '付费挑战' : '开始挑战', () => this.showWeaponSelect('daily', 1), attempts >= 3 ? 0xed716e : 0xb798e2);
    layer.add(this.add.text(centerX, this.safeBottomY(700, 10), `剩余免费次数 ${Math.max(0, 3 - attempts)} / 3`, { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: attempts >= 3 ? palette.amber : palette.cyan }).setOrigin(0.5));
    if (toast) layer.add(this.add.text(centerX, this.safeBottomY(611, 28), toast, { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.amber, wordWrap: { width: 300 } }).setOrigin(0.5));

    const boardPanel = this.addDailyRankingFrame(layer, clamp(1080 + layoutShift, safe.left + 175, safe.right - 175), this.safeBottomY(370, 282), 350, 600);
    boardPanel.add(this.add.text(-125, -268, '排行榜', { fontFamily: 'Microsoft YaHei', fontSize: '17px', color: palette.cream }).setFontStyle('bold'));
    boardPanel.add(this.add.text(-137, -228, '名次', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.muted }));
    boardPanel.add(this.add.text(-65, -228, '昵称', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.muted }));
    boardPanel.add(this.add.text(137, -228, '用时', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: palette.muted }).setOrigin(1, 0));
    const board = this.dailyBoard.map((entry) => entry.name === this.playerNickname && this.progress.dailyBestSeconds ? { ...entry, score: this.dailyScoreForTime(this.progress.dailyBestSeconds) } : entry);
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
      { kind: 'miniBoss', name: '第 7 波 · 小首领', skill: '冲击领域 + 追踪爆弹' },
      { kind: 'boss', name: '楼层首领', skill: '领域攻击 + 激光锁定 + 爆炸冲击' },
    ];
    layer.add(this.add.text(centerX, 382, '首领图鉴', { fontFamily: 'Microsoft YaHei', fontSize: '17px', color: palette.amber }).setOrigin(0.5).setFontStyle('bold'));
    bossEntries.forEach((entry, index) => {
      const unlocked = this.archiveKindUnlocked(entry.kind);
      const x = 490 + layoutShift + index * 300;
      const color = unlocked ? this.enemyColor(entry.kind) : 0x46545a;
      const stats = enemyCombatStats(entry.kind, entry.kind === 'boss' ? this.wavesPerFloor() : 7);
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
    this.releaseJoystick();
    this.clearOverlay();
    this.clearRunObjects();
    this.runMode = mode;
    this.tutorialRun = mode === 'mainline' && Math.round(targetFloor) === 0;
    this.floor = mode === 'daily' ? 1 : this.tutorialRun ? 1 : clamp(Math.round(targetFloor), 1, Math.min(TOTAL_FLOORS, this.progress.maxFloor));
    this.selectedWeaponId = weaponId;
    this.phase = 'dialogue';
    this.dialogueIndex = 0;
    this.dialogueTransitioning = false;
    this.wave = 1;
    this.waveTimer = 0;
    this.spawnTimer = 0.35;
    this.waveSpawned = 0;
    this.waveClearedMessage = '';
    this.waveClearedTimer = 0;
    this.waveBreakTimer = 0;
    this.pendingWaveBreak = false;
    this.waveCleanupComplete = false;
    this.upgradeRefreshCount = 0;
    this.attackTimer = 0.25;
    this.weaponAngle = 0;
    this.previousWeaponAngle = 0;
    this.weaponOrbitRadius = 0;
    this.elapsed = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.shield = 0;
    this.maxShield = 0;
    this.san = 100;
    this.xp = 0;
    this.level = this.tutorialRun ? 8 : 1;
    this.xpNeed = experienceRequiredForLevel(this.level);
    this.kills = 0;
    this.mutationTimer = 0;
    this.sanLowActive = false;
    this.sanLowTimer = 0;
    this.frenzyAvailable = false;
    this.frenzyActive = false;
    this.frenzyTimer = 0;
    this.sanPulse = 0;
    this.mutated = false;
    this.damageBonus = 0;
    this.roundDamageBonus = 0;
    this.rotationSpeedMultiplier = 1;
    this.rotationUpgradeStacks = 0;
    this.rotationStacksConvertedToAmmo = 0;
    this.waveBossSpawned = false;
    this.runSpeed = 190;
    this.pickupRadius = DEFAULT_PICKUP_RADIUS;
    this.magnet = 0;
    this.gameSpeed = 1;
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
      starting.level = this.tutorialRun ? 4 : 1;
      starting.copies = this.tutorialRun ? 3 : 1;
      starting.ammo = this.tutorialRun ? 3 : 1;
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
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.updateHud();
    this.showDialogue();
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
    const equippedSkin = this.skins.find((skin) => skin.id === this.progress.equippedSkinId) ?? this.skins[0];
    const skinColor = equippedSkin.color;
    this.playerGlow = this.add.circle(0, 0, 42, this.mutated ? 0xed716e : 0x6bd3c1, 0.14);
    bodyLayer.add(this.playerGlow);
    bodyLayer.add(this.add.circle(0, 8, 34, this.mutated ? 0xed716e : skinColor, 0.2).setStrokeStyle(1, skinColor, 0.8));
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
    this.playerSpriteTargetHeight = targetHeight;
    this.fitPlayerSprite(sprite);
    parent.add(sprite);
    return sprite;
  }

  private addPatientSprite(parent: Phaser.GameObjects.Container, x: number, y: number, targetHeight: number, skin?: SkinDef) {
    const selectedSkin = skin ?? this.skins[0];
    const textureKey = this.skinHasCustomArt(selectedSkin) ? this.skinFrontTextureKey(selectedSkin) : (this.textures.exists('patient-idle-front') ? 'patient-idle-front' : 'patient-boy');
    if (!this.textures.exists(textureKey)) return undefined;
    const sprite = this.add.image(x, y, textureKey).setOrigin(0.5);
    sprite.setDisplaySize(targetHeight * sprite.width / sprite.height, targetHeight);
    parent.add(sprite);
    return sprite;
  }

  private playPlayerAnimation(animation: PlayerAnimation, force = false) {
    const sprite = this.playerSprite;
    if (!sprite) return;
    const equippedSkin = this.skins.find((skin) => skin.id === this.progress.equippedSkinId) ?? this.skins[0];
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
    const skin = this.skins.find((candidate) => candidate.id === this.progress.equippedSkinId);
    if (!skin) return;
    if (skin.id === 'scarlet-night') this.damageBonus += 6;
    if (skin.id === 'cyan-ward') {
      this.maxShield += 18;
      this.shield = this.maxShield;
    }
    if (skin.id === 'violet-dream') this.runSpeed *= 1.08;
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
    const resolved = this.resolveBlockedPosition(this.player.x + x * this.runSpeed * dt, this.player.y + y * this.runSpeed * dt, this.playerRadius);
    this.player.x = resolved.x;
    this.player.y = resolved.y;
    if (this.playerHitTimer > 0) this.playPlayerAnimation('hit');
    else this.playPlayerAnimation(moving ? `walk-${this.playerDirection}` : 'idle');
    const mutationVisual = this.mutated;
    this.playerGlow.setFillStyle(mutationVisual ? 0xed716e : 0x6bd3c1);
    this.playerGlow.setAlpha(mutationVisual ? 0.22 + (Math.sin(this.sanPulse * 10) + 1) * 0.06 : 0.14);
    this.playerGlow.setScale(mutationVisual ? 1.08 + (Math.sin(this.sanPulse * 10) + 1) * 0.05 : 1);
  }

  private spawnWaveEnemy() {
    if (this.waveTimer >= this.waveLength || this.waveSpawned >= this.spawnBudgetForWave()) return;
    const available: EnemyKind[] = ['chaser'];
    if (this.wave >= 3) available.push('shooter');
    if (this.wave >= 6) available.push('disruptor');
    if (this.wave >= 9) available.push('tentacle');
    if (this.wave >= 12) available.push('bomber');
    if (this.wave >= 15) available.push('eye');
    if (this.tutorialRun) {
      (['shooter', 'disruptor', 'tentacle', 'bomber', 'eye'] as EnemyKind[]).forEach((kind) => {
        if (!available.includes(kind)) available.push(kind);
      });
    }
    let kind: EnemyKind = Phaser.Utils.Array.GetRandom(available);
    if (this.isMiniBossWave() && !this.waveBossSpawned) {
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
    if (isBoss) {
      const bossTextureKey = kind === 'boss' ? 'floor-boss-01' : 'mini-boss-01';
      if (this.textures.exists(bossTextureKey)) {
        const displaySize = kind === 'boss' ? 216 : 164;
        const shadow = this.add.ellipse(0, displaySize * 0.36, displaySize * 0.62, displaySize * 0.18, 0x000000, 0.42);
        const sprite = this.add.image(0, 0, bossTextureKey).setOrigin(0.5).setDisplaySize(displaySize, displaySize);
        body = this.add.container(0, 0, [shadow, sprite]);
        visualWidth = displaySize;
        visualHeight = displaySize;
      } else {
        const s = kind === 'boss' ? 1.45 : 1;
        const g = this.add.graphics();
        g.fillStyle(0x000000, .45); g.fillEllipse(0, 75 * s, 145 * s, 25 * s);
        g.fillStyle(0x15161b); g.fillEllipse(0, 5 * s, 100 * s, 150 * s); g.fillCircle(0, -58 * s, 48 * s);
        g.fillStyle(color, .55); g.fillCircle(-45 * s, 0, 42 * s); g.fillCircle(45 * s, 0, 42 * s);
        const enemyGlyph = this.add.text(0, 0, this.enemyGlyph(kind), { fontFamily: 'Microsoft YaHei', fontSize: `${kind === 'boss' ? 20 : 12}px`, color: '#101820' }).setOrigin(0.5);
        body = this.add.container(0, 0, [g, enemyGlyph]);
        visualWidth = Math.round(radius * (kind === 'boss' ? 4.8 : 4.2));
        visualHeight = Math.round(radius * (kind === 'boss' ? 5.1 : 4.4));
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
    const enemy: Enemy = { kind, node, body, baseHp, hpScale, hp, maxHp: hp, speed: stats.speed, damage: stats.damage, radius, visualWidth, visualHeight, facingRight: false, attackCd: 0.2, shootCd: 1.8, areaCd: 2.5, flash: 0, meleeHitCd: 0, deathTimer: 0, statusTimer: 0, statusTick: 0 };
    (node as Phaser.GameObjects.Container & { hpBar?: Phaser.GameObjects.Graphics }).hpBar = hpBar;
    this.enemies.push(enemy);
    this.waveSpawned += 1;
  }

  private findSpawnPoint(radius: number) {
    const active = this.enemies.filter((enemy) => !enemy.dead);
    const view = this.cameras.main.worldView;
    const margin = 72;
    const left = clamp(view.x - margin, WORLD_BOUNDS.left + 28, WORLD_BOUNDS.right - 28);
    const right = clamp(view.right + margin, WORLD_BOUNDS.left + 28, WORLD_BOUNDS.right - 28);
    const top = clamp(view.y - margin, WORLD_BOUNDS.top + 28, WORLD_BOUNDS.bottom - 28);
    const bottom = clamp(view.bottom + margin, WORLD_BOUNDS.top + 28, WORLD_BOUNDS.bottom - 28);
    let fallback = { x: left, y: top };
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const edge = Math.floor(Math.random() * 4);
      const point = {
        x: edge === 0 ? left : edge === 1 ? right : Phaser.Math.Between(Math.round(left), Math.round(right)),
        y: edge === 2 ? top : edge === 3 ? bottom : Phaser.Math.Between(Math.round(top), Math.round(bottom)),
      };
      fallback = point;
      if (active.every((enemy) => distance(enemy.node, point) >= Math.max(44, enemy.radius + radius + 8)) && !this.isBlocked(point.x, point.y, radius)) return point;
    }
    return fallback;
  }

  private isBlocked(x: number, y: number, radius: number) {
    return this.walls.some((wall) => {
      const closestX = clamp(x, wall.x, wall.x + wall.width);
      const closestY = clamp(y, wall.y, wall.y + wall.height);
      return Math.hypot(x - closestX, y - closestY) < radius;
    });
  }

  private spawnIntervalForWave() {
    if (this.runMode === 'daily') return Math.max(0.25, 0.62 * dailyWaveScaling(this.wave).spawnIntervalMultiplier);
    if (this.wave === 1) return 0.72;
    return Math.max(0.24, 0.72 - this.wave * 0.022);
  }

  private spawnBudgetForWave() {
    const paceBudget = Math.ceil(this.durationForWave() / Math.max(0.1, this.spawnIntervalForWave() * this.spawnRateMultiplier()));
    if (this.runMode === 'daily') {
      const scaling = dailyWaveScaling(this.wave);
      return Math.max(Math.ceil(scaling.baseBudget) + (this.isFloorBossWave() ? 12 : 0), paceBudget);
    }
    const budgets = [24, 30, 36, 42, 50, 58, 66, 75, 85, 96, 108, 120, 134, 148, 164, 180, 196, 214, 232, 252];
    return Math.max(budgets[clamp(this.wave, 1, budgets.length) - 1], paceBudget);
  }

  private wavesPerFloor() {
    return this.runMode === 'daily' ? 50 : wavesPerFloorForFloor(this.floor);
  }

  private isMiniBossWave() {
    return this.runMode === 'mainline' && this.wave === 7;
  }

  private isFloorBossWave() {
    return this.runMode === 'daily' && this.wave === this.wavesPerFloor();
  }

  private currentWeaponTier() {
    const weapon = this.currentWeapon();
    return weapon ? Math.max(0, this.weapons.indexOf(weapon)) : 0;
  }

  private enemyHealthMultiplier() {
    const weapon = this.currentWeapon();
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
    let multiplier = 1;
    if (this.mutated) multiplier *= 1.3;
    if (this.runMode === 'daily') multiplier *= dailyWaveScaling(this.wave).damageMultiplier;
    return multiplier;
  }

  private enemyAttackDamage(enemy: Enemy, amount: number) {
    return amount * this.enemyDamageMultiplier() * (enemy.status === 'weaken' ? 0.65 : 1);
  }

  private incomingDamageMultiplier() {
    let multiplier = this.mutated ? 1.22 : 1;
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
      if (enemy.kind === 'boss' || enemy.kind === 'miniBoss') {
        if (dist > 220) this.moveEnemy(enemy, dt, 0.55);
        if (enemy.shootCd <= 0 && dist < 720) {
          enemy.shootCd = enemy.kind === 'boss' ? 4.2 : 5.2;
          if (enemy.kind === 'boss') this.enemyBeam(enemy);
          else this.enemyBomb(enemy);
        }
        if (enemy.areaCd <= 0) {
          enemy.areaCd = enemy.kind === 'boss' ? 5.6 : 6.4;
          const warningRadius = enemy.kind === 'boss' ? 145 : 116;
          this.createAreaWarning(this.player.x, this.player.y, warningRadius, enemy.kind === 'boss' ? 0xed716e : 0xf2bf62);
          if (dist < warningRadius) this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage * 0.9), enemy.kind === 'boss' ? '楼层 Boss 领域' : '小首领冲击');
        }
        if (dist < enemy.radius + 30 && enemy.attackCd <= 0) {
          enemy.attackCd = 1.15;
          this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage), enemy.kind === 'boss' ? '楼层 Boss' : '小首领');
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
          this.createAreaWarning(enemy.node.x, enemy.node.y, this.smallEnemyDistance(150), 0xb798e2);
          if (dist < this.smallEnemyDistance(150)) this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage * 1.1), '干扰波');
        }
      } else {
        this.moveEnemy(enemy, dt, 1);
        if (dist < enemy.radius + this.smallEnemyDistance(24) && enemy.attackCd <= 0) {
          enemy.attackCd = 1.45;
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
    const resolved = this.resolveBlockedPosition(nextX, nextY, enemy.radius);
    enemy.node.x = resolved.x;
    enemy.node.y = resolved.y;
    if (enemy.kind !== 'boss' && enemy.kind !== 'miniBoss' && enemy.body && Math.abs(nextX - enemy.node.x) > 0.01) {
      enemy.facingRight = nextX > enemy.node.x;
      enemy.body.setScale(enemy.facingRight ? -1 : 1, 1);
    }
  }

  private resolveBlockedPosition(x: number, y: number, radius: number) {
    let nextX = clamp(x, WORLD_BOUNDS.left + radius, WORLD_BOUNDS.right - radius);
    let nextY = clamp(y, WORLD_BOUNDS.top + radius, WORLD_BOUNDS.bottom - radius);
    for (const wall of this.walls) {
      const closestX = clamp(nextX, wall.x, wall.x + wall.width);
      const closestY = clamp(nextY, wall.y, wall.y + wall.height);
      const dx = nextX - closestX;
      const dy = nextY - closestY;
      if (dx * dx + dy * dy >= radius * radius) continue;
      const overlapX = Math.min(Math.abs(nextX - wall.x), Math.abs(nextX - (wall.x + wall.width)));
      const overlapY = Math.min(Math.abs(nextY - wall.y), Math.abs(nextY - (wall.y + wall.height)));
      if (overlapX < overlapY) nextX = nextX < wall.x + wall.width / 2 ? wall.x - radius : wall.x + wall.width + radius;
      else nextY = nextY < wall.y + wall.height / 2 ? wall.y - radius : wall.y + wall.height + radius;
    }
    return { x: clamp(nextX, WORLD_BOUNDS.left + radius, WORLD_BOUNDS.right - radius), y: clamp(nextY, WORLD_BOUNDS.top + radius, WORLD_BOUNDS.bottom - radius) };
  }

  private enemyShot(enemy: Enemy) {
    const dx = this.player.x - enemy.node.x;
    const dy = this.player.y - enemy.node.y;
    const len = Math.hypot(dx, dy) || 1;
    const node = this.add.circle(enemy.node.x, enemy.node.y, 6, 0xb798e2, 1).setDepth(8);
    this.world.add(node);
    this.projectiles.push({ node, vx: (dx / len) * 165, vy: (dy / len) * 165, damage: this.enemyAttackDamage(enemy, enemy.damage * 0.65), ttl: 4, color: 0xb798e2 });
  }

  private enemyBomb(enemy: Enemy) {
    const target = { x: this.player.x, y: this.player.y };
    const warning = this.add.circle(target.x, target.y, 74, 0xe78a57, 0.12).setStrokeStyle(3, 0xe78a57, 0.85).setDepth(4);
    this.world.add(warning);
    this.tweens.add({ targets: warning, scale: 0.65, alpha: 0.6, yoyo: true, repeat: 2, duration: 120 });
    this.time.delayedCall(720, () => {
      if (!warning.active) return;
      warning.destroy();
      const blast = this.add.circle(target.x, target.y, 28, 0xe78a57, 0.5).setStrokeStyle(2, 0xf4e8c9, 0.9).setDepth(9);
      this.world.add(blast);
      this.tweens.add({ targets: blast, scale: 2.2, alpha: 0, duration: 300, onComplete: () => blast.destroy() });
      if (this.phase === 'battle' && distance(this.player, target) < 74) this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage * 1.35), '爆炸冲击');
    });
  }

  private enemyBeam(enemy: Enemy) {
    const target = { x: this.player.x, y: this.player.y };
    const line = this.add.graphics().setDepth(9);
    line.lineStyle(12, 0xf06eaa, 0.18).lineBetween(enemy.node.x, enemy.node.y, target.x, target.y);
    line.lineStyle(4, 0xffb4dc, 0.95).lineBetween(enemy.node.x, enemy.node.y, target.x, target.y);
    this.world.add(line);
    this.tweens.add({ targets: line, alpha: 0, duration: 520, onComplete: () => line.destroy() });
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
      .filter((enemy) => !enemy.dead && distance(enemy.node, this.player) <= weapon.range)
      .sort((a, b) => distance(a.node, this.player) - distance(b.node, this.player));
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

  private applyCardWeaponGrowth() {
    const weapon = this.currentWeapon();
    if (weapon) this.applyRotationUpgrade(weapon, [10, 15, 22][this.upgradeCardTier() - 1]);
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

  private applyAttackEffectUpgrade(status: AttackStatus) {
    const weapon = this.currentWeapon();
    if (!weapon) return;
    const nextStatus = this.activeAttackStatus ?? status;
    const tier = this.upgradeCardTier();
    const growth = attackStatusGrowth(this.attackStatusLevel, tier);
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
      const line = this.add.graphics().setDepth(9);
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
          .setRotation(angle)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.92)
          .setDepth(10)
        : undefined;
      if (effectSprite) this.world.add(effectSprite);
      line.lineStyle(lineWidth, color, 0.92).lineBetween(originX, originY, target.node.x, target.node.y);
      if (effect === 'slash') {
        const perpX = Math.cos(angle + Math.PI / 2) * 13;
        const perpY = Math.sin(angle + Math.PI / 2) * 13;
        line.lineStyle(3, color, 0.8).lineBetween(target.node.x - perpX - Math.cos(angle) * 13, target.node.y - perpY - Math.sin(angle) * 13, target.node.x + perpX, target.node.y + perpY);
      }
      if (effect === 'spark') {
        line.lineStyle(2, color, 0.8);
        for (let ray = 0; ray < 6; ray += 1) {
          const rayAngle = angle + ray * Math.PI / 3;
          line.lineBetween(target.node.x + Math.cos(rayAngle) * 6, target.node.y + Math.sin(rayAngle) * 6, target.node.x + Math.cos(rayAngle) * 18, target.node.y + Math.sin(rayAngle) * 18);
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
          line.lineTo(target.node.x + Math.cos(bend) * offset * 1.5, target.node.y + Math.sin(bend) * offset * 1.5);
          line.strokePath();
        }
      }
      if (effect === 'laser') {
        line.lineStyle(12, color, 0.18).lineBetween(originX, originY, target.node.x, target.node.y);
        line.lineStyle(2, 0xffd4ee, 0.95).lineBetween(originX, originY, target.node.x, target.node.y);
      }
      if (effect === 'void') {
        line.lineStyle(3, color, 0.9);
        for (let ring = 1; ring <= 3; ring += 1) {
          line.strokeCircle(target.node.x, target.node.y, ring * 10);
        }
        for (let ray = 0; ray < 5; ray += 1) {
          const rayAngle = angle + ray * Math.PI * 0.4;
          line.lineBetween(target.node.x, target.node.y, target.node.x + Math.cos(rayAngle) * (16 + ray * 4), target.node.y + Math.sin(rayAngle) * (16 + ray * 4));
        }
      }
      if (effect === 'neon') {
        line.lineStyle(2, 0x9ffff1, 0.95);
        for (let ray = 0; ray < 8; ray += 1) {
          const rayAngle = angle + ray * Math.PI / 4;
          line.lineBetween(target.node.x, target.node.y, target.node.x + Math.cos(rayAngle) * 24, target.node.y + Math.sin(rayAngle) * 24);
        }
      }
      this.world.add(line);
      const muzzle = this.add.circle(originX, originY, effect === 'beam' || effect === 'laser' ? 12 : 7, color, 0.42).setDepth(9);
      this.world.add(muzzle);
      this.tweens.add({ targets: muzzle, scale: 2.2, alpha: 0, duration: 150, onComplete: () => muzzle.destroy() });
      const impactRadius = effect === 'beam' || effect === 'laser' ? 15 : effect === 'burst' || effect === 'bomb' ? 12 : effect === 'void' ? 18 : 7;
      const impact = this.add.circle(target.node.x, target.node.y, impactRadius, color, effect === 'beam' || effect === 'laser' ? 0.3 : 0.22).setDepth(9);
      this.world.add(impact);
      const impactRing = effect === 'bomb'
        ? this.add.circle(target.node.x, target.node.y, 28, color, 0).setStrokeStyle(3, color, 0.9).setDepth(9)
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
          x: target.node.x,
          y: target.node.y,
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
    enemy.dead = true;
    enemy.deathTimer = 0.8;
    const marker = this.add.text(0, -enemy.visualHeight / 2 - 8, 'X', { fontFamily: 'Arial', fontSize: '18px', color: '#f4e8c9', stroke: '#0b1117', strokeThickness: 3 }).setOrigin(0.5);
    enemy.node.add(marker);
    this.tweens.add({ targets: marker, y: -enemy.visualHeight / 2 - 30, alpha: 0, duration: 800, onComplete: () => marker.destroy() });
    this.tweens.add({ targets: enemy.node, alpha: 0, duration: 800 });
    this.spreadAttackStatus(enemy);
    this.kills += 1;
    if (this.runMode === 'daily' && this.dailyKillNova > 0) {
      const cadence = Math.max(6, 12 - this.dailyKillNova * 2);
      if (this.kills % cadence === 0) this.triggerKillNova(enemy.node.x, enemy.node.y);
    }
    if (enemy.kind === 'boss') this.unlockArchiveKind('boss');
    const balanceWave = this.runMode === 'daily' ? Math.ceil(this.wave / 10) : this.wave;
    const stats = enemyCombatStats(enemy.kind, balanceWave);
    this.drop(enemy.node.x, enemy.node.y, 'xp', stats.xp);
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
    this.hp = clamp(this.hp - healthDamage, 0, this.maxHp);
    this.san = clamp(this.san - incoming * 1.2, 0, 100);
    if (this.san <= 0 && !this.mutated && !this.frenzyAvailable && !this.frenzyActive) this.beginSanCollapse();
    const hitLabel = absorbed > 0
      ? `${source} 护盾吸收 ${Math.round(absorbed)}${healthDamage > 0 ? ` · 生命 -${Math.round(healthDamage)}` : ''}`
      : `${source} 生命 -${Math.round(healthDamage)}`;
    this.floatText(this.player.x, this.playerLabelY(10), hitLabel, absorbed > 0 ? palette.cyan : palette.danger);
    this.cameras.main.flash(90, 180, 65, 65, false);
    if (this.screenShakeEnabled) this.cameras.main.shake(120, 0.006);
    this.playerHitTimer = 0.3;
    this.playPlayerAnimation('hit', true);
    // Keep the character silhouette at a uniform scale. Hit feedback comes
    // from the camera flash, shake and animation instead of squash/stretch.
    this.tweens.killTweensOf(this.player);
    this.player.setScale(1);
    if (this.san <= 0 && this.mutated) {
      this.playerDeathPending = true;
      this.playerDeathTimer = 0.72;
      this.playerHitTimer = 0;
      this.playPlayerAnimation('death', true);
    }
  }

  private updateMutation(dt: number) {
    this.sanPulse += dt;
    this.updateWardBackground();
    if (this.mutated) return;
    if (this.san <= 0 && !this.frenzyAvailable && !this.frenzyActive && this.mutationTimer <= 0) this.beginSanCollapse();
    if (this.sanLowActive) {
      this.sanLowTimer -= dt;
      if (this.sanLowTimer <= 0) {
        this.sanLowTimer = 0;
        this.sanLowActive = false;
        this.floatText(this.player.x, this.playerLabelY(18), '低 SAN 暴走结束 · 刷怪恢复', palette.cyan);
      }
    }
    if (this.frenzyActive) {
      this.frenzyTimer -= dt;
      if (this.frenzyTimer <= 0) {
        this.frenzyTimer = 0;
        this.frenzyActive = false;
        this.san = 35;
        this.floatText(this.player.x, this.playerLabelY(18), '暴走结束 · SAN 暂时稳定', palette.cyan);
      }
    }
    if (this.mutationTimer > 0) {
      this.mutationTimer -= dt;
      if (this.mutationTimer <= 0) {
        this.mutated = true;
        this.damageBonus += 10;
        this.san = 42;
        this.playerGlow.setFillStyle(0xed716e);
        this.cameras.main.shake(380, 0.012);
        this.floatText(this.player.x, this.playerLabelY(18), '变异完成 · 伤害提升', palette.danger);
        this.updateWardBackground();
      }
    }
  }

  private enterMutationMode() {
    this.beginSanCollapse();
  }

  private updateWardBackground() {
    if (!this.arenaBackground) return;
    const textureKey = this.mutated ? 'ward-night-deep-v1' : 'ward-night-v1';
    if (this.arenaBackgroundTexture === textureKey || !this.textures.exists(textureKey)) return;
    this.arenaBackgroundTexture = textureKey;
    this.arenaBackground.setTexture(textureKey);
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

  private beginSanCollapse() {
    if (this.mutated || this.mutationTimer > 0 || this.frenzyAvailable || this.frenzyActive) return;
    this.sanLowActive = true;
    this.sanLowTimer = 3;
    this.frenzyAvailable = true;
    this.spawnTimer = Math.min(this.spawnTimer, 0.05);
    this.cameras.main.shake(220, 0.008);
    this.floatText(this.player.x, this.playerLabelY(18), 'SAN 归零 · 暴走技能已就绪', palette.danger);
  }

  private triggerFrenzy() {
    if (this.phase !== 'battle' || !this.frenzyAvailable || this.frenzyActive) return;
    this.frenzyAvailable = false;
    this.frenzyActive = true;
    this.frenzyTimer = 8;
    this.sanLowActive = false;
    this.sanLowTimer = 0;
    this.spawnTimer = Math.min(this.spawnTimer, 0.05);
    this.cameras.main.shake(240, 0.01);
    this.floatText(this.player.x, this.playerLabelY(18), '暴走启动 · 伤害提升 / 护盾减弱', palette.danger);
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
    this.showUpgrade();
  }

  private upgradeCardTier() {
    return Math.min(3, 1 + Math.floor((this.level - 1) / 5));
  }

  private upgradeCardTexture(rarity: UpgradeCardRarity) {
    return `upgrade-card-${rarity}-v1`;
  }

  private upgradeCardIcon(parent: Phaser.GameObjects.Container, kind: UpgradeIconKind, x: number, y: number, color: number) {
    const textureKey = `upgrade-icon-${kind}`;
    if (this.textures.exists(textureKey)) {
      const icon = this.add.image(x, y, textureKey)
        .setOrigin(0.5)
        // The card opening is about 128px wide at runtime; use the full inner diameter.
        .setDisplaySize(128, 128);
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

  private showUpgrade(resetRefresh = true) {
    this.phase = 'upgrade';
    if (resetRefresh) {
      this.upgradeRefreshCount = 0;
      this.upgradePaymentMessage = '';
    }
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    const layoutShift = centerX - W / 2;
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x071015, 0.74));
    this.addPixelFrame(layer, centerX, 350, 940, 560, 0x101b24, 0xb798e2);
    layer.add(this.add.text(centerX, this.safeTopY(84, 8), `升级 Lv.${this.level}`, { fontFamily: 'Microsoft YaHei', fontSize: '28px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    const tier = this.upgradeCardTier();
    layer.add(this.add.text(centerX, this.safeTopY(122, 8), '随机三选一 · 选择后继续战斗', { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.muted }).setOrigin(0.5));
    const weapon = this.currentWeapon();
    const damageAmount = [8, 14, 22][tier - 1];
    const sustainAmount = [20, 32, 48][tier - 1];
    const growthPercent = [10, 15, 22][tier - 1];
    const movePercent = [8, 12, 18][tier - 1];
    const statusOptions: AttackStatus[] = ['poison', 'burn', 'weaken'];
    const status = this.activeAttackStatus ?? statusOptions[(this.level - 1) % statusOptions.length];
    const statusNames: Record<AttackStatus, string> = { poison: '中毒', burn: '燃烧', weaken: '虚弱' };
    const statusGrowth = attackStatusGrowth(this.attackStatusLevel, tier);
    const statusBaseDamage = status === 'burn' ? 3 : status === 'poison' ? 2 : 1.5;
    const statusDamage = Math.round(((this.attackStatusLevel === 0 ? statusBaseDamage : this.attackStatusDamage) + statusGrowth.damageIncrease) * 10) / 10;
    const statusDuration = Math.round(((this.attackStatusLevel === 0 ? 3 : this.attackStatusDuration) + statusGrowth.durationIncrease) * 10) / 10;
    const tickDamage = Math.round((status === 'weaken' ? statusDamage * 0.5 : statusDamage) * 10) / 10;
    const spreadDetail = statusGrowth.spreadTargets > 0
      ? ` · 击败后传播 ${statusGrowth.spreadTargets} 个目标（范围 ${statusGrowth.spreadRadius}）`
      : ' · 持续强化后解锁击杀传播';
    const statusDetail = `${status === 'weaken' ? '敌人伤害 -35% · ' : ''}每 0.8 秒 ${tickDamage} 伤害 · 持续 ${statusDuration} 秒${spreadDetail}`;
    const pool: UpgradeDef[] = [
      {
        title: '移速提升',
        detail: `移动速度 +${movePercent}%`,
        color: 0x7ab9d0,
        rarity: tier >= 3 ? 'gold' : tier >= 2 ? 'purple' : 'blue',
        icon: 'move',
        apply: () => { this.runSpeed *= 1 + movePercent / 100; },
      },
      {
        title: '武器强化',
        detail: `当前武器伤害 +${damageAmount}，持续本层`,
        color: 0xed716e,
        rarity: tier >= 3 ? 'gold' : tier >= 2 ? 'purple' : 'blue',
        icon: 'damage',
        apply: () => this.applyRoundDamageBuff(damageAmount),
      },
      {
        title: 'SAN / 护盾',
        detail: `SAN 不足时恢复 ${sustainAmount}；SAN 满时转为护盾`,
        color: 0x8fd17c,
        rarity: tier >= 3 ? 'gold' : tier >= 2 ? 'purple' : 'blue',
        icon: 'sustain',
        apply: () => this.applyHealthShieldUpgrade(sustainAmount),
      },
      {
        title: '攻速提升',
        detail: `当前武器转速 +${growthPercent}%`,
        color: 0xb798e2,
        rarity: tier >= 3 ? 'gold' : tier >= 2 ? 'purple' : 'blue',
        icon: 'growth',
        apply: () => this.applyCardWeaponGrowth(),
      },
      {
        title: `${this.activeAttackStatus ? '强化' : '攻击特效：'}${statusNames[status]}`,
        detail: statusDetail,
        color: status === 'poison' ? 0x8fd17c : status === 'burn' ? 0xe78a57 : 0xb798e2,
        rarity: tier >= 3 ? 'gold' : tier >= 2 ? 'purple' : 'blue',
        icon: 'effect',
        apply: () => this.applyAttackEffectUpgrade(status),
      },
    ];
    if (this.runMode === 'daily') {
      const synergyStatus = statusNames[status];
      pool.push({
        title: `感染共振 · ${synergyStatus}`,
        detail: `攻击特效伤害 +${2 + tier}，状态持续时间 +1 秒`,
        color: 0x8fd17c,
        rarity: 'gold',
        icon: 'resonance',
        apply: () => {
          this.applyAttackEffectUpgrade(status);
          this.attackStatusDamage += 2 + tier;
          this.attackStatusDuration += 1;
          this.dailyStatusSynergy += 1;
        },
      });
      pool.push({
        title: '双生回响',
        detail: `武器数量 +1，攻击速度 +${6 + tier * 2}%`,
        color: 0xb798e2,
        rarity: 'gold',
        icon: 'copies',
        apply: () => {
          this.applyWeaponCopiesUpgrade();
          this.applyRotationUpgrade(this.currentWeapon()!, 6 + tier * 2);
        },
      });
      pool.push({
        title: '护盾反击',
        detail: `护盾吸收伤害时反击 ${4 + tier * 2} 点`,
        color: 0x7ab9d0,
        rarity: 'gold',
        icon: 'shield',
        apply: () => {
          this.applyHealthShieldUpgrade(12 + tier * 8);
          this.dailyShieldRetaliation += 4 + tier * 2;
        },
      });
      pool.push({
        title: '磁场收割',
        detail: `移动速度 +6%，拾取范围 +28，吸附速度提升`,
        color: 0xf2bf62,
        rarity: 'purple',
        icon: 'magnet',
        apply: () => {
          this.runSpeed *= 1.06;
          this.pickupRadius += 28;
          this.magnet += 36;
          this.dailyMagnetSynergy += 1;
        },
      });
      pool.push({
        title: '裂隙脉冲',
        detail: `每 ${Math.max(2.8, 6.2 - (this.dailyVoidPulse + 1) * 0.45).toFixed(1)} 秒释放虚空环，最多命中 ${6 + (this.dailyVoidPulse + 1) * 2} 个目标`,
        color: 0xb798e2,
        rarity: 'gold',
        icon: 'pulse',
        apply: () => {
          this.dailyVoidPulse += 1;
          this.dailyVoidPulseTimer = 1.2;
        },
      });
      pool.push({
        title: '镜像弹幕',
        detail: `远程每次齐射追加 ${this.dailyEchoShots + 1} 发；近战额外命中目标`,
        color: 0x7ab9d0,
        rarity: 'gold',
        icon: 'mirror',
        apply: () => { this.dailyEchoShots += 1; },
      });
      pool.push({
        title: '血月契约',
        detail: `武器伤害 +16，受到伤害 +${(this.dailyBloodPact + 1) * 8}%`,
        color: 0xed716e,
        rarity: 'gold',
        icon: 'blood',
        apply: () => {
          this.dailyBloodPact += 1;
          this.damageBonus += 16;
        },
      });
      pool.push({
        title: '猎杀爆裂',
        detail: `每 ${Math.max(6, 12 - (this.dailyKillNova + 1) * 2)} 次击杀触发范围爆裂`,
        color: 0xf2bf62,
        rarity: 'gold',
        icon: 'nova',
        apply: () => { this.dailyKillNova += 1; },
      });
      pool.push({
        title: '静滞力场',
        detail: `靠近主角的敌人减速 ${Math.min(56, 28 + (this.dailySlowField + 1) * 8)}%，范围扩大`,
        color: 0x7ab9d0,
        rarity: 'purple',
        icon: 'slow',
        apply: () => { this.dailySlowField += 1; },
      });
    }
    if (weapon && weapon.copies < MAX_WEAPON_COPIES) {
      pool.push({
        title: '升级武器数',
        detail: `当前武器数量 ${weapon.copies} → ${weapon.copies + 1}，围绕主角均匀旋转`,
        color: 0x7ab9d0,
        rarity: tier >= 3 ? 'gold' : tier >= 2 ? 'purple' : 'blue',
        icon: 'copies',
        apply: () => this.applyWeaponCopiesUpgrade(),
      });
    }
    const choices = Phaser.Utils.Array.Shuffle(pool).slice(0, 3);
    if (this.runMode === 'daily' && choices.every((choice) => choice.rarity === 'blue')) {
      const special = Phaser.Utils.Array.GetRandom(pool.filter((choice) => choice.rarity === 'purple' || choice.rarity === 'gold'));
      if (special) choices[2] = special;
    }
    choices.forEach((choice, index) => {
      const x = 390 + layoutShift + index * 250;
      const cardWidth = 228;
      const cardHeight = 342;
      const card = this.add.container(x, 325).setSize(cardWidth, cardHeight).setInteractive({ useHandCursor: true });
      const rarity = choice.rarity ?? 'blue';
      const rarityColor = rarity === 'gold' ? 0xffd18a : rarity === 'purple' ? 0xb798e2 : 0x5f9dff;
      const cardTextColor = rarity === 'blue' ? '#d9edf3' : rarity === 'purple' ? '#2c2033' : '#3b2818';
      const cardDetailColor = rarity === 'blue' ? '#9bbdc8' : rarity === 'purple' ? '#59445e' : '#71532e';
      const textureKey = this.upgradeCardTexture(rarity);
      if (this.textures.exists(textureKey)) {
        card.add(this.add.image(0, 0, textureKey).setOrigin(0.5).setDisplaySize(cardWidth, cardHeight));
      } else {
        card.add(this.add.rectangle(0, 0, cardWidth, cardHeight, palette.panel, 1).setStrokeStyle(2, rarityColor, 0.95));
      }
      const selectionFrame = this.upgradeCardSelectionFrame(card, cardWidth, cardHeight, rarityColor);
      const iconHalo = this.add.circle(0, -22, 64, choice.color, 0.08).setStrokeStyle(2, choice.color, 0.72);
      card.add(iconHalo);
      this.upgradeCardIcon(card, choice.icon ?? 'effect', 0, -22, choice.color);
      const titleSize = choice.title.length > 11 ? 14 : 16;
      const detailSize = choice.detail.length > 42 ? 9 : 10;
      card.add(this.add.text(0, 78, choice.title, {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${titleSize}px`,
        color: cardTextColor,
        align: 'center',
        stroke: '#0b1117',
        strokeThickness: rarity === 'blue' ? 2 : 1,
        wordWrap: { width: 176 },
        lineSpacing: 2,
      }).setOrigin(0.5).setFixedSize(184, 52).setFontStyle('bold'));
      card.add(this.add.text(0, 128, choice.detail, {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${detailSize}px`,
        color: cardDetailColor,
        align: 'center',
        stroke: '#0b1117',
        strokeThickness: 1,
        wordWrap: { width: 174 },
        lineSpacing: 2,
      }).setOrigin(0.5).setFixedSize(180, 54));
      layer.add(card);
      const applyChoice = () => {
        if (this.phase !== 'upgrade') return;
        selectionFrame.setVisible(true);
        choice.apply();
        this.rescaleActiveEnemies();
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
      card.on('pointerover', () => selectionFrame.setVisible(true));
      card.on('pointerout', () => selectionFrame.setVisible(false));
      card.on('pointerdown', () => selectionFrame.setVisible(true));
      card.on('pointerup', applyChoice);
      this.addButton(layer, x, 520, 142, 38, '选择', applyChoice, 'primary', 4);
    });
    const paidRefresh = upgradeRefreshRequiresPayment(this.upgradeRefreshCount);
    const refreshLabel = this.upgradePaymentPending
      ? '正在打开平台支付'
      : paidRefresh
        ? '刷新卡牌 · 平台付费'
        : `刷新卡牌 · 免费（剩 ${FREE_UPGRADE_REFRESHES - this.upgradeRefreshCount} 次）`;
    const refreshStyle = paidRefresh ? 'danger' : 'muted';
    const upgradeActionY = this.safeBottomY(580, 22);
    this.addButton(layer, 475 + layoutShift, upgradeActionY, 280, 42, refreshLabel, () => { void this.refreshUpgradeCards(); }, refreshStyle, 4);
    layer.add(this.add.text(805 + layoutShift, upgradeActionY, `未使用经验 ${Math.floor(this.xp)}`, { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.muted }).setOrigin(0, 0.5));
    if (this.upgradePaymentMessage) {
      layer.add(this.add.text(centerX, this.safeBottomY(612, 8), this.upgradePaymentMessage, {
        fontFamily: 'Microsoft YaHei',
        fontSize: '12px',
        color: palette.amber,
        align: 'center',
        wordWrap: { width: 520 },
      }).setOrigin(0.5));
    }
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

    const sdk = window.Builda;
    if (!sdk?.pay?.showPayPanel) {
      this.upgradePaymentMessage = '当前环境未接入平台支付，卡牌未刷新';
      this.showUpgrade(false);
      return;
    }

    this.upgradePaymentPending = true;
    this.upgradePaymentMessage = '正在等待平台支付结果';
    this.showUpgrade(false);
    let resultMessage = '';
    try {
      const result = await sdk.pay.showPayPanel(PAID_UPGRADE_REFRESH_SALE_ID);
      if (!result.ok) {
        resultMessage = '平台支付未完成，卡牌未刷新';
      } else if (!result.data.success) {
        resultMessage = '支付已取消，卡牌未刷新';
      } else {
        const orderId = result.data.orderId.trim();
        if (!orderId) {
          resultMessage = '平台未返回订单号，卡牌未刷新';
        } else if (this.paidRefreshOrderIds.has(orderId)) {
          resultMessage = '该支付订单已使用，卡牌未重复刷新';
        } else {
          this.paidRefreshOrderIds.add(orderId);
          this.upgradeRefreshCount += 1;
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
    if (this.runMode === 'daily') {
      if (this.wave === waves) return 52;
      if (this.isMiniBossWave()) return 38;
      return 22 + Math.min(10, this.wave * 0.16);
    }
    return this.wave === 7 ? 38 : this.wave === waves ? 34 : 24 + this.wave * 1.2;
  }

  private showResult(win: boolean) {
    this.playerDeathPending = false;
    this.playerDeathTimer = 0;
    if (win) this.recordRunReward();
    this.phase = 'result';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(45).setScrollFactor(0);
    const safe = this.pageSafeBounds(12);
    const centerX = safe.centerX;
    if (!win) {
      layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000204, 1));
      layer.add(this.add.text(centerX, 190, '你的大脑被大量怪物占据，失去意识...', {
        fontFamily: 'Microsoft YaHei',
        fontSize: '27px',
        color: palette.cream,
        stroke: '#13090d',
        strokeThickness: 7,
        align: 'center',
        wordWrap: { width: 760 },
      }).setOrigin(0.5).setFontStyle('bold'));
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
      this.addMenuImageButton(layer, centerX, resultBottomY, 330, 124, 'menu-button-archive-v1', '回到标题', () => this.showStart());
      this.overlay = layer;
      return;
    }
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x071015, 0.94));
    this.addPixelFrame(layer, centerX, 350, 650, 370, 0x101b24, win ? 0x8fd17c : 0xed716e);
    if (win && this.tutorialRun) {
      layer.add(this.add.text(centerX, 206, '入口教程完成', { fontFamily: 'Microsoft YaHei', fontSize: '34px', color: palette.green }).setOrigin(0.5).setFontStyle('bold'));
      layer.add(this.add.text(centerX, 264, '已掌握移动、自动攻击、经验升级和 SAN 异化。下一站是第 1 层。', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.cream, align: 'center', wordWrap: { width: 520 } }).setOrigin(0.5));
      layer.add(this.add.text(centerX, 334, `击破 ${this.kills} · 等级 ${this.level}`, { fontFamily: 'Microsoft YaHei', fontSize: '15px', color: palette.muted }).setOrigin(0.5));
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
      ? this.runMode === 'daily' ? '50 波挑战完成，已解锁首领专属外观。' : finalFloor ? `第 ${TOTAL_FLOORS} 层已清理完成。病区暂时恢复安静。` : `第 ${this.floor} 层已清理完成。准备进入第 ${this.floor + 1} 层。`
      : `你倒在第 ${this.floor} 层第 ${this.wave} 波。当前楼层会保留，重开从第 1 波开始。`;
    if (win && this.tutorialRun) {
      resultTitle = '入口教程完成';
      resultDetail = '已掌握移动、自动攻击、经验升级和 SAN 异化。下一站是第 1 层。';
    }
    layer.add(this.add.text(centerX, 206, resultTitle, { fontFamily: 'Microsoft YaHei', fontSize: '34px', color: win ? palette.green : palette.danger }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(centerX, 264, resultDetail, { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.cream, align: 'center', wordWrap: { width: 520 } }).setOrigin(0.5));
    layer.add(this.add.text(centerX, 334, `击破 ${this.kills} · 等级 ${this.level}`, { fontFamily: 'Microsoft YaHei', fontSize: '15px', color: palette.muted }).setOrigin(0.5));
    this.addButton(layer, centerX, 438, 240, 52, win ? (this.runMode === 'daily' ? '返回每日挑战' : finalFloor ? '从第 1 层再打一遍' : `进入第 ${this.floor + 1} 层`) : `从第 ${this.floor} 层第 1 波重开`, () => win && this.runMode === 'daily' ? this.showDailyChallenge() : this.startRun(win && !finalFloor ? this.floor + 1 : this.floor), 'primary', 10);
    this.addButton(layer, centerX, 507, 160, 38, '回到标题', () => this.showStart(), 'muted', 10);
    this.overlay = layer;
  }

  private recordRunReward() {
    if (this.runMode === 'daily') {
      if (!this.dailyBossRewardGranted) {
        this.dailyBossRewardGranted = true;
        this.progress.dailyCompletedDate = this.todayKey();
        this.progress.dailyBestSeconds = this.progress.dailyBestSeconds
          ? Math.min(this.progress.dailyBestSeconds, this.elapsed)
          : this.elapsed;
        if (!this.progress.unlockedSkinIds.includes('scarlet-night')) this.progress.unlockedSkinIds.push('scarlet-night');
        if (!this.progress.archiveKinds.includes('boss')) this.progress.archiveKinds.push('boss');
        this.progress.metaCoins += 30;
        this.saveProgress();
        void this.submitDailyScore(this.elapsed);
      }
      return;
    }
    if (this.tutorialRun) {
      this.progress.maxFloor = Math.max(1, this.progress.maxFloor);
      this.saveProgress();
      return;
    }
    this.progress.maxFloor = Math.max(this.progress.maxFloor, Math.min(TOTAL_FLOORS, this.floor + 1));
    if (this.floor >= 3 && !this.progress.unlockedWeaponIds.includes('thorn')) this.progress.unlockedWeaponIds.push('thorn');
    if (this.floor >= 5 && !this.progress.unlockedWeaponIds.includes('echo')) this.progress.unlockedWeaponIds.push('echo');
    this.saveProgress();
  }

  private addButton(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, label: string, callback: () => void, style: 'primary' | 'muted' | 'danger' = 'primary', hitPadding = 14) {
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
    const lineColors = { primary: 0x7bd6c1, muted: 0x5b777c, danger: 0xed716e };
    // Keep the touch target larger than the visible button.
    const hitWidth = Math.max(48, width + hitPadding * 2);
    const hitHeight = Math.max(48, height + hitPadding * 2);
    const button = this.add.container(x, y);
    const shadow = isBackButton ? undefined : this.add.rectangle(4, 4, width, height, 0x05090f, 0.96).setStrokeStyle(1, 0x05090f, 1);
    const commandFrameKey = this.textures.exists('ui-command-frame-v2') ? 'ui-command-frame-v2' : 'ui-command-frame';
    const hasPixelButton = !isBackButton && this.textures.exists(commandFrameKey);
    const pixelButton = hasPixelButton
      ? this.add.image(0, 0, commandFrameKey).setDisplaySize(width + 24, Math.max(48, height + 16)).setAlpha(0.92)
      : undefined;
    const rect = isBackButton ? undefined : this.add.rectangle(0, 0, width, height, colors[style], hasPixelButton ? 0.32 : 1).setStrokeStyle(2, lineColors[style], 0.95);
    if (shadow) button.add(shadow);
    if (pixelButton) button.add(pixelButton);
    if (rect) {
      button.add(rect);
      button.add(this.add.rectangle(0, 0, width - 8, height - 8, colors[style], 0).setStrokeStyle(1, lineColors[style], 0.55));
    }
    const labelNode = isBackButton && this.textures.exists('back-icon-v1')
      ? this.add.image(0, 0, 'back-icon-v1').setDisplaySize(48, 48)
      : this.add.text(0, 0, isBackButton ? '←' : label, { fontFamily: 'Microsoft YaHei', fontSize: isBackButton ? '25px' : '15px', color: palette.cream }).setOrigin(0.5);
    button.add(labelNode);
    const setPressed = (pressed: boolean) => {
      button.setScale(pressed ? 0.97 : 1);
      rect?.setFillStyle(pressed ? Phaser.Display.Color.IntegerToColor(colors[style]).lighten(12).color : colors[style], 1);
    };
    parent.add(button);
    this.uiActionRegions.push({ phase: this.phase, x, y, width: hitWidth, height: hitHeight, callback, setPressed });
    return button;
  }

  private clearOverlay() {
    this.releaseJoystick();
    this.releaseUiPointer();
    this.releaseFloorScroll();
    document.getElementById('game-shell')?.classList.remove('menu-shell');
    this.overlay?.destroy(true);
    this.overlay = undefined;
    this.tutorialGuide?.destroy(true);
    this.tutorialGuide = undefined;
    this.tutorialGuideTimer = 0;
    this.floorScrollContent = undefined;
    this.floorScrollRegions = [];
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

  private floatText(x: number, y: number, message: string, color: string, fontSize = 12, rise = 24, duration = 650) {
    const strokeThickness = fontSize >= 20 ? 4 : 3;
    const text = this.add.text(x, y, message, { fontFamily: 'Microsoft YaHei', fontSize: `${fontSize}px`, color, stroke: '#0b1117', strokeThickness }).setOrigin(0.5).setDepth(30);
    this.world.add(text);
    this.tweens.add({ targets: text, y: y - rise, alpha: 0, duration, onComplete: () => text.destroy() });
  }

  private createAreaWarning(x: number, y: number, radius = 75, color = 0xb798e2) {
    const warning = this.add.circle(x, y, radius, color, 0.08).setStrokeStyle(2, color, 0.85).setDepth(4);
    this.world.add(warning);
    this.tweens.add({ targets: warning, scale: 1.35, alpha: 0, duration: 520, onComplete: () => warning.destroy() });
  }

  private canvasPoint(event: PointerEvent) {
    const rect = this.game.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * W / Math.max(1, rect.width),
      y: (event.clientY - rect.top) * H / Math.max(1, rect.height),
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
    if (this.phase === 'battle' || this.pendingUiAction) return;
    const point = this.canvasPoint(event);
    if (this.phase === 'mainline-select') {
      this.floorScrollPointer = event.pointerId;
      this.floorScrollStartY = point.y;
      this.floorScrollStartOffset = this.floorScrollOffset;
      this.floorScrollMoved = false;
    }
    const region = this.findUiRegion(point.x, point.y);
    if (region) {
      this.pendingUiAction = { pointerId: event.pointerId, phase: this.phase, region };
      region.setPressed(true);
    }
    try { this.game.canvas.setPointerCapture(event.pointerId); } catch { /* capture can fail after browser gestures */ }
  }

  private handleUiPointerMove(event: PointerEvent) {
    if (this.phase !== 'mainline-select' || this.floorScrollPointer !== event.pointerId) return;
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
    if (this.phase !== 'mainline-select') return;
    this.setFloorScrollOffset(this.floorScrollOffset + event.deltaY * 0.82);
    event.preventDefault();
  }

  private handleUiPointerUp(event: PointerEvent) {
    const scrollingFloor = this.phase === 'mainline-select' && this.floorScrollPointer === event.pointerId;
    const movedFloor = this.floorScrollMoved;
    if (scrollingFloor) this.releaseFloorScroll();
    if (movedFloor) {
      this.releaseUiPointer();
      return;
    }
    const pending = this.pendingUiAction;
    if (!pending || event.pointerId !== pending.pointerId) return;
    const point = this.canvasPoint(event);
    this.pendingUiAction = undefined;
    pending.region.setPressed(false);
    const withinPendingRegion = point.x >= pending.region.x - pending.region.width / 2
      && point.x <= pending.region.x + pending.region.width / 2
      && point.y >= pending.region.y - pending.region.height / 2
      && point.y <= pending.region.y + pending.region.height / 2;
    if (this.phase === pending.phase && withinPendingRegion) pending.region.callback();
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

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (this.phase !== 'battle') return;
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
    const scale = Math.min(1, 42 / len);
    this.joystickVector.x = (dx / len) * scale;
    this.joystickVector.y = (dy / len) * scale;
    const knob = this.joystickVisual?.getData('knob') as Phaser.GameObjects.Arc | undefined;
    knob?.setPosition(this.joystickVector.x * 42, this.joystickVector.y * 42);
  }

  private createTouchJoystick() {
    this.joystickVisual?.destroy(true);
    const visual = this.add.container(this.joystickOrigin.x, this.joystickOrigin.y).setDepth(30).setScrollFactor(0);
    const ring = this.add.circle(0, 0, 46, 0x18313a, 0.42).setStrokeStyle(2, 0x6bd3c1, 0.8);
    const knob = this.add.circle(0, 0, 18, 0x6bd3c1, 0.82).setStrokeStyle(2, 0xf4e8c9, 0.65);
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
window.__GAME_TEST_API__ = {
  snapshot: () => {
    const scene = game.scene.getScene('hospital-battle') as HospitalBattleScene | undefined;
    if (!scene) return {};
    return {
      phase: scene['phase'],
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
    };
  },
};

export { game };
