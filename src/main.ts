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

const W = 1280;
const H = 720;
const MAX_WEAPON_COPIES = 5;
const TOTAL_FLOORS = TOTAL_HOSPITAL_FLOORS;
const FULL_TURN = Math.PI * 2;
const ARENA = { left: 160, right: 1120, top: 116, bottom: 642 };
const WORLD_BOUNDS = { left: -720, right: 2000, top: -520, bottom: 1700 };

type Phase = 'start' | 'mainline-select' | 'weapon-select' | 'dialogue' | 'battle' | 'wave-cleanup' | 'wave-break' | 'upgrade' | 'result';
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
type UpgradeIconKind = 'move' | 'damage' | 'sustain' | 'growth' | 'effect' | 'copies' | 'weapon' | 'resonance' | 'shield' | 'magnet' | 'pulse' | 'mirror' | 'blood' | 'nova' | 'slow';

interface SkinDef {
  id: string;
  name: string;
  color: number;
  weaponId?: string;
  setName?: string;
  setBuff?: string;
}

interface ProgressSave {
  maxFloor: number;
  unlockedWeaponIds: string[];
  unlockedSkinIds: string[];
  equippedSkinId: string;
  archiveKinds: string[];
  dailyCompletedDate?: string;
  dailyBestSeconds?: number;
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const hex = (color: number) => Phaser.Display.Color.IntegerToColor(color).rgba;

export class HospitalBattleScene extends Phaser.Scene {
  private phase: Phase = 'start';
  private overlay?: Phaser.GameObjects.Container;
  private canvasUiPointerDownHandler?: (event: PointerEvent) => void;
  private canvasUiPointerUpHandler?: (event: PointerEvent) => void;
  private canvasPointerCancelHandler?: (event: PointerEvent) => void;
  private world!: Phaser.GameObjects.Container;
  private ui!: Phaser.GameObjects.Container;
  private arenaBackground?: Phaser.GameObjects.Image;
  private arenaBackgroundTexture = '';
  private player!: Phaser.GameObjects.Container;
  private playerSprite?: Phaser.GameObjects.Sprite;
  private playerSpriteTargetHeight = 82;
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
  private selectedStartFloor = 1;
  private progress: ProgressSave = {
    maxFloor: 1,
    unlockedWeaponIds: ['knife', 'ward-lantern'],
    unlockedSkinIds: ['patient-default'],
    equippedSkinId: 'patient-default',
    archiveKinds: [],
    dailyBestSeconds: undefined,
    metaCoins: 0,
  };
  private playerNickname = '患者 0001';
  private playerIdentityLoaded = false;
  private profilePreviewSkinId = 'patient-default';
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
    { id: 'scarlet-night', name: '猩红夜班', color: 0xed716e, setName: '猩红套装', setBuff: '伤害 +6' },
    { id: 'cyan-ward', name: '青蓝病区', color: 0x7ab9d0, setName: '青蓝套装', setBuff: '护盾 +18' },
    { id: 'violet-dream', name: '紫雾梦魇', color: 0xb798e2, setName: '紫雾套装', setBuff: '移速 +8%' },
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
  private dialogueIndex = 0;
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
    this.load.image('patient-boy', '/assets/art/patient-boy.png');
    this.load.image('patient-idle-front', '/assets/art/animations/patient-idle-front.png');
    this.load.image('menu-ward-night-v1', '/assets/art/menu-ward-night-v1.png');
    this.load.image('menu-background-v1', '/assets/art/menu/menu-background-v1.png');
    this.load.image('menu-title-v2', '/assets/art/menu/menu-title-v2.png');
    this.load.image('menu-button-archive-v1', '/assets/art/menu/menu-button-archive-v1.png');
    this.load.image('menu-button-mainline-v1', '/assets/art/menu/menu-button-mainline-v1.png');
    this.load.image('menu-button-daily-v1', '/assets/art/menu/menu-button-daily-v1.png');
    this.load.image('ward-day-v1', '/assets/art/ward-day-v1.png');
    this.load.image('ward-night-v1', '/assets/art/ward-night-v1.png');
    this.load.image('ward-night-deep-v1', '/assets/art/ward-night-deep-v1.png');
    this.load.image('boss-moon-wolf', '/assets/art/boss-moon-wolf.webp');
    this.load.image('upgrade-card-blue-v1', '/assets/art/cards/upgrade-card-blue-v1.png');
    this.load.image('upgrade-card-purple-v1', '/assets/art/cards/upgrade-card-purple-v1.png');
    this.load.image('upgrade-card-gold-v1', '/assets/art/cards/upgrade-card-gold-v1.png');
    (['sword', 'gun', 'whip', 'cannon'] as const).forEach((weaponClass) => {
      this.load.image(`weapon-${weaponClass}`, `/assets/art/weapons/weapon-${weaponClass}.png`);
    });
    (['left', 'right', 'up', 'down'] as PlayerDirection[]).forEach((direction) => {
      this.load.spritesheet(`patient-walk-${direction}`, `/assets/art/animations/patient-walk-${direction}.png`, { frameWidth: 192, frameHeight: 192 });
    });
    this.load.spritesheet('patient-hit', '/assets/art/animations/patient-hit.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('patient-death', '/assets/art/animations/patient-death.png', { frameWidth: 192, frameHeight: 192 });
  }

  create() {
    this.cameras.main.setBackgroundColor(palette.bg);
    this.loadProgress();
    this.createPlayerAnimations();
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
    this.canvasUiPointerUpHandler = (event: PointerEvent) => this.handleUiPointerUp(event);
    this.canvasPointerCancelHandler = () => {
      this.releaseJoystick();
      this.releaseUiPointer();
    };
    this.game.canvas.addEventListener('pointerdown', this.canvasUiPointerDownHandler, true);
    this.game.canvas.addEventListener('pointerup', this.canvasUiPointerUpHandler, true);
    this.game.canvas.addEventListener('pointercancel', this.canvasPointerCancelHandler);
    this.game.canvas.addEventListener('lostpointercapture', this.canvasPointerCancelHandler);
    this.showStart();
    this.refreshBuildaLayout();
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
        hp: this.hp,
        san: this.san,
        frenzyAvailable: this.frenzyAvailable,
        frenzyActive: this.frenzyActive,
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
        weapon: this.currentWeapon() ? { id: this.currentWeapon()!.id, name: this.currentWeapon()!.name, type: this.currentWeapon()!.type, ammo: this.currentWeapon()!.ammo, copies: this.currentWeapon()!.copies, level: this.currentWeapon()!.level, damage: this.currentWeaponDamage(this.currentWeapon()!), rotationsPerSecond: rotationsPerSecond(this.currentRotationSpeed(this.currentWeapon()!)) } : undefined,
      }),
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.canvasUiPointerDownHandler) this.game.canvas.removeEventListener('pointerdown', this.canvasUiPointerDownHandler, true);
      if (this.canvasUiPointerUpHandler) this.game.canvas.removeEventListener('pointerup', this.canvasUiPointerUpHandler, true);
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

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05) * this.gameSpeed;
    if (this.phase === 'wave-break') {
      this.waveBreakTimer = Math.max(0, this.waveBreakTimer - dt);
      this.waveClearedTimer = Math.max(0, this.waveClearedTimer - dt);
      if (this.waveBreakTimer <= 0) this.completeWaveBreak();
      this.updateHud();
      return;
    }
    if (this.phase === 'wave-cleanup') {
      this.elapsed += dt;
      this.waveClearedTimer = Math.max(0, this.waveClearedTimer - dt);
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
    panel.add(this.add.rectangle(4, 4, 292, 220, 0x03060a, 0.96).setOrigin(0));
    panel.add(this.add.rectangle(0, 0, 292, 220, palette.panel, 0.96).setOrigin(0).setStrokeStyle(2, 0x46636a, 0.95));
    panel.add(this.add.rectangle(5, 5, 282, 210, palette.panel, 0).setOrigin(0).setStrokeStyle(1, 0x6bd3c1, 0.4));
    panel.add(this.add.text(14, 10, '战斗状态 / NIGHT SHIFT', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '12px', color: palette.muted }).setFontStyle('bold'));
    this.hud.panel = panel;
    this.ui.add(panel);
    this.hud.sanOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xc44557, 0).setDepth(0);
    this.ui.add(this.hud.sanOverlay);
    const wavePanel = this.add.container(W / 2, 58).setDepth(26).setScrollFactor(0, 0, true);
    wavePanel.add(this.add.rectangle(3, 3, 390, 82, 0x03060a, 0.92));
    wavePanel.add(this.add.rectangle(0, 0, 390, 82, 0x101b24, 0.96).setStrokeStyle(2, 0x46636a, 0.95));
    wavePanel.add(this.add.rectangle(-186, -37, 56, 2, 0x6bd3c1, 0.75));
    wavePanel.add(this.add.rectangle(130, -37, 56, 2, 0x6bd3c1, 0.75));
    this.hud.wavePanel = wavePanel;
    this.ui.add(wavePanel);
    this.hud.wave = text(0, -27, '第 1 / 20 波', 22, palette.amber).setOrigin(0.5).setFontStyle('bold');
    this.hud.timer = text(0, 1, '倒计时 30 秒', 14, palette.cream).setOrigin(0.5);
    this.hud.waveCleared = text(0, 28, '', 13, palette.green).setOrigin(0.5).setFontStyle('bold');
    wavePanel.add(this.hud.wave);
    wavePanel.add(this.hud.timer);
    wavePanel.add(this.hud.waveCleared);
    const resourcePanel = this.add.container(W - 122, 62).setDepth(26).setScrollFactor(0, 0, true);
    resourcePanel.add(this.add.rectangle(3, 3, 196, 72, 0x03060a, 0.92));
    resourcePanel.add(this.add.rectangle(0, 0, 196, 72, 0x101b24, 0.96).setStrokeStyle(2, 0x46636a, 0.95));
    resourcePanel.add(this.add.text(-82, -22, '本局记录', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '11px', color: palette.muted }).setFontStyle('bold'));
    this.hud.resourcePanel = resourcePanel;
    this.ui.add(resourcePanel);
    this.hud.kills = text(-82, 2, '击破 0', 12, palette.muted).setFixedSize(174, 18);
    resourcePanel.add(this.hud.kills);
    this.hud.hp = text(52, 41, '生命 100 / 100', 13, palette.cream).setFixedSize(220, 18);
    this.hud.xp = text(52, 67, `经验 0 / ${experienceRequiredForLevel(1)} · Lv.1`, 11, palette.muted).setFixedSize(225, 18);
    this.hud.san = text(52, 93, 'SAN 100 / 100', 11, palette.cyan).setFixedSize(228, 18).setWordWrapWidth(228);
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
    this.hud.skill = this.add.text(230, 180, '暴走', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.cream, backgroundColor: '#8c3c4d', padding: { left: 12, right: 12, top: 8, bottom: 8 } }).setOrigin(0.5).setDepth(26).setVisible(false).setInteractive(new Phaser.Geom.Rectangle(-48, -25, 96, 50), Phaser.Geom.Rectangle.Contains);
    this.hud.skill.on('pointerdown', (pointer: Phaser.Input.Pointer) => { pointer.event?.preventDefault?.(); this.triggerFrenzy(); });
    panel.add(this.hud.skill);
    this.pinHudToViewport();
  }

  private currentWeapon() {
    return this.weapons.find((weapon) => weapon.owned);
  }

  private weaponAssetKey(weapon?: Weapon) {
    return `weapon-${weapon?.weaponClass ?? 'sword'}`;
  }

  private weaponVisualSpec(weapon: Weapon) {
    const specs: Record<WeaponClass, { width: number; height: number; originX: number; originY: number; rotation: number }> = {
      sword: { width: 76, height: 76, originX: 0.15, originY: 0.75, rotation: -Math.PI / 4 },
      gun: { width: 74, height: 74, originX: 0.16, originY: 0.72, rotation: 0 },
      whip: { width: 84, height: 84, originX: 0.14, originY: 0.75, rotation: 0 },
      cannon: { width: 80, height: 80, originX: 0.15, originY: 0.74, rotation: -Math.PI / 4 },
    };
    return specs[weapon.weaponClass];
  }

  private safeGameRect(padding = 0) {
    const canvasRect = this.game?.canvas?.getBoundingClientRect();
    const scaleX = canvasRect?.width ? W / canvasRect.width : 1;
    const scaleY = canvasRect?.height ? H / canvasRect.height : 1;
    const leftInset = Math.max(0, this.buildaSafeArea.left * scaleX);
    const rightInset = Math.max(0, this.buildaSafeArea.right * scaleX);
    const topInset = Math.max(0, this.buildaSafeArea.top * scaleY);
    const bottomInset = Math.max(0, this.buildaSafeArea.bottom * scaleY);
    const left = clamp(leftInset + padding, 0, W / 2 - 1);
    const right = clamp(W - rightInset - padding, W / 2 + 1, W);
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
    while (this.heldWeapons.length < copies) {
      const held = this.add.image(0, 0, assetKey).setOrigin(spec.originX, spec.originY);
      this.player.add(held);
      this.heldWeapons.push(held);
    }
    while (this.heldWeapons.length > copies) {
      this.heldWeapons.pop()?.destroy();
    }
    this.heldWeapon = this.heldWeapons[0];
    this.heldWeapons.forEach((held) => {
      held.setTexture(assetKey).setVisible(true).setOrigin(spec.originX, spec.originY).setDisplaySize(spec.width, spec.height);
    });
  }

  private updateWeaponOrbit(dt: number) {
    const weapon = this.currentWeapon();
    if (!weapon || !this.player) return;
    this.updateHeldWeaponVisual();
    this.previousWeaponAngle = this.weaponAngle;
    this.weaponAngle = Phaser.Math.Angle.Wrap(this.weaponAngle + dt * this.currentRotationSpeed(weapon));
    const innerRadius = weapon.type === 'melee' ? 16 : 38;
    const copies = Math.max(1, this.heldWeapons.length);
    this.heldWeapons.forEach((held, index) => {
      const angle = this.weaponAngle + (index * FULL_TURN) / copies;
      held.setPosition(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
      held.setRotation(angle + this.weaponVisualSpec(weapon).rotation);
    });
  }

  private updateHud() {
    if (!this.hud.wave) return;
    this.pinHudToViewport();
    const bossLabel = this.isMiniBossWave() ? ' · 小首领' : this.isFloorBossWave() ? ' · 楼层首领' : '';
    this.hud.wave.setText(`第 ${this.wave} / ${this.wavesPerFloor()} 波${bossLabel}`);
    const remaining = this.enemies.filter((enemy) => !enemy.dead).length;
    const seconds = Math.max(0, Math.ceil(this.waveLength - this.waveTimer));
    this.hud.timer?.setText(this.phase === 'battle'
      ? seconds > 0 ? `倒计时 ${seconds} 秒 · 出怪 ${this.waveSpawned} / ${this.spawnBudgetForWave()}` : `停止出怪 · 场内敌人 ${remaining}`
      : this.phase === 'wave-cleanup'
        ? `波末清理 · 敌人 ${this.enemies.length} · 掉落 ${this.drops.length}`
        : this.phase === 'wave-break'
          ? `下一波倒计时 ${Math.max(1, Math.ceil(this.waveBreakTimer))} 秒`
          : '下一波准备中');
    this.hud.waveCleared?.setText(this.phase === 'wave-break' || this.waveClearedTimer > 0 ? this.waveClearedMessage : '');
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
      ? '变异：刷怪↑ · 伤害↑ · 防御↓'
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
    this.hud.skill?.setScrollFactor(0, 0);
  }

  private loadProgress() {
    try {
      const raw = window.localStorage.getItem('hospital-godslayer-progress');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ProgressSave>;
      this.progress = {
        maxFloor: clamp(Number(parsed.maxFloor) || 1, 1, TOTAL_FLOORS),
        unlockedWeaponIds: Array.isArray(parsed.unlockedWeaponIds) ? parsed.unlockedWeaponIds.filter((id): id is string => typeof id === 'string') : ['knife', 'ward-lantern'],
        unlockedSkinIds: Array.isArray(parsed.unlockedSkinIds) ? parsed.unlockedSkinIds.filter((id): id is string => typeof id === 'string') : ['patient-default'],
        equippedSkinId: typeof parsed.equippedSkinId === 'string' ? parsed.equippedSkinId : 'patient-default',
        archiveKinds: Array.isArray(parsed.archiveKinds) ? parsed.archiveKinds.filter((id): id is string => typeof id === 'string') : [],
        dailyCompletedDate: typeof parsed.dailyCompletedDate === 'string' ? parsed.dailyCompletedDate : undefined,
        dailyBestSeconds: Number.isFinite(Number(parsed.dailyBestSeconds)) && Number(parsed.dailyBestSeconds) > 0 ? Number(parsed.dailyBestSeconds) : undefined,
        metaCoins: Math.max(0, Number(parsed.metaCoins) || 0),
      };
      if (!this.progress.unlockedWeaponIds.includes('knife')) this.progress.unlockedWeaponIds.unshift('knife');
      if (!this.progress.unlockedWeaponIds.includes('ward-lantern')) this.progress.unlockedWeaponIds.push('ward-lantern');
      if (!this.progress.unlockedSkinIds.includes('patient-default')) this.progress.unlockedSkinIds.unshift('patient-default');
    } catch {
      this.progress = { maxFloor: 1, unlockedWeaponIds: ['knife', 'ward-lantern'], unlockedSkinIds: ['patient-default'], equippedSkinId: 'patient-default', archiveKinds: [], dailyBestSeconds: undefined, metaCoins: 0 };
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
      const result = await window.Builda?.rank?.getRankList('daily_night', { limit: 5, timeoutMs: 1400 });
      if (result?.ok && result.data.list.length > 0) {
        this.dailyBoard = result.data.list.map((entry) => ({
          rank: entry.rank,
          name: entry.player.name.trim().slice(0, 14) || `患者 ${entry.rank}`,
          score: Math.max(0, Math.round(entry.score)),
        }));
      }
    } catch {
      // The local board remains visible when a host rank board is unavailable.
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

  private isWeaponUnlocked(id: string) {
    return this.progress.unlockedWeaponIds.includes(id);
  }

  private createWeaponRoster(): Weapon[] {
    return [
      { id: 'knife', name: '病院刀', glyph: '刀', weaponClass: 'sword', type: 'melee', effect: 'slash', color: 0xed716e, damage: WEAPON_DAMAGE.knife, cooldown: 0.42, range: 72, rotationSpeed: 4.8, level: 1, copies: 1, ammo: 1, owned: true },
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
    this.selectedStartFloor = clamp(Math.round(targetFloor), 1, TOTAL_FLOORS);
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.5);
    this.drawMenuMotif(layer);
    this.addPixelFrame(layer, 640, 350, 960, 560, 0x101b24, mode === 'daily' ? 0xb798e2 : 0x6bd3c1);
    layer.add(this.add.text(640, 92, mode === 'daily' ? '每日挑战 · 选择武器' : `第 ${this.selectedStartFloor} 层 · 入场武器`, { fontFamily: 'Microsoft YaHei', fontSize: '27px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(640, 132, mode === 'daily' ? '选择后本次挑战不可更换，卡牌会改变攻击节奏与战斗特效' : '进入本层后不可更换，升级卡牌会在战斗中出现', { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.muted }).setOrigin(0.5));
    const baseWeapons = this.createWeaponRoster().slice(0, 4);
    baseWeapons.forEach((weapon, index) => {
      const unlocked = this.isWeaponUnlocked(weapon.id) || (mode === 'mainline' && weapon.id === 'knife');
      const x = 365 + (index % 2) * 275;
      const y = 270 + Math.floor(index / 2) * 165;
      const color = unlocked ? weapon.color : 0x405158;
      const card = this.add.container(x, y);
      card.add(this.add.rectangle(0, 0, 230, 128, 0x132129, 1).setStrokeStyle(2, color, 0.9));
      card.add(this.add.circle(-82, 0, 30, color, unlocked ? 0.25 : 0.08).setStrokeStyle(2, color, 1));
      if (unlocked) {
        card.add(this.add.image(-82, 0, this.weaponAssetKey(weapon)).setOrigin(0.5).setDisplaySize(50, 50));
      } else {
        card.add(this.add.text(-82, 0, '?', { fontFamily: 'Microsoft YaHei', fontSize: '24px', color: hex(color) }).setOrigin(0.5));
      }
      card.add(this.add.text(-38, -30, unlocked ? weapon.name : '未解锁武器', { fontFamily: 'Microsoft YaHei', fontSize: '17px', color: unlocked ? palette.cream : palette.muted }).setOrigin(0, 0.5));
      card.add(this.add.text(-38, 2, unlocked ? `${weapon.weaponClass === 'sword' ? '剑' : weapon.weaponClass === 'whip' ? '鞭' : weapon.weaponClass === 'gun' ? '枪' : '炮'} · 伤害 ${weapon.damage} · ${weapon.type === 'melee' ? '近战' : '远程'}` : (weapon.id === 'thorn' ? '通关第 3 层解锁' : weapon.id === 'echo' ? '通关第 5 层解锁' : '主线推进后解锁'), { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: unlocked ? palette.muted : palette.muted, wordWrap: { width: 155 } }).setOrigin(0, 0.5));
      card.add(this.add.text(-38, 28, unlocked ? `武器皮肤：${this.weaponAppearanceLabel(weapon)}` : '武器皮肤：解锁后查看', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: unlocked ? palette.amber : palette.muted, wordWrap: { width: 155 } }).setOrigin(0, 0.5));
      layer.add(card);
      if (unlocked && (mode !== 'daily' || this.isWeaponUnlocked(weapon.id))) {
        this.addButton(layer, x + 60, y + 62, 112, 32, weapon.id === this.selectedWeaponId ? '当前选择' : '选择', () => {
          this.selectedWeaponId = weapon.id;
          this.startRun(this.selectedStartFloor, mode, weapon.id);
        }, 'primary');
      }
    });
    this.addButton(layer, 640, 590, 190, 40, mode === 'daily' ? '返回每日挑战' : '返回楼层选择', () => {
      if (mode === 'daily') this.showDailyChallenge();
      else this.showMainline(this.selectedStartFloor);
    }, 'muted');
    this.overlay = layer;
  }

  private showStart() {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addMenuBackdrop(layer);
    // 病历档案入口对应玩家信息页，怪物图鉴暂时保留在内部供后续接入。
    const safe = this.safeGameRect(12);
    const buttonHeight = 132;
    const buttonGap = 2;
    const lastButtonY = safe.bottom - buttonHeight / 2;
    const firstButtonY = lastButtonY - (buttonHeight + buttonGap) * 2;
    this.addMenuImageButton(layer, safe.centerX, firstButtonY, 330, buttonHeight, 'menu-button-archive-v1', '病历档案', () => this.showProfile());
    this.addMenuImageButton(layer, safe.centerX, firstButtonY + buttonHeight + buttonGap, 330, buttonHeight, 'menu-button-mainline-v1', '主线通关', () => this.showMainline(this.floor));
    this.addMenuImageButton(layer, safe.centerX, lastButtonY, 330, buttonHeight, 'menu-button-daily-v1', '每日挑战', () => this.showDailyChallenge());
    this.overlay = layer;
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

  private showMainline(targetFloor = this.floor) {
    this.phase = 'mainline-select';
    this.ui?.setVisible(false);
    this.selectedStartFloor = clamp(Math.round(targetFloor), 1, Math.min(TOTAL_FLOORS, this.progress.maxFloor));
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.58);
    this.drawMenuMotif(layer);
    this.addPixelFrame(layer, 640, 360, 1120, 620, 0x101b24, 0x6bd3c1);
    const selected = this.selectedStartFloor;
    layer.add(this.add.text(640, 92, '主线通关', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '28px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(640, 126, 'MAINLINE / PATIENT ROUTE', { fontFamily: 'Courier New', fontSize: '11px', color: palette.cyan }).setOrigin(0.5));
    layer.add(this.add.rectangle(640, 153, 1000, 1, 0x46636a, 0.75));

    const progressPanel = this.add.container(345, 365);
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
    this.addButton(layer, 345, 565, 250, 48, `进入第 ${selected} 层`, () => this.showWeaponSelect('mainline', selected), 'primary', 10);

    const floorPanel = this.add.container(890, 365);
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
        this.addButton(layer, 890 + x, 365 + y, 208, 40, `${String(floor).padStart(2, '0')}  ${floor === selected ? '当前' : '已开放'}`, () => this.showMainline(floor), floor === selected ? 'primary' : 'muted', 6);
      } else {
        floorPanel.add(this.add.rectangle(x, y, 208, 40, 0x1b2930, 0.72).setStrokeStyle(1, 0x3b5158, 0.8));
        floorPanel.add(this.add.text(x, y, `${String(floor).padStart(2, '0')}  封锁`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '12px', color: palette.muted }).setOrigin(0.5));
      }
    }
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
    frame.add(this.add.rectangle(0, 0, width - 8, height - 8, fill, 0).setStrokeStyle(1, accent, 0.9));
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

  private dialogueLines() {
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
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'ward-day-v1', 0.28);
    this.drawMenuMotif(layer);
    this.addPixelFrame(layer, 640, 350, 980, 520, 0x101b24, 0x6bd3c1);
    const line = this.dialogueLines()[this.dialogueIndex];
    const playerActive = line.speaker === '小男孩';
    const npcLine = playerActive ? this.dialogueLines()[0] : line;
    layer.add(this.add.text(640, 116, `第 ${this.floor} 层 · ${this.floor === 1 ? '旧住院部' : '封锁病区'} / 入场记录`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '19px', color: palette.amber }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(640, 148, `对白记录 ${this.dialogueIndex + 1} / ${this.dialogueLines().length}`, { fontFamily: 'Courier New', fontSize: '12px', color: palette.muted }).setOrigin(0.5));
    const makePortrait = (x: number, active: boolean, isPlayer: boolean) => {
      const portrait = this.add.container(x, 420);
      const data = isPlayer ? { color: 0xf2bf62, role: '患者 / 0001', glyph: '男' } : { color: npcLine.color, role: npcLine.role, glyph: npcLine.glyph };
      portrait.add(this.add.rectangle(0, 0, 190, 220, 0x0a141b, 1).setStrokeStyle(2, data.color, active ? 1 : 0.5));
      if (isPlayer && this.textures.exists('patient-boy')) {
        this.addPatientSprite(portrait, 0, -6, 174);
      } else {
        portrait.add(this.add.circle(0, -34, 42, data.color, active ? 0.9 : 0.52).setStrokeStyle(2, 0x071015, 1));
        portrait.add(this.add.rectangle(0, 42, 62, 72, 0x29444b, active ? 1 : 0.7).setStrokeStyle(2, 0x071015, 1));
        portrait.add(this.add.text(0, -36, data.glyph, { fontFamily: 'Microsoft YaHei', fontSize: '26px', color: '#071015' }).setOrigin(0.5));
      }
      portrait.add(this.add.text(0, 96, data.role, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: active ? (isPlayer ? palette.amber : palette.cyan) : palette.muted }).setOrigin(0.5));
      portrait.setAlpha(active ? 1 : 0.62).setScale(active ? 1.06 : 0.88);
      layer.add(portrait);
    };
    makePortrait(285, playerActive, true);
    makePortrait(995, !playerActive, false);
    const bubble = this.add.container(640, 248);
    bubble.add(this.add.rectangle(0, 0, 620, 174, 0x071015, 0.9).setStrokeStyle(2, line.color, 0.92));
    bubble.add(this.add.rectangle(-299, -72, 5, 142, line.color, 0.9));
    bubble.add(this.add.triangle(playerActive ? -324 : 324, 68, playerActive ? 0 : 28, 0, playerActive ? 28 : 0, 0, playerActive ? 0 : 28, 28, line.color, 0.9));
    layer.add(bubble);
    layer.add(this.add.text(350, 195, line.speaker, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '22px', color: line.color === 0xf2bf62 ? palette.amber : palette.cream }).setOrigin(0, 0.5).setFontStyle('bold'));
    layer.add(this.add.text(350, 246, line.text, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '17px', color: palette.cream, lineSpacing: 10, wordWrap: { width: 540 } }).setOrigin(0, 0.5));
    layer.add(this.add.text(350, 492, '下一步将进入自动战斗。移动、拾取和升级由你决定。', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '12px', color: palette.muted, wordWrap: { width: 540 } }).setOrigin(0, 0.5));
    this.addButton(layer, 640, 548, 220, 46, this.dialogueIndex === this.dialogueLines().length - 1 ? '进入夜班' : '下一句', () => {
      if (this.dialogueIndex >= this.dialogueLines().length - 1) this.beginBattle();
      else { this.dialogueIndex += 1; this.showDialogue(); }
    }, 'primary', 10);
    this.addButton(layer, 640, 614, 160, 38, '跳过对白', () => this.beginBattle(), 'muted', 10);
    this.overlay = layer;
  }

  private beginBattle() {
    this.clearOverlay();
    this.phase = 'battle';
    this.ui?.setVisible(true);
    this.updateHud();
  }

  private showProfileLegacy() {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.56);
    this.drawMenuMotif(layer);
    this.addPixelFrame(layer, 640, 350, 820, 620, 0x101b24, 0xf2bf62);
    layer.add(this.add.text(640, 104, '我的 / PATIENT FILE', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '25px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(640, 140, '外观只改变显示效果，武器等级决定攻击方式。', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.muted }).setOrigin(0.5));
    const profile = this.add.container(360, 340);
    profile.add(this.add.rectangle(0, 0, 220, 280, 0x0a141b, 1).setStrokeStyle(2, 0xf2bf62, 0.9));
    if (!this.addPatientSprite(profile, 0, 6, 232)) {
      profile.add(this.add.circle(0, -70, 50, 0xf2bf62, 0.9).setStrokeStyle(2, 0x071015, 1));
      profile.add(this.add.rectangle(0, 28, 72, 88, 0x415c67, 1).setStrokeStyle(2, 0x071015, 1));
      profile.add(this.add.text(0, -72, '男', { fontFamily: 'Microsoft YaHei', fontSize: '30px', color: '#071015' }).setOrigin(0.5));
    }
    profile.add(this.add.text(0, 132, '患者 / 0001', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.amber }).setOrigin(0.5));
    layer.add(profile);
    const weapon = this.currentWeapon();
    layer.add(this.add.text(525, 230, '当前装备', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '14px', color: palette.muted }).setFontStyle('bold'));
    layer.add(this.add.text(525, 270, weapon ? `${weapon.name}  Lv.${weapon.level}` : '病院刀  Lv.1', { fontFamily: 'Microsoft YaHei', fontSize: '22px', color: palette.amber }).setFixedSize(390, 34));
    layer.add(this.add.text(525, 314, weapon ? `武器数量 ×${weapon.copies} · ${this.currentWeaponDamage(weapon)} 伤害` : '武器数量 ×1 · 24 伤害', { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.cream }).setFixedSize(390, 22));
    layer.add(this.add.text(525, 348, '已解锁外观', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '14px', color: palette.muted }).setFontStyle('bold'));
    layer.add(this.add.text(525, 384, weapon ? `${weapon.name} · ${this.weaponAppearanceLabel(weapon)}` : '病院刀 · 基础外观', { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.cream }).setFixedSize(390, 22));
    layer.add(this.add.text(525, 416, '武器外观随武器等级变化；皮肤外观只改变角色颜色和套装加成。', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.muted, wordWrap: { width: 390 } }).setFixedSize(390, 42));
    layer.add(this.add.text(525, 454, '已解锁皮肤', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.muted }).setFontStyle('bold'));
    this.skins.forEach((skin, index) => {
      const unlocked = this.progress.unlockedSkinIds.includes(skin.id);
      const y = 482 + index * 50;
      const setText = skin.setName ? ` · ${skin.setName}（${skin.setBuff}）` : '';
      layer.add(this.add.text(525, y, unlocked ? `${skin.name}${setText}` : '??? 未解锁', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: unlocked ? (skin.id === this.progress.equippedSkinId ? palette.amber : palette.cream) : palette.muted }).setFixedSize(245, 20));
      if (unlocked) {
        this.addButton(layer, 780, y + 2, 96, 24, skin.id === this.progress.equippedSkinId ? '已装备' : '装备', () => this.equipSkin(skin.id), skin.id === this.progress.equippedSkinId ? 'muted' : 'primary', 10);
      } else if (skin.id !== 'scarlet-night') {
        const cost = this.skinPurchaseCost(skin.id);
        this.addButton(layer, 780, y + 2, 96, 24, `购买 ${cost}`, () => this.buySkin(skin.id), 'primary', 10);
      }
    });
    layer.add(this.add.text(525, 652, `病例残页 ${this.progress.metaCoins} · 套装加成在进入战斗时生效`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '9px', color: palette.cyan }).setFixedSize(390, 14));
    this.addButton(layer, 88, 38, 150, 42, '返回主界面', () => this.showStart(), 'muted', 8);
    this.overlay = layer;
  }

  private showProfile() {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.56);
    this.drawMenuMotif(layer);
    this.addPixelFrame(layer, 640, 360, 1120, 620, 0x101b24, 0xf2bf62);
    layer.add(this.add.text(640, 92, '病历档案', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '28px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(640, 126, 'PATIENT FILE / WARD 07', { fontFamily: 'Courier New', fontSize: '11px', color: palette.cyan }).setOrigin(0.5));
    layer.add(this.add.rectangle(640, 153, 1000, 1, 0x46636a, 0.75));

    const previewSkin = this.skins.find((skin) => skin.id === this.profilePreviewSkinId) ?? this.skins[0];
    const profile = this.add.container(300, 380);
    profile.add(this.add.rectangle(0, 0, 350, 450, 0x0a141b, 0.98).setStrokeStyle(2, 0xf2bf62, 0.9));
    profile.add(this.add.text(-145, -196, '患者本人', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.amber }).setFontStyle('bold'));
    profile.add(this.add.text(145, -196, '预览', { fontFamily: 'Courier New', fontSize: '12px', color: palette.muted }).setOrigin(1, 0));
    const portrait = this.addPatientSprite(profile, 0, -22, 255);
    if (portrait && previewSkin.id !== 'patient-default') portrait.setTint(previewSkin.color);
    profile.add(this.add.rectangle(0, 72, 92, 110, previewSkin.color, previewSkin.id === 'patient-default' ? 0.08 : 0.2).setStrokeStyle(1, previewSkin.color, 0.5));
    profile.add(this.add.text(0, 158, this.playerNickname, { fontFamily: 'Microsoft YaHei', fontSize: '18px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    profile.add(this.add.text(0, 188, `患者编号 0001  /  ${previewSkin.name}`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '11px', color: palette.cyan }).setOrigin(0.5));
    layer.add(profile);

    layer.add(this.add.text(515, 184, '衣着记录', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.cream }).setFontStyle('bold'));
    layer.add(this.add.text(1160, 184, `创游货币  ${this.progress.metaCoins}`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.amber }).setOrigin(1, 0));
    layer.add(this.add.text(515, 210, '选择预览，解锁后即可装备', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.muted }));
    this.skins.forEach((skin, index) => {
      const unlocked = this.progress.unlockedSkinIds.includes(skin.id);
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 665 + column * 310;
      const y = 315 + row * 205;
      const card = this.add.container(x, y);
      const selected = skin.id === this.profilePreviewSkinId;
      card.add(this.add.rectangle(0, 0, 288, 176, 0x0a141b, 0.98).setStrokeStyle(selected ? 2 : 1, selected ? skin.color : 0x46636a, 0.95));
      const mini = this.addPatientSprite(card, -92, -3, 100);
      if (mini && skin.id !== 'patient-default') mini.setTint(skin.color);
      card.add(this.add.rectangle(-92, 30, 48, 48, skin.color, 0.16).setStrokeStyle(1, skin.color, 0.7));
      card.add(this.add.text(-20, -58, skin.name, { fontFamily: 'Microsoft YaHei', fontSize: '15px', color: unlocked ? palette.cream : palette.muted }).setOrigin(0, 0.5).setFontStyle('bold'));
      card.add(this.add.text(128, -58, unlocked ? (skin.id === this.progress.equippedSkinId ? '已装备' : '已解锁') : '已锁定', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: unlocked ? palette.green : palette.muted }).setOrigin(1, 0.5));
      card.add(this.add.text(-20, -25, skin.setName ? `${skin.setName}  ${skin.setBuff}` : '基础病号服', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.cyan, wordWrap: { width: 185 } }));
      card.add(this.add.text(-20, 7, unlocked ? '可直接装备' : skin.id === 'scarlet-night' ? '每日挑战 Boss 掉落' : `创游货币 ${this.skinPurchaseCost(skin.id)}`, { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: unlocked ? palette.muted : palette.amber, wordWrap: { width: 185 } }));
      layer.add(card);
      this.addButton(layer, x - 32, y + 61, 82, 28, '预览', () => this.previewSkin(skin.id), selected ? 'primary' : 'muted', 8);
      if (unlocked) {
        this.addButton(layer, x + 66, y + 61, 92, 28, skin.id === this.progress.equippedSkinId ? '已装备' : '装备', () => this.equipSkin(skin.id), skin.id === this.progress.equippedSkinId ? 'muted' : 'primary', 8);
      } else if (skin.id !== 'scarlet-night') {
        this.addButton(layer, x + 66, y + 61, 92, 28, `购买 ${this.skinPurchaseCost(skin.id)}`, () => this.buySkin(skin.id), 'primary', 8);
      }
    });
    this.addButton(layer, 88, 38, 150, 42, '返回主界面', () => this.showStart(), 'muted', 8);
    this.overlay = layer;
    if (!this.playerIdentityLoaded) {
      void this.ensurePlayerIdentity().then(() => { if (this.overlay === layer && layer.active) this.showProfile(); });
    }
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
    return id === 'cyan-ward' ? 20 : id === 'violet-dream' ? 15 : 999;
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
    const labels = ['基础外观', '裂纹外观', '霓虹外观', '深渊外观', '终焉外观'];
    return labels[clamp(Math.floor(weapon.level) - 1, 0, labels.length - 1)];
  }

  private showDailyChallengeLegacy(toast?: string) {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.56);
    this.addPixelFrame(layer, 640, 350, 820, 560, 0x101b24, 0xb798e2);
    layer.add(this.add.text(640, 104, '每日挑战 / DAILY NIGHT', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '25px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(640, 140, '当天解锁一关，使用主线已解锁的武器挑战 50 波。', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.muted }).setOrigin(0.5));
    this.addPixelFrame(layer, 640, 330, 610, 250, 0x0a141b, 0x46636a);
    const completed = this.isDailyCompleted();
    layer.add(this.add.text(640, 266, completed ? '今日挑战已锁定' : '今日挑战可进入', { fontFamily: 'Microsoft YaHei', fontSize: '24px', color: completed ? palette.muted : palette.violet }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(640, 312, completed ? '每日只能完成一次，明日刷新挑战资格。' : '选择主线已解锁的武器，完成 50 波挑战。', { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.cream }).setOrigin(0.5));
    layer.add(this.add.text(640, 360, '挑战规则：选定武器后不可更换。每次升级三选一，银色、金色、棱彩卡牌会组合出不同战斗流派。', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.muted, wordWrap: { width: 510 } }).setOrigin(0.5));
    layer.add(this.add.text(640, 400, '最终首领拥有范围技能和蓄力攻击，击败后可获得专属外观。', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.cyan }).setOrigin(0.5));
    if (!completed) this.addButton(layer, 640, 474, 220, 44, '选择武器并开始', () => this.showWeaponSelect('daily', 1), 'primary');
    if (toast) layer.add(this.add.text(640, 448, toast, { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.amber }).setOrigin(0.5));
    this.addButton(layer, 88, 38, 150, 42, '返回主界面', () => this.showStart(), 'muted');
    this.overlay = layer;
  }

  private showDailyChallenge(toast?: string) {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.56);
    this.drawMenuMotif(layer);
    this.addPixelFrame(layer, 640, 360, 1120, 620, 0x101b24, 0xb798e2);
    layer.add(this.add.text(640, 92, '每日挑战', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '28px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(640, 126, 'DAILY NIGHT / 50 WAVES', { fontFamily: 'Courier New', fontSize: '11px', color: palette.violet }).setOrigin(0.5));
    layer.add(this.add.rectangle(640, 153, 1000, 1, 0x46636a, 0.75));

    const completed = this.isDailyCompleted();
    const bossPanel = this.add.container(315, 385);
    bossPanel.add(this.add.rectangle(0, 0, 410, 450, 0x0a141b, 0.98).setStrokeStyle(2, 0xb798e2, 0.9));
    bossPanel.add(this.add.text(-170, -198, '今日首领', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.violet }).setFontStyle('bold'));
    bossPanel.add(this.add.text(170, -198, completed ? '已完成' : '待挑战', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: completed ? palette.green : palette.amber }).setOrigin(1, 0));
    if (this.textures.exists('boss-moon-wolf')) {
      bossPanel.add(this.add.image(0, -42, 'boss-moon-wolf').setOrigin(0.5).setDisplaySize(310, 210));
    } else {
      bossPanel.add(this.add.circle(0, -42, 74, 0x24353c, 1).setStrokeStyle(2, 0xb798e2, 1));
      bossPanel.add(this.add.text(0, -42, 'BOSS', { fontFamily: 'Courier New', fontSize: '24px', color: palette.violet }).setOrigin(0.5));
    }
    bossPanel.add(this.add.text(0, 92, '月蚀狼王', { fontFamily: 'Microsoft YaHei', fontSize: '22px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    bossPanel.add(this.add.text(0, 126, '范围攻击  /  追踪爆裂', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.cyan }).setOrigin(0.5));
    bossPanel.add(this.add.text(0, 157, completed ? '首领外观已加入病历档案' : '击败后获得首领外观', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.muted }).setOrigin(0.5));
    layer.add(bossPanel);
    if (!completed) this.addButton(layer, 315, 582, 220, 44, '选择武器', () => this.showWeaponSelect('daily', 1), 'primary', 10);
    if (toast) layer.add(this.add.text(315, 622, toast, { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.amber }).setOrigin(0.5));

    const boardPanel = this.add.container(895, 385);
    boardPanel.add(this.add.rectangle(0, 0, 540, 450, 0x0a141b, 0.98).setStrokeStyle(2, 0x46636a, 0.9));
    boardPanel.add(this.add.text(-238, -198, '排行榜', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.cream }).setFontStyle('bold'));
    boardPanel.add(this.add.text(238, -198, '今日战绩', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '11px', color: palette.muted }).setOrigin(1, 0));
    boardPanel.add(this.add.rectangle(0, -163, 470, 1, 0x46636a, 0.75));
    boardPanel.add(this.add.text(-220, -147, '名次', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.muted }));
    boardPanel.add(this.add.text(-155, -147, '患者', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.muted }));
    boardPanel.add(this.add.text(220, -147, '分数', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: palette.muted }).setOrigin(1, 0));
    const board = this.dailyBoard.map((entry) => entry.name === this.playerNickname && this.progress.dailyBestSeconds ? { ...entry, score: this.dailyScoreForTime(this.progress.dailyBestSeconds) } : entry);
    board.slice(0, 5).forEach((entry, index) => {
      const y = -105 + index * 48;
      const own = entry.name === this.playerNickname;
      boardPanel.add(this.add.rectangle(0, y + 14, 470, 38, own ? 0x18353b : 0x101b24, own ? 0.9 : 0.72).setStrokeStyle(1, own ? 0x6bd3c1 : 0x26383f, 0.9));
      boardPanel.add(this.add.text(-220, y + 14, String(entry.rank).padStart(2, '0'), { fontFamily: 'Courier New', fontSize: '14px', color: entry.rank === 1 ? palette.amber : palette.cream }).setOrigin(0, 0.5));
      boardPanel.add(this.add.text(-155, y + 14, entry.name, { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: own ? palette.teal : palette.cream }).setOrigin(0, 0.5));
      boardPanel.add(this.add.text(220, y + 14, entry.score > 0 ? `${entry.score}` : '未通关', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: entry.score > 0 ? palette.amber : palette.muted }).setOrigin(1, 0.5));
    });
    boardPanel.add(this.add.rectangle(0, 151, 470, 1, 0x46636a, 0.75));
    boardPanel.add(this.add.text(-220, 174, '最快通关', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.muted }));
    boardPanel.add(this.add.text(220, 174, this.formatDailyTime(this.progress.dailyBestSeconds), { fontFamily: 'Courier New', fontSize: '22px', color: this.progress.dailyBestSeconds ? palette.green : palette.muted }).setOrigin(1, 0));
    layer.add(boardPanel);
    this.addButton(layer, 88, 38, 150, 42, '返回主界面', () => this.showStart(), 'muted', 8);
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
    this.addPixelFrame(layer, 640, 350, 980, 570, 0x101b24, 0x7ab9d0);
    layer.add(this.add.text(640, 92, '病历档案 / ARCHIVE', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '25px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(640, 128, '遇到异常体后解锁记录；未遇到的条目保留为问号剪影。', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: palette.muted }).setOrigin(0.5));

    const entries: Array<{ kind: EnemyKind; name: string; skill: string; wave: number }> = [
      { kind: 'chaser', name: '追猎异常体', skill: '近身追击，接触时造成伤害', wave: 1 },
      { kind: 'shooter', name: '投射病患', skill: '保持距离发射追踪弹', wave: 3 },
      { kind: 'disruptor', name: '干扰体', skill: '脚下生成范围干扰波', wave: 6 },
      { kind: 'tentacle', name: '触手病灶', skill: '远距离横扫，预警范围较大', wave: 9 },
      { kind: 'bomber', name: '爆裂病灶', skill: '锁定位置后延迟爆炸', wave: 12 },
      { kind: 'eye', name: '窥视之眼', skill: '直线激光，命中后造成重击', wave: 15 },
    ];
    layer.add(this.add.text(640, 164, '异常体图鉴', { fontFamily: 'Microsoft YaHei', fontSize: '17px', color: palette.cyan }).setOrigin(0.5).setFontStyle('bold'));
    entries.forEach((entry, index) => {
      const unlocked = this.archiveKindUnlocked(entry.kind);
      const x = 350 + (index % 3) * 290;
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
    layer.add(this.add.text(640, 382, '首领图鉴', { fontFamily: 'Microsoft YaHei', fontSize: '17px', color: palette.amber }).setOrigin(0.5).setFontStyle('bold'));
    bossEntries.forEach((entry, index) => {
      const unlocked = this.archiveKindUnlocked(entry.kind);
      const x = 490 + index * 300;
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

    layer.add(this.add.text(640, 520, `已记录 ${this.progress.archiveKinds.length} 项 · 当前推进至第 ${this.floor} 层 / 共 ${TOTAL_FLOORS} 层`, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '12px', color: palette.cyan }).setOrigin(0.5));
    this.addButton(layer, 640, 590, 190, 44, '返回主界面', () => this.showStart(), 'muted');
    this.overlay = layer;
  }

  private showSettings() {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.58);
    this.addPixelFrame(layer, 640, 350, 700, 500, 0x101b24, 0x8fd17c);
    layer.add(this.add.text(640, 116, '夜班设置 / OPTIONS', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '25px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(640, 154, '设置只影响表现，不改变本层战斗数值。', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.muted }).setOrigin(0.5));
    const setting = (y: number, label: string, value: boolean, callback: () => void) => {
      layer.add(this.add.text(430, y - 9, label, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '16px', color: palette.cream }));
      this.addButton(layer, 770, y, 160, 38, value ? '开启' : '关闭', callback, value ? 'primary' : 'muted');
    };
    setting(234, '受击震动', this.screenShakeEnabled, () => { this.screenShakeEnabled = !this.screenShakeEnabled; this.showSettings(); });
    setting(302, '数字伤害', this.damageNumbersEnabled, () => { this.damageNumbersEnabled = !this.damageNumbersEnabled; this.showSettings(); });
    layer.add(this.add.text(640, 414, '推荐横屏 16:9 · 支持触摸摇杆与键盘调试', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.cyan }).setOrigin(0.5));
    this.addButton(layer, 640, 560, 190, 44, '返回主界面', () => this.showStart(), 'muted');
    this.overlay = layer;
  }

  private showHelp() {
    this.phase = 'start';
    this.ui?.setVisible(false);
    this.clearOverlay();
    const layer = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.addHospitalBackdrop(layer, 'menu-ward-night-v1', 0.58);
    this.addPixelFrame(layer, 640, 350, 780, 500, 0x101b24, 0xf2bf62);
    layer.add(this.add.text(640, 116, '夜班手册 / FIELD MANUAL', { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '25px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    const help = [
      ['移动', '在屏幕任意位置按住并拖动，松开手指即可停下。'],
      ['攻击', '武器会自动环绕并攻击，武器数越多覆盖越广。'],
      ['成长', '拾取绿色经验，升级时从三张医嘱卡中选择一张。'],
      ['SAN', 'SAN 归零会进入暴走与变异倒计时，风险和伤害同时上升。'],
      ['成长', '击杀敌人获得经验，升级时选择卡牌；卡牌前两次可免费刷新。'],
    ];
    help.forEach(([title, detail], index) => {
      const y = 198 + index * 52;
      layer.add(this.add.text(424, y, title, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '16px', color: palette.amber }).setFontStyle('bold'));
      layer.add(this.add.text(536, y, detail, { fontFamily: 'Courier New, Microsoft YaHei', fontSize: '13px', color: palette.cream, wordWrap: { width: 400 } }));
    });
    this.addButton(layer, 640, 566, 190, 44, '返回主界面', () => this.showStart(), 'muted');
    this.overlay = layer;
  }

  private startRun(targetFloor = this.floor, mode: RunMode = this.runMode, weaponId = this.selectedWeaponId) {
    this.releaseJoystick();
    this.clearOverlay();
    this.clearRunObjects();
    this.runMode = mode;
    this.floor = mode === 'daily' ? 1 : clamp(Math.round(targetFloor), 1, Math.min(TOTAL_FLOORS, this.progress.maxFloor));
    this.selectedWeaponId = weaponId;
    this.phase = 'dialogue';
    this.dialogueIndex = 0;
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
    this.elapsed = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.shield = 0;
    this.maxShield = 0;
    this.san = 100;
    this.xp = 0;
    this.level = 1;
    this.xpNeed = experienceRequiredForLevel(1);
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
    if (starting) { starting.level = 1; starting.copies = 1; starting.ammo = 1; }
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
    this.playerSprite = undefined;
    const skinColor = this.skins.find((skin) => skin.id === this.progress.equippedSkinId)?.color ?? 0xe7c28b;
    this.playerGlow = this.add.circle(0, 0, 32, this.mutated ? 0xed716e : 0x6bd3c1, 0.14);
    this.player.add(this.playerGlow);
    this.player.add(this.add.circle(0, 6, 26, this.mutated ? 0xed716e : skinColor, 0.2).setStrokeStyle(1, skinColor, 0.8));
    this.playerSpriteTargetHeight = 82;
    this.playerSprite = this.addPlayerSprite(this.player, 0, 5, this.playerSpriteTargetHeight);
    if (!this.playerSprite) {
      this.player.add(this.add.circle(0, 2, 18, this.mutated ? 0x9a3846 : skinColor, 1).setStrokeStyle(2, 0x17262d, 1));
      this.player.add(this.add.rectangle(0, 23, 22, 21, this.mutated ? 0x8b3446 : 0x415c67, 1).setStrokeStyle(2, 0x17262d, 1));
      this.player.add(this.add.text(0, -3, '男', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: '#17262d' }).setOrigin(0.5));
    }
    this.heldWeapons = [];
    this.heldWeapon = undefined;
    this.updateHeldWeaponVisual();
    this.world.add(this.player);
  }

  private addPlayerSprite(parent: Phaser.GameObjects.Container, x: number, y: number, targetHeight: number) {
    if (!this.textures.exists('patient-boy')) return undefined;
    const sprite = this.add.sprite(x, y, 'patient-boy').setOrigin(0.5);
    sprite.setDisplaySize(targetHeight * sprite.width / sprite.height, targetHeight);
    parent.add(sprite);
    return sprite;
  }

  private addPatientSprite(parent: Phaser.GameObjects.Container, x: number, y: number, targetHeight: number) {
    if (!this.textures.exists('patient-boy')) return undefined;
    const textureKey = this.textures.exists('patient-idle-front') ? 'patient-idle-front' : 'patient-boy';
    const sprite = this.add.image(x, y, textureKey).setOrigin(0.5);
    sprite.setDisplaySize(targetHeight * sprite.width / sprite.height, targetHeight);
    parent.add(sprite);
    return sprite;
  }

  private playPlayerAnimation(animation: PlayerAnimation, force = false) {
    const sprite = this.playerSprite;
    if (!sprite) return;
    if (animation === 'idle') {
      if (force || this.playerAnimation !== 'idle') {
        sprite.anims.stop();
        if (this.textures.exists('patient-idle-front')) sprite.setTexture('patient-idle-front');
        else {
          const idleKey = `patient-walk-${this.playerDirection}`;
          if (this.textures.exists(idleKey)) sprite.setTexture(idleKey, 0);
          else sprite.setTexture('patient-boy');
        }
        sprite.setDisplaySize(this.playerSpriteTargetHeight, this.playerSpriteTargetHeight);
      }
      this.playerAnimation = 'idle';
      return;
    }
    const key = `patient-${animation}`;
    if (!this.textures.exists(key)) return;
    if (!force && this.playerAnimation === animation && sprite.anims.isPlaying) return;
    sprite.setTexture(key, 0);
    sprite.setDisplaySize(this.playerSpriteTargetHeight, this.playerSpriteTargetHeight);
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
    this.player.x = clamp(this.player.x + x * this.runSpeed * dt, WORLD_BOUNDS.left + 44, WORLD_BOUNDS.right - 44);
    this.player.y = clamp(this.player.y + y * this.runSpeed * dt, WORLD_BOUNDS.top + 44, WORLD_BOUNDS.bottom - 44);
    if (this.playerHitTimer > 0) this.playPlayerAnimation('hit');
    else this.playPlayerAnimation(moving ? `walk-${this.playerDirection}` : 'idle');
    const frenzy = this.sanLowActive || this.frenzyActive || this.mutationTimer > 0 || this.mutated;
    this.playerGlow.setFillStyle(frenzy ? 0xed716e : 0x6bd3c1);
    this.playerGlow.setAlpha(frenzy ? 0.22 + (Math.sin(this.sanPulse * 10) + 1) * 0.06 : 0.14);
    this.playerGlow.setScale(frenzy ? 1.08 + (Math.sin(this.sanPulse * 10) + 1) * 0.05 : 1);
  }

  private spawnWaveEnemy() {
    if (this.waveTimer >= this.waveLength || this.waveSpawned >= this.spawnBudgetForWave()) return;
    const available: EnemyKind[] = ['chaser'];
    if (this.wave >= 3) available.push('shooter');
    if (this.wave >= 6) available.push('disruptor');
    if (this.wave >= 9) available.push('tentacle');
    if (this.wave >= 12) available.push('bomber');
    if (this.wave >= 15) available.push('eye');
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
    const hp = Math.max(1, Math.round(baseHp * hpScale));
    const { radius } = stats;
    const { x, y } = this.findSpawnPoint(radius);
    const node = this.add.container(x, y).setDepth(7);
    const color = this.enemyColor(kind);
    const shape = kind === 'chaser' ? this.add.rectangle(0, 0, radius * 2, radius * 2, color, 1).setAngle(45) : kind === 'tentacle' ? this.add.star(0, 0, 8, radius * 0.55, radius, color, 1) : kind === 'eye' ? this.add.ellipse(0, 0, radius * 2.2, radius * 1.45, color, 1) : this.add.circle(0, 0, radius, color, 1);
    node.add(shape.setStrokeStyle(isBoss ? 3 : 1, 0x101820, 1));
    node.add(this.add.text(0, 0, this.enemyGlyph(kind), { fontFamily: 'Microsoft YaHei', fontSize: `${isBoss ? 20 : 12}px`, color: '#101820' }).setOrigin(0.5));
    const hpBar = this.add.graphics();
    hpBar.fillStyle(0x101820, 0.8).fillRect(-radius - 4, -radius - 12, radius * 2 + 8, 4);
    hpBar.fillStyle(color, 1).fillRect(-radius - 4, -radius - 12, radius * 2 + 8, 4);
    node.add(hpBar);
    this.world.add(node);
    const enemy: Enemy = { kind, node, baseHp, hpScale, hp, maxHp: hp, speed: stats.speed, damage: stats.damage, radius, attackCd: 0.2, shootCd: 1.8, areaCd: 2.5, flash: 0, meleeHitCd: 0, deathTimer: 0, statusTimer: 0, statusTick: 0 };
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
      if (active.every((enemy) => distance(enemy.node, point) >= Math.max(44, enemy.radius + radius + 8))) return point;
    }
    return fallback;
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
    return this.runMode === 'daily' ? 50 : 20;
  }

  private isMiniBossWave() {
    return this.runMode === 'daily' ? this.wave === 25 : this.wave === 7;
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
    if (this.frenzyActive) return 0.42;
    if (this.sanLowActive) return 0.55;
    if (this.mutationTimer > 0 || this.mutated) return 0.62;
    return 1;
  }

  private enemyDamageMultiplier() {
    let multiplier = 1;
    if (this.frenzyActive) multiplier *= 1.35;
    else if (this.sanLowActive) multiplier *= 1.15;
    else if (this.mutationTimer > 0 || this.mutated) multiplier *= 1.3;
    if (this.runMode === 'daily') multiplier *= dailyWaveScaling(this.wave).damageMultiplier;
    return multiplier;
  }

  private enemyAttackDamage(enemy: Enemy, amount: number) {
    return amount * this.enemyDamageMultiplier() * (enemy.status === 'weaken' ? 0.65 : 1);
  }

  private incomingDamageMultiplier() {
    let multiplier = this.mutationTimer > 0 || this.mutated ? 1.22 : 1;
    if (this.dailyBloodPact > 0) multiplier *= 1 + this.dailyBloodPact * 0.08;
    return multiplier;
  }

  private shieldAbsorptionMultiplier() {
    if (this.frenzyActive) return 0.65;
    if (this.sanLowActive) return 0.85;
    if (this.mutationTimer > 0 || this.mutated) return 0.78;
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
        if (dist < 290) this.moveEnemy(enemy, dt, -0.7);
        else if (dist > 430) this.moveEnemy(enemy, dt, 0.45);
        if (enemy.shootCd <= 0 && dist < 620) {
          enemy.shootCd = 3.2;
          this.enemyBomb(enemy);
        }
      } else if (enemy.kind === 'eye') {
        if (dist < 310) this.moveEnemy(enemy, dt, -0.45);
        else if (dist > 520) this.moveEnemy(enemy, dt, 0.35);
        if (enemy.shootCd <= 0 && dist < 620) {
          enemy.shootCd = 2.8;
          this.enemyBeam(enemy);
        }
      } else if (enemy.kind === 'tentacle') {
        if (dist > 190) this.moveEnemy(enemy, dt, 0.75);
        if (enemy.areaCd <= 0) {
          enemy.areaCd = 3.2;
          this.createAreaWarning(enemy.node.x, enemy.node.y, 190, 0x9a6bd1);
          if (dist < 190) this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage * 1.1), '触手横扫');
        }
      } else if (enemy.kind === 'shooter') {
        if (dist > 230) this.moveEnemy(enemy, dt, 1);
        if (enemy.shootCd <= 0 && dist < 480) {
          enemy.shootCd = 2.3;
          this.enemyShot(enemy);
        }
      } else if (enemy.kind === 'disruptor') {
        if (dist > 160) this.moveEnemy(enemy, dt, 0.75);
        if (enemy.areaCd <= 0) {
          enemy.areaCd = 3.8;
          this.createAreaWarning(enemy.node.x, enemy.node.y, 150, 0xb798e2);
          if (dist < 150) this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage * 1.1), '干扰波');
        }
      } else {
        this.moveEnemy(enemy, dt, 1);
        if (dist < enemy.radius + 24 && enemy.attackCd <= 0) {
          enemy.attackCd = 1.45;
          this.hitPlayer(this.enemyAttackDamage(enemy, enemy.damage), '异常体');
        }
      }
      if (enemy.flash > 0) enemy.node.setAlpha(0.55); else enemy.node.setAlpha(1);
      const hpBar = (enemy.node as Phaser.GameObjects.Container & { hpBar?: Phaser.GameObjects.Graphics }).hpBar;
      hpBar?.clear().fillStyle(0x101820, 0.8).fillRect(-enemy.radius - 4, -enemy.radius - 12, enemy.radius * 2 + 8, 5).fillStyle(this.enemyColor(enemy.kind), 1).fillRect(-enemy.radius - 4, -enemy.radius - 12, (enemy.radius * 2 + 8) * Math.max(0, enemy.hp / enemy.maxHp), 5);
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
    enemy.node.x += (dx / len) * enemy.speed * multiplier * slow * dt;
    enemy.node.y += (dy / len) * enemy.speed * multiplier * slow * dt;
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
        this.fireLine(target, weapon.color, index * 0.02, weapon.effect);
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
      this.fireLine(target, weapon.color, shot * 0.02, weapon.effect);
    }
  }

  private meleeBladeSegment(weapon: Weapon, angle = this.weaponAngle) {
    const innerRadius = 16;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    return {
      start: {
        x: this.player.x + direction.x * innerRadius,
        y: this.player.y + direction.y * innerRadius,
      },
      end: {
        x: this.player.x + direction.x * weapon.range,
        y: this.player.y + direction.y * weapon.range,
      },
    };
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
    return Math.round(base * (this.frenzyActive || this.sanLowActive ? 1.35 : 1));
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
    enemy.statusMarker = this.add.text(0, -enemy.radius - 18, labels[status], { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: colors[status], stroke: '#0b1117', strokeThickness: 3 }).setOrigin(0.5);
    enemy.node.add(enemy.statusMarker);
    this.floatText(enemy.node.x, enemy.node.y - enemy.radius - 26, `${status === 'poison' ? '中毒' : status === 'burn' ? '燃烧' : '虚弱'}`, colors[status]);
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
    this.floatText(this.player.x, this.player.y - 55, `${labels[nextStatus]}提升至 Lv.${this.attackStatusLevel}`, palette.amber);
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
    if (this.hp < this.maxHp) {
      this.hp = clamp(this.hp + amount, 0, this.maxHp);
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
      this.maxHp += 24;
      this.hp = clamp(this.hp + 24, 0, this.maxHp);
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
    if (this.damageNumbersEnabled) this.floatText(enemy.node.x, enemy.node.y - enemy.radius - 15, `-${Math.round(amount)}`, hex(color));
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private fireLine(target: Enemy, color: number, delay: number, effect: WeaponEffect) {
    this.time.delayedCall(delay * 1000, () => {
      if (!target.node.active || target.dead || this.phase !== 'battle') return;
      const line = this.add.graphics().setDepth(9);
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.node.x, target.node.y);
      const lineWidth = effect === 'beam' || effect === 'laser' ? 6 : effect === 'slash' || effect === 'tentacle' ? 4 : 2;
      const originX = effect === 'slash' && this.heldWeapon ? this.player.x + this.heldWeapon.x : this.player.x;
      const originY = effect === 'slash' && this.heldWeapon ? this.player.y + this.heldWeapon.y : this.player.y;
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
    });
  }

  private killEnemy(enemy: Enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    enemy.deathTimer = 0.8;
    const marker = this.add.text(0, -enemy.radius - 8, 'X', { fontFamily: 'Arial', fontSize: '18px', color: '#f4e8c9', stroke: '#0b1117', strokeThickness: 3 }).setOrigin(0.5);
    enemy.node.add(marker);
    this.tweens.add({ targets: marker, y: -enemy.radius - 30, alpha: 0, duration: 800, onComplete: () => marker.destroy() });
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
    node.add(this.add.circle(0, 0, 8, colors[kind], 0.9).setStrokeStyle(1, 0x0b1117, 1));
    node.add(this.add.text(0, 0, glyphs[kind], { fontFamily: 'Microsoft YaHei', fontSize: '9px', color: '#0b1117' }).setOrigin(0.5));
    this.world.add(node);
    this.drops.push({ node, kind, value, ttl: 12, attracted: false });
  }

  private hitPlayer(amount: number, source: string) {
    if (this.phase !== 'battle' || this.playerDeathPending) return;
    const incoming = amount * this.incomingDamageMultiplier();
    const absorbed = Math.min(this.shield, incoming * this.shieldAbsorptionMultiplier());
    this.shield = Math.max(0, this.shield - absorbed);
    const healthDamage = incoming - absorbed;
    this.hp = clamp(this.hp - healthDamage, 0, this.maxHp);
    if (absorbed > 0 && this.dailyShieldRetaliation > 0) {
      const target = this.enemies
        .filter((enemy) => !enemy.dead)
        .sort((a, b) => distance(a.node, this.player) - distance(b.node, this.player))[0];
      if (target) this.damageEnemy(target, this.dailyShieldRetaliation, 0x7ab9d0);
    }
    this.san = clamp(this.san - incoming * 1.2, 0, 100);
    if (this.san <= 0 && !this.mutated && !this.frenzyAvailable && !this.frenzyActive) this.beginSanCollapse();
    const hitLabel = absorbed > 0
      ? `${source} 护盾吸收 ${Math.round(absorbed)}${healthDamage > 0 ? ` · 生命 -${Math.round(healthDamage)}` : ''}`
      : `${source} 生命 -${Math.round(healthDamage)}`;
    this.floatText(this.player.x, this.player.y - 42, hitLabel, absorbed > 0 ? palette.cyan : palette.danger);
    this.cameras.main.flash(90, 180, 65, 65, false);
    if (this.screenShakeEnabled) this.cameras.main.shake(120, 0.006);
    this.playerHitTimer = 0.3;
    this.playPlayerAnimation('hit', true);
    this.tweens.add({ targets: this.player, scaleX: 1.14, scaleY: 0.88, yoyo: true, duration: 90 });
    if (this.hp <= 0) {
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
        this.floatText(this.player.x, this.player.y - 55, '低 SAN 暴走结束 · 刷怪恢复', palette.cyan);
      }
    }
    if (this.frenzyActive) {
      this.frenzyTimer -= dt;
      if (this.frenzyTimer <= 0) {
        this.frenzyTimer = 0;
        this.frenzyActive = false;
        this.san = 35;
        this.floatText(this.player.x, this.player.y - 55, '暴走结束 · SAN 暂时稳定', palette.cyan);
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
        this.floatText(this.player.x, this.player.y - 55, '变异完成 · 伤害提升', palette.danger);
        this.updateWardBackground();
      }
    }
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
    this.floatText(this.player.x, this.player.y - 62, `裂隙脉冲 · ${targets.length} 个目标`, '#d9b9ff');
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
    this.floatText(this.player.x, this.player.y - 55, 'SAN 归零 · 暴走技能已就绪', palette.danger);
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
    this.floatText(this.player.x, this.player.y - 55, '暴走启动 · 伤害提升 / 护盾减弱', palette.danger);
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
      case 'weapon':
        g.strokeRect(-12, -2, 24, 13);
        g.lineBetween(0, -16, 0, -3);
        g.lineBetween(0, -16, -6, -10);
        g.lineBetween(0, -16, 6, -10);
        g.lineBetween(-8, 11, 8, 11);
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
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x071015, 0.74));
    this.addPixelFrame(layer, 640, 350, 940, 560, 0x101b24, 0xb798e2);
    layer.add(this.add.text(640, 84, `升级 Lv.${this.level}`, { fontFamily: 'Microsoft YaHei', fontSize: '28px', color: palette.cream }).setOrigin(0.5).setFontStyle('bold'));
    const tier = this.upgradeCardTier();
    layer.add(this.add.text(640, 122, `随机三选一 · 卡牌等级 Lv.${tier} · 选择后继续战斗`, { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: palette.muted }).setOrigin(0.5));
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
      : ' · 特效 Lv.3 解锁击杀传播';
    const statusDetail = `${status === 'weaken' ? '敌人伤害 -35% · ' : ''}每 0.8 秒 ${tickDamage} 伤害 · 持续 ${statusDuration} 秒${spreadDetail}`;
    const pool: UpgradeDef[] = [
      {
        title: `移速提升 · Lv.${tier}`,
        detail: `移动速度 +${movePercent}%`,
        color: 0x7ab9d0,
        rarity: tier >= 3 ? 'gold' : tier >= 2 ? 'purple' : 'blue',
        icon: 'move',
        apply: () => { this.runSpeed *= 1 + movePercent / 100; },
      },
      {
        title: `武器强化 · Lv.${tier}`,
        detail: `当前武器伤害 +${damageAmount}，持续本层`,
        color: 0xed716e,
        rarity: tier >= 3 ? 'gold' : tier >= 2 ? 'purple' : 'blue',
        icon: 'damage',
        apply: () => this.applyRoundDamageBuff(damageAmount),
      },
      {
        title: `生命 / 护盾 · Lv.${tier}`,
        detail: `生命不足时恢复 ${sustainAmount}；满血时转为护盾`,
        color: 0x8fd17c,
        rarity: tier >= 3 ? 'gold' : tier >= 2 ? 'purple' : 'blue',
        icon: 'sustain',
        apply: () => this.applyHealthShieldUpgrade(sustainAmount),
      },
      {
        title: `攻速提升 · Lv.${tier}`,
        detail: `当前武器转速 +${growthPercent}%`,
        color: 0xb798e2,
        rarity: tier >= 3 ? 'gold' : tier >= 2 ? 'purple' : 'blue',
        icon: 'growth',
        apply: () => this.applyCardWeaponGrowth(),
      },
      {
        title: `${this.activeAttackStatus ? '强化' : '攻击特效：'}${statusNames[status]} · 特效 Lv.${statusGrowth.level}`,
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
        title: `升级武器数 · Lv.${tier}`,
        detail: `当前武器数量 ${weapon.copies} → ${weapon.copies + 1}，围绕主角均匀旋转`,
        color: 0x7ab9d0,
        rarity: tier >= 3 ? 'gold' : tier >= 2 ? 'purple' : 'blue',
        icon: 'copies',
        apply: () => this.applyWeaponCopiesUpgrade(),
      });
    }
    const nextWeapon = this.strongerWeapon();
    if (nextWeapon && this.runMode !== 'daily') {
      pool.push({
        title: '升级武器',
        detail: `${weapon?.name ?? '当前武器'} → ${nextWeapon.name}，伤害 ${nextWeapon.damage}`,
        color: 0xf2bf62,
        rarity: 'gold',
        icon: 'weapon',
        apply: () => this.upgradeWeapon(),
      });
    }
    const choices = Phaser.Utils.Array.Shuffle(pool).slice(0, 3);
    if (this.runMode === 'daily' && choices.every((choice) => choice.rarity === 'blue')) {
      const special = Phaser.Utils.Array.GetRandom(pool.filter((choice) => choice.rarity === 'purple' || choice.rarity === 'gold'));
      if (special) choices[2] = special;
    }
    choices.forEach((choice, index) => {
      const x = 390 + index * 250;
      const cardWidth = 228;
      const cardHeight = 342;
      const card = this.add.container(x, 325).setSize(cardWidth, cardHeight).setInteractive({ useHandCursor: true });
      const rarity = choice.rarity ?? 'blue';
      const rarityLabel: Record<UpgradeCardRarity, string> = { blue: '蓝色', purple: '紫色', gold: '金色' };
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
      const iconHalo = this.add.circle(0, -22, 35, choice.color, 0.16).setStrokeStyle(2, choice.color, 0.82);
      card.add(iconHalo);
      this.upgradeCardIcon(card, choice.icon ?? 'effect', 0, -22, choice.color);
      card.add(this.add.text(0, 61, rarityLabel[rarity], {
        fontFamily: 'Microsoft YaHei',
        fontSize: '12px',
        color: cardTextColor,
        align: 'center',
      }).setOrigin(0.5).setFontStyle('bold'));
      const titleSize = choice.title.length > 11 ? 14 : 16;
      const detailSize = choice.detail.length > 42 ? 9 : 10;
      card.add(this.add.text(0, 94, choice.title, {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${titleSize}px`,
        color: cardTextColor,
        align: 'center',
        wordWrap: { width: 176 },
        lineSpacing: 2,
      }).setOrigin(0.5).setFixedSize(184, 42).setFontStyle('bold'));
      card.add(this.add.text(0, 132, choice.detail, {
        fontFamily: 'Microsoft YaHei',
        fontSize: `${detailSize}px`,
        color: cardDetailColor,
        align: 'center',
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
    this.addButton(layer, 475, 580, 280, 42, refreshLabel, () => { void this.refreshUpgradeCards(); }, refreshStyle, 4);
    layer.add(this.add.text(805, 580, `未使用经验 ${Math.floor(this.xp)}`, { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: palette.muted }).setOrigin(0, 0.5));
    if (this.upgradePaymentMessage) {
      layer.add(this.add.text(640, 612, this.upgradePaymentMessage, {
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
    if (!win) {
      layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000204, 1));
      layer.add(this.add.text(640, 190, '你的大脑被大量怪物占据，失去意识...', {
        fontFamily: 'Microsoft YaHei',
        fontSize: '27px',
        color: palette.cream,
        stroke: '#13090d',
        strokeThickness: 7,
        align: 'center',
        wordWrap: { width: 760 },
      }).setOrigin(0.5).setFontStyle('bold'));
      layer.add(this.add.text(640, 270, `第 ${this.floor} 层 · 第 ${this.wave} 波`, {
        fontFamily: 'Courier New, Microsoft YaHei',
        fontSize: '15px',
        color: palette.danger,
      }).setOrigin(0.5));
      this.addMenuImageButton(layer, 640, 430, 330, 124, 'menu-button-mainline-v1', '重新挑战', () => {
        this.startRun(this.floor, this.runMode, this.selectedWeaponId);
      });
      this.addMenuImageButton(layer, 640, 590, 330, 124, 'menu-button-archive-v1', '回到标题', () => this.showStart());
      this.overlay = layer;
      return;
    }
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x071015, 0.94));
    this.addPixelFrame(layer, 640, 350, 650, 370, 0x101b24, win ? 0x8fd17c : 0xed716e);
    const finalFloor = this.floor >= TOTAL_FLOORS;
    const resultTitle = win
      ? this.runMode === 'daily' ? '每日挑战完成' : finalFloor ? `全部 ${TOTAL_FLOORS} 层清除完成` : `第 ${this.floor} 层清除完成`
      : '失去意识';
    const resultDetail = win
      ? this.runMode === 'daily' ? '50 波挑战完成，已解锁首领专属外观。' : finalFloor ? `第 ${TOTAL_FLOORS} 层已清理完成。病区暂时恢复安静。` : `第 ${this.floor} 层已清理完成。准备进入第 ${this.floor + 1} 层。`
      : `你倒在第 ${this.floor} 层第 ${this.wave} 波。当前楼层会保留，重开从第 1 波开始。`;
    layer.add(this.add.text(640, 206, resultTitle, { fontFamily: 'Microsoft YaHei', fontSize: '34px', color: win ? palette.green : palette.danger }).setOrigin(0.5).setFontStyle('bold'));
    layer.add(this.add.text(640, 264, resultDetail, { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: palette.cream, align: 'center', wordWrap: { width: 520 } }).setOrigin(0.5));
    layer.add(this.add.text(640, 334, `击破 ${this.kills} · 等级 ${this.level}`, { fontFamily: 'Microsoft YaHei', fontSize: '15px', color: palette.muted }).setOrigin(0.5));
    this.addButton(layer, 640, 438, 240, 52, win ? (this.runMode === 'daily' ? '返回每日挑战' : finalFloor ? '从第 1 层再打一遍' : `进入第 ${this.floor + 1} 层`) : `从第 ${this.floor} 层第 1 波重开`, () => win && this.runMode === 'daily' ? this.showDailyChallenge() : this.startRun(win && !finalFloor ? this.floor + 1 : this.floor), 'primary', 10);
    this.addButton(layer, 640, 507, 160, 38, '回到标题', () => this.showStart(), 'muted', 10);
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
    this.progress.maxFloor = Math.max(this.progress.maxFloor, Math.min(TOTAL_FLOORS, this.floor + 1));
    if (this.floor >= 3 && !this.progress.unlockedWeaponIds.includes('thorn')) this.progress.unlockedWeaponIds.push('thorn');
    if (this.floor >= 5 && !this.progress.unlockedWeaponIds.includes('echo')) this.progress.unlockedWeaponIds.push('echo');
    this.saveProgress();
  }

  private addButton(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, label: string, callback: () => void, style: 'primary' | 'muted' | 'danger' = 'primary', hitPadding = 14) {
    const isBackButton = x === 88 && y === 38;
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
    const shadow = this.add.rectangle(4, 4, width, height, 0x05090f, 0.96).setStrokeStyle(1, 0x05090f, 1);
    const rect = this.add.rectangle(0, 0, width, height, colors[style], 1).setStrokeStyle(2, lineColors[style], 0.95);
    button.add(shadow);
    button.add(rect);
    button.add(this.add.rectangle(0, 0, width - 8, height - 8, colors[style], 0).setStrokeStyle(1, lineColors[style], 0.55));
    button.add(this.add.text(0, 0, label, { fontFamily: 'Microsoft YaHei', fontSize: isBackButton ? '25px' : '15px', color: palette.cream }).setOrigin(0.5));
    const setPressed = (pressed: boolean) => {
      button.setScale(pressed ? 0.97 : 1);
      rect.setFillStyle(pressed ? Phaser.Display.Color.IntegerToColor(colors[style]).lighten(12).color : colors[style], 1);
    };
    parent.add(button);
    this.uiActionRegions.push({ phase: this.phase, x, y, width: hitWidth, height: hitHeight, callback, setPressed });
    return button;
  }

  private clearOverlay() {
    this.releaseJoystick();
    this.releaseUiPointer();
    this.overlay?.destroy(true);
    this.overlay = undefined;
    this.uiActionRegions = [];
  }

  private clearRunObjects() {
    this.enemies.forEach((enemy) => enemy.node.destroy());
    this.projectiles.forEach((shot) => shot.node.destroy());
    this.clearDrops();
    this.enemies = [];
    this.projectiles = [];
    this.player?.destroy();
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

  private floatText(x: number, y: number, message: string, color: string) {
    const text = this.add.text(x, y, message, { fontFamily: 'Microsoft YaHei', fontSize: '12px', color, stroke: '#0b1117', strokeThickness: 3 }).setOrigin(0.5).setDepth(30);
    this.world.add(text);
    this.tweens.add({ targets: text, y: y - 24, alpha: 0, duration: 650, onComplete: () => text.destroy() });
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
    const region = this.findUiRegion(point.x, point.y);
    if (!region) return;
    this.pendingUiAction = { pointerId: event.pointerId, phase: this.phase, region };
    region.setPressed(true);
    try { this.game.canvas.setPointerCapture(event.pointerId); } catch { /* capture can fail after browser gestures */ }
  }

  private handleUiPointerUp(event: PointerEvent) {
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
      frenzyAvailable: scene['frenzyAvailable'],
      frenzyActive: scene['frenzyActive'],
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
