import { store } from './store';

export type SoundId = 'tap' | 'select' | 'invalid' | 'drop' | 'brew' | 'transform' | 'hit' | 'skill' | 'danger' | 'finish' | 'victory' | 'defeat';

export class AudioManager {
  private context?: AudioContext;
  private ambient?: { osc: OscillatorNode; gain: GainNode };

  unlock() {
    this.context ??= new AudioContext();
    void this.context.resume();
    if (!this.ambient) this.startAmbient();
  }

  toggle() {
    store.data.sound = !store.data.sound;
    store.save();
    if (store.data.sound) this.unlock();
    this.ambient?.gain.gain.setTargetAtTime(store.data.sound ? 0.018 : 0.0001, this.context?.currentTime ?? 0, 0.08);
  }

  play(id: SoundId) {
    if (!store.data.sound) return;
    this.unlock();
    const ctx = this.context!;
    const configs: Record<SoundId, [number, number, OscillatorType, number]> = {
      tap: [260, 360, 'sine', .08], select: [360, 560, 'triangle', .13], invalid: [100, 70, 'sawtooth', .18], drop: [150, 80, 'square', .2],
      brew: [180, 760, 'sine', .32], transform: [140, 1200, 'sawtooth', .7], hit: [110, 55, 'square', .09], skill: [260, 920, 'sawtooth', .35],
      danger: [85, 55, 'sawtooth', .45], finish: [160, 1450, 'square', .7], victory: [440, 880, 'triangle', .65], defeat: [180, 70, 'sawtooth', .65],
    };
    const [from, to, type, duration] = configs[id];
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(from, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), ctx.currentTime + duration);
    gain.gain.setValueAtTime(id === 'hit' ? .08 : .045, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + duration);
  }

  pause() { void this.context?.suspend(); }
  resume() { if (store.data.sound) void this.context?.resume(); }

  private startAmbient() {
    const ctx = this.context!; const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 55; gain.gain.value = store.data.sound ? .018 : .0001;
    osc.connect(gain).connect(ctx.destination); osc.start(); this.ambient = { osc, gain };
  }
}

export const audio = new AudioManager();
