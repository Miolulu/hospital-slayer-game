import Phaser from 'phaser';
import { ARMORS, LEVELS } from '../data';
import { store } from '../store';
import { addCoverImage, createArmor, drawForest } from '../art';
import { COLORS, iconButton, soundButton, text, vignette } from '../ui';

export class StoryBookScene extends Phaser.Scene {
  constructor() { super('StoryBook'); }
  create() {
    const { width: w, height: h } = this.scale;
    if (!addCoverImage(this, 'storybook-background')) drawForest(this, [0x0c1115, 0x27363a, 0x973143]);
    vignette(this, w, h);
    const page = this.add.rectangle(w / 2, h / 2 + 8, Math.min(w - 52, 1120), h - 58, 0xe4d7b8, .78).setStrokeStyle(4, 0x4b3025);
    this.add.rectangle(w / 2, h / 2 + 8, 3, h - 76, 0x795c3b, .45);
    text(this, w / 2, 18, '失 落 的 童 话 书', 18, '#efe2c2', 'center'); soundButton(this, w - 38, 34);
    const left = page.x - page.width / 2 + 28; const top = page.y - page.height / 2 + 30;
    text(this, left, top, '无名黑猫的旅途', 22, '#32251f');
    text(this, left, top + 32, `已发现炼装 ${store.data.recipes.length}/6  ·  觉醒 ${store.data.awakenings.length}/3`, 13, '#755a42');
    const cols = h >= 520 ? 2 : 3;
    const gapX = cols === 2 ? Math.min(155, page.width / 4 - 45) : Math.min(92, (page.width / 2 - 78) / 2);
    const gapY = cols === 2 ? Math.min(112, (page.height - 155) / 3) : 72;
    const gridStartX = cols === 2 ? left + 76 : left + 40;
    const gridStartY = top + 96;
    LEVELS.forEach((level, i) => {
      const col = i % cols; const row = Math.floor(i / cols); const x = gridStartX + col * gapX; const y = gridStartY + row * gapY;
      const unlocked = level.id <= store.data.unlockedLevel; const complete = store.data.completed.includes(level.id); const grade = store.data.grades[String(level.id)];
      const node = this.add.circle(x, y, 25, unlocked ? level.colors[2] : 0x70685e, unlocked ? .95 : .4).setStrokeStyle(2, complete ? COLORS.gold : 0x66594b);
      text(this, x, y - 1, unlocked ? String(level.id) : '×', 18, '#fff2d3', 'center');
      text(this, x, y + 39, `${level.chapter}\n${level.title}`, 11, unlocked ? '#392a22' : '#8a7d6c', 'center')
        .setLineSpacing(3).setWordWrapWidth(cols === 2 ? 124 : 86);
      if (grade) text(this, x + 24, y - 24, grade, 15, grade === 'S' ? '#b52c40' : '#5d4632', 'center');
      if (unlocked) node.setInteractive().on('pointerup', () => this.selectLevel(level.id));
      if (i < LEVELS.length - 1 && col < cols - 1) { const line = this.add.graphics(); line.lineStyle(2, 0x856b4b, .45); line.lineBetween(x + 27, y, x + gapX - 27, y); }
    });
    const right = w / 2 + 30;
    const next = LEVELS[Math.min(store.data.unlockedLevel, 7) - 1];
    const preview = ARMORS[store.currentArmor ?? store.data.recipes.at(-1) ?? 'scarlet-string'];
    if (h >= 520) {
      const previewArmor = createArmor(this, preview, right + page.width * .34, top + 294, .42).setDepth(2);
      text(this, right + page.width * .34, top + 385, `当前炼装 · ${preview.name}`, 12, '#6b5039', 'center').setDepth(3);
      void previewArmor;
    }
    this.add.rectangle(right + page.width * .19, top - 4, Math.min(340, page.width * .42), 24, 0x4f3a2b, .12).setStrokeStyle(1, 0x8f6d49, .3);
    text(this, right + 16, top - 4, `章节 ${next.id}/7  ·  ${store.data.completed.length} 章已夺回`, 11, '#755a42').setDepth(3);
    if (h < 520) {
      text(this, right, top + 8, '黑森林吞掉所有结局', 15, '#3c2b22');
      text(this, right, top + 34, '两件遗物 → 炼装 → 卡牌战斗', 12, '#6b5039');
      text(this, right, top + 78, '当前目标', 12, '#9b2f3d');
      text(this, right, top + 104, `${next.chapter} · ${next.title}`, 16, '#33231c');
      text(this, right, top + 130, next.keywords.join(' · '), 11, '#765d42');
      iconButton(this, right + 76, h - 84, '⚗', store.data.completed.length ? '进入炼药房' : '开始教学', () => this.selectLevel(next.id), 142, '#2d2116');
      if (store.data.completed.length) {
        iconButton(this, right + 76, h - 38, '↻', '重玩', () => this.selectLevel(store.data.completed.at(-1) ?? 1), 78, '#2d2116');
        iconButton(this, right + 154, h - 38, '↺', '新旅程', () => this.confirmReset(), 78, '#2d2116');
      }
    } else {
      text(this, right, top + 10, '黑森林正在吞掉所有结局。', 19, '#3c2b22');
      text(this, right, top + 46, '把两件童话遗物投入坩埚，\n夺回故事，也写下你的名字。', 15, '#6b5039');
      text(this, right, top + 112, '当前目标', 14, '#9b2f3d');
      text(this, right, top + 143, `${next.chapter} · ${next.title}`, 21, '#33231c');
      text(this, right, top + 174, next.keywords.join('  ·  '), 13, '#765d42');
      iconButton(this, right + 90, top + 226, '⚗', store.data.completed.length ? '进入炼药房' : '开始教学', () => this.selectLevel(next.id), 180, '#2d2116');
      if (store.data.completed.length) {
        iconButton(this, right + 90, top + 282, '↻', '重玩已完成关', () => this.selectLevel(store.data.completed.at(-1) ?? 1), 180, '#2d2116');
        iconButton(this, right + 238, top + 282, '↺', '新旅程', () => this.confirmReset(), 110, '#2d2116');
      }
    }
    if (h >= 520) {
      const panelY = top + 370;
      this.add.rectangle(right + page.width * .19, panelY, page.width * .38, 126, 0x4f3a2b, .09).setStrokeStyle(1, 0x7f6044, .32);
      text(this, right + 18, panelY - 42, '敌情手记', 14, '#9b2f3d');
      text(this, right + 18, panelY - 14, `目标：${next.enemy}\n线索：${next.keywords.join(' / ')}\n建议：长按遗物查看共鸣，再决定炼装。`, 13, '#5c4635');
      text(this, right + 18, panelY + 46, `旅途收集  遗物 ${store.data.materials.length}/7  ·  最高评级 ${Object.values(store.data.grades).filter((g) => g === 'S').length}S`, 12, '#755a42');
    }
  }

  private confirmReset() {
    const { width: w, height: h } = this.scale;
    const shade = this.add.rectangle(w / 2, h / 2, w, h, 0x050609, .88).setDepth(1100).setInteractive();
    const panel = this.add.rectangle(w / 2, h / 2, Math.min(460, w - 48), 210, 0x17151a, .98).setStrokeStyle(2, COLORS.gold, .8).setDepth(1101);
    const title = text(this, w / 2, h / 2 - 58, '开启一段全新的旅程？', 22, '#f1dfb9', 'center').setDepth(1102);
    const warning = text(this, w / 2, h / 2 - 17, '现有关卡、遗物、炼装与评级将被清除', 14, '#c9b99b', 'center').setDepth(1102);
    const cancel = iconButton(this, w / 2 - 88, h / 2 + 53, '×', '保留旅程', close, 150).setDepth(1102);
    const reset = iconButton(this, w / 2 + 88, h / 2 + 53, '↺', '确认重置', () => { store.reset(); this.scene.restart(); }, 150).setDepth(1102);
    function close() { shade.destroy(); panel.destroy(); title.destroy(); warning.destroy(); cancel.destroy(); reset.destroy(); }
  }

  private selectLevel(id: number) { store.data.selectedLevel = id; store.save(); this.scene.start('Workshop'); }
}
