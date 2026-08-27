import type { ArmorId, Grade, MaterialId } from './data';

export interface SaveData {
  version: 1;
  unlockedLevel: number;
  completed: number[];
  materials: MaterialId[];
  recipes: ArmorId[];
  awakenings: MaterialId[];
  grades: Record<string, Grade>;
  transformations: Record<string, number>;
  sound: boolean;
  selectedLevel: number;
  cardUnlocks: Record<string, string[]>;
}

const KEY = 'potion-armor-save-v1';
const fresh = (): SaveData => ({
  version: 1,
  unlockedLevel: 1,
  completed: [],
  materials: ['hood', 'heart', 'bean'],
  recipes: [],
  awakenings: [],
  grades: {},
  transformations: {},
  sound: true,
  selectedLevel: 1,
  cardUnlocks: {},
});

export class GameStore {
  data: SaveData;
  currentArmor?: ArmorId;
  battleResult?: { level: number; victory: boolean; grade?: Grade; time: number; hp: number; pressure: boolean };

  constructor() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SaveData | null;
      this.data = parsed?.version === 1 ? { ...fresh(), ...parsed } : fresh();
      this.data.cardUnlocks ??= {};
    } catch { this.data = fresh(); }
  }

  save() { localStorage.setItem(KEY, JSON.stringify(this.data)); }
  reset() { this.data = fresh(); this.currentArmor = undefined; localStorage.removeItem(KEY); }
  hasMaterial(id: MaterialId) { return this.data.materials.includes(id); }
  addMaterial(id: MaterialId) { if (!this.hasMaterial(id)) this.data.materials.push(id); }
  discover(id: ArmorId) { if (!this.data.recipes.includes(id)) this.data.recipes.push(id); }
  transform(id: ArmorId) { this.data.transformations[id] = (this.data.transformations[id] ?? 0) + 1; this.currentArmor = id; this.discover(id); this.save(); }
  complete(level: number, grade: Grade, reward?: MaterialId, awakening?: MaterialId) {
    if (!this.data.completed.includes(level)) this.data.completed.push(level);
    this.data.unlockedLevel = Math.min(7, Math.max(this.data.unlockedLevel, level + 1));
    if (reward) this.addMaterial(reward);
    if (awakening && !this.data.awakenings.includes(awakening)) this.data.awakenings.push(awakening);
    const rank: Record<Grade, number> = { B: 1, A: 2, S: 3 };
    const old = this.data.grades[String(level)];
    if (!old || rank[grade] > rank[old]) this.data.grades[String(level)] = grade;
    this.save();
  }
  addCard(armor: ArmorId, cardId: string) {
    const cards = this.data.cardUnlocks[armor] ?? (this.data.cardUnlocks[armor] = []);
    if (!cards.includes(cardId)) { cards.push(cardId); this.save(); }
  }
}

export const store = new GameStore();

declare global {
  interface Window { __GAME_TEST_API__: { snapshot: () => object; workshop?: () => object } }
}

window.__GAME_TEST_API__ = {
  snapshot: () => JSON.parse(JSON.stringify({ save: store.data, armor: store.currentArmor, result: store.battleResult })),
};
