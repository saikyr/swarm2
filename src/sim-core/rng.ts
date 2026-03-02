export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
    if (this.state === 0) this.state = 0x1234567;
  }

  next(): number {
    // xorshift32
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x | 0;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}
