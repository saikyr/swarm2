import type { Entity } from '../ecs/entity';
import type { Vec2 } from '../utils/math';

export class SpatialHash {
  private cells = new Map<number, Entity[]>();
  // Track which query generation each entity was last seen in, to avoid Set allocation
  private entityGeneration = new Map<Entity, number>();
  private currentGeneration = 0;

  constructor(private cellSize: number) {}

  private key(cx: number, cy: number): number {
    const a = cx + 50000;
    const b = cy + 50000;
    return a * 100001 + b;
  }

  clear(): void {
    this.cells.clear();
    this.entityGeneration.clear();
    this.currentGeneration = 0;
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
        }
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

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
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
