import Phaser from 'phaser';
import { audio } from '../audio';
import { addCoverImage, createAlchemyPanel, createCat, createTitlePlaque } from '../art';
import { MOON_MOTH_QUEEN_ART_IMAGES, MOON_MOTH_QUEEN_ART_SHEETS } from '../moonMothQueenArt';
import { MAINLINE_BOSS_ART_IMAGES, MAINLINE_BOSS_ART_SHEETS } from '../mainlineBossArt';
import { COLORS, iconButton, soundButton, text, vignette } from '../ui';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.image('workshop-background', '/assets/art/workshop-background.webp');
    this.load.image('storybook-background', '/assets/art/storybook-background.webp');
    this.load.image('forest-red-background', '/assets/art/forest-red-background.webp');
    this.load.image('cat-alchemist', '/assets/art/cat-alchemist.webp');
    this.load.image('armor-scarlet-string', '/assets/art/armor-scarlet-string.webp');
    this.load.image('armor-thorn-wolf', '/assets/art/armor-thorn-wolf.webp');
    MOON_MOTH_QUEEN_ART_IMAGES.forEach(({ key, path }) => this.load.image(key, path));
    MOON_MOTH_QUEEN_ART_SHEETS.forEach(({ key, path, frameWidth, frameHeight }) => this.load.spritesheet(key, path, { frameWidth, frameHeight }));
    this.load.image('ui-command-frame', '/assets/art/ui-command-frame.webp');
    this.load.image('ui-alchemy-panel', '/assets/art/ui-alchemy-panel.webp');
    this.load.image('ui-title-plaque', '/assets/art/ui-title-plaque.webp');
    this.load.image('ui-round-frame', '/assets/art/ui-round-frame.webp');
    this.load.image('ui-cauldron', '/assets/art/ui-cauldron.webp');
    this.load.image('ui-potion-bottle', '/assets/art/ui-potion-bottle.webp');
    MAINLINE_BOSS_ART_IMAGES.forEach(({ key, path }) => this.load.image(key, path));
    MAINLINE_BOSS_ART_SHEETS.forEach(({ key, path, frameWidth, frameHeight }) => this.load.spritesheet(key, path, { frameWidth, frameHeight }));
    for (const id of ['hood', 'heart', 'bean', 'fang', 'thread', 'crown', 'shoe']) {
      this.load.image(`relic-${id}`, `/assets/art/relic-${id}.webp`);
    }
  }

  create() {
    document.querySelector('#loading')?.classList.add('ready');
    const { width: w, height: h } = this.scale;
    const compact = h < 500;
    this.cameras.main.setBackgroundColor('#080a0d');
    addCoverImage(this, 'workshop-background', -20);

    const shade = this.add.graphics().setDepth(-10);
    shade.fillStyle(0x06070b, .38).fillRect(0, 0, w, h);
    shade.fillStyle(0x06070b, .52).fillRect(0, h * .72, w, h * .28);

    const plaqueWidth = Math.min(460, w * .55);
    createTitlePlaque(this, w * .27, h * .16, plaqueWidth, compact ? 60 : 72).setDepth(4);
    text(this, w * .27, h * .15, '魔药炼装', compact ? 30 : 38, '#2d2116', 'center').setDepth(5);
    text(this, w * .27, h * .23, '黑森林的变身童话', compact ? 13 : 15, '#e7d6ae', 'center').setDepth(5);

    const panelWidth = Math.min(390, w * .45);
    const panelHeight = compact ? 142 : 170;
    createAlchemyPanel(this, w * .25, h * .51, panelWidth, panelHeight).setDepth(1).setAlpha(.94);
    text(this, w * .25, h * .43, '无名黑猫药师', compact ? 19 : 23, '#f1d891', 'center').setDepth(3);
    text(this, w * .25, h * .51, '收集童话遗物，调制你的专属炼装', compact ? 13 : 15, '#c5d8ca', 'center').setDepth(3);
    text(this, w * .25, h * .58, '每一次配方，都会改变战斗的卡牌流派', compact ? 12 : 13, '#a9b8b0', 'center').setDepth(3);

    const cat = createCat(this, w * .79, h * .66, Math.min(.86, h / 440));
    cat.setDepth(3);
    soundButton(this, w - 38, 34);
    const start = iconButton(this, w * .25, h * .76, '✦', '开始炼装', () => {
      audio.unlock(); audio.play('transform'); this.cameras.main.flash(300, 220, 190, 130);
      this.time.delayedCall(260, () => this.scene.start('StoryBook'));
    }, Math.min(190, w * .28), '#fff4d6').setDepth(6);
    this.tweens.add({ targets: start, scale: { from: 1, to: 1.035 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const sparks = this.add.graphics().setDepth(2);
    for (let i = 0; i < 9; i++) {
      const x = w * (.54 + (i % 3) * .065);
      const y = h * (.28 + Math.floor(i / 3) * .12);
      sparks.fillStyle(i % 2 ? COLORS.gold : 0x78c5b4, .55).fillCircle(x, y, i % 3 === 0 ? 3 : 2);
      this.tweens.add({ targets: sparks, alpha: { from: .35, to: 1 }, duration: 900 + i * 80, yoyo: true, repeat: -1, delay: i * 90 });
    }
    vignette(this, w, h);
    text(this, w - 18, h - 16, 'GAMEJAM DEMO  ·  30 MIN RUN', 11, '#b0a88f', 'right').setDepth(901);
  }
}
