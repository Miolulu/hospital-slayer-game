import Phaser from 'phaser';
import { ARMORS, LEVELS, type ArmorDef, type LevelDef } from '../data';
import { audio } from '../audio';
import { addCoverImage, createArmor, createEnemy, drawForest } from '../art';
import { getCard, getStarterDeck, type CardDef } from '../cards';
import { store } from '../store';
import { COLORS, iconButton, soundButton, text, vignette } from '../ui';

type Outcome = 'advantage' | 'normal' | 'defeat' | 'pressure';
type RuntimeCard = { uid: number; def: CardDef };

export class BattleScene extends Phaser.Scene {
  private playerHp = 100;
  private playerBlock = 0;
  private enemyHp = 100;
  private enemyMaxHp = 100;
  private enemyPoison = 0;
  private enemyBleed = 0;
  private enemyMark = 0;
  private playerCounter = 0;
  private nextAttackBonus = 0;
  private energy = 3;
  private turn = 1;
  private cardsPlayed = 0;
  private drawPile: string[] = [];
  private discard: string[] = [];
  private hand: RuntimeCard[] = [];
  private nextUid = 1;
  private cardNodes: Phaser.GameObjects.Container[] = [];
  private playerBar!: Phaser.GameObjects.Rectangle;
  private enemyBar!: Phaser.GameObjects.Rectangle;
  private hero!: Phaser.GameObjects.Container;
  private enemy!: Phaser.GameObjects.Container;
  private armor!: ArmorDef;
  private level!: LevelDef;
  private outcome!: Outcome;
  private enemyIntent = 0;
  private startedAt = 0;
  private combatOver = false;
  private handLayer!: Phaser.GameObjects.Container;
  private energyText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private intentText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private combatLog!: Phaser.GameObjects.Text;
  private endTurnButton?: Phaser.GameObjects.Container;

  constructor() { super('Battle'); }

  create() {
    this.level = LEVELS[store.data.selectedLevel - 1];
    this.armor = ARMORS[store.currentArmor ?? 'scarlet-string'];
    this.outcome = this.resolveOutcome();
    const { width: w, height: h } = this.scale;
    if (this.level.id <= 2 && !addCoverImage(this, 'forest-red-background')) drawForest(this, this.level.colors);
    else drawForest(this, this.level.colors);
    vignette(this, w, h); soundButton(this, w - 38, 34);
    this.add.rectangle(w / 2, h / 2, w, h, 0x000000, .18).setDepth(1);
    const chapter = text(this, w / 2, h * .28, this.level.chapter, 15, '#c6aa72', 'center').setDepth(100);
    const title = text(this, w / 2, h * .40, this.level.title, 34, '#f3e7c7', 'center').setDepth(100);
    const subtitle = text(this, w / 2, h * .51, '选择卡牌，改变这段童话的结局', 15, '#9bc4ba', 'center').setDepth(100);
    this.cameras.main.fadeIn(280);
    const delay = new URLSearchParams(location.search).has('test') ? 250 : 900;
    this.time.delayedCall(delay, () => this.tweens.add({ targets: [chapter, title, subtitle], alpha: 0, duration: 260, onComplete: () => this.beginBattle() }));
  }

  private beginBattle() {
    const { width: w, height: h } = this.scale;
    this.startedAt = this.time.now;
    this.enemyMaxHp = this.level.boss ? 150 : 100;
    this.enemyHp = this.enemyMaxHp;
    this.drawHud();
    this.hero = createArmor(this, this.armor, w * .24, h * .55, Math.min(.68, h / 560)).setDepth(20);
    this.enemy = createEnemy(this, this.level.enemy, w * .76, h * .56, this.level.boss, this.level.colors[2]).setDepth(20);
    this.enemy.setScale(0);
    this.tweens.add({ targets: this.enemy, scale: this.level.boss ? .82 : .75, duration: 520, ease: 'Back.Out' });
    audio.play('danger');
    this.handLayer = this.add.container(0, 0).setDepth(80);
    this.drawPile = [...getStarterDeck(this.armor.id), ...(store.data.cardUnlocks[this.armor.id] ?? [])];
    this.shuffle(this.drawPile);
    this.drawCards(5);
    this.enemyIntent = this.getIntentDamage();
    this.renderCombatUi();
  }

  private drawHud() {
    const { width: w, height: h } = this.scale;
    text(this, 26, 27, this.armor.name, 15, '#f2e2bf').setDepth(30);
    text(this, w - 26, 27, this.level.enemy, 15, '#f2e2bf', 'right').setDepth(30);
    this.add.rectangle(26, 47, w * .31, 14, 0x090b0e).setOrigin(0).setStrokeStyle(1, COLORS.gold).setDepth(30);
    this.playerBar = this.add.rectangle(28, 49, w * .31 - 4, 10, this.armor.color).setOrigin(0).setDepth(31);
    this.add.rectangle(w - 26, 47, -w * .31, 14, 0x090b0e).setOrigin(0).setStrokeStyle(1, COLORS.gold).setDepth(30);
    this.enemyBar = this.add.rectangle(w - 28, 49, -(w * .31 - 4), 10, this.level.colors[2]).setOrigin(0).setDepth(31);
    this.energyText = text(this, w / 2 - 88, 28, '', 15, '#f0cf72').setDepth(40);
    this.turnText = text(this, w / 2, 28, '', 15, '#d8d0b8', 'center').setDepth(40);
    this.intentText = text(this, w / 2, 86, '', 15, '#ef8d94', 'center').setDepth(40);
    this.statusText = text(this, w / 2, 111, '', 12, '#9bc4ba', 'center').setDepth(40);
    this.combatLog = text(this, w / 2, h * .70, '', 15, '#eee2c2', 'center').setDepth(100);
  }

  private renderCombatUi() {
    this.energyText.setText(`能量 ${this.energy}/3`);
    this.turnText.setText(`第 ${this.turn} 回合`);
    this.intentText.setText(`敌人意图：攻击 ${this.enemyIntent}`);
    const statuses = [
      this.playerBlock ? `护盾 ${this.playerBlock}` : '',
      this.playerCounter ? `反击 ${this.playerCounter}` : '',
      this.enemyPoison ? `中毒 ${this.enemyPoison}` : '',
      this.enemyBleed ? `流血 ${this.enemyBleed}` : '',
      this.enemyMark ? `月痕 ${this.enemyMark}` : '',
    ].filter(Boolean);
    this.statusText.setText(statuses.join('  ·  ') || '本回合还没有状态');
    this.updateBars();
    this.renderHand();
  }

  private renderHand() {
    this.cardNodes.forEach((node) => node.destroy());
    this.cardNodes = [];
    const { width: w, height: h } = this.scale;
    const count = Math.max(this.hand.length, 1);
    const gap = Math.min(8, w * .012);
    const endArea = w < 760 ? 86 : 134;
    const cardWidth = Math.min(126, (w - 26 - endArea - gap * (count - 1)) / count);
    const cardHeight = Math.min(128, h * .22);
    const total = cardWidth * this.hand.length + gap * Math.max(0, this.hand.length - 1);
    const start = Math.max(12, (w - endArea - total) / 2) + cardWidth / 2;
    this.hand.forEach((card, index) => {
      const node = this.makeCard(card, start + index * (cardWidth + gap), h - cardHeight / 2 - 12, cardWidth, cardHeight);
      this.cardNodes.push(node); this.handLayer.add(node);
    });
    if (!this.endTurnButton) {
      this.endTurnButton = iconButton(this, w - (w < 760 ? 42 : 74), h - cardHeight / 2 - 12, '→', w < 760 ? '结束' : '结束回合', () => this.endTurn(), w < 760 ? 76 : 120).setDepth(120);
    }
  }

  private makeCard(card: RuntimeCard, x: number, y: number, width: number, height: number) {
    const bg = this.add.rectangle(0, 0, width, height, 0x11131a, .96).setStrokeStyle(2, card.def.color, .95);
    const header = this.add.rectangle(0, -height * .34, width - 8, 3, card.def.color, .95);
    const cost = this.add.circle(-width / 2 + 19, -height / 2 + 18, 13, card.def.color, .95);
    const costText = text(this, -width / 2 + 19, -height / 2 + 18, String(card.def.cost), 14, '#171319', 'center');
    const sigil = makeCardSigil(this, card.def, width / 2 - 20, -height / 2 + 18);
    const name = text(this, 0, -height * .27, card.def.name, Math.max(12, width * .11), '#f4e6c6', 'center');
    const type = text(this, 0, -height * .08, card.def.kind === 'attack' ? '攻击' : card.def.kind === 'defense' ? '防御' : card.def.kind === 'finisher' ? '终结' : '技能', 10, '#9cc9be', 'center');
    const desc = text(this, 0, height * .17, card.def.description, Math.max(10, width * .085), '#d0c4a7', 'center').setWordWrapWidth(width - 18);
    const node = this.add.container(x, y, [bg, header, cost, costText, sigil, name, type, desc]).setSize(width, height).setInteractive({ useHandCursor: true });
    node.on('pointerdown', () => node.setScale(.96));
    node.on('pointerup', () => { node.setScale(1); this.playCard(card.uid); });
    node.on('pointerout', () => node.setScale(1));
    return node;
  }

  private playCard(uid: number) {
    if (this.combatOver) return;
    const index = this.hand.findIndex((card) => card.uid === uid);
    if (index < 0) return;
    const card = this.hand[index];
    if (card.def.cost > this.energy) { this.flashMessage('能量不足'); audio.play('invalid'); return; }
    this.energy -= card.def.cost; this.hand.splice(index, 1); this.discard.push(card.def.id); this.cardsPlayed += 1;
    this.applyCard(card.def);
    this.animateCard(card.def);
    audio.play(card.def.kind === 'attack' || card.def.kind === 'finisher' ? 'skill' : 'select');
    this.renderCombatUi();
    if (this.enemyHp <= 0) this.finishBattle(true);
  }

  private applyCard(card: CardDef) {
    switch (card.effect.type) {
      case 'damage': {
        let amount = card.effect.amount + this.nextAttackBonus;
        this.nextAttackBonus = 0;
        if (card.id === 'scarlet-combo') amount += Math.max(0, this.cardsPlayed - 1) * 3;
        if (card.id === 'tower-punch') amount += Math.floor(this.playerBlock / 3);
        if (this.enemyMark) { amount *= 2; this.enemyMark = 0; }
        this.damageEnemy(amount);
        break;
      }
      case 'block': this.playerBlock += card.effect.amount; break;
      case 'bleed': this.enemyBleed += card.effect.amount; this.damageEnemy(7); break;
      case 'poison': this.enemyPoison += card.effect.amount; this.damageEnemy(this.statusCardDamage(card)); break;
      case 'mark': this.enemyMark += card.effect.amount; break;
      case 'heal': this.playerHp = Math.min(100, this.playerHp + card.effect.amount); break;
      case 'draw': this.drawCards(card.effect.amount); break;
      case 'energy': this.energy = Math.min(3, this.energy + card.effect.amount); this.drawCards(1); break;
      case 'counter': this.playerBlock += card.effect.amount; this.playerCounter += card.effect.amount; break;
    }
    if (card.id === 'tower-finisher') this.playerBlock += 12;
    if (card.id === 'scarlet-reel') this.energy = Math.min(3, this.energy + 1);
    if (card.id === 'moon-draw') this.energy = Math.min(3, this.energy + 1);
    if (card.id === 'giant-charge') this.nextAttackBonus += 10;
    this.flashMessage(card.name);
  }

  private endTurn() {
    if (this.combatOver) return;
    this.tickEnemyStatuses();
    if (this.enemyHp <= 0) { this.finishBattle(true); return; }
    const incoming = this.enemyIntent;
    const blocked = Math.min(this.playerBlock, incoming);
    const damage = Math.max(0, incoming - blocked);
    this.playerBlock -= blocked;
    this.playerHp = Math.max(0, this.playerHp - damage);
    if (this.playerCounter) { this.damageEnemy(this.playerCounter); this.playerCounter = 0; }
    this.animateEnemyAttack(damage);
    if (this.playerHp <= 0) { this.finishBattle(false); return; }
    this.turn += 1; this.cardsPlayed = 0; this.energy = 3; this.enemyIntent = this.getIntentDamage();
    this.drawCards(Math.max(0, 5 - this.hand.length));
    this.renderCombatUi();
  }

  private tickEnemyStatuses() {
    if (this.enemyPoison) { this.damageEnemy(this.enemyPoison); this.enemyPoison = Math.max(0, this.enemyPoison - 1); }
    if (this.enemyBleed) { this.damageEnemy(this.enemyBleed); this.enemyBleed = Math.max(0, this.enemyBleed - 1); }
  }

  private drawCards(amount: number) {
    for (let i = 0; i < amount; i++) {
      if (!this.drawPile.length) { this.drawPile = [...this.discard]; this.discard = []; this.shuffle(this.drawPile); }
      const id = this.drawPile.shift();
      const def = id ? getCard(id) : undefined;
      if (def) this.hand.push({ uid: this.nextUid++, def });
    }
  }

  private shuffle(values: string[]) {
    for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; }
  }

  private getIntentDamage() { return (this.level.boss ? 15 : 9) + Math.min(12, this.turn * 2) + (this.outcome === 'defeat' ? 8 : 0); }

  private statusCardDamage(card: CardDef) {
    if (card.id === 'thorn-bite') return 9;
    if (card.id === 'thorn-finisher') return 25;
    if (card.id === 'thorn-spore' || card.id === 'vine-root') return 0;
    if (card.id === 'vine-finisher') return 26;
    return 4;
  }

  private animateCard(card: CardDef) {
    if (!this.hero?.active || !this.enemy?.active) return;
    if (card.target === 'enemy') {
      this.tweens.add({ targets: this.hero, x: this.enemy.x - 100, duration: 140, yoyo: true, hold: 80, ease: 'Quad.In' });
      this.time.delayedCall(90, () => this.flashAt(this.enemy.x, this.enemy.y - 42, card.color));
    } else {
      const pulse = this.add.circle(this.hero.x, this.hero.y - 38, 24, card.color, .5).setDepth(40);
      this.tweens.add({ targets: pulse, scale: 3, alpha: 0, duration: 300, onComplete: () => pulse.destroy() });
    }
  }

  private animateEnemyAttack(damage: number) {
    if (!this.enemy?.active || !this.hero?.active) return;
    this.tweens.add({ targets: this.enemy, x: this.hero.x + 100, duration: 160, yoyo: true, hold: 80 });
    this.time.delayedCall(110, () => {
      if (damage > 0) { this.cameras.main.shake(110, .009); this.flashAt(this.hero.x, this.hero.y - 40, this.level.colors[2]); }
      else this.flashMessage('护盾挡住了攻击');
    });
  }

  private finishBattle(victory: boolean) {
    if (this.combatOver) return;
    this.combatOver = true;
    const time = Math.max(1, Math.round((this.time.now - this.startedAt) / 1000));
    const grade = victory ? (this.outcome === 'advantage' ? 'S' : this.outcome === 'normal' ? 'A' : 'B') : undefined;
    store.battleResult = { level: this.level.id, victory, grade, time, hp: Math.max(0, Math.round(this.playerHp)), pressure: this.outcome === 'pressure' };
    if (victory && grade) store.complete(this.level.id, grade, this.level.reward, this.level.awakening);
    audio.play(victory ? 'victory' : 'defeat');
    this.cameras.main.fadeOut(450);
    this.time.delayedCall(500, () => this.scene.start('Result'));
  }

  private resolveOutcome(): Outcome {
    if (this.armor.tier === 2 && this.level.id <= 3 && store.data.completed.includes(this.level.id)) return 'pressure';
    if (this.level.disadvantaged.includes(this.armor.id)) return 'defeat';
    if (this.level.preferred.includes(this.armor.id)) return 'advantage';
    return 'normal';
  }

  private damageEnemy(amount: number) { this.enemyHp = Math.max(0, this.enemyHp - amount); this.updateBars(); if (this.enemyHp <= 0 && this.enemy?.active) this.tweens.add({ targets: this.enemy, alpha: 0, scale: .2, angle: 20, duration: 500 }); }
  private updateBars() { if (this.playerBar) this.playerBar.scaleX = this.playerHp / 100; if (this.enemyBar) this.enemyBar.scaleX = this.enemyHp / this.enemyMaxHp; }
  private flashAt(x: number, y: number, color: number) { const f = this.add.circle(x, y, 18, color, .95).setDepth(40); this.tweens.add({ targets: f, scale: 4, alpha: 0, duration: 240, onComplete: () => f.destroy() }); }
  private flashMessage(message: string) { this.combatLog?.setText(message); this.time.delayedCall(900, () => { if (this.combatLog?.active) this.combatLog.setText(''); }); }
}

function makeCardSigil(scene: Phaser.Scene, card: CardDef, x: number, y: number) {
  const g = scene.add.graphics(); g.lineStyle(2, card.color, .95); g.fillStyle(card.color, .35);
  if (card.armor === 'scarlet-string') { g.strokeCircle(x, y, 9); g.lineBetween(x - 5, y - 5, x + 5, y + 5); g.lineBetween(x + 5, y - 5, x - 5, y + 5); }
  else if (card.armor === 'thorn-wolf') { g.fillTriangle(x, y - 10, x - 9, y + 7, x + 9, y + 7); g.strokeTriangle(x, y - 10, x - 9, y + 7, x + 9, y + 7); }
  else if (card.armor === 'tower-puppet') { g.strokeRect(x - 8, y - 8, 16, 16); g.lineBetween(x - 8, y, x + 8, y); }
  else if (card.armor === 'moon-string') { g.strokeCircle(x, y, 9); g.beginPath(); g.arc(x + 3, y - 1, 7, Math.PI * .2, Math.PI * 1.55, false); g.strokePath(); }
  else if (card.armor === 'vine-puppet') { g.beginPath(); g.moveTo(x - 8, y - 8); g.lineTo(x + 4, y - 2); g.lineTo(x - 2, y + 8); g.lineTo(x + 8, y + 6); g.strokePath(); }
  else if (card.armor === 'scarlet-giant') { g.fillTriangle(x - 9, y + 7, x, y - 10, x + 9, y + 7); g.strokeCircle(x, y + 2, 5); }
  else { g.strokeCircle(x, y, 8); g.fillCircle(x, y, 2); }
  return g;
}
