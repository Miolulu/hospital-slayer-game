import Phaser from 'phaser';
import { audio } from './audio';
import { store } from './store';

export const COLORS = { ink: 0x0a0c10, paper: 0xeee2c2, gold: 0xd3aa55, teal: 0x79b6ac, red: 0xb82e43, muted: 0x9c9b91 };

export function text(scene: Phaser.Scene, x: number, y: number, value: string, size = 18, color = '#eee2c2', align: 'left' | 'center' | 'right' = 'left') {
  return scene.add.text(x, y, value, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: `${size}px`, color, align, wordWrap: { width: 720 }, letterSpacing: 0 }).setOrigin(align === 'center' ? .5 : align === 'right' ? 1 : 0, .5);
}

export function iconButton(scene: Phaser.Scene, x: number, y: number, icon: string, label: string, action: () => void, width = 132, labelColor = '#f2e6c8') {
  const bg = scene.textures.exists('ui-command-frame')
    ? scene.add.image(0, 0, 'ui-command-frame').setDisplaySize(width + 24, 54)
    : scene.add.rectangle(0, 0, width, 48, COLORS.ink, .78).setStrokeStyle(1, COLORS.gold, .8);
  const labelText = text(scene, 0, 0, `${icon}  ${label}`, 16, labelColor, 'center').setShadow(0, 2, '#090a0d', 0.85, true, true);
  const c = scene.add.container(x, y, [bg, labelText]).setSize(width, 48).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => { audio.play('tap'); scene.tweens.add({ targets: c, scale: .94, duration: 70, yoyo: true }); });
  c.on('pointerup', action);
  return c;
}

export function soundButton(scene: Phaser.Scene, x: number, y: number) {
  const label = text(scene, 0, 0, store.data.sound ? '♪' : '×', 25, '#eee2c2', 'center');
  const ring = scene.textures.exists('ui-round-frame')
    ? scene.add.image(0, 0, 'ui-round-frame').setDisplaySize(52, 52)
    : scene.add.circle(0, 0, 24, COLORS.ink, .75).setStrokeStyle(1, COLORS.gold);
  const c = scene.add.container(x, y, [ring, label]).setSize(48, 48).setInteractive();
  c.on('pointerup', () => { audio.toggle(); label.setText(store.data.sound ? '♪' : '×'); });
  return c.setDepth(1000);
}

export function vignette(scene: Phaser.Scene, width: number, height: number) {
  const g = scene.add.graphics().setDepth(900);
  g.fillStyle(0x000000, .25); g.fillRect(0, 0, width, 22); g.fillRect(0, height - 22, width, 22);
  for (let i = 0; i < 8; i++) { g.lineStyle(2, COLORS.paper, .05); g.strokeEllipse(width / 2, height / 2, width - i * 22, height - i * 12); }
  return g;
}
