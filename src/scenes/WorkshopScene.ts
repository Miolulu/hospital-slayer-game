import Phaser from 'phaser';
import { ARMORS, findRecipe, LEVELS, MATERIALS, type ArmorDef, type MaterialId } from '../data';
import { audio } from '../audio';
import { addCoverImage, createAlchemyPanel, createArmor, createCat, createCauldron, createMaterial, createTitlePlaque, drawWorkbench } from '../art';
import { store } from '../store';
import { COLORS, iconButton, soundButton, text, vignette } from '../ui';
import { StirTracker } from '../brewing';

export class WorkshopScene extends Phaser.Scene {
  private selected: MaterialId[] = [];
  private dropped: MaterialId[] = [];
  private materialNodes = new Map<MaterialId, Phaser.GameObjects.Container>();
  private origins = new Map<MaterialId, Phaser.Math.Vector2>();
  private cauldron!: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  private recipeText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private selectionText!: Phaser.GameObjects.Text;
  private dropButton?: Phaser.GameObjects.Container;
  private bottle?: Phaser.GameObjects.Container;
  private stirTracker?: StirTracker;
  private stirRing!: Phaser.GameObjects.Graphics;
  private stirTrail!: Phaser.GameObjects.Graphics;
  private stirPoints: Phaser.Math.Vector2[] = [];
  private selectedRings = new Map<MaterialId, Phaser.GameObjects.Arc>();
  private ingredientSlots: Array<{ ring: Phaser.GameObjects.Arc; marker: Phaser.GameObjects.Text }> = [];
  private activeDrag?: {
    id: MaterialId;
    node: Phaser.GameObjects.Container;
    downX: number;
    downY: number;
    moved: boolean;
    pointerId?: number;
    longTimer?: Phaser.Time.TimerEvent;
  };

  constructor() { super('Workshop'); }
  create() {
    this.resetRunState();
    const { width: w, height: h } = this.scale;
    if (!addCoverImage(this, 'workshop-background')) drawWorkbench(this);
    vignette(this, w, h); soundButton(this, w - 38, 34);
    text(this, 28, 30, '女 巫 塔 · 炼 药 房', 21, '#eee1c1');
    createTitlePlaque(this, 180, 32, Math.min(360, w * .42), 44).setDepth(4);
    text(this, 180, 32, '炼药工坊', 19, '#2d2116', 'center').setDepth(5);
    const level = LEVELS[store.data.selectedLevel - 1];
    text(this, 28, 57, `${level.chapter} / ${level.title}  ·  ${level.keywords.join(' · ')}`, 13, '#9bc3b9');
    const phaseY = h < 500 ? 76 : 88;
    this.phaseText = text(this, w * .52, phaseY, '① 选择遗物    ② 投入坩埚    ③ 搅拌变身', 13, '#d8c79f', 'center').setDepth(6);
    this.add.rectangle(w * .52, phaseY, Math.min(500, w * .46), 28, 0x090b10, .55).setStrokeStyle(1, COLORS.gold, .35).setDepth(5);
    this.phaseText.setDepth(6);
    createCat(this, w * .12, h * .66, Math.min(.72, h / 540));
    this.cauldron = createCauldron(this, w * .52, h * .65, Math.min(1, h / 430));
    this.stirTracker = new StirTracker({ x: this.cauldron.x, y: this.cauldron.y - 5 }, 34, Math.max(115, h * .2));
    this.stirRing = this.add.graphics().setDepth(18).setVisible(false);
    this.stirTrail = this.add.graphics().setDepth(19).setVisible(false);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.startStir(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.handlePointerMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.handlePointerUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.handlePointerUp(p));
    this.input.on('pointercancel', () => { this.stopStir(); this.cancelAll(); });
    const canvas = this.game.canvas as HTMLCanvasElement;
    const nativeMove = (event: PointerEvent) => {
      const drag = this.activeDrag;
      if (!drag || (drag.pointerId !== undefined && drag.pointerId !== event.pointerId)) return;
      event.preventDefault();
      const point = this.nativeToGame(event);
      if (!drag.moved && Phaser.Math.Distance.Between(drag.downX, drag.downY, point.x, point.y) > 12) {
        drag.moved = true;
        drag.longTimer?.remove(false);
      }
      if (drag.moved) drag.node.setPosition(point.x, point.y).setScale(1.12).setDepth(20);
    };
    const nativeUp = (event: PointerEvent) => {
      const drag = this.activeDrag;
      if (!drag || (drag.pointerId !== undefined && drag.pointerId !== event.pointerId)) return;
      event.preventDefault();
      this.finishDrag();
    };
    canvas.addEventListener('pointermove', nativeMove, { passive: false });
    canvas.addEventListener('pointerup', nativeUp, { passive: false });
    canvas.addEventListener('pointercancel', nativeUp, { passive: false });
    const ids = store.data.materials.filter((id) => id !== 'shoe');
    const startX = w * .28; const availableWidth = w * .66; const gap = availableWidth / Math.max(ids.length, 3);
    const materialY = h < 500 ? Math.min(132, h * .36) : h * .28;
    ids.forEach((id, index) => this.spawnMaterial(id, startX + gap * (index + .35), materialY));
    const panelWidth = Math.min(250, w * .25);
    this.add.rectangle(w * .79, h * .61, panelWidth, 108, 0x090b10, .72).setStrokeStyle(1, COLORS.gold, .45);
    createAlchemyPanel(this, w * .79, h * .54, panelWidth, 230).setDepth(1);
    text(this, w * .79, h * .545, '炼装共鸣', 12, '#9bc3b9', 'center');
    this.recipeText = text(this, w * .79, h * .6, '尚未共鸣', h < 500 ? 15 : 18, '#918c81', 'center').setWordWrapWidth(panelWidth - 16);
    this.hint = text(this, w * .79, h * .675, h < 500 ? '先点选两件遗物' : '先点亮两件遗物，再拖入坩埚', 13, '#d7c7a5', 'center').setWordWrapWidth(panelWidth - 16);
    this.selectionText = text(this, w * .79, h * .72, '已选择 0/2', 12, '#9bc3b9', 'center').setDepth(3).setWordWrapWidth(panelWidth - 16);
    this.recipeText.setDepth(3);
    this.hint.setDepth(3);
    this.drawIngredientSlots();
    this.dropButton = iconButton(this, w * .79, Math.min(h - 62, h * .81), '⚗', '投入选中遗物', () => this.commitSelectedToCauldron(), Math.min(190, w * .23)).setDepth(5);
    this.dropButton.setAlpha(.42);
    iconButton(this, 92, h - 40, '‹', '童话书', () => this.scene.start('StoryBook'), 128);
    window.__GAME_TEST_API__.workshop = () => ({
      selected: [...this.selected], dropped: [...this.dropped],
      activeDrag: this.activeDrag?.id ?? null,
      nodes: [...this.materialNodes.entries()].map(([id, node]) => ({ id, x: node.x, y: node.y, alpha: node.alpha })),
    });
    const releaseFromWindow = () => { if (this.activeDrag) this.handlePointerUp(this.input.activePointer); };
    window.addEventListener('pointerup', releaseFromWindow);
    window.addEventListener('pointercancel', releaseFromWindow);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cancelAll());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('pointermove', nativeMove);
      canvas.removeEventListener('pointerup', nativeUp);
      canvas.removeEventListener('pointercancel', nativeUp);
      window.removeEventListener('pointerup', releaseFromWindow);
      window.removeEventListener('pointercancel', releaseFromWindow);
      window.__GAME_TEST_API__.workshop = undefined;
    });
  }

  private resetRunState() {
    this.selected = [];
    this.dropped = [];
    this.materialNodes.clear();
    this.origins.clear();
    this.selectedRings.clear();
    this.ingredientSlots = [];
    this.stirPoints = [];
    this.stirTracker = undefined;
    this.bottle = undefined;
    this.activeDrag = undefined;
  }

  private spawnMaterial(id: MaterialId, x: number, y: number) {
    const node = createMaterial(this, MATERIALS[id], x, y).setSize(112, 126).setInteractive({ useHandCursor: true });
    this.origins.set(id, new Phaser.Math.Vector2(x, y)); this.materialNodes.set(id, node);
    const ring = this.add.circle(x, y, 48, MATERIALS[id].color, .08).setStrokeStyle(3, MATERIALS[id].color, 0).setDepth(2);
    this.selectedRings.set(id, ring);
    text(this, x, y + 58, MATERIALS[id].name, 12, '#d8cba9', 'center').setDepth(3);
    node.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.dropped.includes(id)) return;
      audio.unlock();
      const drag = { id, node, downX: p.x, downY: p.y, moved: false, pointerId: (p as unknown as { pointerId?: number }).pointerId } as NonNullable<WorkshopScene['activeDrag']>;
      drag.longTimer = this.time.delayedCall(450, () => {
        if (!drag.moved && this.activeDrag === drag) { this.showInfo(id, node.x, node.y + 72); audio.play('select'); }
      });
      this.activeDrag = drag;
    });
  }

  private handlePointerMove(p: Phaser.Input.Pointer) {
    const drag = this.activeDrag;
    if (drag) {
      if (!drag.moved && Phaser.Math.Distance.Between(drag.downX, drag.downY, p.x, p.y) > 12) {
        drag.moved = true;
        drag.longTimer?.remove(false);
      }
      if (drag.moved) drag.node.setPosition(p.x, p.y).setScale(1.12).setDepth(20);
      return;
    }
    this.moveStir(p);
  }

  private handlePointerUp(p: Phaser.Input.Pointer) {
    const drag = this.activeDrag;
    if (!drag) { this.stopStir(); return; }
    const pointerId = (p as unknown as { pointerId?: number }).pointerId;
    if (drag.pointerId !== undefined && pointerId !== undefined && drag.pointerId !== pointerId) return;
    this.finishDrag();
  }

  private finishDrag() {
    const drag = this.activeDrag;
    if (!drag) return;
    drag.longTimer?.remove(false);
    this.activeDrag = undefined;
    if (drag.moved) this.tryDrop(drag.id, drag.node);
    else this.toggleSelect(drag.id);
  }

  private nativeToGame(event: PointerEvent) {
    const rect = this.game.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.scale.width / Math.max(1, rect.width)),
      y: (event.clientY - rect.top) * (this.scale.height / Math.max(1, rect.height)),
    };
  }

  private toggleSelect(id: MaterialId) {
    if (this.dropped.includes(id)) return;
    const index = this.selected.indexOf(id);
    if (index >= 0) this.selected.splice(index, 1);
    else if (this.selected.length < 2) this.selected.push(id);
    else { audio.play('invalid'); this.hint.setText('一次魔药只能聆听两个故事'); }
    audio.play('select'); this.refreshSelection();
  }

  private refreshSelection() {
    for (const [id, node] of this.materialNodes) {
      if (this.dropped.includes(id)) continue;
      const chosen = this.selected.includes(id); node.setScale(chosen ? 1.18 : 1).setAlpha(this.selected.length === 1 && !chosen && !this.canPair(this.selected[0], id) ? .35 : 1);
      this.selectedRings.get(id)?.setFillStyle(MATERIALS[id].color, chosen ? .2 : .06).setStrokeStyle(3, MATERIALS[id].color, chosen ? 1 : 0);
      node.list[0]?.setData?.('selected', chosen);
    }
    const recipe = this.selected.length === 2 ? findRecipe(this.selected[0], this.selected[1]) : undefined;
    this.recipeText.setText(recipe ? `${recipe.name}\n${recipe.role}` : this.selected.length ? '再点亮一件共鸣遗物' : '尚未共鸣').setColor(recipe ? '#f0cf72' : '#918c81');
    this.selectionText.setText(`已选择 ${this.selected.length}/2  ·  已投入 ${this.dropped.length}/2`);
    if (this.dropButton) {
      const next = this.selected.find((id) => !this.dropped.includes(id));
      this.dropButton.setAlpha(next ? 1 : .42);
    }
    if (this.dropped.length === 2) {
      this.phaseText.setText('① 选择遗物    ② 投入坩埚 ✓    ③ 顺时针搅拌');
    } else if (this.dropped.length === 1) {
      this.phaseText.setText('① 选择遗物 ✓    ② 投入第二件遗物    ③ 搅拌变身');
    } else if (this.selected.length === 2) {
      this.phaseText.setText('① 选择遗物 ✓    ② 点击投入或直接拖拽    ③ 搅拌变身');
    } else {
      this.phaseText.setText('① 选择遗物    ② 投入坩埚    ③ 搅拌变身');
    }
    if (recipe) this.hint.setText(this.scale.height < 500 ? '点击投入，或直接拖入' : '点击“投入选中遗物”，或把遗物拖进坩埚');
  }

  private canPair(a: MaterialId, b: MaterialId) { return !!findRecipe(a, b); }
  private commitSelectedToCauldron() {
    const id = this.selected.find((candidate) => !this.dropped.includes(candidate));
    if (!id) { audio.play('invalid'); return; }
    const node = this.materialNodes.get(id);
    if (node) this.acceptDrop(id, node);
  }
  private tryDrop(id: MaterialId, node: Phaser.GameObjects.Container) {
    const origin = this.origins.get(id)!; const close = Phaser.Math.Distance.Between(node.x, node.y, this.cauldron.x, this.cauldron.y) < 115;
    const first = this.dropped[0] ?? this.selected[0];
    const validPair = first ? !!findRecipe(first, id) : true;
    const selectedPair = this.selected.length === 2 && !!findRecipe(this.selected[0], this.selected[1]);
    const valid = close && this.dropped.length < 2 && (
      this.dropped.length === 1 ? validPair :
      this.selected.length === 2 ? this.selected.includes(id) && selectedPair :
      this.selected.length === 1 ? validPair : true
    );
    if (valid) {
      this.acceptDrop(id, node);
    } else {
      if (close) { audio.play('invalid'); this.cameras.main.shake(120, .005); this.hint.setText(this.scale.height < 500 ? '换一件可共鸣遗物' : '这两件故事无法共鸣，换一件遗物'); }
      this.tweens.add({ targets: node, x: origin.x, y: origin.y, scale: this.selected.includes(id) ? 1.14 : 1, alpha: 1, duration: 200, ease: 'Back.Out' });
    }
  }

  private acceptDrop(id: MaterialId, node: Phaser.GameObjects.Container) {
    if (this.dropped.includes(id) || this.dropped.length >= 2) return;
    if (this.dropped.length === 1 && !findRecipe(this.dropped[0], id)) {
      audio.play('invalid'); this.hint.setText('这两件遗物无法共鸣，请换一个'); return;
    }
    const origin = this.origins.get(id)!;
    audio.play('drop');
    if (!this.selected.includes(id)) this.selected.push(id);
    this.dropped.push(id); node.disableInteractive();
    this.tweens.add({
      targets: node, x: this.cauldron.x, y: this.cauldron.y - 20, scale: .1, alpha: 0, angle: 180, duration: 420,
      onComplete: () => node.setPosition(origin.x, origin.y),
    });
    this.selectedRings.get(id)?.setVisible(false); this.updateIngredientSlots(); this.refreshSelection();
    this.hint.setText(this.dropped.length === 2 ? '沿发光圆环顺时针搅拌' : '再投入另一件已选遗物');
    if (this.dropped.length === 2) this.showStirRing();
  }

  private startStir(p: Phaser.Input.Pointer) {
    if (this.dropped.length !== 2 || this.bottle || !this.stirTracker?.begin(p)) return;
    this.stirPoints = [new Phaser.Math.Vector2(p.x, p.y)]; this.stirTrail.setVisible(true); audio.play('select');
  }
  private moveStir(p: Phaser.Input.Pointer) {
    if (!p.isDown || !this.stirTracker) return;
    const progress = this.stirTracker.move(p); this.stirPoints.push(new Phaser.Math.Vector2(p.x, p.y));
    if (this.stirPoints.length > 28) this.stirPoints.shift(); this.drawStirTrail();
    this.cauldron.angle = Math.sin(progress * Math.PI * 8) * 3; this.hint.setText(`魔药沸腾中 · ${Math.round(progress * 100)}%`); this.drawStirRing(progress);
    if (this.stirTracker.complete) this.finishBrew();
  }
  private stopStir() { this.stirTracker?.end(); this.stirPoints = []; this.stirTrail.clear().setVisible(false); }

  private finishBrew() {
    this.stopStir(); audio.play('brew'); const recipe = findRecipe(this.selected[0], this.selected[1])!;
    this.stirRing.setVisible(false); this.cauldron.setAngle(0);
    this.cameras.main.flash(250, 65, 190, 150); this.bottle = this.makeBottle(recipe); this.hint.setText('点击发光药瓶，炼装！');
  }

  private makeBottle(recipe: ArmorDef) {
    const x = this.cauldron.x; const y = this.cauldron.y - 110; const g = this.add.graphics();
    if (this.textures.exists('ui-potion-bottle')) {
      const image = this.add.image(0, 0, 'ui-potion-bottle');
      image.setDisplaySize(72, 108);
      const c = this.add.container(x, y, [image]).setSize(82, 118).setInteractive().setDepth(30);
      this.tweens.add({ targets: c, y: y - 12, scale: 1.12, duration: 650, yoyo: true, repeat: -1 });
      c.on('pointerup', () => this.transform(recipe));
      return c;
    }
    g.fillStyle(recipe.color, .9); g.fillRoundedRect(-18, -30, 36, 56, 9); g.fillStyle(0xe8d6af); g.fillRect(-9, -45, 18, 15); g.lineStyle(3, recipe.accent); g.strokeRoundedRect(-18, -30, 36, 56, 9);
    const c = this.add.container(x, y, [g]).setSize(72, 90).setInteractive().setDepth(30); this.tweens.add({ targets: c, y: y - 12, scale: 1.12, duration: 650, yoyo: true, repeat: -1 });
    c.on('pointerup', () => this.transform(recipe)); return c;
  }

  private transform(recipe: ArmorDef) {
    audio.play('transform'); const first = (store.data.transformations[recipe.id] ?? 0) === 0; store.transform(recipe.id);
    const { width: w, height: h } = this.scale; const veil = this.add.rectangle(w / 2, h / 2, w, h, 0x050609, .96).setDepth(100);
    const armor = createArmor(this, recipe, w / 2, h * .58, 1.25).setDepth(102).setScale(.05); const title = text(this, w / 2, h * .19, recipe.name, 34, '#f4dfad', 'center').setDepth(103).setAlpha(0);
    text(this, w / 2, h * .28, recipe.finisher, 15, '#9fd1c3', 'center').setDepth(103).setAlpha(.9);
    this.tweens.add({ targets: armor, scale: 1.25, angle: 360, duration: 900, ease: 'Back.Out' }); this.tweens.add({ targets: title, alpha: 1, y: h * .17, duration: 500 });
    let proceeded = false;
    const proceed = () => { if (proceeded) return; proceeded = true; veil.destroy(); this.scene.start('Battle'); };
    if (!first) iconButton(this, w - 85, 54, '≫', '跳过', proceed, 110).setDepth(110);
    this.time.delayedCall(first ? 2600 : 2200, proceed);
  }

  private showInfo(id: MaterialId, x: number, y: number) { const d = MATERIALS[id]; const pop = text(this, x, y, `${d.name}\n${d.keywords}`, 13, '#fff0c8', 'center').setBackgroundColor('#171319dd').setPadding(10).setDepth(50); this.time.delayedCall(1500, () => pop.destroy()); }
  private drawIngredientSlots() {
    for (const offset of [-28, 28]) {
      const ring = this.add.circle(this.cauldron.x + offset, this.cauldron.y - 78, 18, 0x0a0c10, .75).setStrokeStyle(2, COLORS.gold, .55).setDepth(17);
      const mark = text(this, this.cauldron.x + offset, this.cauldron.y - 78, '+', 16, '#9a8863', 'center').setDepth(18);
      this.ingredientSlots.push({ ring, marker: mark });
    }
  }
  private updateIngredientSlots() {
    this.dropped.forEach((id, index) => {
      const slot = this.ingredientSlots[index]; if (!slot) return;
      slot.marker.setText(MATERIALS[id].name.slice(0, 1)).setColor('#f4dfa8');
      slot.ring.setFillStyle(MATERIALS[id].color, .8);
    });
  }
  private showStirRing() { this.stirTracker?.reset(); this.drawStirRing(0); this.stirRing.setVisible(true); }
  private drawStirRing(progress = 0) {
    const r = Math.min(105, this.scale.height * .17); const start = -Math.PI / 2;
    this.stirRing.clear().lineStyle(5, 0x5ec7af, .22).strokeCircle(this.cauldron.x, this.cauldron.y - 5, r);
    if (progress > 0) this.stirRing.lineStyle(7, 0xf0ca68, .95).beginPath().arc(this.cauldron.x, this.cauldron.y - 5, r, start, start + Math.PI * 2 * progress, false).strokePath();
    this.stirRing.fillStyle(0xf0ca68, .95).fillTriangle(this.cauldron.x + r - 6, this.cauldron.y - 18, this.cauldron.x + r + 12, this.cauldron.y - 5, this.cauldron.x + r - 6, this.cauldron.y + 8);
  }
  private drawStirTrail() {
    this.stirTrail.clear().lineStyle(5, 0xf2d581, .75).beginPath(); this.stirPoints.forEach((point, index) => index ? this.stirTrail.lineTo(point.x, point.y) : this.stirTrail.moveTo(point.x, point.y)); this.stirTrail.strokePath();
  }
  private cancelAll() {
    this.stopStir();
    this.activeDrag?.longTimer?.remove(false);
    this.activeDrag = undefined;
    for (const [id, node] of this.materialNodes) { const o = this.origins.get(id)!; if (!this.dropped.includes(id)) node.setPosition(o.x, o.y); }
  }
}
