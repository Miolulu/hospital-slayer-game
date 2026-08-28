import { describe, expect, it } from 'vitest';
import { DeveloperMode } from './DeveloperMode';

describe('DeveloperMode', () => {
  it('只接受显式开启参数', () => {
    expect(new DeveloperMode('').options.enabled).toBe(false);
    expect(new DeveloperMode('?dev=1').options.enabled).toBe(true);
    expect(new DeveloperMode('?developer=true').options.enabled).toBe(true);
  });

  it('限制测试楼层和波次范围', () => {
    const mode = new DeveloperMode('?dev=1');
    expect(mode.applyControls({ floor: 999, wave: -4 })).toEqual({ floor: 30, wave: 1, godMode: undefined, autoClear: undefined });
  });

  it('读取并限制开发者模式速度参数', () => {
    const mode = new DeveloperMode('?dev=1&devSpeed=99');
    expect(mode.options.initialGameSpeed).toBe(99);
  });

  it('缺省楼层参数时保留开发者模式的最高楼层默认值', () => {
    const mode = new DeveloperMode('?dev=1');
    expect(mode.options.initialFloor).toBeUndefined();
  });
});
