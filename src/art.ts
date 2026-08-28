import Phaser from 'phaser';
import type { ArmorDef, MaterialDef } from './data';
import { MOON_MOTH_QUEEN_ART } from './moonMothQueenArt';

export function addCoverImage(scene: Phaser.Scene, key: string, depth = -10) {
  if (!scene.textures.exists(key)) return undefined;
  const { width, height } = scene.scale;
  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const scale = Math.max(width / source.naturalWidth, height / source.naturalHeight);
  return scene.add.image(width / 2, height / 2, key).setScale(scale).setDepth(depth);
}

export function drawForest(scene: Phaser.Scene, colors: [number, number, number]) {
  const { width, height } = scene.scale;
  scene.cameras.main.setBackgroundColor(colors[0]);
  const g = scene.add.graphics();
  g.fillGradientStyle(colors[1], colors[1], colors[0], colors[0], 1);
  g.fillRect(0, 0, width, height);
  g.fillStyle(0xe9dfbe, .12); g.fillCircle(width * .78, height * .23, height * .13);
  for (let layer = 0; layer < 3; layer++) {
    const color = layer === 0 ? colors[2] : layer === 1 ? colors[1] : colors[0];
    const alpha = layer === 0 ? .12 : layer === 1 ? .4 : .8;
    g.fillStyle(color, alpha);
    for (let i = 0; i < 9; i++) {
      const x = (i * width / 8) + (layer * 43 % 90) - 55;
      const base = height * (.68 + layer * .09);
      const h = height * (.32 + ((i * 31) % 40) / 200);
      g.fillTriangle(x - 35, base, x, base - h, x + 30, base);
      g.fillRect(x - 8, base - h * .55, 16, h * .65);
    }
  }
  g.fillStyle(0x080a0d, .9); g.fillRect(0, height * .82, width, height * .18);
  return g;
}

export function drawWorkbench(scene: Phaser.Scene) {
  const { width, height } = scene.scale;
  const g = scene.add.graphics();
  g.fillGradientStyle(0x252129, 0x252129, 0x090a0d, 0x090a0d, 1); g.fillRect(0, 0, width, height);
  g.fillStyle(0x18141b, .75);
  for (let i = 0; i < 7; i++) { g.fillRect(i * width / 6 - 25, 0, 20, height * .55); g.fillTriangle(i * width / 6 - 70, height * .52, i * width / 6, height * .12, i * width / 6 + 55, height * .52); }
  g.fillStyle(0x4b3024, 1); g.fillRect(0, height * .62, width, height * .38);
  g.lineStyle(3, 0x251810, .8); for (let y = height * .66; y < height; y += 34) g.lineBetween(0, y, width, y + 5);
  g.fillStyle(0xe2c66b, .08); g.fillCircle(width * .5, height * .55, height * .46);
  return g;
}

export function createCauldron(scene: Phaser.Scene, x: number, y: number, scale = 1) {
  if (scene.textures.exists('ui-cauldron')) {
    const image = scene.add.image(0, 0, 'ui-cauldron');
    const targetWidth = 220 * scale;
    image.setDisplaySize(targetWidth, targetWidth * image.height / image.width);
    const c = scene.add.container(x, y, [image]).setSize(targetWidth, targetWidth * image.height / image.width);
    scene.tweens.add({ targets: c, y: y - 3, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    return c;
  }
  const g = scene.add.graphics();
  g.fillStyle(0x11141a); g.fillEllipse(0, 12, 170, 98); g.fillRect(-68, 8, 136, 54);
  g.fillStyle(0x07090c); g.fillEllipse(0, -2, 150, 48); g.lineStyle(5, 0x76502e); g.strokeEllipse(0, -4, 156, 52);
  g.fillStyle(0x4cb9a0, .85); g.fillEllipse(0, -5, 130, 32);
  g.fillStyle(0xb92c43, .55); g.fillCircle(-28, -9, 6); g.fillCircle(15, -13, 8); g.fillCircle(38, -4, 4);
  g.fillStyle(0xd8a855); g.fillTriangle(-48, 60, -72, 95, -25, 74); g.fillTriangle(48, 60, 72, 95, 25, 74);
  const c = scene.add.container(x, y, [g]).setScale(scale).setSize(180 * scale, 130 * scale);
  scene.tweens.add({ targets: c, y: y - 3, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return c;
}

export function createCat(scene: Phaser.Scene, x: number, y: number, scale = 1) {
  if (scene.textures.exists('cat-alchemist')) {
    const portrait = scene.add.image(0, 0, 'cat-alchemist');
    const targetHeight = 280 * scale;
    portrait.setScale(targetHeight / portrait.height);
    const c = scene.add.container(x, y, [portrait]);
    scene.tweens.add({ targets: c, y: y - 3, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    return c;
  }
  const g = scene.add.graphics();
  g.fillStyle(0x13151b); g.fillEllipse(0, 12, 84, 100); g.fillCircle(0, -36, 48);
  g.fillTriangle(-38, -54, -28, -102, -5, -62); g.fillTriangle(38, -54, 28, -102, 5, -62);
  g.fillStyle(0x0b0c10); g.fillTriangle(-49, -22, 0, -112, 49, -22); g.fillRect(-46, -23, 92, 20);
  g.fillStyle(0xe6bc54); g.fillEllipse(-16, -38, 10, 6); g.fillEllipse(16, -38, 10, 6);
  g.lineStyle(7, 0x13151b); g.beginPath(); g.moveTo(34, 27); g.lineTo(64, 20); g.lineTo(76, -2); g.lineTo(62, -20); g.strokePath();
  const c = scene.add.container(x, y, [g]).setScale(scale);
  scene.tweens.add({ targets: c, scaleY: scale * .97, scaleX: scale * 1.02, duration: 900, yoyo: true, repeat: -1 });
  return c;
}

export function createMaterial(scene: Phaser.Scene, def: MaterialDef, x: number, y: number) {
  const textureKey = `relic-${def.id}`;
  if (scene.textures.exists(textureKey)) {
    const relic = scene.add.image(0, 0, textureKey);
    const maxSide = 88;
    relic.setScale(Math.min(maxSide / relic.width, maxSide / relic.height));
    const c = scene.add.container(x, y, [relic]).setSize(82, 92).setData('id', def.id);
    scene.tweens.add({ targets: c, angle: { from: -2, to: 2 }, y: y - 4, duration: 1200 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    return c;
  }
  const g = scene.add.graphics();
  g.fillStyle(0x000000, .35); g.fillEllipse(3, 35, 74, 18);
  g.fillStyle(def.color, 1); g.lineStyle(3, 0xf0dfb8, .55);
  switch (def.shape) {
    case 'hood': g.fillTriangle(-34, 26, 0, -43, 34, 26); g.fillCircle(0, 5, 27); g.fillStyle(0x24151b); g.fillCircle(0, 7, 17); break;
    case 'heart': g.fillCircle(-15, -8, 22); g.fillCircle(15, -8, 22); g.fillTriangle(-35, 0, 35, 0, 0, 42); g.lineStyle(4, 0x5b3e2a); g.lineBetween(0, -28, 0, 32); break;
    case 'bean': g.fillEllipse(-8, 0, 52, 75); g.lineStyle(4, 0x314f35); g.beginPath(); g.moveTo(-15, 29); g.lineTo(4, 8); g.lineTo(-2, -8); g.lineTo(15, -28); g.strokePath(); break;
    case 'fang': g.fillTriangle(-18, -40, 22, -22, -8, 42); g.fillStyle(0xe8e0c7); g.fillTriangle(-12, -31, 14, -19, -6, 29); break;
    case 'thread': for (let i = 0; i < 5; i++) { g.lineStyle(7, def.color); g.strokeCircle((i % 2) * 12 - 6, i * 12 - 25, 22 - i * 2); } break;
    case 'crown': g.fillRect(-34, -5, 68, 35); g.fillTriangle(-34, -5, -28, -40, -10, -5); g.fillTriangle(-10, -5, 0, -48, 12, -5); g.fillTriangle(12, -5, 30, -38, 34, -5); break;
    case 'shoe': g.fillStyle(0xa5e5ee, .7); g.fillTriangle(-32, 20, 8, -35, 19, 17); g.fillRect(-30, 15, 65, 19); break;
  }
  const c = scene.add.container(x, y, [g]).setSize(82, 92).setData('id', def.id);
  scene.tweens.add({ targets: c, angle: { from: -2, to: 2 }, y: y - 4, duration: 1200 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return c;
}

export function createAlchemyPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
  if (!scene.textures.exists('ui-alchemy-panel')) return scene.add.rectangle(x, y, width, height, 0x090b10, .72).setStrokeStyle(1, 0xd3aa55, .45);
  return scene.add.image(x, y, 'ui-alchemy-panel').setDisplaySize(width, height);
}

export function createTitlePlaque(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
  if (!scene.textures.exists('ui-title-plaque')) return scene.add.rectangle(x, y, width, height, 0x171319, .78).setStrokeStyle(1, 0xd3aa55, .65);
  return scene.add.image(x, y, 'ui-title-plaque').setDisplaySize(width, height);
}

export function createArmor(scene: Phaser.Scene, armor: ArmorDef, x: number, y: number, scale = 1) {
  const textureKey = `armor-${armor.id}`;
  if (scene.textures.exists(textureKey)) {
    const portrait = scene.add.image(0, 0, textureKey);
    const targetHeight = 245;
    portrait.setScale(targetHeight / portrait.height);
    return scene.add.container(x, y, [portrait]).setScale(scale);
  }
  const g = scene.add.graphics();
  const dark = 0x11141a;
  g.fillStyle(0x000000, .35); g.fillEllipse(0, 85, 110, 22);
  g.fillStyle(armor.color); g.fillTriangle(-35, -28, -65, 65, -20, 78); g.fillTriangle(35, -28, 68, 65, 20, 78);
  g.fillStyle(dark); g.fillEllipse(0, 10, armor.silhouette === 'tank' ? 100 : 74, 140);
  g.fillStyle(armor.color); g.fillRect(-28, -25, 56, 100); g.fillCircle(0, -62, 43);
  if (armor.silhouette === 'beast') { g.fillTriangle(-38, -75, -26, -115, -6, -78); g.fillTriangle(38, -75, 26, -115, 6, -78); }
  if (armor.silhouette === 'tank') { g.fillRect(-58, -22, 38, 70); g.fillRect(20, -22, 38, 70); }
  if (armor.silhouette === 'ranger') { g.fillTriangle(-25, 0, -110, 38, -15, 28); g.lineStyle(7, armor.accent); g.lineBetween(25, -8, 92, -44); }
  g.fillStyle(armor.accent); g.fillTriangle(-30, -66, 0, -82, 30, -66); g.fillRect(-22, -68, 44, 13); g.fillCircle(0, -7, 9);
  g.lineStyle(4, armor.accent, .9); g.lineBetween(-23, 20, 23, 20); g.lineBetween(-18, 44, 18, 44);
  drawArmorSignature(g, armor);
  return scene.add.container(x, y, [g]).setScale(scale);
}

function drawArmorSignature(g: Phaser.GameObjects.Graphics, armor: ArmorDef) {
  g.lineStyle(4, armor.accent, .92);
  switch (armor.id) {
    case 'tower-puppet':
      g.strokeRect(-46, -18, 92, 76); g.lineBetween(-46, 18, 46, -4); g.lineBetween(-46, -4, 46, 18);
      g.fillStyle(armor.accent, .82); g.fillTriangle(-55, -26, -30, -58, -5, -26); g.fillTriangle(55, -26, 30, -58, 5, -26);
      break;
    case 'moon-string':
      g.strokeCircle(0, 3, 52); g.beginPath(); g.arc(0, 3, 34, Math.PI * .18, Math.PI * 1.48, false); g.strokePath();
      g.lineBetween(-80, 30, -35, 8); g.lineBetween(80, 30, 35, 8);
      break;
    case 'vine-puppet':
      for (const side of [-1, 1]) { g.beginPath(); g.moveTo(side * 28, -42); g.lineTo(side * 58, -12); g.lineTo(side * 36, 18); g.lineTo(side * 68, 48); g.strokePath(); }
      g.fillStyle(armor.accent, .72); g.fillCircle(-54, -16, 9); g.fillCircle(54, 24, 9);
      break;
    case 'scarlet-giant':
      g.fillStyle(armor.accent, .82); g.fillTriangle(-48, -70, -24, -115, 0, -74); g.fillTriangle(0, -74, 24, -115, 48, -70);
      g.lineStyle(8, armor.accent, .8); g.lineBetween(-72, -8, -108, 38); g.lineBetween(72, -8, 108, 38);
      g.strokeCircle(0, 5, 56);
      break;
    case 'scarlet-string':
      g.lineStyle(3, armor.accent, .82); for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 8, 56 + i * 11, -1.1, 1.1, false); g.strokePath(); }
      break;
    case 'thorn-wolf':
      g.lineStyle(5, armor.accent, .9); g.beginPath(); g.moveTo(-50, -4); g.lineTo(-78, -28); g.lineTo(-58, 4); g.lineTo(-92, 16); g.moveTo(50, -4); g.lineTo(78, -28); g.lineTo(58, 4); g.lineTo(92, 16); g.strokePath();
      break;
  }
}

export function createEnemy(scene: Phaser.Scene, enemy: string, x: number, y: number, boss: boolean, color: number) {
  if (boss && scene.textures.exists(MOON_MOTH_QUEEN_ART.portraitKey)) {
    const portrait = scene.add.image(0, 0, MOON_MOTH_QUEEN_ART.portraitKey);
    portrait.setScale(310 / portrait.height);
    return scene.add.container(x, y, [portrait]).setData('enemy', enemy);
  }
  const s = boss ? 1.45 : 1;
  const g = scene.add.graphics(); g.fillStyle(0x000000, .45); g.fillEllipse(0, 75, 145 * s, 25);
  g.fillStyle(0x15161b); g.fillEllipse(0, 5, 100 * s, 150 * s); g.fillCircle(0, -58 * s, 48 * s);
  if (enemy.includes('狼')) { g.fillTriangle(-40 * s, -77 * s, -25 * s, -125 * s, -5 * s, -85 * s); g.fillTriangle(40 * s, -77 * s, 25 * s, -125 * s, 5 * s, -85 * s); }
  if (enemy.includes('木偶')) { g.lineStyle(6, color); g.lineBetween(-30 * s, -90 * s, -75 * s, -150 * s); g.lineBetween(30 * s, -90 * s, 75 * s, -150 * s); g.fillStyle(color); g.fillRect(-15 * s, -98 * s, 30 * s, 80 * s); }
  if (enemy.includes('巨人')) { g.fillStyle(color, .55); g.fillCircle(-45 * s, 0, 42 * s); g.fillCircle(45 * s, 0, 42 * s); }
  if (enemy.includes('鹿王')) { for (const side of [-1, 1]) { g.lineStyle(8, color); g.beginPath(); g.moveTo(side * 18, -85); g.lineTo(side * 60, -150); g.lineTo(side * 105, -170); g.moveTo(side * 55, -143); g.lineTo(side * 45, -195); g.moveTo(side * 78, -160); g.lineTo(side * 118, -205); g.strokePath(); } }
  if (enemy.includes('狼群')) { for (const side of [-1, 1]) { g.fillStyle(color, .8); g.fillTriangle(side * 14, 34, side * 74, 12, side * 40, 54); g.fillCircle(side * 62, 9, 18); } }
  if (enemy.includes('甲虫')) { g.fillStyle(color, .72); g.fillEllipse(0, 12 * s, 130 * s, 88 * s); g.lineStyle(5, color); g.lineBetween(-48 * s, -22 * s, -80 * s, -64 * s); g.lineBetween(48 * s, -22 * s, 80 * s, -64 * s); g.lineBetween(-52 * s, 35 * s, -92 * s, 66 * s); g.lineBetween(52 * s, 35 * s, 92 * s, 66 * s); }
  if (enemy.includes('王子')) { g.fillStyle(color, .88); g.fillTriangle(0, -124 * s, -26 * s, -88 * s, 26 * s, -88 * s); g.lineStyle(4, color); g.lineBetween(0, -82 * s, 0, 56 * s); g.lineBetween(-44 * s, -32 * s, 44 * s, 12 * s); }
  g.fillStyle(color); g.fillEllipse(-16 * s, -58 * s, 12 * s, 7 * s); g.fillEllipse(16 * s, -58 * s, 12 * s, 7 * s);
  return scene.add.container(x, y, [g]).setScale(boss ? .82 : .75).setData('enemy', enemy);
}
