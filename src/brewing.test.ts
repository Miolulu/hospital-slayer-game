import { describe, expect, it } from 'vitest';
import { StirTracker } from './brewing';

const point = (degrees: number, radius = 80) => {
  const angle = degrees * Math.PI / 180;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
};

describe('StirTracker', () => {
  it('completes after a clockwise 270 degree arc', () => {
    const tracker = new StirTracker({ x: 0, y: 0 }, 30, 120);
    expect(tracker.begin(point(0))).toBe(true);
    for (let angle = 15; angle <= 285; angle += 15) tracker.move(point(angle));
    expect(tracker.complete).toBe(true);
  });

  it('ignores counter-clockwise movement', () => {
    const tracker = new StirTracker({ x: 0, y: 0 }, 30, 120);
    tracker.begin(point(0));
    for (let angle = -15; angle >= -300; angle -= 15) tracker.move(point(angle));
    expect(tracker.progress).toBe(0);
  });

  it('keeps progress between pointer releases', () => {
    const tracker = new StirTracker({ x: 0, y: 0 }, 30, 120);
    tracker.begin(point(0)); for (let angle = 15; angle <= 150; angle += 15) tracker.move(point(angle)); tracker.end();
    const halfway = tracker.progress;
    tracker.begin(point(150)); for (let angle = 165; angle <= 300; angle += 15) tracker.move(point(angle));
    expect(halfway).toBeGreaterThan(.45);
    expect(tracker.complete).toBe(true);
  });

  it('does not start outside the visible stir ring', () => {
    const tracker = new StirTracker({ x: 0, y: 0 }, 30, 120);
    expect(tracker.begin(point(0, 10))).toBe(false);
    expect(tracker.begin(point(0, 160))).toBe(false);
  });
});
