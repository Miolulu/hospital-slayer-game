import { store } from './store';

export type SoundId = 'tap' | 'select' | 'invalid' | 'drop' | 'brew' | 'transform' | 'hit' | 'skill' | 'danger' | 'finish' | 'victory' | 'defeat';
export type WeaponSoundClass = 'sword' | 'gun' | 'whip' | 'cannon';
export type EnemySoundKind = 'chaser' | 'shooter' | 'disruptor' | 'tentacle' | 'bomber' | 'eye' | 'miniBoss' | 'boss';

type ToneOptions = {
  from: number;
  to?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  detune?: number;
  destination?: GainNode;
};

const nowMs = () => typeof performance !== 'undefined' ? performance.now() : Date.now();

export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private musicGain?: GainNode;
  private sfxGain?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private musicTimer?: number;
  private musicStep = 0;
  private lastPlayed = new Map<string, number>();
  private lastVibrationAt = 0;

  unlock() {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === 'suspended') void context.resume();
    this.startMusic();
  }

  toggle() {
    store.data.sound = !store.data.sound;
    store.save();
    if (store.data.sound) this.unlock();
    const target = store.data.sound ? 1 : 0.0001;
    this.master?.gain.setTargetAtTime(target, this.context?.currentTime ?? 0, 0.08);
  }

  isEnabled() {
    return store.data.sound;
  }

  play(id: SoundId) {
    if (!store.data.sound) return;
    const configs: Record<SoundId, ToneOptions> = {
      tap: { from: 260, to: 360, type: 'sine', duration: 0.08, gain: 0.055 },
      select: { from: 360, to: 560, type: 'triangle', duration: 0.13, gain: 0.07 },
      invalid: { from: 100, to: 70, type: 'sawtooth', duration: 0.18, gain: 0.08 },
      drop: { from: 150, to: 80, type: 'square', duration: 0.2, gain: 0.07 },
      brew: { from: 180, to: 760, type: 'sine', duration: 0.32, gain: 0.07 },
      transform: { from: 140, to: 1200, type: 'sawtooth', duration: 0.7, gain: 0.09 },
      hit: { from: 110, to: 55, type: 'square', duration: 0.09, gain: 0.08 },
      skill: { from: 260, to: 920, type: 'sawtooth', duration: 0.35, gain: 0.08 },
      danger: { from: 85, to: 55, type: 'sawtooth', duration: 0.45, gain: 0.085 },
      finish: { from: 160, to: 1450, type: 'square', duration: 0.7, gain: 0.09 },
      victory: { from: 440, to: 880, type: 'triangle', duration: 0.65, gain: 0.085 },
      defeat: { from: 180, to: 70, type: 'sawtooth', duration: 0.65, gain: 0.09 },
    };
    this.playTone(configs[id]);
  }

  playBattleStart() {
    if (!this.allow('battle-start', 350)) return;
    this.playTone({ from: 146, to: 220, type: 'triangle', duration: 0.22, gain: 0.08, attack: 0.004 });
    window.setTimeout(() => this.playTone({ from: 220, to: 330, type: 'triangle', duration: 0.24, gain: 0.065 }), 90);
  }

  playWeaponAttack(weaponClass: WeaponSoundClass) {
    if (!this.allow('weapon-attack', 85)) return;
    const sounds: Record<WeaponSoundClass, ToneOptions> = {
      sword: { from: 220, to: 720, type: 'triangle', duration: 0.13, gain: 0.095 },
      gun: { from: 460, to: 120, type: 'square', duration: 0.075, gain: 0.11, attack: 0.002 },
      whip: { from: 520, to: 145, type: 'sawtooth', duration: 0.15, gain: 0.075 },
      cannon: { from: 82, to: 34, type: 'sine', duration: 0.24, gain: 0.14, attack: 0.006 },
    };
    this.playTone(sounds[weaponClass]);
    if (weaponClass === 'gun' || weaponClass === 'cannon') this.playNoise(weaponClass === 'cannon' ? 0.16 : 0.08, 0.07);
    else this.playNoise(0.055, 0.1, 900);
  }

  playEnemyHit(kind: EnemySoundKind = 'chaser') {
    if (!this.allow(`enemy-hit-${kind}`, 42)) return;
    const heavy = kind === 'miniBoss' || kind === 'boss' || kind === 'bomber';
    this.playTone({ from: heavy ? 92 : 155, to: heavy ? 42 : 78, type: heavy ? 'sine' : 'square', duration: heavy ? 0.16 : 0.085, gain: heavy ? 0.105 : 0.06, attack: 0.002 });
    this.playNoise(heavy ? 0.11 : 0.045, heavy ? 0.11 : 0.07, heavy ? 420 : 1200);
  }

  playEnemyDeath(kind: EnemySoundKind = 'chaser') {
    if (!this.allow('enemy-death', 55)) return;
    const heavy = kind === 'miniBoss' || kind === 'boss';
    this.playTone({ from: heavy ? 190 : 290, to: 48, type: heavy ? 'sawtooth' : 'triangle', duration: heavy ? 0.36 : 0.2, gain: heavy ? 0.12 : 0.07 });
    this.playNoise(heavy ? 0.16 : 0.07, heavy ? 0.22 : 0.1, 520);
  }

  playEnemyAttack(kind: EnemySoundKind = 'chaser') {
    if (!this.allow(`enemy-attack-${kind}`, kind === 'boss' ? 280 : 150)) return;
    const sounds: Record<EnemySoundKind, ToneOptions> = {
      chaser: { from: 130, to: 58, type: 'sawtooth', duration: 0.16, gain: 0.07 },
      shooter: { from: 520, to: 220, type: 'square', duration: 0.11, gain: 0.065 },
      disruptor: { from: 78, to: 38, type: 'sine', duration: 0.3, gain: 0.09 },
      tentacle: { from: 260, to: 75, type: 'sawtooth', duration: 0.23, gain: 0.075 },
      bomber: { from: 110, to: 30, type: 'sine', duration: 0.42, gain: 0.115 },
      eye: { from: 780, to: 260, type: 'square', duration: 0.25, gain: 0.09 },
      miniBoss: { from: 170, to: 44, type: 'sawtooth', duration: 0.38, gain: 0.13 },
      boss: { from: 120, to: 28, type: 'sine', duration: 0.55, gain: 0.16 },
    };
    this.playTone(sounds[kind]);
    this.playNoise(kind === 'boss' || kind === 'bomber' ? 0.16 : 0.06, kind === 'boss' ? 0.34 : 0.12, 360);
  }

  playPlayerHit() {
    if (this.allow('player-hit', 80)) {
      this.playTone({ from: 190, to: 62, type: 'triangle', duration: 0.19, gain: 0.12, attack: 0.002 });
      this.playNoise(0.1, 0.12, 680);
    }
    this.vibrate(24);
  }

  playPlayerDeath() {
    if (this.allow('player-death', 200)) {
      this.playTone({ from: 240, to: 36, type: 'sawtooth', duration: 0.72, gain: 0.16 });
      this.playNoise(0.14, 0.42, 300);
    }
    this.vibrate([0, 42, 28, 78, 40]);
  }

  playPickup() {
    if (!this.allow('pickup', 90)) return;
    this.playTone({ from: 540, to: 980, type: 'triangle', duration: 0.14, gain: 0.06 });
  }

  playLevelUp() {
    if (!this.allow('level-up', 150)) return;
    this.playTone({ from: 320, to: 760, type: 'triangle', duration: 0.28, gain: 0.09 });
    window.setTimeout(() => this.playTone({ from: 520, to: 1180, type: 'triangle', duration: 0.3, gain: 0.075 }), 90);
  }

  playBossEntrance() {
    if (!this.allow('boss-entrance', 600)) return;
    this.playTone({ from: 64, to: 28, type: 'sine', duration: 0.9, gain: 0.16 });
    this.playNoise(0.15, 0.6, 260);
    this.vibrate([0, 35, 20, 35]);
  }

  playBossDeath() {
    if (!this.allow('boss-death', 600)) return;
    this.playTone({ from: 220, to: 32, type: 'sawtooth', duration: 1.1, gain: 0.18 });
    this.playNoise(0.18, 0.8, 220);
    this.vibrate([0, 55, 30, 90, 45]);
  }

  pause() {
    void this.context?.suspend();
  }

  resume() {
    if (store.data.sound) this.unlock();
  }

  destroy() {
    if (this.musicTimer !== undefined) window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    this.context?.close();
    this.context = undefined;
    this.master = undefined;
    this.musicGain = undefined;
    this.sfxGain = undefined;
    this.noiseBuffer = undefined;
  }

  private ensureContext() {
    if (this.context) return this.context;
    if (typeof window === 'undefined') return undefined;
    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextCtor) return undefined;
    try {
      const context = new AudioContextCtor();
      const master = context.createGain();
      const musicGain = context.createGain();
      const sfxGain = context.createGain();
      master.gain.value = store.data.sound ? 1 : 0.0001;
      musicGain.gain.value = 0.28;
      sfxGain.gain.value = 0.86;
      musicGain.connect(master);
      sfxGain.connect(master);
      master.connect(context.destination);
      this.context = context;
      this.master = master;
      this.musicGain = musicGain;
      this.sfxGain = sfxGain;
      return context;
    } catch {
      return undefined;
    }
  }

  private allow(key: string, intervalMs: number) {
    if (!store.data.sound) return false;
    const current = nowMs();
    const previous = this.lastPlayed.get(key) ?? -Infinity;
    if (current - previous < intervalMs) return false;
    this.lastPlayed.set(key, current);
    return true;
  }

  private playTone(options: ToneOptions) {
    const context = this.ensureContext();
    const destination = options.destination ?? this.sfxGain;
    if (!context || !destination || !store.data.sound) return;
    const start = context.currentTime + 0.006;
    const duration = Math.max(0.025, options.duration);
    const attack = Math.min(options.attack ?? 0.008, duration * 0.35);
    const release = Math.min(options.release ?? duration * 0.45, duration * 0.65);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = options.type ?? 'triangle';
    osc.detune.value = options.detune ?? 0;
    osc.frequency.setValueAtTime(Math.max(20, options.from), start);
    if (options.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), start + duration);
    const peak = Math.max(0.0001, options.gain ?? 0.07);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.setValueAtTime(peak, start + Math.max(attack, duration - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.025);
  }

  private playNoise(gainAmount: number, duration: number, highPass = 700) {
    const context = this.ensureContext();
    if (!context || !this.sfxGain || !store.data.sound) return;
    if (!this.noiseBuffer) {
      const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const start = context.currentTime + 0.006;
    source.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = highPass;
    gain.gain.setValueAtTime(Math.max(0.0001, gainAmount), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(0.025, duration));
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(start);
    source.stop(start + duration + 0.025);
  }

  private startMusic() {
    if (this.musicTimer !== undefined || !this.context || !this.musicGain || !store.data.sound) return;
    this.musicStep = 0;
    this.tickMusic();
    this.musicTimer = window.setInterval(() => this.tickMusic(), 360);
  }

  private tickMusic() {
    if (!this.context || !this.musicGain || !store.data.sound) return;
    const lead = [196, 233, 262, 294, 262, 233, 175, 147][this.musicStep % 8];
    const bass = [98, 98, 87, 87, 73.5, 73.5, 82.5, 82.5][this.musicStep % 8];
    this.playTone({ from: lead, to: lead * 0.985, type: 'square', duration: 0.24, gain: 0.045, attack: 0.006, destination: this.musicGain });
    this.playTone({ from: bass, to: bass * 0.97, type: 'triangle', duration: 0.3, gain: 0.055, attack: 0.012, destination: this.musicGain });
    if (this.musicStep % 4 === 3) this.playTone({ from: lead * 2, to: lead * 1.5, type: 'sine', duration: 0.12, gain: 0.025, destination: this.musicGain });
    this.musicStep += 1;
  }

  private vibrate(pattern: number | number[]) {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    const current = nowMs();
    if (current - this.lastVibrationAt < 45) return;
    this.lastVibrationAt = current;
    navigator.vibrate(pattern);
  }
}

export const audio = new AudioManager();
