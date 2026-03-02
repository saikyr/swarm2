import { SeededRNG } from '../utils/rng';

let rng: SeededRNG | null = null;

export function setSimulationSeed(seed: number): void {
  rng = new SeededRNG(seed | 0);
}

export function clearSimulationSeed(): void {
  rng = null;
}

export function simRandom(): number {
  return rng ? rng.next() : Math.random();
}

export function simRange(min: number, max: number): number {
  return min + simRandom() * (max - min);
}

export function simInt(min: number, max: number): number {
  return Math.floor(simRange(min, max + 1));
}

export function simChance(probability: number): boolean {
  return simRandom() < probability;
}

export function simPick<T>(arr: T[]): T {
  return arr[Math.floor(simRandom() * arr.length)];
}

export function simShuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(simRandom() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
