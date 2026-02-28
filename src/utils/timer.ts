export class Cooldown {
  remaining = 0;

  constructor(public duration: number) {}

  update(dt: number): void {
    if (this.remaining > 0) {
      this.remaining -= dt;
    }
  }

  get ready(): boolean {
    return this.remaining <= 0;
  }

  trigger(): void {
    this.remaining = this.duration;
  }

  reset(): void {
    this.remaining = 0;
  }
}

export class IntervalTimer {
  elapsed = 0;

  constructor(public interval: number) {}

  update(dt: number): boolean {
    this.elapsed += dt;
    if (this.elapsed >= this.interval) {
      this.elapsed -= this.interval;
      return true;
    }
    return false;
  }
}
