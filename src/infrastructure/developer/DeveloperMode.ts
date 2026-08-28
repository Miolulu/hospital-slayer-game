export interface DeveloperModeOptions {
  enabled: boolean;
  initialFloor?: number;
  initialWave?: number;
  initialGameSpeed?: number;
  godMode?: boolean;
  autoClear?: boolean;
}

export interface DeveloperControls {
  floor?: number;
  wave?: number;
  godMode?: boolean;
  autoClear?: boolean;
}

/**
 * 开发者模式只接受显式参数，正式包不会因为运行在本地浏览器就自动开启。
 * 示例：`?dev=1&devFloor=10&devWave=5&devGod=1`。
 */
export class DeveloperMode {
  readonly options: DeveloperModeOptions;

  constructor(search = typeof location === 'undefined' ? '' : location.search) {
    const params = new URLSearchParams(search);
    const enabled = ['dev', 'developer', 'builda_dev'].some((key) => {
      const value = params.get(key)?.toLowerCase();
      return value === '1' || value === 'true' || value === 'on';
    });
    this.options = {
      enabled,
      initialFloor: this.numberParam(params, 'devFloor'),
      initialWave: this.numberParam(params, 'devWave'),
      initialGameSpeed: this.numberParam(params, 'devSpeed'),
      godMode: this.booleanParam(params, 'devGod'),
      autoClear: this.booleanParam(params, 'devAutoClear'),
    };
  }

  applyControls(next: DeveloperControls): DeveloperControls {
    return {
      floor: this.clampInteger(next.floor, 0, 30),
      wave: this.clampInteger(next.wave, 1, 50),
      godMode: next.godMode,
      autoClear: next.autoClear,
    };
  }

  private numberParam(params: URLSearchParams, key: string) {
    const raw = params.get(key);
    if (raw === null || raw.trim() === '') return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.floor(value) : undefined;
  }

  private booleanParam(params: URLSearchParams, key: string) {
    const value = params.get(key)?.toLowerCase();
    return value === '1' || value === 'true' || value === 'on';
  }

  private clampInteger(value: number | undefined, min: number, max: number) {
    return value === undefined ? undefined : Math.max(min, Math.min(max, Math.floor(value)));
  }
}

export const developerMode = new DeveloperMode();
