export interface StirPoint { x: number; y: number }

export class StirTracker {
  private lastAngle?: number;
  private total = 0;
  private active = false;

  constructor(
    private readonly center: StirPoint,
    private readonly minRadius: number,
    private readonly maxRadius: number,
    private readonly targetRadians = Math.PI * 1.5,
  ) {}

  begin(point: StirPoint) {
    if (!this.inRing(point)) return false;
    this.active = true;
    this.lastAngle = Math.atan2(point.y - this.center.y, point.x - this.center.x);
    return true;
  }

  move(point: StirPoint) {
    if (!this.active || !this.inRing(point) || this.lastAngle === undefined) return this.progress;
    const angle = Math.atan2(point.y - this.center.y, point.x - this.center.x);
    let delta = angle - this.lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    if (delta > 0 && delta < Math.PI / 2) this.total += delta;
    this.lastAngle = angle;
    return this.progress;
  }

  end() { this.active = false; this.lastAngle = undefined; }
  reset() { this.total = 0; this.end(); }
  get progress() { return Math.min(1, this.total / this.targetRadians); }
  get complete() { return this.progress >= 1; }

  private inRing(point: StirPoint) {
    const distance = Math.hypot(point.x - this.center.x, point.y - this.center.y);
    return distance >= this.minRadius && distance <= this.maxRadius;
  }
}
