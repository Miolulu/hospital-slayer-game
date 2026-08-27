import Phaser from 'phaser';
import { ARMORS, LEVELS, MATERIALS } from '../data';
import { createMaterial, drawForest } from '../art';
import { getRewardCards } from '../cards';
import { store } from '../store';
import { COLORS, iconButton, soundButton, text, vignette } from '../ui';

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }
  create() {
    const result = store.battleResult!; const level = LEVELS[result.level - 1]; const { width: w, height: h } = this.scale;
    drawForest(this, level.colors); vignette(this, w, h); soundButton(this, w - 38, 34); this.add.rectangle(w / 2, h / 2, w, h, 0x05070a, .55);
    text(this, w / 2, h * .16, result.victory ? '童 话 已 夺 回' : '故 事 在 此 中 断', 22, result.victory ? '#e7d7ab' : '#e36a73', 'center');
    if (result.victory) {
      text(this, w * .32, h * .49, result.grade ?? 'B', Math.min(112, h * .27), result.grade === 'S' ? '#e94857' : '#e8c875', 'center');
      text(this, w * .32, h * .68, `${result.pressure ? '力量压制' : '配方适性'}  ·  ${result.time}秒  ·  剩余生命 ${result.hp}%`, 14, '#a7cbc0', 'center');
      text(this, w * .68, h * .30, level.title, 25, '#f1dfb9', 'center');
      this.drawCardRewards(w * .68, h * .38, ARMORS[store.currentArmor ?? 'scarlet-string']);
      if (level.reward && store.hasMaterial(level.reward)) { const mat = createMaterial(this, MATERIALS[level.reward], w * .68, h * .54).setScale(1.2); text(this, w * .68, h * .72, level.reward === 'shoe' ? '新童话即将开启' : `获得 · ${MATERIALS[level.reward].name}`, 15, '#eacb78', 'center'); void mat; }
      else text(this, w * .68, h * .56, '故事墨水已收好', 16, '#c7b995', 'center');
      iconButton(this, w / 2 - 95, h - 45, '↻', '重玩本关', () => { store.data.selectedLevel = level.id; this.scene.start('Workshop'); }, 160);
      iconButton(this, w / 2 + 95, h - 45, '›', level.id === 7 ? '查看童话书' : '继续冒险', () => this.scene.start('StoryBook'), 160);
    } else {
      text(this, w / 2, h * .42, '这套炼装无法改写眼前的结局', 24, '#f1ddbd', 'center');
      text(this, w / 2, h * .53, `敌人特征：${level.keywords.join(' · ')}\n长按遗物研究共鸣，换一套炼装再来。`, 15, '#a9c8bf', 'center');
      iconButton(this, w / 2, h * .7, '⚗', '重新炼制', () => this.scene.start('Workshop'), 180);
    }
  }

  private drawCardRewards(centerX: number, centerY: number, armor: typeof ARMORS[keyof typeof ARMORS]) {
    const { width: w, height: h } = this.scale;
    const cards = getRewardCards(armor.id, store.battleResult?.level ?? 1);
    const cardWidth = Math.min(116, (w * .5 - 70) / 3);
    const cardHeight = Math.min(142, h * .24);
    const gap = Math.min(8, w * .012);
    const chosen = new Set<string>(store.data.cardUnlocks[armor.id] ?? []);
    const cardNodes: Phaser.GameObjects.Container[] = [];
    text(this, centerX, centerY - cardHeight / 2 - 24, '选择 1 张加入牌组', 13, '#a8c7bc', 'center');
    cards.forEach((card, index) => {
      const x = centerX - (cardWidth + gap) + index * (cardWidth + gap);
      const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x11131a, .97).setStrokeStyle(2, card.color, .9);
      const cost = text(this, 0, -cardHeight * .34, String(card.cost), 14, '#f3df99', 'center');
      const title = text(this, 0, -cardHeight * .15, card.name, 12, '#f3e6c5', 'center');
      const desc = text(this, 0, cardHeight * .13, card.description, 10, '#d0c4a7', 'center').setWordWrapWidth(cardWidth - 14);
      const node = this.add.container(x, centerY, [bg, cost, title, desc]).setSize(cardWidth, cardHeight).setDepth(40).setInteractive({ useHandCursor: true });
      if (chosen.has(card.id)) node.setAlpha(.45);
      node.on('pointerup', () => {
        if (chosen.size > 0) return;
        store.addCard(armor.id, card.id); chosen.add(card.id);
        cardNodes.forEach((other) => other.disableInteractive().setAlpha(.42));
        node.setAlpha(1.1); text(this, centerX, centerY + cardHeight / 2 + 12, `已加入：${card.name}`, 12, '#f0cf72', 'center').setDepth(45);
      });
      cardNodes.push(node);
    });
  }
}
