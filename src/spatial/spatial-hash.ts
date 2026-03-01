import type { Entity } from '../ecs/entity';
import type { Vec2 } from '../utils/math';

export class SpatialHash {
  private cells = new Map<number, Entity[]>();
  // Track which query generation each entity was last seen in, to avoid Set allocation
  private entityGeneration = new Map<Entity, number>();
  private currentGeneration = 0;
  // Frame generation — cells with stale frameGen are treated as empty
  private frameGen = 0;
  private cellFrameGen = new Map<number, number>();

  constructor(private cellSize: number) {}

  private key(cx: number, cy: number): number {
    const a = cx + 50000;
    const b = cy + 50000;
    return a * 100001 + b;
  }

  clear(): void {
    // Increment frame generation instead of clearing maps — avoids GC pressure
    this.frameGen++;
    this.currentGeneration = 0;
    // Periodically do a real clear to avoid unbounded growth from cells that are no longer used
    if (this.frameGen % 600 === 0) {
      this.cells.clear();
      this.cellFrameGen.clear();
      this.entityGeneration.clear();
    }
  }

  insert(entity: Entity, pos: Vec2, radius: number): void {
    const minCX = Math.floor((pos.x - radius) / this.cellSize);
    const minCY = Math.floor((pos.y - radius) / this.cellSize);
    const maxCX = Math.floor((pos.x + radius) / this.cellSize);
    const maxCY = Math.floor((pos.y + radius) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const k = this.key(cx, cy);
        let cell = this.cells.get(k);
        if (!cell) {
          cell = [];
          this.cells.set(k, cell);
        } else if (this.cellFrameGen.get(k) !== this.frameGen) {
          // Cell exists but is from a previous frame — reuse array by resetting length
          cell.length = 0;
        }
        this.cellFrameGen.set(k, this.frameGen);
        cell.push(entity);
      }
    }
  }

  query(pos: Vec2, radius: number): Entity[] {
    const minCX = Math.floor((pos.x - radius) / this.cellSize);
    const minCY = Math.floor((pos.y - radius) / this.cellSize);
    const maxCX = Math.floor((pos.x + radius) / this.cellSize);
    const maxCY = Math.floor((pos.y + radius) / this.cellSize);

    this.currentGeneration++;
    const gen = this.currentGeneration;
    const result: Entity[] = [];
    const fg = this.frameGen;

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const k = this.key(cx, cy);
        if (this.cellFrameGen.get(k) !== fg) continue; // stale cell
        const cell = this.cells.get(k);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            const e = cell[i];
            if (this.entityGeneration.get(e) !== gen) {
              this.entityGeneration.set(e, gen);
              result.push(e);
            }
          }
        }
      }
    }
    return result;
  }
}
